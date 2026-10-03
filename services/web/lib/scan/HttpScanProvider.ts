/**
 * HttpScanProvider: ШАБЛОН реальной стратегии под бэкенд.
 *
 * Предполагается, что `web` (Next.js) проксирует запрос в Go-сканер, а события
 * отдаются через Server-Sent Events: `GET /api/scan?target=...`.
 * Каждое SSE-событие называется так же, как метод `ScanEventHandlers`:
 *   event: stageStart    data: {"index":0}
 *   event: stageProgress data: {"index":0,"progress":0.4,"elapsedMs":820}
 *   event: log           data: {ScanLogEntry}
 *   event: finding       data: {Finding}
 *   event: stageComplete data: {"index":0,"durationMs":1700}
 *   event: complete      data: {ScanReport}
 *
 * Если бэкенд отдаёт события в другом формате, меняется только этот файл:
 * UI работает с интерфейсом `ScanProvider` (паттерн Adapter).
 */
import type { ScanEventHandlers, ScanProvider, ScanStageDefinition } from './types';

export class HttpScanProvider implements ScanProvider {
  /**
   * @param stages   список этапов (можно получать с бэкенда, тогда сделайте async-фабрику)
   * @param endpoint URL SSE-эндпоинта
   */
  constructor(
    public readonly stages: ReadonlyArray<ScanStageDefinition>,
    private readonly endpoint: string = '/api/scan',
  ) {}

  start(target: string, handlers: ScanEventHandlers): () => void {
    /** SSE-соединение с бэкендом. */
    const source = new EventSource(`${this.endpoint}?target=${encodeURIComponent(target)}`);

    /** Хелпер: подписка на именованное событие с JSON-парсингом. */
    const on = <T>(name: string, cb: (data: T) => void) =>
      source.addEventListener(name, (e) => cb(JSON.parse((e as MessageEvent<string>).data) as T));

    on<{ index: number }>('stageStart', (d) => handlers.onStageStart(d.index));
    on<{ index: number; progress: number; elapsedMs: number }>('stageProgress', (d) =>
      handlers.onStageProgress(d.index, d.progress, d.elapsedMs),
    );
    on('log', handlers.onLog);
    on('finding', handlers.onFinding);
    on<{ index: number; durationMs: number }>('stageComplete', (d) =>
      handlers.onStageComplete(d.index, d.durationMs),
    );
    on<Parameters<ScanEventHandlers['onComplete']>[0]>('complete', (report) => {
      handlers.onComplete(report);
      source.close();
    });
    source.onerror = () => {
      handlers.onError(new Error('Соединение со сканером прервано'));
      source.close();
    };

    return () => source.close();
  }
}
