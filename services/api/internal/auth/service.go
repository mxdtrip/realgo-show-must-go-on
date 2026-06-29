package auth

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

const minPasswordLen = 8
const maxPasswordBytes = 72

// Service implements registration, authentication and the token lifecycle.
type Service struct {
	queries *db.Queries
	redis   *goredis.Client
	cfg     Config
	now     func() time.Time
}

// NewService wires the auth service over the user store and Redis.
func NewService(queries *db.Queries, redis *goredis.Client, cfg Config) *Service {
	return &Service{
		queries: queries,
		redis:   redis,
		cfg:     cfg,
		now:     time.Now,
	}
}

// Register validates the input, creates a user and issues a token pair.
func (s *Service) Register(ctx context.Context, email, password string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if len(password) < minPasswordLen {
		return db.User{}, TokenPair{}, ErrWeakPassword
	}
	if len(password) > maxPasswordBytes {
		return db.User{}, TokenPair{}, ErrPasswordTooLong
	}

	hash, err := hashPassword(password)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{Email: normalized, PasswordHash: hash})
	if err != nil {
		if isUniqueViolation(err) {
			return db.User{}, TokenPair{}, ErrEmailTaken
		}
		return db.User{}, TokenPair{}, err
	}

	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
		defer cancel()
		_ = s.queries.DeleteUserByID(cleanupCtx, user.ID)
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// Login verifies credentials and issues a token pair. It returns
// ErrInvalidCredentials for both an unknown email and a wrong password so the
// endpoint does not leak which accounts exist.
func (s *Service) Login(ctx context.Context, email, password string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}

	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, TokenPair{}, ErrInvalidCredentials
		}
		return db.User{}, TokenPair{}, err
	}
	if !checkPassword(user.PasswordHash, password) {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}

	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// Refresh rotates a refresh token and issues a fresh token pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	userID, newRefreshToken, err := s.rotateRefreshToken(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	access, err := s.issueAccessToken(userID, s.now())
	if err != nil {
		return TokenPair{}, err
	}
	return s.tokenPair(access, newRefreshToken), nil
}

// Logout revokes a refresh token.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.revokeRefreshToken(ctx, refreshToken)
}

// UserByID loads the user behind an authenticated request.
func (s *Service) UserByID(ctx context.Context, id int64) (db.User, error) {
	user, err := s.queries.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

func normalizeEmail(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
