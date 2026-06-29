package server

import (
	"net/http"
	"testing"
)

func TestClientIPIgnoresForwardedHeadersFromUntrustedRemote(t *testing.T) {
	req := &http.Request{
		RemoteAddr: "203.0.113.10:12345",
		Header: http.Header{
			"X-Forwarded-For": []string{"198.51.100.77"},
			"Forwarded":       []string{`for=198.51.100.88`},
		},
	}

	if got := clientIP(req); got != "203.0.113.10" {
		t.Fatalf("clientIP = %q, want socket remote IP", got)
	}
}

func TestClientIPUsesXForwardedForFromTrustedProxy(t *testing.T) {
	req := &http.Request{
		RemoteAddr: "10.0.0.5:12345",
		Header: http.Header{
			"X-Forwarded-For": []string{"198.51.100.77, 10.0.0.5"},
		},
	}

	if got := clientIP(req); got != "198.51.100.77" {
		t.Fatalf("clientIP = %q, want first forwarded client IP", got)
	}
}

func TestClientIPUsesForwardedHeaderFromTrustedProxy(t *testing.T) {
	req := &http.Request{
		RemoteAddr: "127.0.0.1:12345",
		Header: http.Header{
			"Forwarded": []string{`for="198.51.100.88";proto=https`},
		},
	}

	if got := clientIP(req); got != "198.51.100.88" {
		t.Fatalf("clientIP = %q, want Forwarded header client IP", got)
	}
}

func TestCeilSeconds(t *testing.T) {
	if got := ceilSeconds(1500 * 1000 * 1000); got != 2 {
		t.Fatalf("ceilSeconds = %d, want 2", got)
	}
}
