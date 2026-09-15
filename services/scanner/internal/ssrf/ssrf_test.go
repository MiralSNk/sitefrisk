package ssrf_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/ssrf"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	ssrf.SetLogger(slog.New(slog.NewTextHandler(io.Discard, nil)))
	ssrf.SetAllowedPorts()
	os.Exit(m.Run())
}

// --- ResolveAndCheck -------------------------------------------------------

func TestResolveAndCheck_Blocked(t *testing.T) {
	cases := []struct {
		name   string
		host   string
		reason string
	}{
		{"loopback v4", "127.0.0.1", "loopback"},
		{"loopback in v6", "::ffff:127.0.0.1", "loopback"},
		{"loopback v6", "::1", "loopback"},
		{"cloud metadata", "169.254.169.254", "link-local unicast"},
		{"private 10/8", "10.0.0.1", "private"},
		{"private 172.16/12", "172.16.0.1", "private"},
		{"private 192.168/16", "192.168.1.1", "private"},
		{"unspecified v4", "0.0.0.0", "unspecified"},
		{"unspecified v6", "::", "unspecified"},
		{"with port", "127.0.0.1:8080", "loopback"},
		{"v6 with port", "[::1]:8080", "loopback"},
		{"v6 no port", "[::1]", "loopback"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := ssrf.ResolveAndCheck(context.Background(), tc.host)

			require.Error(t, err)
			assert.ErrorIs(t, err, ssrf.ErrBlockedAddress)

			var blocked *ssrf.BlockedAddressError
			require.ErrorAs(t, err, &blocked)
			assert.Equal(t, tc.reason, blocked.Reason)
			assert.NotNil(t, blocked.IP)
		})
	}
}

func TestResolveAndCheck_Allowed(t *testing.T) {
	cases := []string{
		"8.8.8.8",
		"1.1.1.1",
		"2001:4860:4860::8888", // Google IPv6 DNS
	}

	for _, host := range cases {
		t.Run(host, func(t *testing.T) {
			t.Parallel()

			ips, err := ssrf.ResolveAndCheck(context.Background(), host)

			require.NoError(t, err)
			require.NotEmpty(t, ips)
			assert.True(t, ips[0].Equal(net.ParseIP(host)))
		})
	}
}

func TestResolveAndCheck_EmptyHost(t *testing.T) {
	t.Parallel()

	_, err := ssrf.ResolveAndCheck(context.Background(), "")

	require.ErrorIs(t, err, ssrf.ErrEmptyHost)
	assert.NotErrorIs(t, err, ssrf.ErrBlockedAddress)
}

// --- Test helpers ---------------------------------------------------------

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newRedirectClient(rt http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: rt,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func redirectResponse(location string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusFound,
		Header:     http.Header{"Location": []string{location}},
		Body:       io.NopCloser(strings.NewReader("")),
	}
}

func okResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// --- SafeGet (тонкая обёртка над SafeDo) ----------------------------------

func TestSafeGet_NoRedirect(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return okResponse("hello"), nil
	})

	resp, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 3)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestSafeGet_FollowsSafeRedirect(t *testing.T) {
	t.Parallel()

	var calls int
	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return redirectResponse("http://8.8.8.8/final"), nil
		}
		return okResponse("ok"), nil
	})

	resp, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 3)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, 2, calls)
}

func TestSafeGet_BlockedRedirect(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return redirectResponse("http://169.254.169.254/latest/meta-data/"), nil
	})

	_, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 5)

	require.ErrorIs(t, err, ssrf.ErrBlockedAddress)

	var blocked *ssrf.BlockedAddressError
	require.ErrorAs(t, err, &blocked)
	assert.Equal(t, "169.254.169.254", blocked.IP.String())
	assert.Equal(t, "link-local unicast", blocked.Reason)
}

func TestSafeGet_TooManyRedirects(t *testing.T) {
	t.Parallel()

	var calls int
	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return redirectResponse("http://8.8.8.8/next"), nil
	})

	_, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 3)

	require.ErrorIs(t, err, ssrf.ErrTooManyRedirects)
	assert.Equal(t, 4, calls) // initial + 3 redirects
}

func TestSafeGet_RejectsUnsafeClient(t *testing.T) {
	t.Parallel()

	c := &http.Client{} // CheckRedirect == nil

	_, err := ssrf.SafeGet(context.Background(), c, "http://8.8.8.8/", 3)

	require.ErrorIs(t, err, ssrf.ErrCheckRedirectClient)
}

func TestSafeGet_RejectsNilClient(t *testing.T) {
	t.Parallel()

	_, err := ssrf.SafeGet(context.Background(), nil, "http://8.8.8.8/", 3)

	require.ErrorIs(t, err, ssrf.ErrEmptyClient)
}

func TestSafeGet_ForbiddenScheme(t *testing.T) {
	ssrf.SetAllowedPorts()
	t.Cleanup(func() { ssrf.SetAllowedPorts() })

	c := ssrf.SafeClient()

	for _, rawURL := range []string{
		"ftp://8.8.8.8/",
		"file:///etc/passwd",
		"gopher://8.8.8.8/",
		"dict://8.8.8.8/",
	} {
		t.Run(rawURL, func(t *testing.T) {
			_, err := ssrf.SafeGet(context.Background(), c, rawURL, 3)
			require.ErrorIs(t, err, ssrf.ErrForbiddenScheme, "url=%s", rawURL)
		})
	}
}

func TestSafeGet_ForbiddenPort(t *testing.T) {
	ssrf.SetAllowedPorts(80, 443)
	t.Cleanup(func() { ssrf.SetAllowedPorts() })

	c := ssrf.SafeClient()

	for _, rawURL := range []string{
		"http://8.8.8.8:22/",
		"http://8.8.8.8:6379/",
		"http://8.8.8.8:5432/",
		"http://8.8.8.8:9200/",
	} {
		t.Run(rawURL, func(t *testing.T) {
			_, err := ssrf.SafeGet(context.Background(), c, rawURL, 3)
			require.ErrorIs(t, err, ssrf.ErrForbiddenPort, "url=%s", rawURL)
		})
	}
}

func TestSafeGet_AllowedPorts(t *testing.T) {
	ssrf.SetAllowedPorts(80, 443, 8080)
	t.Cleanup(func() { ssrf.SetAllowedPorts() })

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return okResponse("ok"), nil
	})
	c := newRedirectClient(rt)

	for _, rawURL := range []string{
		"http://8.8.8.8/",      // default 80
		"http://8.8.8.8:80/",   // explicit 80
		"https://8.8.8.8/",     // default 443
		"http://8.8.8.8:8080/", // explicit 8080
	} {
		t.Run(rawURL, func(t *testing.T) {
			resp, err := ssrf.SafeGet(context.Background(), c, rawURL, 3)
			require.NoError(t, err)
			resp.Body.Close()
		})
	}
}

func TestSafeGet_EmptyAllowedPortsMeansAll(t *testing.T) {
	ssrf.SetAllowedPorts()
	t.Cleanup(func() { ssrf.SetAllowedPorts() })

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return okResponse("ok"), nil
	})

	resp, err := ssrf.SafeGet(
		context.Background(),
		newRedirectClient(rt),
		"http://8.8.8.8:54321/",
		3,
	)
	require.NoError(t, err)
	resp.Body.Close()
}

func TestSafeGet_ForbiddenPortOnRedirect(t *testing.T) {
	ssrf.SetAllowedPorts(80, 443)
	t.Cleanup(func() { ssrf.SetAllowedPorts() })

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return redirectResponse("http://8.8.8.8:6379/"), nil
	})

	_, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 5)

	require.ErrorIs(t, err, ssrf.ErrForbiddenPort)
}

// Цепочка ошибок не теряется через обёртки SafeGet.
func TestSafeGet_ErrorChainPreserved(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return redirectResponse("http://10.0.0.1/admin"), nil
	})

	_, err := ssrf.SafeGet(context.Background(), newRedirectClient(rt), "http://8.8.8.8/", 5)

	require.ErrorIs(t, err, ssrf.ErrBlockedAddress)
	assert.False(t, errors.Is(err, context.Canceled))
}

// --- SafeDo ---------------------------------------------------------------

func TestSafeDo_RejectsNilRequest(t *testing.T) {
	t.Parallel()

	_, err := ssrf.SafeDo(context.Background(), ssrf.SafeClient(), nil, 3)

	require.ErrorIs(t, err, ssrf.ErrEmptyRequest)
}

func TestSafeDo_RejectsNilClient(t *testing.T) {
	t.Parallel()

	req, err := http.NewRequest(http.MethodGet, "http://8.8.8.8/", nil)
	require.NoError(t, err)

	_, err = ssrf.SafeDo(context.Background(), nil, req, 3)

	require.ErrorIs(t, err, ssrf.ErrEmptyClient)
}

func TestSafeDo_RejectsUnsafeClient(t *testing.T) {
	t.Parallel()

	req, err := http.NewRequest(http.MethodGet, "http://8.8.8.8/", nil)
	require.NoError(t, err)

	_, err = ssrf.SafeDo(context.Background(), &http.Client{}, req, 3)

	require.ErrorIs(t, err, ssrf.ErrCheckRedirectClient)
}

// Тело запроса не поддерживается — fail fast.
func TestSafeDo_BodyNotSupported(t *testing.T) {
	t.Parallel()

	body := strings.NewReader("payload")
	req, err := http.NewRequest(http.MethodPost, "http://8.8.8.8/", body)
	require.NoError(t, err)

	_, err = ssrf.SafeDo(context.Background(), ssrf.SafeClient(), req, 3)

	require.ErrorIs(t, err, ssrf.ErrBodyNotSupported)
}

// http.NoBody — не считается телом, запрос проходит.
func TestSafeDo_NoBodyIsAllowed(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return okResponse("ok"), nil
	})

	req, err := http.NewRequest(http.MethodPost, "http://8.8.8.8/", http.NoBody)
	require.NoError(t, err)

	resp, err := ssrf.SafeDo(context.Background(), newRedirectClient(rt), req, 3)
	require.NoError(t, err)
	resp.Body.Close()
}

// Произвольный метод без тела проходит через все хопы.
func TestSafeDo_ArbitraryMethod(t *testing.T) {
	t.Parallel()

	methods := []string{http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodDelete}

	for _, m := range methods {
		t.Run(m, func(t *testing.T) {
			var gotMethod string
			rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotMethod = req.Method
				return okResponse("ok"), nil
			})

			req, err := http.NewRequest(m, "http://8.8.8.8/", nil)
			require.NoError(t, err)

			resp, err := ssrf.SafeDo(context.Background(), newRedirectClient(rt), req, 3)
			require.NoError(t, err)
			resp.Body.Close()

			assert.Equal(t, m, gotMethod)
		})
	}
}

// Чувствительные заголовки вырезаются при редиректе на другой хост.
func TestSafeDo_StripsSensitiveHeadersOnCrossHostRedirect(t *testing.T) {
	t.Parallel()

	var secondReq *http.Request

	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Host == "8.8.8.8" {
			return redirectResponse("http://1.1.1.1/next"), nil
		}
		secondReq = req
		return okResponse("ok"), nil
	})

	req, err := http.NewRequest(http.MethodGet, "http://8.8.8.8/", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer secret-token")
	req.Header.Set("Cookie", "session=abc")
	req.Header.Set("User-Agent", "test-agent")

	resp, err := ssrf.SafeDo(context.Background(), newRedirectClient(rt), req, 5)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.NotNil(t, secondReq)
	assert.Empty(t, secondReq.Header.Get("Authorization"), "Authorization must be stripped on cross-host redirect")
	assert.Empty(t, secondReq.Header.Get("Cookie"), "Cookie must be stripped on cross-host redirect")
	assert.Equal(t, "test-agent", secondReq.Header.Get("User-Agent"), "non-sensitive headers must be preserved")
}

// При редиректе на тот же хост заголовки сохраняются.
func TestSafeDo_KeepsHeadersOnSameHostRedirect(t *testing.T) {
	t.Parallel()

	var secondReq *http.Request
	var calls int

	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return redirectResponse("http://8.8.8.8/next"), nil
		}
		secondReq = req
		return okResponse("ok"), nil
	})

	req, err := http.NewRequest(http.MethodGet, "http://8.8.8.8/", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer secret-token")

	resp, err := ssrf.SafeDo(context.Background(), newRedirectClient(rt), req, 5)
	require.NoError(t, err)
	resp.Body.Close()

	require.NotNil(t, secondReq)
	assert.Equal(t, "Bearer secret-token", secondReq.Header.Get("Authorization"))
}

// Заблокированный редирект: SafeDo не должен дойти до client.Do для второго хоста.
func TestSafeDo_BlockedRedirect(t *testing.T) {
	t.Parallel()

	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Host == "8.8.8.8" {
			return redirectResponse("http://169.254.169.254/"), nil
		}
		t.Fatal("second request must not be sent")
		return nil, nil
	})

	req, err := http.NewRequest(http.MethodGet, "http://8.8.8.8/", nil)
	require.NoError(t, err)

	_, err = ssrf.SafeDo(context.Background(), newRedirectClient(rt), req, 5)

	require.ErrorIs(t, err, ssrf.ErrBlockedAddress)
}
