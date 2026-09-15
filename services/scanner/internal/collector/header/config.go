package header

import "time"

const (
	// Стандартное время ожидания соединения
	DefaultTimeout = 30 * time.Second
)

var headerKeys = [...]string{
	"Content-Security-Policy",
	"Strict-Transport-Security",
	"X-Frame-Options",
}
