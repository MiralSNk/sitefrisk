package ssrf

import (
	"log/slog"
	"strconv"
)

// logger — логгер пакета. По умолчанию slog.Default().
// Меняется через SetLogger. Меняйте один раз при старте, до запуска горутин.
var logger *slog.Logger = slog.Default()

// SetLogger устанавливает логгер пакета. nil сбрасывает на slog.Default().
//
// Не потокобезопасно — вызывайте один раз при инициализации приложения.
func SetLogger(l *slog.Logger) {
	if l == nil {
		l = slog.Default()
	}
	logger = l
}

// allowedPorts — белый список разрешённых портов.
// nil или пустая map означает "разрешить все порты".
var allowedPorts = map[string]struct{}{
	"80":   {},
	"443":  {},
	"8080": {},
	"8443": {},
}

// SetAllowedPorts заменяет белый список разрешённых портов.
//
// Без аргументов — разрешает все порты (полезно в тестах и для доверенных сценариев).
// По умолчанию: 80, 443, 8080, 8443.
//
// Не потокобезопасно — вызывайтся один раз при инициализации приложения.
func SetAllowedPorts(ports ...int) {
	if len(ports) == 0 {
		allowedPorts = nil
		return
	}
	m := make(map[string]struct{}, len(ports))
	for _, p := range ports {
		m[strconv.Itoa(p)] = struct{}{}
	}
	allowedPorts = m
}
