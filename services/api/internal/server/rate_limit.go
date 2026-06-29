package server

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	redisstore "github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

const rateLimitScript = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
	ttl = tonumber(ARGV[1])
end
return {count, ttl}
`

func rateLimit(store *redisstore.Storage, namespace string, limit int64, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if store == nil || store.Client == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := fmt.Sprintf("rate:%s:%s:%s:%s", namespace, r.Method, r.URL.Path, clientIP(r))
			count, retryAfter, err := incrementRateLimit(store, r, key, window)
			if err != nil {
				response.Fail(w, http.StatusServiceUnavailable, "rate_limit_unavailable", "rate limit service is unavailable")
				return
			}
			remaining := max(0, limit-count)
			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			if count > limit {
				w.Header().Set("Retry-After", strconv.FormatInt(ceilSeconds(retryAfter), 10))
				response.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func incrementRateLimit(store *redisstore.Storage, r *http.Request, key string, window time.Duration) (int64, time.Duration, error) {
	result, err := store.Client.Eval(r.Context(), rateLimitScript, []string{key}, window.Milliseconds()).Result()
	if err != nil {
		return 0, 0, err
	}
	values, ok := result.([]interface{})
	if !ok || len(values) != 2 {
		return 0, 0, fmt.Errorf("unexpected rate limit result: %T", result)
	}
	count, err := redisInt64(values[0])
	if err != nil {
		return 0, 0, err
	}
	ttlMillis, err := redisInt64(values[1])
	if err != nil {
		return 0, 0, err
	}
	return count, time.Duration(ttlMillis) * time.Millisecond, nil
}

func redisInt64(v any) (int64, error) {
	switch value := v.(type) {
	case int64:
		return value, nil
	case string:
		return strconv.ParseInt(value, 10, 64)
	default:
		return 0, fmt.Errorf("unexpected redis integer type: %T", v)
	}
}

func ceilSeconds(d time.Duration) int64 {
	if d <= 0 {
		return 1
	}
	return int64((d + time.Second - 1) / time.Second)
}

func clientIP(r *http.Request) string {
	remote := hostOnly(r.RemoteAddr)
	if remote == "" {
		return "unknown"
	}
	if !isTrustedProxy(remote) {
		return remote
	}
	if forwarded := firstForwardedFor(r.Header.Get("Forwarded")); forwarded != "" {
		return forwarded
	}
	if forwarded := firstXForwardedFor(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		return forwarded
	}
	return remote
}

func hostOnly(addr string) string {
	host := addr
	if ip, _, err := net.SplitHostPort(addr); err == nil {
		host = ip
	}
	host = strings.Trim(host, "[]")
	if host == "" {
		return ""
	}
	return host
}

func isTrustedProxy(host string) bool {
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast())
}

func firstXForwardedFor(header string) string {
	for _, part := range strings.Split(header, ",") {
		if host := hostOnly(strings.TrimSpace(part)); net.ParseIP(host) != nil {
			return host
		}
	}
	return ""
}

func firstForwardedFor(header string) string {
	for _, part := range strings.Split(header, ",") {
		for _, param := range strings.Split(part, ";") {
			key, value, ok := strings.Cut(strings.TrimSpace(param), "=")
			if !ok || !strings.EqualFold(key, "for") {
				continue
			}
			host := hostOnly(strings.Trim(strings.TrimSpace(value), `"`))
			if net.ParseIP(host) != nil {
				return host
			}
		}
	}
	return ""
}
