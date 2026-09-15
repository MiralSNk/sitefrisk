// Package header реализует Collector, который проверяет наличие
// и значения security-заголовков ответа целевого сервера:
// Content-Security-Policy, Strict-Transport-Security, X-Frame-Options.
//
// Запрос выполняется методом HEAD через ssrf.SafeDo — исходящие
// запросы защищены SSRF-guard'ом на двух уровнях: проверка URL
// (схема, порт, IP) и проверка IP в момент установки TCP-соединения
// (safeDialContext внутри ssrf.SafeClient).
//
// Таймаут задаётся только через ctx вызывающего — у клиента нет
// собственного Timeout, чтобы общий бюджет времени контролировался
// в одном месте (в collector.RunAll).
//
// Использовать http.DefaultClient или http.Get напрямую в этом пакете
// не следует — они не защищены от SSRF.
package header
