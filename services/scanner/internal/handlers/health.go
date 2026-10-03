package handlers

import "net/http"

// Health — обработчик /health. Отдаёт статичный JSON без логики,
// нужен только чтобы docker-compose/оркестратор могли проверить,
// что процесс жив и отвечает на HTTP.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok", "service":"scanner"}`))
}
