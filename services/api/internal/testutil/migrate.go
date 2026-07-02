package testutil

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // registers the "postgres" database driver
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/mxdtrip/freeburger/services/api/migrations"
)

// ApplyMigrations runs all embedded up-migrations against the given database.
// connStr must be a postgres:// URL acceptable to the migrate postgres driver
// (e.g. "postgres://user:pass@host:port/dbname?sslmode=disable"); pgx's
// "host=... port=..." DSN form will NOT work here.
//
// ErrNoChange (DB already fully migrated) is treated as success.
func ApplyMigrations(connStr string) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("build migrate source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, connStr)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
