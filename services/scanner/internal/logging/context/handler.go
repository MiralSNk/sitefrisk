package context

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/logging/helpers"
)

// Handler - подмешивает в забись атрибуты из контекста
type Handler struct {
	slog.Handler
}

// New собирает логгер сервиса.
// Читает LOG_LEVEL и LOG_FORMAT из окружения.
func New(service string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level:       parseLevel(os.Getenv("LOG_LEVEL")),
		ReplaceAttr: rename,
	}

	var base slog.Handler
	if strings.EqualFold(os.Getenv("LOG_FORMAT"), "text") {
		base = slog.NewTextHandler(os.Stdout, opts)
	} else {
		base = slog.NewJSONHandler(os.Stdout, opts)
	}

	return slog.New(Handler{Handler: base}).With(slog.String("service", service))
}

func (h Handler) Handle(ctx context.Context, r slog.Record) error {
	r.AddAttrs(helpers.FormatContext(ctx)...)
	return h.Handler.Handle(ctx, r)
}

// WithAttrs и WithGroup переопределены намеренно.
// Встроенный slog.Handler вернул бы внутренний обработчик, и обёртка
// потерялась бы — logger.With(...) перестал бы читать контекст.
// так что анлак, приходится переопределять
func (h Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return Handler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h Handler) WithGroup(name string) slog.Handler {
	return Handler{Handler: h.Handler.WithGroup(name)}
}

// rename приводит стандартные ключи slog к контракту.
func rename(_ []string, a slog.Attr) slog.Attr {
	switch a.Key {
	case slog.TimeKey:
		return slog.String("ts", a.Value.Time().UTC().Format(helpers.TimeFormat))
	case slog.LevelKey:
		return slog.String("level", strings.ToLower(a.Value.String()))
	default:
		return a
	}
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
