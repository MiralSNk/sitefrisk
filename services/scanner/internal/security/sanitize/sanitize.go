package sanitize

import (
	"log/slog"
	"strings"
	"unicode"
)

// maxValueLen — предел длины Fact.Value после очистки. Защита от
// context-stuffing: цель кладёт в заголовок мегабайты текста, и это
// целиком летит в промпт ML-сервиса.
var maxValueLen = 2048

// SetMaxValueLen задаёт предел длины значения после Clean.
//
// Не потокобезопасно!! — вызывать один раз при инициализации
// (та же схема, что ssrf.SetAllowedPorts).
func SetMaxValueLen(n int) {
	maxValueLen = n
}

// logger — логгер пакета. Та же схема, что ssrf.SetLogger.
var logger *slog.Logger = slog.Default()

// SetLogger задаёт логгер пакета. nil сбрасывает на slog.Default().
func SetLogger(l *slog.Logger) {
	if l == nil {
		l = slog.Default()
	}
	logger = l
}

// Clean убирает из s управляющие и невидимые Unicode-символы
// (zero-width, RTL/LTR override и т.п. — техника маскировки текста от
// визуального ревью) и обрезает результат до maxValueLen рун.
//
// Обрезка идёт по рунам, не по байтам — обрезка по байтам могла бы
// разорвать multi-byte UTF-8 символ посередине и вернуть невалидную
// строку.
func Clean(s string) string {
	var b strings.Builder
	b.Grow(len(s))

	count := 0
	truncated := false
	for _, r := range s {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			continue
		}
		if count >= maxValueLen {
			truncated = true
			break
		}
		b.WriteRune(r)
		count++
	}

	if truncated {
		logger.Warn("sanitize: значение обрезано по длине", "max_len", maxValueLen)
	}

	return b.String()
}
