// Package migrations embeds the SQL migration files so they can be applied by
// tests via golang-migrate's iofs source, without depending on the working
// directory or a file:// path.
package migrations

import "embed"

// FS holds every *.sql migration in this directory, embedded at build time.
//go:embed *.sql
var FS embed.FS
