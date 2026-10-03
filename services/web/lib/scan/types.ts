/**
 * Доменные типы сканирования.
 *
 * Описывают контракт между UI и источником данных (мок, HTTP/SSE, gRPC-web).
 * Структура повторяет `contracts/scanner.proto`: `Finding` ↔ `message Finding`,
 * `ScanProvider.start` ↔ `rpc Run(ScanRequest) returns (stream Finding)`.
 * UI зависит только от этих интерфейсов, а не от конкретной реализации
 * (принцип инверсии зависимостей).
 */

/** Критичность уязвимости. */
export type Severity = 'high' | 'medium' | 'low';

/** Уровень строки в живом логе скана. */
export type LogLevel = 'info' | 'ok' | 'warn' | 'alert';

/** Итоговый флаг этапа: было ли на нём что-то подозрительное. */
export type StageFlag = 'warn' | 'alert';

/** Описание одного этапа скана (статичные метаданные, без прогресса). */
export interface ScanStageDefinition {
  /** Стабильный идентификатор этапа (для key и аналитики). */
  readonly id: string;
  /** Заголовок для крупного вывода: «TLS-рукопожатие». */
  readonly title: string;
  /** Короткая метка для компактных мест: «tls». */
  readonly short: string;
  /** Текст, пока этап выполняется: «устанавливаем защищённое соединение». */
  readonly runningText: string;
  /** Флаг результата. Нет флага, значит этап прошёл чисто. */
  readonly flag?: StageFlag;
}

/** Найденная уязвимость. Аналог `message Finding` из proto. */
export interface Finding {
  /** Уникальный id находки в рамках отчёта. */
  readonly id: string;
  /** Критичность. */
  readonly severity: Severity;
  /** Оценка риска 0–10. */
  readonly score: number;
  /** Идентификатор по таксономии MITRE CWE, например «CWE-538». */
  readonly cwe: string;
  /** Человекочитаемое название. */
  readonly title: string;
  /** Техническое доказательство: что именно увидел сканер. */
  readonly evidence: string;
  /** Вопрос модели, который отправится по клику на находку. */
  readonly suggestedQuestion: string;
}

/** Одна строка живого лога. */
export interface ScanLogEntry {
  /** Порядковый id (для key в React). */
  readonly id: number;
  /** Сколько миллисекунд прошло от старта скана. */
  readonly elapsedMs: number;
  /** Текст строки. */
  readonly text: string;
  /** Уровень, от него зависит цвет. */
  readonly level: LogLevel;
}

/** Итоговый отчёт: приходит один раз, когда скан завершён. */
export interface ScanReport {
  /** Нормализованный URL цели. */
  readonly target: string;
  /** Идентификатор сессии скана (показывается в UI и передаётся модели). */
  readonly sessionId: string;
  /** Общий risk score 0–10. */
  readonly riskScore: number;
  /** Все находки, отсортированные по убыванию критичности. */
  readonly findings: ReadonlyArray<Finding>;
  /** Сколько фактов собрал сканер. */
  readonly factsCollected: number;
  /** Длительность скана, мс. */
  readonly durationMs: number;
}

/**
 * Обработчики событий скана (паттерн Observer).
 * Провайдер вызывает их по мере работы, UI подписывается через `useScanSession`.
 */
export interface ScanEventHandlers {
  /** Этап с индексом `index` начался. */
  onStageStart(index: number): void;
  /** Прогресс текущего этапа 0..1 и общее прошедшее время. */
  onStageProgress(index: number, progress: number, elapsedMs: number): void;
  /** Новая строка в логе. */
  onLog(entry: ScanLogEntry): void;
  /** Найдена уязвимость (стримится по ходу, как `stream Finding` в proto). */
  onFinding(finding: Finding): void;
  /** Этап завершён за `durationMs`. */
  onStageComplete(index: number, durationMs: number): void;
  /** Скан полностью завершён. */
  onComplete(report: ScanReport): void;
  /** Ошибка: сеть, SSRF-блокировка, таймаут и т.п. */
  onError(error: Error): void;
}

/** Опции запуска скана. */
export interface ScanStartOptions {
  /** Множитель скорости (для демо/тестов). 1 = обычная. */
  readonly speed?: number;
}

/**
 * Стратегия получения данных скана (паттерн Strategy).
 * Реализации: `MockScanProvider` (демо) и `HttpScanProvider` (шаблон под бэкенд).
 * Выбор реализации — в `src/lib/providers.ts`.
 */
export interface ScanProvider {
  /** Список этапов: UI рисует их заранее, ещё до старта. */
  readonly stages: ReadonlyArray<ScanStageDefinition>;
  /**
   * Запускает скан.
   * @param target   нормализованный URL
   * @param handlers подписчики на события
   * @param options  доп. опции
   * @returns функция отмены. Её обязательно вызывать при размонтировании.
   */
  start(target: string, handlers: ScanEventHandlers, options?: ScanStartOptions): () => void;
}
