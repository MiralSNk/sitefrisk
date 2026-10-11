package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/logging"
)

// headerTraceparent — стандарт W3C Trace Context.
// Формат: <версия 2>-<trace-id 32>-<parent-id 16>-<флаги 2>, всё lowercase hex.
const headerTraceparent = "traceparent"

// Trace — обёртка, которая обеспечивает сквозной trace_id и логирует запрос.
//
// Что делает:
//  1. читает traceparent от вызывающего и проверяет его на валидность;
//  2. если заголовка нет или он битый — начинает новую трассу;
//  3. всегда генерирует свой span_id: он идентифицирует ЭТОТ хоп, не всю трассу;
//  4. кладёт оба в контекст, чтобы они попали в каждую запись лога;
//  5. возвращает traceparent в ответе — чтобы фронт показал id пользователю.
func Trace(log *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			traceID, _, ok := parseTraceparent(r.Header.Get(headerTraceparent))
			if !ok {
				traceID = randomHex(16) // 16 байт -> 32 hex
			}
			spanID := randomHex(8) // 8 байт -> 16 hex

			ctx := r.Context()
			if traceID != "" {
				ctx = logging.With(ctx,
					slog.String("trace_id", traceID),
					slog.String("span_id", spanID),
				)
				w.Header().Set(headerTraceparent, "00-"+traceID+"-"+spanID+"-01")
			}
			r = r.WithContext(ctx)

			sw := &statusWriter{ResponseWriter: w}
			start := time.Now()

			log.InfoContext(ctx, "request started",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
			)

			next.ServeHTTP(sw, r)

			log.InfoContext(ctx, "request finished",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", sw.Status()),
				slog.Int("bytes", sw.bytes),
				slog.Int64("duration_ms", time.Since(start).Milliseconds()),
			)
		})
	}
}

// parseTraceparent разбирает и проверяет заголовок.
// Заголовок приходит извне, то есть от недоверенного источника — та же
// логика, что в ssrf.checkURL: не доверяем, а валидируем.
func parseTraceparent(v string) (traceID, spanID string, ok bool) {
	parts := strings.Split(v, "-")
	if len(parts) != 4 {
		return "", "", false
	}

	version, trace, parent, flags := parts[0], parts[1], parts[2], parts[3]
	if len(version) != 2 || len(trace) != 32 || len(parent) != 16 || len(flags) != 2 {
		return "", "", false
	}

	for _, p := range parts {
		if !isLowerHex(p) {
			return "", "", false
		}
	}
	if version == "ff" { // запрещено спецификацией, ибо нефиг
		return "", "", false
	}
	if isAllZero(trace) || isAllZero(parent) { // тоже запрещено, ибо нефиг
		return "", "", false
	}

	return trace, parent, true
}

func isLowerHex(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

func isAllZero(s string) bool {
	return strings.Count(s, "0") == len(s)
}

// randomHex возвращает n случайных байт в hex.
// crypto/rand, а не math/rand: trace_id уезжает в ответ пользователю,
// а предсказуемые идентификаторы в сервисе безопасности — плохой тон.
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// Начиная с Go 1.24 это невозможно. На более старых версиях
		// отдаём пустую строку: лучше запрос без trace_id, чем 500.
		return ""
	}
	return hex.EncodeToString(b)
}
