package handlers_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/factory"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/handlers"

	"github.com/stretchr/testify/assert"
)

type stubCollector struct{ facts []fact.Fact }

func (s stubCollector) Collect(ctx context.Context, _ string) ([]fact.Fact, error) {
	return s.facts, nil
}

func TestScan(t *testing.T) {
	reg := []factory.Registration{
		{Name: "p", Kind: factory.KindPassive, Factory: func() collector.Collector {
			return stubCollector{facts: []fact.Fact{{Category: fact.CategoryHeader, Key: "k", Value: "v"}}}
		}},
		{Name: "a", Kind: factory.KindActive, Factory: func() collector.Collector {
			return stubCollector{facts: []fact.Fact{{Category: fact.CategoryHeader, Key: "active-only", Value: "v"}}}
		}},
	}
	h := handlers.Scan(reg)

	t.Run("без url -> 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		h(w, httptest.NewRequest(http.MethodGet, "/scan", nil))
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("неизвестный kind -> 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		h(w, httptest.NewRequest(http.MethodGet, "/scan?url=http://x&kind=pasive", nil))
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("passive по умолчанию — активный коллектор не зовётся", func(t *testing.T) {
		w := httptest.NewRecorder()
		h(w, httptest.NewRequest(http.MethodGet, "/scan?url=http://x", nil))
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "\"k\"")
		assert.NotContains(t, w.Body.String(), "active-only")
	})

	t.Run("kind=active зовёт только активный", func(t *testing.T) {
		w := httptest.NewRecorder()
		h(w, httptest.NewRequest(http.MethodGet, "/scan?url=http://x&kind=active", nil))
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "active-only")
	})
}
