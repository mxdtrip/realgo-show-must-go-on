package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	// Embed the IANA time zone database so time.LoadLocation-based validation
	// works identically in every runtime, including minimal container images.
	_ "time/tzdata"

	"github.com/mxdtrip/freeburger/services/api/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx); err != nil {
		slog.Error("api exited with error", slog.Any("err", err))
		os.Exit(1)
	}
}
