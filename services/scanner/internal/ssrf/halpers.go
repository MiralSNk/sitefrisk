package ssrf

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
)

// normalizeHost срезает порт и тримит пробелы.
func normalizeHost(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		return h
	}
	return strings.Trim(host, "[]")
}

// validateScheme проверяет, что схема — http или https.
func validateScheme(u *url.URL) error {
	switch u.Scheme {
	case "http", "https":
		return nil
	default:
		return fmt.Errorf("%w: %q", ErrForbiddenScheme, u.Scheme)
	}
}

// validatePort проверяет порт (с учётом дефолтных для схемы) на белый список.
// Пустой allowedPorts = разрешить всё.
func validatePort(u *url.URL) error {
	if len(allowedPorts) == 0 {
		return nil
	}

	port := u.Port()
	if port == "" {
		if u.Scheme == "http" {
			port = "80"
		} else {
			port = "443"
		}
	}

	if _, ok := allowedPorts[port]; !ok {
		return fmt.Errorf("%w: %s", ErrForbiddenPort, port)
	}
	return nil
}

// checkIPs проверяет каждый IP на запрещённые диапазоны.
// Возвращает *BlockedAddressError на первом заблокированном.
func checkIPs(host string, ips []net.IP) error {
	for _, ip := range ips {
		if reason, blocked := isBlocked(ip); blocked {
			return &BlockedAddressError{Host: host, IP: ip, Reason: reason}
		}
	}
	return nil
}

// resolve резолвит host (IP-литерал или DNS-имя) в список IP.
func resolve(ctx context.Context, host string) ([]net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		return []net.IP{ip}, nil
	}

	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("resolve %q: %w", host, err)
	}
	if len(addrs) == 0 {
		return nil, fmt.Errorf("resolve %q: нет адресов", host)
	}

	ips := make([]net.IP, 0, len(addrs))
	for _, a := range addrs {
		ips = append(ips, a.IP)
	}
	return ips, nil
}

// checkURL парсит URL, проверяет схему, хост (SSRF) и порт.
//
// Проверка хоста здесь дублирует ту, что происходит внутри safeDialContext —
// это намеренный defense-in-depth: даёт быстрый отказ и логирование ДО того,
// как построен HTTP-запрос, не полагаясь только на последний рубеж в Transport.
//
// Логирует заблокированные попытки.
func checkURL(ctx context.Context, rawURL string) (*url.URL, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parse url %q: %w", rawURL, err)
	}

	if err := validateScheme(u); err != nil {
		logger.Warn("ssrf: запрещенная схема",
			"url", rawURL,
			"scheme", u.Scheme,
			"err", err.Error(),
		)
		return nil, err
	}

	if u.Host == "" {
		return nil, fmt.Errorf("%w: url %q", ErrEmptyHost, rawURL)
	}

	if _, err := ResolveAndCheck(ctx, u.Host); err != nil {
		var blocked *BlockedAddressError
		if errors.As(err, &blocked) {
			logger.Warn("ssrf: заблокированный адрес",
				"url", rawURL,
				"host", blocked.Host,
				"ip", blocked.IP.String(),
				"reason", blocked.Reason,
			)
		}
		return nil, fmt.Errorf("check %q: %w", u.Host, err)
	}

	if err := validatePort(u); err != nil {
		logger.Warn("ssrf: запрещенный порт",
			"url", rawURL,
			"port", u.Port(),
			"err", err.Error(),
		)
		return nil, err
	}

	return u, nil
}

// isRedirect сообщает, является ли ответ редиректом (3xx).
func isRedirect(resp *http.Response) bool {
	return resp.StatusCode >= 300 && resp.StatusCode < 400
}

// nextURL разрешает Location относительно текущего URL.
func nextURL(current *url.URL, resp *http.Response) (string, bool, error) {
	loc := resp.Header.Get("Location")
	if loc == "" {
		return "", false, nil
	}
	next, err := current.Parse(loc)
	if err != nil {
		return "", false, fmt.Errorf("parse redirect location %q: %w", loc, err)
	}
	return next.String(), true, nil
}

// sensitiveHeaders — заголовки, которые нельзя пересылать на другой хост
// при редиректе. Список соответствует внутреннему списку net/http
// (см. src/net/http/client.go: internalHeaders).
var sensitiveHeaders = map[string]struct{}{
	"Authorization":    {},
	"Www-Authenticate": {},
	"Cookie":           {},
	"Cookie2":          {},
}

// copyHeaders копирует заголовки из src в dst.
// Если stripSensitive == true, заголовки из sensitiveHeaders пропускаются.
func copyHeaders(dst, src http.Header, stripSensitive bool) {
	for k, vv := range src {
		if stripSensitive {
			if _, sensitive := sensitiveHeaders[http.CanonicalHeaderKey(k)]; sensitive {
				continue
			}
		}
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

// sameHost сравнивает два host:port без учёта регистра.
// Порт значим: смена порта — это смена origin.
func sameHost(a, b string) bool {
	return strings.EqualFold(a, b)
}
