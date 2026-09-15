package fact

// Validated - структура-обертка над срезом фактов, прошедших ValidateAll
//
// Что дает гарант валидность предоставляемых фактов
type Validated struct {
	facts []Fact
}

// NewValidated - единственный способ получить значение этого типа
func NewValidated(facts []Fact) (Validated, error) {
	if err := ValidateAll(facts); err != nil {
		return Validated{}, err
	}
	copied := make([]Fact, len(facts))
	copy(copied, facts)
	return Validated{facts: copied}, nil
}

// Facts - геттер фактов
func (v Validated) Facts() []Fact {
	return v.facts
}
