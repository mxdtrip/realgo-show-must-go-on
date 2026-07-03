package testutil

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // registers the "postgres" database driver
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/mxdtrip/freeburger/services/api/migrations"
)

// ApplyMigrations применяет все встроенные up-миграции к указанной базе данных.
//
// connStr должен быть URL в формате postgres://, поддерживаемом драйвером
// postgres библиотеки migrate (например,
// "postgres://user:pass@host:port/dbname?sslmode=disable").
// DSN в формате pgx ("host=... port=...") здесь НЕ поддерживается.
//
// Ошибка ErrNoChange (база уже полностью мигрирована) считается успешным
// результатом.
func ApplyMigrations(connStr string) (err error) {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("build migrate source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, connStr)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer func() {
		sourceErr, databaseErr := m.Close()
		if sourceErr != nil {
			err = errors.Join(err, fmt.Errorf("close migration source: %w", sourceErr))
		}
		if databaseErr != nil {
			err = errors.Join(err, fmt.Errorf("close migration database: %w", databaseErr))
		}
	}()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
