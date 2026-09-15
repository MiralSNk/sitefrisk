package header

import (
	"context"
	"fmt"
	"net/http"

	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/ssrf"
)

// HeaderCollector собирает security-заголовки целевого сервера.
// Для создания используйте NewHeaderCollector.
type HeaderCollector struct {
	client *http.Client
}

// NewHeaderCollector создаёт коллектор с переиспользуемым HTTP-клиентом,
// защищённым от SSRF через ssrf.SafeClient.
//
// Создавайте один коллектор и вызывайте Collect многократно — клиент
// внутри держит пул соединений, так что не стоит плодить экземпляры.
//
// Собственного Timeout у клиента нет: таймаут задаётся через ctx
// вызывающего, чтобы общий бюджет времени контролировался в одном месте.
func NewHeaderCollector() *HeaderCollector {
	return &HeaderCollector{
		client: ssrf.SafeClient(),
	}
}

// NewHeaderCollectorWithClient создаёт коллектор с заданным HTTP-клиентом.
//
// Предназначен для тестов и для случаев, когда нужен уже настроенный
// клиент (кастомный Transport для метрик, трейсинга и т.п.).
//
// Внимание: переданный клиент должен иметь CheckRedirect != nil —
// иначе ssrf.SafeDo откажется работать.
func NewHeaderCollectorWithClient(client *http.Client) *HeaderCollector {
	return &HeaderCollector{client: client}
}

// doRequest выполняет HEAD-запрос по targetURL через ssrf.SafeDo.
//
// SafeDo проверяет схему, порт и IP на каждом хопе и блокирует
// запросы к приватным адресам. Ошибки ssrf пробрасываются в цепочке
// через ErrResponse: errors.Is(err, ErrResponse) и
// errors.Is(err, ssrf.ErrBlockedAddress) работают одновременно.
//
// Возвращает ErrRequest при сборке запроса и ErrResponse при ошибке
// сети или блокировке SSRF.
//
// Вызывающий обязан закрыть resp.Body.
func (h HeaderCollector) doRequest(ctx context.Context, targetURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrRequest, err)
	}

	resp, err := ssrf.SafeDo(ctx, h.client, req, maxRedirects)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrResponse, err)
	}

	return resp, nil
}

// Collect собирает security-заголовки по targetURL.
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
