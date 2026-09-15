package header

import "errors"

var (
	// ErrRequest возвращается, когда не удалось собрать *http.Request
	// (например, некорректный URL). Исходная причина обёрнута через %w,
	// проверка через errors.Is.
	ErrRequest = errors.New("запрос не сформировался")

	// ErrResponse возвращается при ошибке сети или при блокировке запроса
	// SSRF-защитой. Исходная причина обёрнута через %w, поэтому
	// errors.Is(err, ssrf.ErrBlockedAddress) и
	// errors.As(err, &ssrf.BlockedAddressError{}) тоже сработают.
	// Проверка через errors.Is.
	ErrResponse = errors.New("соединение не установилось")
)
