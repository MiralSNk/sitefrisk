package helpers

import (
	"context"
	"log/slog"
)

// TimeFormat - RFC3339 с миллисекундами. В UTC смещение рендерится как "Z".
const TimeFormat = "2006-01-02T15:04:05.000Z07:00"

// CtxKey - приватный тип ключа. Свой кастомный тип,
// чтобы никакой другой пакет не смог случайно перезаписать значение в контексте
type CtxKey = struct{}

// FormatContext - достает атрибуты из контекста
func FormatContext(ctx context.Context) []slog.Attr {
	attrs, _ := ctx.Value(CtxKey{}).([]slog.Attr)
	return attrs
}
