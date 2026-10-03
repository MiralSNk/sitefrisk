package ssrf

import (
	"context"
	"fmt"
	"net"
	"net/http"
)

// ResolveAndCheck преобразует хост (который может включать порт) в список
// IP-адресов и проверяет, не входит ли ни один из них в запрещенный диапазон.
//
// IP-литералы проверяются без обращения к DNS.
//
// Если какой-либо адрес заблокирован, ResolveAndCheck возвращает *BlockedAddressError
// с оберткой ErrBlockedAddress.
// Если все адреса разрешены, возвращается полный список — вызывающие стороны не должны предполагать, что первый адрес будет использоваться сетевым стеком.
func ResolveAndCheck(ctx context.Context, host string) ([]net.IP, error) {
	host = normalizeHost(host)
	if host == "" {
		return nil, ErrEmptyHost
	}

	ips, err := resolve(ctx, host)
	if err != nil {
		return nil, err
	}
	if err := checkIPs(host, ips); err != nil {
		return nil, err
	}
	return ips, nil
}

// SafeClient возвращает http.Client, который:
//
//   - не следует за редиректами автоматически (это делает SafeGet);
//   - проверяет каждый IP в момент установки TCP-соединения через
//     safeDialContext, закрывая DNS rebinding.
//
// Даже если вызывающий код обратится к client.Do напрямую, в обход SafeGet,
// SSRF-проверка всё равно сработает на уровне DialContext.
func SafeClient() *http.Client {
	transport := &http.Transport{
		DialContext: safeDialContext,
	}

	return &http.Client{
		Transport: transport,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

// SafeDo выполняет req, проверяя каждый хоп (включая исходный URL)
// через ResolveAndCheck, и запрещая схемы/порты вне белого списка.
//
// В отличие от SafeGet, принимает готовый *http.Request — это позволяет
// использовать любой HTTP-метод (GET, HEAD, POST без тела и т.д.).
//
// Заголовки исходного запроса копируются в каждый хоп. Если редирект
// ведёт на другой хост, чувствительные заголовки (Authorization,
// WWW-Authenticate, Cookie, Cookie2) вырезаются — это повторяет
// поведение стандартного http.Client и защищает от утечки credentials
// на чужой сервер.
//
// Ограничение: тело запроса не поддерживается. Если req.Body не nil
// и не http.NoBody, SafeDo возвращает ErrBodyNotSupported. Это осознанное
// решение: повторять тело на редиректах — источник утечек (отправка
// credentials на подконтрольный хост после редиректа) и лишней сложности.
//
// req.Context() игнорируется; используется переданный ctx.
//
// При успехе вызывающий обязан закрыть resp.Body.
func SafeDo(
	ctx context.Context,
	client *http.Client,
	req *http.Request,
	maxRedirects int,
) (*http.Response, error) {
	if client == nil {
		return nil, ErrEmptyClient
	}
	if client.CheckRedirect == nil {
		return nil, ErrCheckRedirectClient
	}
	if req == nil || req.URL == nil {
		return nil, ErrEmptyRequest
	}
	if req.Body != nil && req.Body != http.NoBody {
		return nil, ErrBodyNotSupported
	}

	method := req.Method
	if method == "" {
		method = http.MethodGet
	}

	originalHeaders := req.Header.Clone()
	initialHost := req.URL.Host
	currentURL := req.URL.String()

	for i := 0; i <= maxRedirects; i++ {
		u, err := checkURL(ctx, currentURL)
		if err != nil {
			return nil, err
		}

		next, err := http.NewRequestWithContext(ctx, method, currentURL, nil)
		if err != nil {
			return nil, fmt.Errorf("build request %q: %w", currentURL, err)
		}

		// Тот же хост — копируем всё. Сменился — вырезаем чувствительные.
		copyHeaders(next.Header, originalHeaders, !sameHost(initialHost, u.Host))

		resp, err := client.Do(next)
		if err != nil {
			return nil, fmt.Errorf("do request %q: %w", currentURL, err)
		}

		if !isRedirect(resp) {
			return resp, nil
		}

		loc, hasLocation, err := nextURL(u, resp)
		if err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("redirect from %q: %w", currentURL, err)
		}
		if !hasLocation {
			return resp, nil
		}

		resp.Body.Close()
		currentURL = loc
	}

	return nil, fmt.Errorf("%w: last url %q", ErrTooManyRedirects, currentURL)
}

// SafeGet — удобная обёртка над SafeDo для GET-запросов без тела.
func SafeGet(
	ctx context.Context,
	client *http.Client,
	targetURL string,
	maxRedirects int,
) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request %q: %w", targetURL, err)
	}
	return SafeDo(ctx, client, req, maxRedirects)
}
