# scanner

![tests](https://img.shields.io/badge/tests-passing-brightgreen) ![race](https://img.shields.io/badge/-race--tested-blue) ![lint](https://img.shields.io/badge/golangci--lint-passing-brightgreen)

Go-сервис пассивного сбора фактов о целевом сайте (заголовки, в будущем — TLS, открытые пути) для `sitefrisk` — AI-сканера веб-безопасности. HTTP-эндпоинт `/scan` запускает сбор и отдаёт собранные факты; результаты в перспективе передаются в Python ML-сервис через gRPC для анализа и оценки риска (контракт ниже, клиент пока не реализован).

> Пассивное наблюдение, не атака: сервис не эксплуатирует уязвимости, только собирает и структурирует общедоступные факты о цели.

## Архитектура

```
services/scanner/
├── main.go                          # composition root + HTTP-сервер (/health, /scan)
└── internal/
    ├── fact/                        # доменная модель факта + гарантия валидности через типы
    ├── collector/                   # порт Collector + конкурентный pipeline + событийный стриминг
    │   └── header/                  # первый рабочий Collector — security-заголовки
    ├── security/
    │   ├── ssrf/                    # защита исходящих запросов от SSRF
    │   └── sanitize/                # очистка Fact.Value перед выходом из сервиса
    ├── factory/                     # composition-policy: реестр Collector'ов (Factory Method)
    ├── handlers/                    # HTTP-обработчики (/health, /scan)
    └── mocks/                       # сгенерированные mockery-моки для тестов
```

Весь код лежит под `internal/` — Go физически не даёт импортировать его из других сервисов монорепо, `scanner` не задуман как переиспользуемая библиотека.

**Как добавить новый коллектор** (например TLS): реализовать `collector.Collector` в своём пакете (см. `internal/collector/header` как образец), добавить для него `factory.Registration` в `internal/factory/registration.go`. Больше никуда лезть не нужно — SSRF-защита и очистка значений применяются автоматически к любому коллектору через общий пайплайн в `internal/collector`, а не через код конкретного коллектора.

## Контракт (`contracts/scanner/v1/scanner.proto`)

```protobuf
message Fact            { string category; string key; string value; }
message Finding         { string cwe_id; string severity; string description; string recommendation; }
message AnalyzeRequest  { string scan_id; string target_url; repeated Fact facts; }
message AnalyzeResponse { string scan_id; string model_version; repeated Finding findings; float risk_score; }
service ScannerAnalysisService { rpc Analyze(AnalyzeRequest) returns (AnalyzeResponse); }
```

`go_package` контракта — отдельный модуль (`.../contracts/scanner/v1`), не часть модуля `scanner`. gRPC-клиент к ML-сервису пока не реализован (см. "Известные ограничения").

## Компоненты

### `internal/fact` — доменная модель

- `Fact` — категория (`header` / `tls` / `exposed_path`), ключ, значение.
- `Fact.Validate()` / `ValidateAll(facts []Fact)` — проверка на уровне значений. Новая `Category` без обновления `switch` в `Validate` ловится линтером `exhaustive` (см. `.golangci.yml`), а не только комментарием в коде.
- `Validated` — тип-обёртка над `[]Fact`, создаётся **только** через `NewValidated`, которая гоняет `ValidateAll` и делает defensive copy. Дальше по коду валидность факта — гарантия системы типов, а не то, что нужно проверять заново на каждом шаге ("parse, don't validate").
- Пакет не импортирует ничего за пределами стандартной библиотеки — домен не знает о сети/защите.

### `internal/collector` — порт и конкурентный сбор

- `Collector` — интерфейс с одним методом `Collect(ctx, targetURL) ([]fact.Fact, error)`.
- `RunAll` запускает все переданные коллекторы **параллельно** (горутины + канал + `sync.WaitGroup`), с общим таймаутом на весь скан через `context.WithTimeout` — один медленный коллектор не подвешивает остальные.
- Каждый результат коллектора на пути к каналу очищается через `security/sanitize.Clean` — это применяется здесь, один раз для всех коллекторов, а не в каждом коллекторе отдельно.
- Результат — не `(facts, error)`, а канал `<-chan Event`: `EventCollectorDone` на каждый завершившийся коллектор (промежуточный прогресс) и `EventValidationDone` как финальный, провалидированный результат. Канал `out` забуферен на `cap(res)+1` — ровно максимум возможных отправок за жизнь горутины, поэтому ни один `send` не может заблокироваться навечно, даже если вызывающий код перестал читать канал раньше времени (проверено `go test -race`, в т.ч. сценарий таймаута).
- Задел под будущую публикацию статуса скана в очередь (Redis/NATS — пока не подключены, см. `TODO` в коде).

### `internal/collector/header` — первый рабочий коллектор

Проверяет наличие и значения security-заголовков ответа: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`. HEAD-запрос через `ssrf.SafeDo`, таймаут — только через `ctx` (единый бюджет времени управляется в `RunAll`, не в самом HTTP-клиенте).

### `internal/security/ssrf` — защита исходящих запросов

Сканер принимает произвольный URL от пользователя и сам делает по нему запросы — готовый вектор для Server-Side Request Forgery (внутренние сервисы, облачные метаданные `169.254.169.254`, локальные БД/админки). Пакет закрывает это на двух независимых уровнях:

- **`checkURL`** — проверка схемы (`http`/`https`), порта (белый список) и IP хоста до построения запроса, с логированием заблокированных попыток.
- **`safeDialContext`** — резолвинг и проверка IP **в момент открытия TCP-соединения** (`http.Transport.DialContext`). Между проверкой и реальным подключением не остаётся окна для повторного DNS-запроса с другим ответом (DNS rebinding) — используется тот же резолв, что и был проверен.

Блокируются: loopback, приватные диапазоны (RFC1918 + IPv6 ULA), link-local (включая cloud metadata `169.254.169.254`), unspecified, multicast.

`SafeDo`/`SafeGet` — безопасная замена `http.Client.Do`/`http.Get`:
- автоматические редиректы запрещены на уровне `http.Client` (`CheckRedirect`), каждый хоп проверяется SSRF-guard'ом заново;
- принимает произвольный `*http.Request` — любой метод, не только GET;
- тело запроса намеренно не поддерживается (`ErrBodyNotSupported`) — повторять его на редиректах небезопасно;
- чувствительные заголовки (`Authorization`, `Cookie`, `WWW-Authenticate`, `Cookie2`) вырезаются при редиректе на другой хост — то же поведение, что у стандартного `net/http`.

### `internal/security/sanitize` — очистка перед выходом из сервиса

Собранные `Fact.Value` приходят от сканируемой цели — то есть от потенциально недоверенного источника. Если это значение в итоге окажется в промпте ML-сервиса (см. контракт), это вектор prompt injection. `Clean`:
- вырезает управляющие и невидимые Unicode-символы (zero-width, RTL/LTR override — техника маскировки текста от визуального ревью);
- обрезает значение по рунам (не по байтам — без риска разорвать multi-byte UTF-8 символ) до `maxValueLen` (защита от context-stuffing).

**Это defense-in-depth, не доказуемая защита** — в отличие от `ssrf`, где множество запрещённых IP конечно и перечисляемо, у prompt injection через естественный текст конечного списка признаков не существует. Финальный барьер — разделение instruction/data в промпте на стороне ML-сервиса, не эта очистка.

Применяется один раз в `collector.workerCollectors`, автоматически для результата любого `Collector` — ничего добавлять в сам коллектор не нужно.

### `internal/factory` — composition policy (Factory Method)

`Registration{Name, Kind, Factory}` — именованная фабрика коллектора. `Kind` (`passive`/`active`) разделяет коллекторы по риску для цели: пассивный HEAD-запрос — не то же самое, что активный брутфорс путей. `factory.Registrations` — единственное место, перечисляющее все коллекторы сервиса. Новый `Kind` без обновления `Valid()` ловится тем же линтером `exhaustive`.

### `internal/handlers` — HTTP-слой

- `GET /health` — статический JSON для проверки живости процесса.
- `GET /scan?url=...&kind=passive|active` (по умолчанию `passive`) — фильтрует `factory.Registrations` по `Kind`, строит коллекторы, прогоняет через `collector.RunAll`, отдаёт `{"facts": [...], "error": "..."}`. Неизвестный `kind` и отсутствующий `url` — `400`.

### `internal/mocks` — тестовые дублёры

`MockCollector`, сгенерированный `mockery` (`.mockery.yaml`) из интерфейса `collector.Collector`.

## Тестирование

```bash
go build ./...                       # собрать всё
go vet ./...                         # статическая проверка
golangci-lint run ./...              # includes exhaustive — ловит забытые case в Category/Kind
go test ./...                        # unit, без реальной сети
go test ./... -tags=integration      # + integration (реальный DNS/сеть, см. ssrf_integration_test.go)
go test ./... -race                  # обязательно перед коммитом — весь pipeline конкурентный
```

- `testing` + `testify` (`assert`/`require`/`mock`) везде.
- `mockery` — генерация моков интерфейсов, точечно, где важна проверка конкретных аргументов вызова; для простых случаев (`handlers.Scan`) — ручные стабы.
- `httptest` — тесты HTTP-логики без реальной сети (`handlers/scan_test.go`).
- Табличные тесты с граничными значениями (например, точные границы CIDR-диапазонов RFC1918) — везде, где применимо.

## Известные ограничения / TODO

- **Нет CI** — `go build`/`vet`/`golangci-lint`/`test -race` запускаются только руками. `exhaustive`-линтер не имеет зубов, если никто не обязан его прогонять перед мержем.
- `RunAll` стримит события в канал, но публикация во внешнюю очередь (Redis/NATS) ещё не подключена — сервис пока работает без брокера.
- `safeDialContext` использует только первый IP из списка резолва; если DNS вернул несколько адресов и первый недоступен, соединение не переключается на следующий автоматически.
- gRPC-клиент к ML-сервису ещё не реализован — `fact.Validated` спроектирован так, чтобы стать входным типом клиента напрямую, без повторной валидации на границе. Контракт живёт в отдельном Go-модуле (`contracts/scanner/v1`), а не внутри модуля `scanner` — для генерации стабов нужен `protoc`/`buf` + `replace` в `go.mod` на локальный путь (ни то, ни другое пока не настроено).
- `security/sanitize.Clean` — defense-in-depth от обфускации/context-stuffing, не полная защита от prompt injection (см. doc-комментарий пакета).
