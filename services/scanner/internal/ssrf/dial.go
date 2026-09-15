package ssrf

import (
	"context"
	"fmt"
	"net"
)

// safeDialContext — DialContext для http.Transport, который резолвит и
// проверяет хост до открытия TCP-соединения и подключается к уже
// проверенному IP-адресу.
//
// Это закрывает DNS rebinding: между проверкой и connect не происходит
// повторного DNS-запроса, потому что подключение идёт на конкретный
// IP, полученный из ResolveAndCheck.
//
// Используется только первый IP из списка. Если он недоступен, соединение
// падает, даже если другие резолвнутые адреса рабочие. Это осознанный
// компромисс ради простоты
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("split addr %q: %w", addr, err)
	}

	ips, err := ResolveAndCheck(ctx, host)
	if err != nil {
		return nil, err
	}

	dialer := &net.Dialer{}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}
