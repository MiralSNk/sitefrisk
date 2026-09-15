package fact

import (
	"errors"
	"fmt"
)

var ( // -> Кастомные ошибки

	// ErrValidationCategory кастомная ошибка для не найденной категории, проверять через errors.Is
	ErrValidationCategory = errors.New("такой категории не существует")
	// ErrValidationKey кастомная ошибка для пустого ключа, проверять через errors.Is
	ErrValidationKey = errors.New("пустой ключ")
	// ErrValidationCategoryVoid кастомная ошибка для пустой категории, проверять через errors.Is
	ErrValidationCategoryVoid = errors.New("пустая категория")
	// ErrVoidFact кастомная ошибка для пустого fact, проверять через errors.Is
	ErrVoidFact = errors.New("пустой Fact")
)

// ValidationErrorFacts кастомная структура ошибок, проверять через errors.As
type ErrValidation struct {
	Index int
	Err   error
}

func (e *ErrValidation) Error() string {
	return fmt.Sprintf("facts[%d]: %v", e.Index, e.Err)
}

func (e *ErrValidation) Unwrap() error { return e.Err }
