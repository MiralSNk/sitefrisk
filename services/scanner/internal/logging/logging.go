package logging

import (
	"context"
	"log/slog"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/logging/helpers"
)

// With - возвращает контекст с добавленными атрибутами.
// Они попадут в каждую запись, сделанную с этим контекстом — в текущей функции и во всех вложенных.
//
// Срез копируется, а не дописывается на месте: родительский контекст может
// быть расшарен между горутинами, и append в общий бэкинг-массив — гонка.
func With(ctx context.Context, attrs ...slog.Attr) context.Context {
	if len(attrs) == 0 {
		return ctx
	}

	prev := helpers.FormatContext(ctx)
	merged := make([]slog.Attr, 0, len(prev)+len(attrs))
	merged = append(merged, prev...)
	merged = append(merged, attrs...)
	return context.WithValue(ctx, helpers.CtxKey{}, merged)
}
