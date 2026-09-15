package header_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector/header"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHeaderCollector_Collect(t *testing.T) {
	cases := []struct {
		name     string
		handler  http.HandlerFunc
		expErr   error
		expFacts map[string]string
	}{
		{
			name: "Все заголовки присутствуют",
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Security-Policy", "default-src 'self'")
				w.Header().Set("Strict-Transport-Security", "max-age=31536000")
				w.Header().Set("X-Frame-Options", "DENY")
			},
			expErr: nil,
			expFacts: map[string]string{
				"Content-Security-Policy":   "default-src 'self'",
				"Strict-Transport-Security": "max-age=31536000",
				"X-Frame-Options":           "DENY",
			},
		},
		{
			name: "Часть заголовков отсутствует",
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("X-Frame-Options", "SAMEORIGIN")
			},
			expErr: nil,
			expFacts: map[string]string{
				"X-Frame-Options": "SAMEORIGIN",
			},
		},
		{
			name:     "Нет ни одного заголовка",
			handler:  func(w http.ResponseWriter, r *http.Request) {},
			expErr:   nil,
			expFacts: map[string]string{},
		},
		{
			name: "Пустое значение не считается",
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Security-Policy", "")
				w.Header().Set("X-Frame-Options", "DENY")
			},
			expErr: nil,
			expFacts: map[string]string{
				"X-Frame-Options": "DENY",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(tc.handler)
			defer srv.Close()

			c := header.NewHeaderCollector()
			got, err := c.Collect(context.Background(), srv.URL)

			if tc.expErr == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tc.expErr)
				return
			}

			gotMap := make(map[string]string, len(got))
			for _, f := range got {
				gotMap[f.Key] = f.Value
			}
			assert.Equal(t, tc.expFacts, gotMap)
		})
	}
}

func TestHeaderCollector_Collect_RequestError(t *testing.T) {
	c := header.NewHeaderCollector()

	_, err := c.Collect(context.Background(), "://broken")

	require.ErrorIs(t, err, header.ErrRequest)
}

func TestHeaderCollector_Collect_ServerUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := srv.URL
	srv.Close()

	c := header.NewHeaderCollector()
	_, err := c.Collect(context.Background(), url)

	require.ErrorIs(t, err, header.ErrResponse)
}

func TestHeaderCollector_Collect_ContextCanceled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(100 * time.Millisecond)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond) // даём запросу время уйти на сервер
		cancel()
	}()

	c := header.NewHeaderCollector()
	_, err := c.Collect(ctx, srv.URL)

	require.ErrorIs(t, err, header.ErrResponse)
	require.ErrorIs(t, err, context.Canceled)
}
