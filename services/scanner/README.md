# scanner

![tests](https://img.shields.io/badge/tests-passing-brightgreen) ![coverage](https://img.shields.io/badge/coverage-84.2%25-brightgreen) ![race](https://img.shields.io/badge/-race--tested-blue)

Go-сервис пассивного сбора фактов о целевом сайте (заголовки, TLS, открытые пути) для `sitefrisk` — AI-сканера веб-безопасности. Результаты передаются в Python ML-сервис через gRPC для анализа и оценки риска.

> Пассивное наблюдение, не атака: сервис не эксплуатирует уязвимости, только собирает и структурирует общедоступные факты о цели.

## Архитектура

```
services/scanner/
├── main.go                          # заглушка /health, порт из SCANNER_PORT
└── internal/
    ├── fact/                        # доменная модель факта + гарантия валидности через типы
    ├── collector/                   # конкурентный pipeline сбора + событийный стриминг
    │   └── header/                  # первый рабочий Collector — security-заголовки
    ├── ssrf/                        # SSRF-guard — защита исходящих запросов
    └── mocks/                       # сгенерированные mockery-моки для тестов
```

Весь код лежит под `internal/` — Go физически не даёт импортировать его из других сервисов монорепо, `scanner` не задуман как переиспользуемая библиотека.

## Контракт (`contracts/scanner.proto`)

```protobuf
message Fact       { string category; string key; string value; }
message Finding     { string cwe_id; string severity; string description; string recommendation; }
message AnalyzeRequest  { string scan_id; string target_url; repeated Fact facts; }
message AnalyzeResponse { string scan_id; string model_version; repeated Finding findings; float risk_score; }
service ScannerAnalysis { rpc Analyze(AnalyzeRequest) returns (AnalyzeResponse); }
```

## Компоненты

### `internal/fact` — доменная модель

- `Fact` — категория (`header` / `tls` / `exposed_path`), ключ, значение.
- `Fact.Validate()` / `ValidateAll(facts []Fact)` — проверка на уровне значений.
- `Validated` — тип-обёртка над `[]Fact`, создаётся **только** через `NewValidated`, которая гоняет `ValidateAll` и делает defensive copy. Дальше по коду валидность факта — гарантия системы типов, а не то, что нужно проверять заново на каждом шаге ("parse, don't validate").

### `internal/collector` — конкурентный сбор

- `Collector` — интерфейс с одним методом `Collect(ctx, targetURL) ([]fact.Fact, error)`.
- `RunAll` запускает все переданные коллекторы **параллельно** (горутины + канал + `sync.WaitGroup`), с общим таймаутом на весь скан через `context.WithTimeout` — один медленный коллектор не подвешивает остальные.
- Результат — не `(facts, error)`, а канал `<-chan Event`: `EventCollectorDone` на каждый завершившийся коллектор (промежуточный прогресс) и `EventValidationDone` как финальный, провалидированный результат. Задел под будущую публикацию статуса скана в очередь (Redis/NATS — пока не подключены, см. `TODO` в коде).
- Покрыто тестами на гонки (`go test -race`), включая моки через `mockery` (`testify/mock`) для проверки конкретных вызовов и аргументов.

### `internal/collector/header` — первый рабочий коллектор

Проверяет наличие и значения security-заголовков ответа: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`. HEAD-запрос через `ssrf.SafeDo`, таймаут — только через `ctx` (единый бюджет времени управляется в `RunAll`, не в самом HTTP-клиенте).

### `internal/ssrf` — SSRF-guard

Сканер принимает произвольный URL от пользователя и сам делает по нему запросы — готовый вектор для Server-Side Request Forgery (внутренние сервисы, облачные метаданные `169.254.169.254`, локальные БД/админки). Пакет закрывает это на двух независимых уровнях:

- **`checkURL`** — проверка схемы (`http`/`https`), порта (белый список) и IP хоста до построения запроса, с логированием заблокированных попыток.
- **`safeDialContext`** — резолвинг и проверка IP **в момент открытия TCP-соединения** (`http.Transport.DialContext`). Между проверкой и реальным подключением не остаётся окна для повторного DNS-запроса с другим ответом (DNS rebinding) — используется тот же резолв, что и был проверен.

Блокируются: loopback, приватные диапазоны (RFC1918 + IPv6 ULA), link-local (включая cloud metadata `169.254.169.254`), unspecified, multicast.

`SafeDo`/`SafeGet` — безопасная замена `http.Client.Do`/`http.Get`:
- автоматические редиректы запрещены на уровне `http.Client` (`CheckRedirect`), каждый хоп проверяется SSRF-guard'ом заново;
- принимает произвольный `*http.Request` — любой метод, не только GET;
- тело запроса намеренно не поддерживается (`ErrBodyNotSupported`) — повторять его на редиректах небезопасно;
- чувствительные заголовки (`Authorization`, `Cookie`, `WWW-Authenticate`, `Cookie2`) вырезаются при редиректе на другой хост — то же поведение, что у стандартного `net/http`.

## Тестирование

**Покрытие: 84.2%** от всех операторов модуля (`go test ./... -coverpkg=./...`, снято на момент последнего коммита — значение зафиксировано вручную, не обновляется автоматически; для живого бейджа нужна интеграция с Codecov/Coveralls в CI).

- `testing` + `testify` (`assert`/`require`) везде.
- `mockery` — генерация моков интерфейсов (`.mockery.yaml`), используется точечно, где важна проверка конкретных аргументов вызова; для простых случаев — ручные фейки/`httptest`.
- `httptest.NewServer` — тесты HTTP-логики без реальной сети.
- `//go:build integration` — тесты, зависящие от реального DNS/сети, отделены от обычного прогона:
  ```bash
  go test ./...                      # unit, без сети
  go test ./... -tags=integration    # + integration
  go test ./... -race                # обязательно перед коммитом — весь пайплайн конкурентный
  ```
- Табличные тесты (`table-driven`) с граничными значениями (например, точные границы CIDR-диапазонов RFC1918) — везде, где применимо.

**Покрытие:** 84.2% (`go test ./... -coverprofile=coverage.out -coverpkg=./... && go tool cover -func=coverage.out | tail -1`). Зафиксировано на момент последнего коммита с SSRF-guard — команда выше пересчитывает актуальное значение, число ниже не обновляется автоматически.

## Известные ограничения / TODO

- `RunAll` стримит события в канал, но публикация во внешнюю очередь (Redis/NATS) ещё не подключена — сервис пока работает без брокера.
- `safeDialContext` использует только первый IP из списка резолва; если DNS вернул несколько адресов и первый недоступен, соединение не переключается на следующий автоматически.
- gRPC-клиент к ML-сервису ещё не реализован — `fact.Validated` спроектирован так, чтобы стать входным типом клиента напрямую, без повторной валидации на границе.