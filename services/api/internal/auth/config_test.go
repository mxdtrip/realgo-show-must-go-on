package auth

import "testing"

func TestLoadConfigRejectsPlaceholderSecret(t *testing.T) {
	t.Setenv("AUTH_JWT_SECRET", placeholderSecret)

	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected placeholder JWT secret to be rejected")
	}
}

func TestLoadConfigAcceptsStrongSecret(t *testing.T) {
	t.Setenv("AUTH_JWT_SECRET", "a-real-test-secret-with-enough-random-looking-bytes")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if len(cfg.JWTSecret) == 0 {
		t.Fatal("JWTSecret was not populated")
	}
}
