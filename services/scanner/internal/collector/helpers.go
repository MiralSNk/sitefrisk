package collector

import (
	"context"
	"errors"
	"sync"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
)

// results — внутренний тип для передачи между стадиями пайплайна
type results struct {
	facts []fact.Fact
	errs  []error
}

// generate - генерирует канал только для чтения данных
func generate[T any](items ...T) <-chan T {
	out := make(chan T, len(items))

	go func() {
		defer close(out)
		for _, f := range items {
			out <- f
		}
	}()

	return out
}

// workerCollectors - нужен для создания работников,
// которые будут работать над экземплярами, реализовавшими Collector.Collect
func workerCollectors(
	ctx context.Context,
	jobs <-chan Collector,
	result chan<- results,
	targetURL string,
) {
	var wg sync.WaitGroup

	for job := range jobs {
		wg.Add(1)
		go func() {
			defer wg.Done()

			f, err := job.Collect(ctx, targetURL)

			// Не репортим ошибку, если она — следствие отмены родительского контекста:
			// validation добавит ctx.Err() в финальное событие сама, а в промежуточном
			// EventCollectorDone дублировать не нужно.
			if err != nil && errors.Is(err, ctx.Err()) {
				err = nil
			}

			res := results{facts: f}
			if err != nil {
				res.errs = append(res.errs, err)
			}

			select {
			case result <- res:
			case <-ctx.Done():
			}
		}()
	}

	go func() {
		defer close(result)
		wg.Wait()
	}()
}
