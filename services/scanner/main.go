package main

import (
	"log"
	"net/http"
	"os"
)

//TODO: позже сюда надо бы добавить пассивный сбор фактов (заголовки, TLS, пути)
// и SSRF-guard — проверка резолвленного IP против приватных диапазонов
// перед любым исходящим запросом к целевому сайту.

// healthHandler — обработчик /health. Отдаёт статичный JSON без логики,
// нужен только чтобы docker-compose/оркестратор могли проверить,
// что процесс жив и отвечает на HTTP.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok", "service":"scanner"}`))
}

func main() {
	port := os.Getenv("SCANNER_PORT") // -> Переменная окружения docker-compose
	if port == "" {
		port = "8081"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)

	log.Println("Scanner слушает: " + port)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
