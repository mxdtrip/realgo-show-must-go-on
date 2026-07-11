package redis

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
)

func TestStorageSaveGet(t *testing.T) {
	ctx := context.Background()
	container, err := tcredis.Run(ctx, "redis:7-alpine")
	if err != nil {
		t.Skipf("start redis: %v", err)
	}
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(container) })

	host, err := container.Host(ctx)
	require.NoError(t, err)
	port, err := container.MappedPort(ctx, "6379/tcp")
	require.NoError(t, err)

	store, err := New(ctx, &config.Redis{Host: host, Port: port.Port()})
	require.NoError(t, err)
	t.Cleanup(func() { _ = store.Close() })

	require.NoError(t, store.Save(ctx, "test:raw", []byte("value"), time.Minute))

	raw, err := store.Get(ctx, "test:raw")
	require.NoError(t, err)
	require.Equal(t, []byte("value"), raw)

	require.NoError(t, store.SaveJSON(ctx, "test:object", map[string]any{"id": 42, "name": "FreeBurger"}, time.Minute))

	got, err := store.GetJSON(ctx, "test:object")
	require.NoError(t, err)
	require.Equal(t, map[string]any{"id": json.Number("42"), "name": "FreeBurger"}, got)

	id, err := got["id"].(json.Number).Int64()
	require.NoError(t, err)
	require.Equal(t, int64(42), id)

	locked, err := store.Locked(ctx, "test:lock")
	require.NoError(t, err)
	require.False(t, locked)

	acquired, err := store.TryLock(ctx, "test:lock", time.Minute)
	require.NoError(t, err)
	require.True(t, acquired, "first TryLock should acquire the lock")

	acquired, err = store.TryLock(ctx, "test:lock", time.Minute)
	require.NoError(t, err)
	require.False(t, acquired, "second TryLock must not acquire an already-held lock")

	locked, err = store.Locked(ctx, "test:lock")
	require.NoError(t, err)
	require.True(t, locked)

	require.NoError(t, store.Unlock(ctx, "test:lock"))

	acquired, err = store.TryLock(ctx, "test:lock", time.Minute)
	require.NoError(t, err)
	require.True(t, acquired, "TryLock should acquire again after Unlock")
}
