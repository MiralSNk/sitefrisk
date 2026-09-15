// Package header реализует Collector, который проверяет наличие
// и значения security-заголовков ответа целевого сервера:
// Content-Security-Policy, Strict-Transport-Security, X-Frame-Options.
//
// Запрос выполняется методом HEAD с явным таймаутом — использовать
// http.DefaultClient или http.Get напрямую в этом пакете не следует,
// у них нет ни таймаута, ни способа передать context.
package header
