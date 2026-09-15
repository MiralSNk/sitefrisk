package header

import (
	"context"
	"fmt"
	"net/http"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
)

// Для создания используйте только NewHeaderCollector
type HeaderCollector struct {
	client *http.Client
}

// NewHeaderCollector - создаёт коллектор с переиспользуемым HTTP-клиентом.
// Создавайте один коллектор и вызывайте Collect многократно — клиент
// внутри держит пул соединений, так что не стоит плодить экземпляры.
func NewHeaderCollector() *HeaderCollector {
	return &HeaderCollector{
		client: &http.Client{Timeout: DefaultTimeout},
	}
}

// doRequest выполняет HEAD-запрос по targetURL.
// Возвращает ErrRequest при сборке запроса и ErrResponse при ошибке сети.
// Вызывающий обязан закрыть resp.Body.
func (h HeaderCollector) doRequest(ctx context.Context, targetURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrRequest, err)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrResponse, err)
	}

	return resp, nil
}

// Collect собирает данные по targetURL
func (h HeaderCollector) Collect(ctx context.Context, targetURL string) ([]fact.Fact, error) {
	var facts []fact.Fact

	resp, err := h.doRequest(ctx, targetURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	for _, key := range headerKeys {
		if v := resp.Header.Get(key); v != "" {
			facts = append(facts, fact.Fact{
				Category: fact.CategoryHeader,
				Key:      key,
				Value:    v,
			})
		}
	}

	return facts, nil
}
