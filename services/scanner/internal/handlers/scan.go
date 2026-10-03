package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/factory"
)

// scanResponse - тело ответа /scan
type scanResponse struct {
	Facts []fact.Fact `json:"facts"`
	Error string      `json:"error,omitempty"`
}

// Scan возвращает обработчик /scan, собирающий коллекторы из reg
// по query-параметры kind и запускающий их через collector.RunAll
//
// Передае r.Context() нутрь RunAll - если клиент обрвет HTTP-запро,
// отмена дает до каждого колектора и до financial-отправки в event.go
func Scan(reg []factory.Registration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		targetURL := r.URL.Query().Get("url")
		if targetURL == "" {
			http.Error(w, `{"error":"query param 'url' is required"}`, http.StatusBadRequest)
			return
		}

		kind := factory.KindPassive
		if k := r.URL.Query().Get("kind"); k != "" {
			kind = factory.Kind(k)
			if !kind.Valid() {
				http.Error(w, fmt.Sprintf(`{"error":"unknown kind %q"}`, k), http.StatusBadRequest)
				return
			}
		}

		var collectors []collector.Collector
		for _, r := range reg {
			if r.Kind == kind {
				collectors = append(collectors, r.Factory())
			}
		}

		ch := collector.RunAll(r.Context(), collectors, targetURL)
		var final collector.Event
		for ev := range ch {
			if ev.Type == collector.EventValidationDone {
				final = ev
			}
		}

		resp := scanResponse{Facts: final.Validated.Facts()}
		if final.Err != nil {
			resp.Error = final.Err.Error()
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
