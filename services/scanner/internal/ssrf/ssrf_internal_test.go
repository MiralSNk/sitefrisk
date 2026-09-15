package ssrf

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- normalizeHost --------------------------------------------------------

func TestNormalizeHost(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"example.com", "example.com"},
		{"example.com:8080", "example.com"},
		{"127.0.0.1", "127.0.0.1"},
		{"127.0.0.1:8080", "127.0.0.1"},
		{"[::1]:8080", "::1"},
		{"[::1]", "::1"}, // без порта — снимаем скобки
		{"::1", "::1"},
		{"", ""},
		{"example.com:", "example.com"},
	}

	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			assert.Equal(t, tc.want, normalizeHost(tc.in))
		})
	}
}

// --- isBlocked ------------------------------------------------------------

func TestIsBlocked(t *testing.T) {
	cases := []struct {
		ip       string
		wantReas string // "" = not blocked
	}{
		// loopback
		{"127.0.0.1", "loopback"},
		{"127.255.255.254", "loopback"},
		{"::1", "loopback"},
		{"::ffff:127.0.0.1", "loopback"}, // IPv4-mapped loopback

		// private (RFC1918 + IPv6 ULA)
		{"10.0.0.1", "private"},
		{"10.255.255.255", "private"},
		{"172.16.0.1", "private"},
		{"172.31.255.255", "private"},
		{"192.168.0.1", "private"},
		{"192.168.255.255", "private"},
		{"fc00::1", "private"},

		// link-local unicast
		{"169.254.169.254", "link-local unicast"},
		{"169.254.0.1", "link-local unicast"},
		{"fe80::1", "link-local unicast"},

		// link-local multicast (224.0.0.0/24, ff02::/16)
		{"224.0.0.1", "link-local multicast"},
		{"224.0.0.255", "link-local multicast"},
		{"ff02::1", "link-local multicast"},
		{"ff02::ff", "link-local multicast"},

		// прочий multicast (не link-local)
		{"224.0.1.1", "multicast"}, // Internetwork Control Block
		{"239.1.1.1", "multicast"}, // Administratively Scoped
		{"ff0e::1", "multicast"},   // global scope

		// unspecified
		{"0.0.0.0", "unspecified"},
		{"::", "unspecified"},

		// Границы — не блокируются.
		{"9.255.255.255", ""},
		{"11.0.0.0", ""},
		{"172.15.255.255", ""},
		{"172.32.0.0", ""},
		{"192.167.255.255", ""},
		{"192.169.0.0", ""},
		{"8.8.8.8", ""},
		{"1.1.1.1", ""},
		{"2001:4860:4860::8888", ""},
	}

	for _, tc := range cases {
		t.Run(tc.ip, func(t *testing.T) {
			ip := net.ParseIP(tc.ip)
			require.NotNil(t, ip, "bad test IP")

			reason, blocked := isBlocked(ip)
			if tc.wantReas == "" {
				assert.False(t, blocked, "expected allowed, got reason %q", reason)
			} else {
				assert.True(t, blocked)
				assert.Equal(t, tc.wantReas, reason)
			}
		})
	}
}

// --- checkIPs -------------------------------------------------------------

func TestCheckIPs_AllAllowed(t *testing.T) {
	ips := []net.IP{
		net.ParseIP("8.8.8.8"),
		net.ParseIP("1.1.1.1"),
	}
	assert.NoError(t, checkIPs("test", ips))
}

// Первый заблокированный IP выигрывает — проверка останавливается раньше.
func TestCheckIPs_FirstBlockedWins(t *testing.T) {
	ips := []net.IP{
		net.ParseIP("8.8.8.8"),
		net.ParseIP("10.0.0.1"),
		net.ParseIP("192.168.1.1"),
	}

	err := checkIPs("test", ips)

	var blocked *BlockedAddressError
	require.ErrorAs(t, err, &blocked)
	assert.Equal(t, "10.0.0.1", blocked.IP.String())
	assert.Equal(t, "private", blocked.Reason)
	assert.Equal(t, "test", blocked.Host)
}

// --- validateScheme -------------------------------------------------------

func TestValidateScheme(t *testing.T) {
	cases := []struct {
		name    string
		rawURL  string
		wantErr error
	}{
		{"http", "http://example.com", nil},
		{"https", "https://example.com", nil},
		{"ftp", "ftp://example.com", ErrForbiddenScheme},
		{"file", "file:///etc/passwd", ErrForbiddenScheme},
		{"gopher", "gopher://example.com", ErrForbiddenScheme},
		{"dict", "dict://example.com", ErrForbiddenScheme},
		{"empty", "//example.com", ErrForbiddenScheme},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			u, err := url.Parse(tc.rawURL)
			require.NoError(t, err)

			err = validateScheme(u)
			if tc.wantErr == nil {
				assert.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, tc.wantErr)
		})
	}
}

// --- validatePort ---------------------------------------------------------

func TestValidatePort(t *testing.T) {
	orig := allowedPorts
	t.Cleanup(func() { allowedPorts = orig })

	allowedPorts = map[string]struct{}{
		"80":   {},
		"443":  {},
		"8080": {},
	}

	cases := []struct {
		name    string
		rawURL  string
		wantErr error
	}{
		{"http default", "http://example.com", nil},
		{"https default", "https://example.com", nil},
		{"http 80", "http://example.com:80", nil},
		{"https 443", "https://example.com:443", nil},
		{"http 8080", "http://example.com:8080", nil},
		{"http 22", "http://example.com:22", ErrForbiddenPort},
		{"http 6379", "http://example.com:6379", ErrForbiddenPort},
		{"https 5432", "https://example.com:5432", ErrForbiddenPort},
		{"http 9200", "http://example.com:9200", ErrForbiddenPort},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			u, err := url.Parse(tc.rawURL)
			require.NoError(t, err)

			err = validatePort(u)
			if tc.wantErr == nil {
				assert.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, tc.wantErr)
		})
	}
}

// Пустой allowedPorts = разрешить всё.
func TestValidatePort_EmptyAllowedPortsMeansAll(t *testing.T) {
	orig := allowedPorts
	t.Cleanup(func() { allowedPorts = orig })

	allowedPorts = nil

	for _, rawURL := range []string{
		"http://example.com:22",
		"http://example.com:5432",
		"https://example.com:6379",
		"http://example.com:65535",
	} {
		t.Run(rawURL, func(t *testing.T) {
			u, err := url.Parse(rawURL)
			require.NoError(t, err)
			assert.NoError(t, validatePort(u))
		})
	}
}

// --- isRedirect -----------------------------------------------------------

func TestIsRedirect(t *testing.T) {
	cases := []struct {
		code int
		want bool
	}{
		{200, false},
		{204, false},
		{299, false},
		{300, true}, // Multiple Choices
		{301, true},
		{302, true},
		{307, true},
		{308, true},
		{399, true},
		{400, false},
		{500, false},
	}

	for _, tc := range cases {
		t.Run(http.StatusText(tc.code), func(t *testing.T) {
			resp := &http.Response{StatusCode: tc.code}
			assert.Equal(t, tc.want, isRedirect(resp), "code=%d", tc.code)
		})
	}
}

// --- nextURL --------------------------------------------------------------

func TestNextURL(t *testing.T) {
	base, err := url.Parse("http://example.com/a/b")
	require.NoError(t, err)

	cases := []struct {
		name     string
		location string
		wantURL  string
		wantHas  bool
		wantErr  bool
	}{
		{
			name:     "пустой Location",
			location: "",
			wantHas:  false,
		},
		{
			name:     "абсолютный",
			location: "http://other.com/x",
			wantURL:  "http://other.com/x",
			wantHas:  true,
		},
		{
			name:     "относительный от корня",
			location: "/root",
			wantURL:  "http://example.com/root",
			wantHas:  true,
		},
		{
			name:     "относительный от текущей директории",
			location: "sibling",
			wantURL:  "http://example.com/a/sibling",
			wantHas:  true,
		},
		{
			name:     "битый (control char)",
			location: "\x00bad",
			wantHas:  false,
			wantErr:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := &http.Response{
				Header: http.Header{"Location": []string{tc.location}},
			}
			if tc.location == "" {
				resp.Header = http.Header{}
			}

			got, has, err := nextURL(base, resp)

			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantHas, has)
			if tc.wantHas {
				assert.Equal(t, tc.wantURL, got)
			}
		})
	}
}

// --- copyHeaders / sameHost -----------------------------------------------

func TestCopyHeaders(t *testing.T) {
	src := http.Header{
		"Authorization": []string{"Bearer token"},
		"Cookie":        []string{"session=abc"},
		"User-Agent":    []string{"test"},
		"X-Custom":      []string{"v1", "v2"},
	}

	t.Run("stripSensitive=true", func(t *testing.T) {
		dst := http.Header{}
		copyHeaders(dst, src, true)

		assert.Empty(t, dst.Get("Authorization"))
		assert.Empty(t, dst.Get("Cookie"))
		assert.Equal(t, "test", dst.Get("User-Agent"))
		assert.Equal(t, []string{"v1", "v2"}, dst.Values("X-Custom"))
	})

	t.Run("stripSensitive=false", func(t *testing.T) {
		dst := http.Header{}
		copyHeaders(dst, src, false)

		assert.Equal(t, "Bearer token", dst.Get("Authorization"))
		assert.Equal(t, "session=abc", dst.Get("Cookie"))
		assert.Equal(t, "test", dst.Get("User-Agent"))
	})
}

func TestSameHost(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"example.com", "example.com", true},
		{"example.com", "EXAMPLE.com", true},
		{"example.com:80", "example.com:80", true},
		{"example.com:80", "example.com:443", false},
		{"example.com", "other.com", false},
	}

	for _, tc := range cases {
		t.Run(tc.a+"_"+tc.b, func(t *testing.T) {
			assert.Equal(t, tc.want, sameHost(tc.a, tc.b))
		})
	}
}

// --- safeDialContext (блокировка до сети) ---------------------------------

// Заблокированный IP: safeDialContext должен вернуть *BlockedAddressError
// до того, как будет предпринята попытка открыть TCP-соединение.
//
// Тест не ходит в сеть: ResolveAndCheck отсекает такие адреса мгновенно.
func TestSafeDialContext_BlockedAddress(t *testing.T) {
	cases := []string{
		"127.0.0.1:80",
		"169.254.169.254:80",
		"10.0.0.1:443",
		"192.168.1.1:8080",
		"[::1]:80",
	}

	for _, addr := range cases {
		t.Run(addr, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
			defer cancel()

			_, err := safeDialContext(ctx, "tcp", addr)

			require.Error(t, err)
			require.ErrorIs(t, err, ErrBlockedAddress)

			var blocked *BlockedAddressError
			require.ErrorAs(t, err, &blocked)
			assert.NotEmpty(t, blocked.Reason)
		})
	}
}
