package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
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
		if cleanupErr := s.queries.DeleteUserByID(cleanupCtx, user.ID); cleanupErr != nil {
			slog.Error("auth: registration cleanup failed",
				slog.String("layer", "service"),
				slog.String("module", "auth"),
				slog.Any("err", cleanupErr),
				slog.Int64("user_id", user.ID),
			)
		}
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

// ProfileUpdate carries optional profile fields for a partial PATCH. A nil
// pointer means "not provided — keep the existing value"; a non-nil pointer
// (including an empty string) overwrites the column.
type ProfileUpdate struct {
	Timezone          *string
	InterviewDate     *time.Time
	PrepGoal          *string
	Grade             *string
	TargetCompany     *string
	TargetPosition    *string
	SetOnboardingDone bool
}

// UpdateProfile applies a partial profile update for the given user.
func (s *Service) UpdateProfile(ctx context.Context, userID int64, u ProfileUpdate) (db.User, error) {
	params := db.UpdateUserProfileParams{
		ID:                     userID,
		SetOnboardingCompleted: u.SetOnboardingDone,
	}
	if u.Timezone != nil {
		params.Timezone = pgtype.Text{String: *u.Timezone, Valid: true}
	}
	if u.InterviewDate != nil {
		params.InterviewDate = pgtype.Timestamptz{Time: *u.InterviewDate, Valid: true}
	}
	if u.PrepGoal != nil {
		params.PrepGoal = pgtype.Text{String: *u.PrepGoal, Valid: true}
	}
	if u.Grade != nil {
		params.Grade = pgtype.Text{String: *u.Grade, Valid: true}
	}
	if u.TargetCompany != nil {
		params.TargetCompany = pgtype.Text{String: *u.TargetCompany, Valid: true}
	}
	if u.TargetPosition != nil {
		params.TargetPosition = pgtype.Text{String: *u.TargetPosition, Valid: true}
	}

	user, err := s.queries.UpdateUserProfile(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

// NotificationSettings carries optional notification preferences. A nil pointer
// keeps the current preference.
type NotificationSettings struct {
	ReviewReminder *bool
	WeeklyDigest   *bool
	EmailEnabled   *bool
}

// UpdateNotificationSettings applies a partial notification-preference update
// in a single atomic statement.
func (s *Service) UpdateNotificationSettings(ctx context.Context, userID int64, ns NotificationSettings) (db.User, error) {
	params := db.UpdateNotificationSettingsParams{ID: userID}
	if ns.ReviewReminder != nil {
		params.ReviewReminder = pgtype.Bool{Bool: *ns.ReviewReminder, Valid: true}
	}
	if ns.WeeklyDigest != nil {
		params.WeeklyDigest = pgtype.Bool{Bool: *ns.WeeklyDigest, Valid: true}
	}
	if ns.EmailEnabled != nil {
		params.EmailEnabled = pgtype.Bool{Bool: *ns.EmailEnabled, Valid: true}
	}

	user, err := s.queries.UpdateNotificationSettings(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

// DeleteAccount permanently removes the user and all cascading data after
// verifying the account password. The caller's refresh token, when supplied, is
// revoked immediately; any other sessions expire with their refresh TTL because
// the account row (and its data) is gone.
func (s *Service) DeleteAccount(ctx context.Context, userID int64, password, refreshToken string) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	if !checkPassword(user.PasswordHash, password) {
		return ErrInvalidCredentials
	}
	if err := s.queries.DeleteUserByID(ctx, userID); err != nil {
		return err
	}
	if refreshToken != "" {
		// Best-effort: the account is already gone, so a revoke failure is not fatal.
		if revokeErr := s.revokeRefreshToken(ctx, refreshToken); revokeErr != nil {
			slog.Error("auth: delete account revoke refresh token failed",
				slog.String("layer", "service"),
				slog.String("module", "auth"),
				slog.Any("err", revokeErr),
				slog.Int64("user_id", userID),
			)
		}
	}
	return nil
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
