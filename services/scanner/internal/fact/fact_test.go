package fact_test

import (
	"testing"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name   string
		fact   fact.Fact
		expErr error
	}{
		{name: "Валидный тест", fact: fact.Fact{Category: "header", Key: "example_key", Value: "example"}, expErr: nil},
		{name: "Пустой ключ", fact: fact.Fact{Category: "header", Value: "example"}, expErr: fact.ErrValidationKey},
		{name: "Неверная категория", fact: fact.Fact{Category: "example", Key: "example_key", Value: "example"}, expErr: fact.ErrValidationCategory},
		{name: "Пустая категория", fact: fact.Fact{Key: "example_key", Value: "example"}, expErr: fact.ErrValidationCategoryVoid},
		{name: "Пустой fact", fact: fact.Fact{}, expErr: fact.ErrVoidFact},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.fact.Validate(); tc.expErr == nil {
				assert.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expErr)
			}
		})
	}
}

func TestValidateAll(t *testing.T) {
	cases := []struct {
		name     string
		facts    []fact.Fact
		expErr   error
		expIndex int
	}{
		{name: "Валидный тест", facts: []fact.Fact{
			{Category: "header", Key: "example_key", Value: "example"},
		}, expErr: nil},

		{name: "Пустой ключ", facts: []fact.Fact{
			{Category: "header", Key: "example_key", Value: "example"},
			{Category: "header", Value: "example"},
			{Category: "header", Key: "example_key", Value: "example"},
		}, expErr: fact.ErrValidationKey, expIndex: 1},

		{name: "Неверная категория", facts: []fact.Fact{
			{Category: "header", Key: "example_key", Value: "example"},
			{Category: "header", Key: "example_key", Value: "example"},
			{Category: "example", Key: "example_key", Value: "example"},
		}, expErr: fact.ErrValidationCategory, expIndex: 2},

		{name: "Пустая категория", facts: []fact.Fact{
			{Key: "example_key", Value: "example"},
			{Category: "header", Key: "example_key", Value: "example"},
			{Category: "header", Key: "example_key", Value: "example"},
		}, expErr: fact.ErrValidationCategoryVoid, expIndex: 0},

		{name: "Пустой fact", facts: []fact.Fact{
			{Category: "header", Key: "example_key", Value: "example"},
			{},
			{Category: "header", Key: "example_key", Value: "example"},
		}, expErr: fact.ErrVoidFact, expIndex: 1},

		{name: "Пустые категории", facts: []fact.Fact{}, expErr: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := fact.ValidateAll(tc.facts); tc.expErr == nil {
				assert.NoError(t, err)
				return
			} else {
				var vef *fact.ErrValidation
				require.ErrorAs(t, err, &vef)
				assert.Equal(t, tc.expIndex, vef.Index)
				assert.ErrorIs(t, err, tc.expErr)
			}
		})
	}
}
