package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/factory"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/handlers"
	logging "github.com/MiralSNk/sitefrisk/services/scanner/internal/logging/context"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/middleware"
)

func main() {
	log := logging.New("scanner")

	if err := run(log); err != nil {
		log.Error("fatal", slog.String("err", err.Error()))
		os.Exit(0)
	}
}

func run(log *slog.Logger) error {
	port := os.Getenv("SCANNER_PORT")
	if port == "" {
		return errors.New("port is not set")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/scan", handlers.Scan(factory.Registrations))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           middleware.Chain(mux, middleware.Trace(log)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// SIGTERM приходит от `docker compose stop`. Без обработки процесс
	// умирает мгновенно, обрывая запросы на полпути.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		log.Info("scanner started", slog.String("port", port))
		// ErrServerClosed — штатный ответ на Shutdown
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		log.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown ждёт завершения активных запросов, новые не принимает.
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}

	log.Info("scanner stopped")
	return nil
}
