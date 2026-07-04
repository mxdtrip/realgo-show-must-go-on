package server

import (
	"net/http"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

// healthHandler serves the liveness and readiness probes.
type healthHandler struct {
	pg    *postgres.Storage
	redis *redis.Storage
}

// live reports that the process is up. It does not touch dependencies, so it
// stays green during a transient Postgres or Redis outage.
func (h *healthHandler) live(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ready reports whether the service can serve traffic: both Postgres and Redis
// must answer a ping.
func (h *healthHandler) ready(w http.ResponseWriter, r *http.Request) {
	if h.pg == nil {
		response.Fail(w, http.StatusServiceUnavailable, "postgres_unavailable", "postgres is not configured")
		return
	}
	if h.redis == nil {
		response.Fail(w, http.StatusServiceUnavailable, "redis_unavailable", "redis is not configured")
		return
	}
	if err := h.pg.Pool.Ping(r.Context()); err != nil {
		response.Fail(w, http.StatusServiceUnavailable, "postgres_unavailable", "postgres is not reachable")
		return
	}
	if err := h.redis.Client.Ping(r.Context()).Err(); err != nil {
		response.Fail(w, http.StatusServiceUnavailable, "redis_unavailable", "redis is not reachable")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
