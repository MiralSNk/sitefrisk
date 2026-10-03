package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/factory"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/handlers"
)

func main() {
	port := os.Getenv("SCANNER_PORT") // -> Переменная окружения docker-compose
	if port == "" {
		port = "8081"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/scan", handlers.Scan(factory.Registrations))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("Scanner слушает: " + port)

	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
