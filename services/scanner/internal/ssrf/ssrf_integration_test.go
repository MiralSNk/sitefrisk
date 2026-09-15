//go:build integration

package ssrf

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- safeDialContext с реальным сетевым стеком ----------------------------

// TestSafeDialContext_AllowedAddress идёт в реальный DNS/TCP.
// В CI без исходящего трафика может упасть по таймауту — поэтому integration.
func TestSafeDialContext_AllowedAddress(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	_, err := safeDialContext(ctx, "tcp", "8.8.8.8:443")
	if err != nil {
		assert.NotErrorIs(t, err, ErrBlockedAddress,
			"публичный IP не должен блокироваться SSRF-проверкой")
	}
}

// --- checkURL-линия через реальный Transport ------------------------------

// TestSafeGet_BlocksLoopbackBeforeRequest проверяет, что SafeGet через
// SafeClient (реальный Transport, реальный httptest-сервер на loopback)
// блокирует запрос на уровне checkURL до открытия соединения.
func TestSafeGet_BlocksLoopbackBeforeRequest(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be reached")
	}))
	defer srv.Close()

	c := SafeClient()
	_, err := SafeGet(context.Background(), c, srv.URL, 5)

	require.ErrorIs(t, err, ErrBlockedAddress)

	var blocked *BlockedAddressError
	require.ErrorAs(t, err, &blocked)
	assert.Equal(t, "loopback", blocked.Reason)
}

// --- DialContext-линия: защита работает в обход SafeGet -------------------

// TestSafeClient_DialContextBlocksLoopbackEvenWithoutSafeGet доказывает,
// что DialContext — самодостаточная линия защиты.
//
// Мы не вызываем SafeGet/checkURL: берём SafeClient() и дёргаем
// client.Do напрямую. Если бы защита жила только на уровне URL-проверки,
// этот тест упал бы. Он проходит — значит, safeDialContext реально
// блокирует loopback в момент TCP-connect.
func TestSafeClient_DialContextBlocksLoopbackEvenWithoutSafeGet(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be reached: connection should be blocked in DialContext")
	}))
	defer srv.Close()

	client := SafeClient()

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		srv.URL,
		nil,
	)
	require.NoError(t, err)

	// Обходим SafeGet/checkURL — идём в client.Do напрямую.
	_, err = client.Do(req)

	require.Error(t, err)

	var blocked *BlockedAddressError
	require.ErrorAs(t, err, &blocked,
		"DialContext должен блокировать loopback, даже если SafeGet не вызван")
	assert.Equal(t, "loopback", blocked.Reason)
}
