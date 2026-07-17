package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errTransactionsUnsupported = errors.New("database handle does not support transactions")

type transactionBeginner interface {
	Begin(context.Context) (pgx.Tx, error)
}

var _ transactionBeginner = (*pgxpool.Pool)(nil)

// BeginTx exposes transaction creation without leaking the generated Queries
// implementation detail to domain packages. Queries created from pgxpool.Pool
// support it; Queries already bound to a transaction intentionally do not.
func (q *Queries) BeginTx(ctx context.Context) (pgx.Tx, error) {
	beginner, ok := q.db.(transactionBeginner)
	if !ok {
		return nil, errTransactionsUnsupported
	}
	return beginner.Begin(ctx)
}
