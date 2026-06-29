package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndCheckPassword(t *testing.T) {
	const pw = "correct horse battery staple"

	hash, err := hashPassword(pw)
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}
	if hash == pw {
		t.Fatal("password stored in plaintext")
	}
	if !checkPassword(hash, pw) {
		t.Fatal("checkPassword rejected the correct password")
	}
	if checkPassword(hash, "wrong password") {
		t.Fatal("checkPassword accepted a wrong password")
	}
}

func TestRegisterRejectsPasswordLongerThanBcryptLimit(t *testing.T) {
	s := testService()
	_, _, err := s.Register(t.Context(), "user@example.com", strings.Repeat("a", maxPasswordBytes+1))
	if !errors.Is(err, ErrPasswordTooLong) {
		t.Fatalf("Register error: want %v, got %v", ErrPasswordTooLong, err)
	}
}
