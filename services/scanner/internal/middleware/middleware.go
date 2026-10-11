// middleware - обёртки над http.Handler, общие для всех маршрутов.
package middleware

import "net/http"

type Middleware func(http.Handler) http.Handler

// Chain навешивает обёртки на h. Первая в списке — самая внешняя:
// Chain(h, A, B) эквивалентно A(B(h)) — запрос входит через A.
func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for _, mw := range mws {
		h = mw(h)
	}
	return h
}
