package main_test

import (
	"context"
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/specifications"
	httpdriver "github.com/mxdtrip/freeburger/services/api/internal/testdriver/http"
	"github.com/mxdtrip/freeburger/services/api/internal/testutil"
)

// harness is the shared testcontainer pair, booted once in TestMain and reused
// across every acceptance test in this package. Per-test isolation comes from
// harness.Reset, not from fresh containers (too slow for the inner loop).
var harness *testutil.Harness

// TestMain boots the Postgres+Redis harness once for the package. Under -short
// it skips the boot entirely so the fast unit loop (go test -short ./...) needs
// no Docker.
func TestMain(m *testing.M) {
	// When TestMain is called, flag.Parse has not been run, and testing.Short
	// panics until it has (see Go testing docs). Parse explicitly.
	flag.Parse()

	if testing.Short() {
		os.Exit(m.Run())
	}

	h, err := testutil.Start(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "acceptance: failed to start harness:", err)
		os.Exit(1)
	}
	harness = h

	code := m.Run()
	harness.Stop()
	os.Exit(code)
}

// TestAcceptance_HarnessWalkingSkeleton is the Plan 0 deliverable: prove the
// whole pipeline lives. testcontainers PG16+Redis7 -> real server.New under
// httptest -> real POST /auth/register yields a JWT -> GET /me with Bearer
// returns the registered email. Nothing is stubbed.
func TestAcceptance_HarnessWalkingSkeleton(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	harness.Reset(t)

	d := httpdriver.New(t, harness)
	defer d.Close()

	specifications.HarnessSpecification(t, d)
}
