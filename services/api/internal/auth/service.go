package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

const minPasswordLen = 8
const maxPasswordBytes = 72

// A valid pre-computed bcrypt hash keeps the unknown-account login path close
// in cost to the wrong-password path. Its plaintext is irrelevant and is never
// used by the application.
const dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

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
	if err := validatePassword(password); err != nil {
		return db.User{}, TokenPair{}, err
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
			_ = checkPassword(dummyPasswordHash, password)
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
	// Redis can outlive a user row (for example after an account deletion on an
	// older deployment). Never consume and renew such a zombie session.
	userID, err := s.refreshTokenUserID(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	if _, err := s.queries.GetUserByID(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = s.revokeRefreshToken(ctx, refreshToken)
			return TokenPair{}, ErrInvalidToken
		}
		return TokenPair{}, err
	}

	rotatedUserID, newRefreshToken, err := s.rotateRefreshToken(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	if rotatedUserID != userID {
		_ = s.revokeRefreshToken(ctx, newRefreshToken)
		return TokenPair{}, ErrInvalidToken
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

// NewSession issues an independent token pair for an already authenticated
// user. Browser surfaces use it to avoid sharing one rotating refresh token.
func (s *Service) NewSession(ctx context.Context, userID int64) (TokenPair, error) {
	if _, err := s.queries.GetUserByID(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TokenPair{}, ErrInvalidToken
		}
		return TokenPair{}, err
	}
	return s.issueTokens(ctx, userID, s.now())
}

// ChangePassword verifies the current password and stores a freshly hashed new
// password. Revoking sessions remains a separate explicit operation so adding
// this endpoint does not unexpectedly sign other clients out.
func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	if !checkPassword(user.PasswordHash, currentPassword) {
		return ErrInvalidCredentials
	}
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	rows, err := s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: userID, PasswordHash: hash})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrInvalidToken
	}
	return nil
}

// RevokeAllSessions invalidates all refresh sessions for userID, including
// legacy sessions created before the per-user Redis index existed.
func (s *Service) RevokeAllSessions(ctx context.Context, userID int64) error {
	return s.revokeAllRefreshTokens(ctx, userID)
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
	Platform          *string
	TargetTopics      *[]string
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
	if u.Platform != nil {
		params.Platform = pgtype.Text{String: *u.Platform, Valid: true}
	}
	if u.TargetTopics != nil {
		params.TargetTopics = *u.TargetTopics
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

// DeleteAccount permanently removes the user and all cascading/user-originated
// activity after verifying the account password. Every refresh session is
// revoked before the account row is removed.
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
	if err := s.revokeAllRefreshTokens(ctx, userID); err != nil {
		return err
	}
	if err := s.deleteAccountData(ctx, userID); err != nil {
		return err
	}
	// Retained in the method/wire contract for older clients; all tokens were
	// already revoked via the user index and legacy scan above.
	_ = refreshToken
	return nil
}

// deleteAccountData erases payload-bearing child rows before the user row in
// one transaction. Separate statements are intentional: data-modifying CTEs
// execute in an unspecified order, which can race the children's ON DELETE
// SET NULL actions and leave the payload rows behind.
func (s *Service) deleteAccountData(ctx context.Context, userID int64) (err error) {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin account deletion: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil && !errors.Is(rollbackErr, pgx.ErrTxClosed) {
			err = errors.Join(err, fmt.Errorf("rollback account deletion: %w", rollbackErr))
		}
	}()

	q := s.queries.WithTx(tx)
	if _, err := q.LockUserForDeletion(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return fmt.Errorf("lock user for deletion: %w", err)
	}
	if err := q.DeleteExtensionEventsByUserID(ctx, userID); err != nil {
		return fmt.Errorf("delete extension events: %w", err)
	}
	if err := q.DeleteAIRequestLogsByUserID(ctx, userID); err != nil {
		return fmt.Errorf("delete AI request logs: %w", err)
	}
	if err := q.DeleteUserByID(ctx, userID); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit account deletion: %w", err)
	}
	committed = true
	return nil
}

func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < minPasswordLen {
		return ErrWeakPassword
	}
	if len(password) > maxPasswordBytes {
		return ErrPasswordTooLong
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
