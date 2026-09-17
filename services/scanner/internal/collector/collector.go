package collector

import (
	"context"
	"time"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
)

const defaultTimeout = 10 * time.Second

//go:generate mockery
type Collector interface { // Для автоматической генерации всех моков `go generate ./...`
	Collect(ctx context.Context, targetURL string) ([]fact.Fact, error)
}

// TODO(redis/nats): публиковать EventCollectorDone в очередь по мере поступления,
// когда появится брокер — сейчас вызывающий код просто читает канал синхронно.

// RunAll ассинхронно проходит по срезу экземпляров, реализующих интерфейс Collector, и объединяет результаты
func RunAll(ctx context.Context, collectors []Collector, targetURL string) <-chan Event {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)

	res := make(chan results, len(collectors))
	workerCollectors(ctx, generate(collectors...), res, targetURL)
	return (validation(ctx, cancel, res))
}
