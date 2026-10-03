package ssrf

import (
	"errors"
	"fmt"
	"net"
)

var ( // -> Кастомные ошибки
	// ErrTooManyRedirects возвращается, когда SafeGet превышает maxRedirects. (Проверка errors.Is)
	ErrTooManyRedirects = errors.New("слишком много редиректов")
	// ErrBlockedAddress возвращается, когда хост указывает на запрещенный IP. (Проверка errors.Is)
	ErrBlockedAddress = errors.New("заблокированный адрес")
	// ErrEmptyHost - возвращается, когда host пустой. (Проверка errors.Is)
	ErrEmptyHost = errors.New("пустой host")
	// ErrEmptyClient - возвращается, когда клиент пустой или nil. (Проверка errors.Is)
	ErrEmptyClient = errors.New("пустой клиент")
	// ErrCheckRedirectClient - возвращается, когда CheckRedirect не установлен. (Проверка errors.Is)
	ErrCheckRedirectClient = errors.New("client.CheckRedirect должен быть установлен; используйте SafeClient()")

	// ErrForbiddenScheme возвращается, когда URL использует схему, отличную от http/https. (Проверка errors.Is)
	ErrForbiddenScheme = errors.New("запрещённая схема")
	// ErrForbiddenPort возвращается, когда порт URL не входит в белый список. (Проверка errors.Is)
	ErrForbiddenPort = errors.New("запрещённый порт")

	// ErrBodyNotSupported возвращается когда идет запрос к телу, которого никогда не будет!
	ErrBodyNotSupported = errors.New("тело запроса не поддерживается")
	// ErrEmptyRequest возвращается при пустом запросе
	ErrEmptyRequest = errors.New("пустой запрос")
)

// BlockedAddressError содержит сведения об отклоненном адресе. (Проверка errors.As)
type BlockedAddressError struct {
	Host   string
	IP     net.IP
	Reason string
}

func (e *BlockedAddressError) Error() string {
	return fmt.Sprintf("host %q разрешается в заблокированный IP %s (%s)", e.Host, e.IP, e.Reason)
}

func (e *BlockedAddressError) Unwrap() error { return ErrBlockedAddress }

// isBlocked сообщает, находится ли IP-адрес в диапазоне, запросы с которого запрещены,
// и возвращает понятное пользователю обоснование.
func isBlocked(ip net.IP) (string, bool) {
	switch {
	case ip.IsLoopback():
		return "loopback", true
	case ip.IsPrivate():
		return "private", true
	case ip.IsLinkLocalUnicast():
		return "link-local unicast", true
	case ip.IsLinkLocalMulticast():
		return "link-local multicast", true
	case ip.IsUnspecified():
		return "unspecified", true
	case ip.IsMulticast():
		return "multicast", true
	}

	return "", false
}
