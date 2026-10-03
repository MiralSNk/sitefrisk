package fact

type Category string

const (
	CategoryHeader      Category = "header"
	CategoryTls         Category = "tls"
	CategoryExposedPath Category = "exposed_path"

	// ВНИМАНИЕ: при добавлении новой категории обязательно
	// обновите switch в Fact.Validate, иначе все факты с новой
	// категорией будут считаться невалидными (ErrValidationCategory).
	// Забытый case ловит линтер exhaustive (см. .golangci.yml,
	// default-signifies-exhaustive: false) — go vet этого не проверяет.
)
