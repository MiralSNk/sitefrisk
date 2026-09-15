package header_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector/header"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/ssrf"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	// Глушим логгер ssrf: тесты намеренно бьют в приватные адреса,
	// и предупреждения об этом — ожидаемый шум.
	ssrf.SetLogger(slog.New(slog.NewTextHandler(io.Discard, nil)))
	os.Exit(m.Run())
}

// --- test helpers ---------------------------------------------------------

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

// newTestClient возвращает клиент с mock RoundTripper. Используется
// в тестах, где нужно изолировать логику HeaderCollector от ssrf-проверок
// и реальной сети.
func newTestClient(rt http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: rt,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func newResponse(status int, headers map[string]string) *http.Response {
	h := http.Header{}
	for k, v := range headers {
		h.Set(k, v)
	}
	return &http.Response{
		StatusCode: status,
		Header:     h,
		Body:       io.NopCloser(strings.NewReader("")),
	}
}

// Публичный URL: ssrf.SafeDo пропускает такой хост, mock RoundTripper
// возвращает заготовленный ответ. Сети нет — тест чистый unit.
const publicURL = "http://8.8.8.8/"

// --- Collect: парсинг заголовков ------------------------------------------

func TestHeaderCollector_Collect(t *testing.T) {
	cases := []struct {
		name     string
		headers  map[string]string
		expFacts map[string]string
	}{
		{
			name: "Все заголовки присутствуют",
			headers: map[string]string{
				"Content-Security-Policy":   "default-src 'self'",
				"Strict-Transport-Security": "max-age=31536000",
				"X-Frame-Options":           "DENY",
			},
			expFacts: map[string]string{
				"Content-Security-Policy":   "default-src 'self'",
				"Strict-Transport-Security": "max-age=31536000",
				"X-Frame-Options":           "DENY",
			},
		},
		{
			name: "Часть заголовков отсутствует",
			headers: map[string]string{
				"X-Frame-Options": "SAMEORIGIN",
			},
			expFacts: map[string]string{
				"X-Frame-Options": "SAMEORIGIN",
			},
		},
		{
			name:     "Нет ни одного заголовка",
			headers:  map[string]string{},
			expFacts: map[string]string{},
		},
		{
			name: "Пустое значение не считается",
			headers: map[string]string{
				"Content-Security-Policy": "",
				"X-Frame-Options":         "DENY",
			},
			expFacts: map[string]string{
				"X-Frame-Options": "DENY",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
				return newResponse(http.StatusOK, tc.headers), nil
			})

			c := header.NewHeaderCollectorWithClient(newTestClient(rt))
			got, err := c.Collect(context.Background(), publicURL)

			require.NoError(t, err)

			gotMap := make(map[string]string, len(got))
			for _, f := range got {
				gotMap[f.Key] = f.Value
			}
			assert.Equal(t, tc.expFacts, gotMap)
		})
	}
}

// --- Collect: ошибки на разных уровнях ------------------------------------

// Некорректный URL: ошибка при сборке запроса, до SafeDo.
func TestHeaderCollector_Collect_RequestError(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return newResponse(http.StatusOK, nil), nil
	})

	c := header.NewHeaderCollectorWithClient(newTestClient(rt))
	_, err := c.Collect(context.Background(), "://broken")

	require.ErrorIs(t, err, header.ErrRequest)
}

// Сетевая ошибка от клиента: обёрнута в ErrResponse, исходная причина
// доступна через errors.Is.
func TestHeaderCollector_Collect_ResponseError(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("connection refused")
	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, wantErr
	})

	c := header.NewHeaderCollectorWithClient(newTestClient(rt))
	_, err := c.Collect(context.Background(), publicURL)

	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, wantErr, "исходная ошибка должна быть в цепочке")
}

// Отмена контекста: клиент возвращает ctx.Err(), он обёрнут в ErrResponse.
func TestHeaderCollector_Collect_ContextCanceled(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // отменяем сразу

	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		// mock RoundTripper не вызывает сеть, но контекст уже отменён.
		if err := req.Context().Err(); err != nil {
			return nil, err
		}
		return newResponse(http.StatusOK, nil), nil
	})

	c := header.NewHeaderCollectorWithClient(newTestClient(rt))
	_, err := c.Collect(ctx, publicURL)

	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, context.Canceled)
}

// --- Collect: SSRF-блокировка (главный новый тест) ------------------------

// Loopback должен блокироваться ssrf.SafeDo до client.Do.
func TestHeaderCollector_Collect_BlocksLoopback(t *testing.T) {
	t.Parallel()

	c := header.NewHeaderCollector()
	_, err := c.Collect(context.Background(), "http://127.0.0.1:8080/")

	require.Error(t, err)
	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, ssrf.ErrBlockedAddress)

	var blocked *ssrf.BlockedAddressError
	require.ErrorAs(t, err, &blocked)
	assert.Equal(t, "loopback", blocked.Reason)
}

// Приватный адрес — тоже блокируется.
func TestHeaderCollector_Collect_BlocksPrivate(t *testing.T) {
	t.Parallel()

	c := header.NewHeaderCollector()
	_, err := c.Collect(context.Background(), "http://10.0.0.1/")

	require.Error(t, err)
	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, ssrf.ErrBlockedAddress)

	var blocked *ssrf.BlockedAddressError
	require.ErrorAs(t, err, &blocked)
	assert.Equal(t, "private", blocked.Reason)
}

// Запрещённая схема — блокируется до DialContext.
func TestHeaderCollector_Collect_ForbiddenScheme(t *testing.T) {
	t.Parallel()

	c := header.NewHeaderCollector()
	_, err := c.Collect(context.Background(), "ftp://8.8.8.8/")

	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, ssrf.ErrForbiddenScheme)
}
