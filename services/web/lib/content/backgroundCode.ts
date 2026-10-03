/**
 * Фоновый код, который «печатается» за хиро.
 * Фрагменты на языках монорепо: Go (scanner), Python (ml), Java (auth),
 * TS (web) + proto-контракт. Чтобы добавить колонку, допишите объект в массив
 * и стиль позиции в `BackgroundCode.module.scss`.
 */

/** Положение колонки на экране (используется как data-атрибут в SCSS). */
export type CodeColumnPosition = 'left' | 'right' | 'center';

/** Описание одной колонки фонового кода. */
export interface BackgroundCodeColumn {
  /** Стабильный id. */
  readonly id: string;
  /** Где колонка расположена. */
  readonly position: CodeColumnPosition;
  /** Сам текст. */
  readonly code: string;
  /** Задержка между символами, мс: разная, чтобы колонки не шли синхронно. */
  readonly charDelayMs: number;
}

const GO_PY_JAVA = `// scanner/guard.go
func (s *Scanner) Run(ctx context.Context, target string) error {
  if err := guardSSRF(target); err != nil {
    return fmt.Errorf("blocked: %w", err)
  }
  facts, err := s.collect(ctx, target)
  findings := s.classify(facts)
  return s.report(findings)
}

// ml/infer.py
class VulnClassifier:
  def __init__(self, base, adapter):
    self.model = PeftModel.from_pretrained(base, adapter)

  def predict(self, facts: Facts) -> list[Finding]:
    logits = self.model(**self.tokenize(facts))
    return decode_cwe(logits)

// auth/SecurityConfig.java
@Configuration
public class SecurityConfig {
  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) {
    return http.oauth2ResourceServer(c -> c.jwt())
      .authorizeHttpRequests(a -> a.anyRequest().authenticated())
      .build();
  }
}`;

const TS_HTTP_DOCKER = `// web/app/scan/actions.ts
export async function startScan(url: string): Promise<ScanResult> {
  const res = await fetch(\`\${API}/v1/scan\`, {
    method: "POST",
    body: JSON.stringify({ target: url, depth: "passive" }),
  });
  if (!res.ok) throw new ScanError(res.status);
  return res.json();
}

POST /v1/scan HTTP/1.1
Host: api.sitefrisk.dev
{ "target": "example.com" }

< 200 OK
< CWE-200 risk=6.8

$ docker compose up -d
[+] Running 4/4
 ✓ web      started
 ✓ auth     started
 ✓ scanner  started
 ✓ ml       started`;

const PROTO = `message ScanRequest {
  string target = 1;
  ScanDepth depth = 2;
}

message Finding {
  string cwe_id = 1;
  float risk_score = 2;
  string explanation = 3;
}

service Scanner {
  rpc Run(ScanRequest) returns (stream Finding);
}`;

/** Три колонки фонового кода. */
export const BACKGROUND_CODE_COLUMNS: ReadonlyArray<BackgroundCodeColumn> = [
  { id: 'left', position: 'left', code: GO_PY_JAVA, charDelayMs: 45 },
  { id: 'right', position: 'right', code: TS_HTTP_DOCKER, charDelayMs: 55 },
  { id: 'center', position: 'center', code: PROTO, charDelayMs: 50 },
];
