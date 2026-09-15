package fact

type Fact struct {
	Category Category
	Key      string
	Value    string
}

// Validate проверка на валидацию
//
// возвращает ошибку, если:
// Category not in {"header", "tls", "exposed_path"} or Key -> nil
func (f Fact) Validate() error {
	if f == (Fact{}) {
		return ErrVoidFact
	}

	if f.Key == "" {
		return ErrValidationKey
	}

	if f.Category == "" {
		return ErrValidationCategoryVoid
	}

	switch f.Category {
	case CategoryHeader, CategoryTls, CategoryExposedPath:
		return nil
	default:
		return ErrValidationCategory
	}
}

// ValidateAll проверяет весь срез
// при первой невалидной находке возвращает ошибку, обернутую через `%w`, с указанием индекса
func ValidateAll(facts []Fact) error {
	for i, fact := range facts {
		if err := fact.Validate(); err != nil {
			return &ErrValidation{
				Index: i,
				Err:   err,
			}
		}
	}

	return nil
}
