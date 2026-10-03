package collector

import (
	"context"
	"errors"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
)

type EventType string

const (
	// EventCollectorDone - один коллектор закончил работу
	EventCollectorDone EventType = "collector_done"
	// EventValidationDone - финальная валидация
	EventValidationDone EventType = "validation_done"
)

// Event - тип валидных данных для стриминга
type Event struct {
	Type EventType
	// Для EventCollectorDone — сырые факты от коллектора
	RawFacts []fact.Fact
	// Для EventValidationDone — уже провалидированные факты
	Validated fact.Validated
	Err       error
}

// validation - стримит промежуточные результаты
// review: Буфер покрывает максимум возможных отправок
// (cap(res) промежуточных + 1 финальное) -> ни в один send в этот канал не может заблокироваться,
// даже если вызывающий RunAll бросил читать канал раньше времени (ДАЙ БОГ НЕТ...)
func validation(ctx context.Context, cancel context.CancelFunc, res <-chan results) <-chan Event {
	out := make(chan Event, cap(res)+1)

	go func() {
		defer cancel()
		defer close(out)

		var allFacts []fact.Fact
		var allErrs []error

		for r := range res {
			var err error
			if len(r.errs) > 0 {
				err = errors.Join(r.errs...)
			}

			out <- Event{
				Type:     EventCollectorDone,
				RawFacts: r.facts,
				Err:      err,
			}

			allFacts = append(allFacts, r.facts...)
			allErrs = append(allErrs, r.errs...)
		}

		validated, err := fact.NewValidated(allFacts)
		if err != nil {
			allErrs = append(allErrs, err)
		}

		if err := ctx.Err(); err != nil {
			allErrs = append(allErrs, err)
		}

		out <- Event{
			Type:      EventValidationDone,
			Validated: validated,
			Err:       errors.Join(allErrs...),
		}
	}()

	return out
}
