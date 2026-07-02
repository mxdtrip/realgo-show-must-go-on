// Package specifications holds acceptance-test specifications written in the
// domain language, free of any I/O. A specification is a function that drives a
// HarnessProvider and asserts essential behaviour. It is reused by every driver
// (HTTP today, and any future one), so the spec stays ignorant of transport.
package specifications

import (
	"strings"
	"testing"
)

// HarnessProvider is the contract a driver fulfils so that a specification can
// exercise the system. The driver owns all I/O (transport, server lifecycle);
// the spec speaks only in domain terms.
type HarnessProvider interface {
	// Register creates a fresh account and returns an authenticated handle to it.
	Register(t *testing.T, email, password string) AuthenticatedUser
}

// AuthenticatedUser is an already-logged-in actor the spec can interrogate.
type AuthenticatedUser interface {
	// OwnIdentity returns the user's identity as the system reports it back to
	// them (e.g. the email a GET /me echoes). It is the strongest cheap
	// invariant for "the pipeline works end to end".
	OwnIdentity(t *testing.T) string
}

// HarnessSpecification is the walking-skeleton acceptance test: a freshly
// registered user must be able to read their own identity. It is deliberately
// minimal — it proves the whole pipeline (register -> bearer auth -> identity)
// without asserting on any feature's data. Cards specs layer on top later.
func HarnessSpecification(t *testing.T, p HarnessProvider) {
	t.Helper()
	t.Run("freshly registered user can read their own identity", func(t *testing.T) {
		email := uniqueEmail(t)
		user := p.Register(t, email, "AcceptanceTest-2026!")
		if got := user.OwnIdentity(t); got != email {
			t.Fatalf("expected identity %q, got %q", email, got)
		}
	})
}

// uniqueEmail derives a valid, test-local email from the running test's name so
// parallel/sub-tests never collide on the users.email unique constraint. It
// only needs to be valid and stable within a single test (the harness wipes
// users between tests), not globally unique.
func uniqueEmail(t *testing.T) string {
	t.Helper()
	var b strings.Builder
	for _, r := range strings.ToLower(t.Name()) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteRune('.')
		}
	}
	local := strings.Trim(b.String(), ".")
	for strings.Contains(local, "..") {
		local = strings.ReplaceAll(local, "..", ".")
	}
	if len(local) > 48 { // keep within the 64-char local-part limit with margin
		local = local[:48]
	}
	return local + "@acceptance.test"
}
