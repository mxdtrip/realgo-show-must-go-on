package auth

import (
	"testing"
	"time"
)

func testService() *Service {
	return &Service{
		cfg: Config{
			JWTSecret:  []byte("test-secret-at-least-16-bytes-long"),
			AccessTTL:  15 * time.Minute,
			RefreshTTL: time.Hour,
			Issuer:     issuer,
		},
		now: time.Now,
	}
}

func TestAccessTokenRoundTrip(t *testing.T) {
	s := testService()

	tok, err := s.issueAccessToken(42, time.Now())
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	id, err := s.ParseAccessToken(tok)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if id != 42 {
		t.Fatalf("got user id %d, want 42", id)
	}
}

func TestExpiredAccessTokenRejected(t *testing.T) {
	s := testService()

	// Issued two hours ago: expiry (issued + 15m) is well in the past.
	tok, err := s.issueAccessToken(7, time.Now().Add(-2*time.Hour))
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	if _, err := s.ParseAccessToken(tok); err == nil {
		t.Fatal("expected an expired token to be rejected")
	}
}

func TestTamperedAccessTokenRejected(t *testing.T) {
	s := testService()

	tok, err := s.issueAccessToken(1, time.Now())
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	if _, err := s.ParseAccessToken(tok + "tampered"); err == nil {
		t.Fatal("expected a tampered token to be rejected")
	}
}
