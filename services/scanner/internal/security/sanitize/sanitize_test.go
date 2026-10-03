package sanitize_test

import (
	"testing"
	"unicode/utf8"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/security/sanitize"

	"github.com/stretchr/testify/assert"
)

func TestClean(t *testing.T) {
	t.Run("чистая строка не меняется", func(t *testing.T) {
		assert.Equal(t, "max-age=31536000", sanitize.Clean("max-age=31536000"))
	})

	t.Run("управляющие символы вырезаются", func(t *testing.T) {
		assert.Equal(t, "ab", sanitize.Clean("a\x00\x1bb"))
	})

	t.Run("zero-width и RTL override вырезаются", func(t *testing.T) {
		assert.Equal(t, "ab", sanitize.Clean("a\u200b\u202eb"))
	})

	t.Run("обрезка по длине безопасна для multibyte UTF-8", func(t *testing.T) {
		sanitize.SetMaxValueLen(3)
		defer sanitize.SetMaxValueLen(2048)

		got := sanitize.Clean("абвгд") // кириллица — многобайтовая в UTF-8
		assert.Equal(t, "абв", got)
		assert.True(t, utf8.ValidString(got))
	})
}
