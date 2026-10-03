/**
 * Демо-сценарий скана: заглушка, пока не подключён Go-сканер.
 *
 * Чтобы поменять текст этапов, логи или находки, правьте этот файл,
 * компоненты трогать не нужно. Чтобы добавить этап, допишите объект в
 * `MOCK_STAGES`: радар, полосы прогресса и счётчики подстроятся сами.
 */
import type { Finding, LogLevel, ScanStageDefinition } from './types';

/** Этап мок-сценария: публичное описание + данные только для симуляции. */
export interface MockStage extends ScanStageDefinition {
  /** Сколько длится этап при speed = 1, мс. */
  readonly durationMs: number;
  /** Строки лога, которые «выпадут» по ходу этапа (равномерно по прогрессу). */
  readonly logs: ReadonlyArray<{ readonly text: string; readonly level: LogLevel }>;
}

/** Находка мок-сценария + момент, когда её «обнаружить». */
export interface MockFindingSeed extends Finding {
  /** Индекс этапа, по завершении которого находка появится. */
  readonly revealAfterStage: number;
}

/** Идентификатор демо-сессии. */
export const MOCK_SESSION_ID = '0x3F2A';

/** Итоговый risk score демо-отчёта. */
export const MOCK_RISK_SCORE = 6.8;

/** Сколько «фактов» собрал демо-скан. */
export const MOCK_FACTS_COLLECTED = 14;

/** Первая строка лога при старте. */
export const MOCK_BOOT_LOG = 'session 0x3F2A · passive mode';

/** Пять этапов: от резолва до анализа моделью. */
export const MOCK_STAGES: ReadonlyArray<MockStage> = [
  {
    id: 'ssrf',
    title: 'Резолв и SSRF-guard',
    short: 'ssrf-guard',
    runningText: 'резолвим DNS, проверяем диапазоны',
    durationMs: 1700,
    logs: [
      { text: 'dns: A → 93.184.216.34', level: 'info' },
      { text: 'ssrf_guard: private ranges ✓ · cloud-metadata ✓', level: 'ok' },
      { text: 'ssrf_guard: target allowed', level: 'ok' },
    ],
  },
  {
    id: 'tls',
    title: 'TLS-рукопожатие',
    short: 'tls',
    runningText: 'устанавливаем защищённое соединение',
    flag: 'warn',
    durationMs: 1500,
    logs: [
      { text: 'tls: ClientHello → :443', level: 'info' },
      { text: 'tls: negotiated TLSv1.2 ECDHE-RSA-AES128-GCM', level: 'ok' },
      { text: 'tls: TLSv1.3 не поддерживается', level: 'warn' },
    ],
  },
  {
    id: 'headers',
    title: 'Security-заголовки',
    short: 'headers',
    runningText: 'читаем ответ сервера',
    flag: 'warn',
    durationMs: 1400,
    logs: [
      { text: 'http: GET / → 200 · 38 KB', level: 'info' },
      { text: 'headers: HSTS ✓ X-Frame-Options ✓', level: 'ok' },
      { text: 'headers: Content-Security-Policy — отсутствует', level: 'warn' },
    ],
  },
  {
    id: 'paths',
    title: 'Открытые пути',
    short: 'paths',
    runningText: 'проверяем типичные чувствительные пути',
    flag: 'alert',
    durationMs: 2100,
    logs: [
      { text: 'probe: /.git/HEAD → 404', level: 'info' },
      { text: 'probe: /admin → 403', level: 'ok' },
      { text: 'probe: /.env → 200 OK (!)', level: 'alert' },
    ],
  },
  {
    id: 'ml',
    title: 'Анализ моделью',
    short: 'ml · cwe',
    runningText: 'модель классифицирует факты по CWE',
    flag: 'alert',
    durationMs: 2300,
    logs: [
      { text: 'ml: adapter sitefrisk-lora-v0 загружен', level: 'info' },
      { text: 'ml: 14 фактов → 3 находки', level: 'ok' },
      { text: 'ml: CWE-538 severity=high', level: 'alert' },
    ],
  },
];

/** Три демо-находки, по убыванию критичности. */
export const MOCK_FINDINGS: ReadonlyArray<MockFindingSeed> = [
  {
    id: 'env-exposed',
    severity: 'high',
    score: 8.1,
    cwe: 'CWE-538',
    title: 'Файл .env доступен публично',
    evidence: 'GET /.env → 200 · 412 байт · содержит DB_PASSWORD',
    suggestedQuestion: 'Насколько критичен открытый /.env?',
    revealAfterStage: 3,
  },
  {
    id: 'csp-missing',
    severity: 'medium',
    score: 5.4,
    cwe: 'CWE-693',
    title: 'Нет Content-Security-Policy',
    evidence: 'заголовок отсутствует в ответе на GET /',
    suggestedQuestion: 'Как настроить CSP для Next.js?',
    revealAfterStage: 2,
  },
  {
    id: 'tls-legacy',
    severity: 'low',
    score: 3.1,
    cwe: 'CWE-326',
    title: 'TLS 1.3 не поддерживается',
    evidence: 'negotiated TLSv1.2 · ECDHE-RSA-AES128-GCM',
    suggestedQuestion: 'Зачем переходить на TLS 1.3?',
    revealAfterStage: 1,
  },
];
