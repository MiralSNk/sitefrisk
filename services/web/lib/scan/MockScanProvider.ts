/**
 * MockScanProvider: демо-реализация стратегии `ScanProvider`.
 *
 * Симулирует работу Go-сканера по таймеру: прогресс этапов, строки лога,
 * постепенное «обнаружение» находок. Эмитит те же события, что и настоящий
 * бэкенд, поэтому UI не отличает мок от реального сканера.
 */
import {
  MOCK_BOOT_LOG,
  MOCK_FACTS_COLLECTED,
  MOCK_FINDINGS,
  MOCK_RISK_SCORE,
  MOCK_SESSION_ID,
  MOCK_STAGES,
  type MockFindingSeed,
  type MockStage,
} from './mockScenario';
import type { Finding, ScanEventHandlers, ScanProvider, ScanStartOptions } from './types';

/** Полный сценарий симуляции. Можно передать свой в конструктор (удобно для тестов). */
export interface MockScanScenario {
  /** Этапы с длительностями и логами. */
  readonly stages: ReadonlyArray<MockStage>;
  /** Находки с моментом появления. */
  readonly findings: ReadonlyArray<MockFindingSeed>;
  /** Id сессии. */
  readonly sessionId: string;
  /** Итоговый risk score. */
  readonly riskScore: number;
  /** Количество собранных фактов. */
  readonly factsCollected: number;
}

/** Сценарий по умолчанию из `mockScenario.ts`. */
const DEFAULT_SCENARIO: MockScanScenario = {
  stages: MOCK_STAGES,
  findings: MOCK_FINDINGS,
  sessionId: MOCK_SESSION_ID,
  riskScore: MOCK_RISK_SCORE,
  factsCollected: MOCK_FACTS_COLLECTED,
};

/** Частота «тиков» симуляции, мс. 40 мс ≈ 25 кадров/с, этого хватает для плавности. */
const DEFAULT_TICK_MS = 40;

/**
 * Пороги прогресса, на которых выпадают строки лога этапа.
 * Для N строк равномерно раскладываются от 15% до 95%.
 */
function logThreshold(index: number, total: number): number {
  if (total <= 1) return 0.5;
  return 0.15 + (index * 0.8) / (total - 1);
}

/** Убирает служебное поле `revealAfterStage` у находки. */
function toPublicFinding({ revealAfterStage: _ignored, ...finding }: MockFindingSeed): Finding {
  return finding;
}

export class MockScanProvider implements ScanProvider {
  /**
   * @param scenario сценарий симуляции
   * @param tickMs   шаг таймера, мс
   */
  constructor(
    private readonly scenario: MockScanScenario = DEFAULT_SCENARIO,
    private readonly tickMs: number = DEFAULT_TICK_MS,
  ) {}

  /** Этапы отдаются наружу без служебных полей симуляции. */
  get stages() {
    return this.scenario.stages;
  }

  start(target: string, handlers: ScanEventHandlers, options: ScanStartOptions = {}): () => void {
    /** Множитель скорости (защита от 0 и отрицательных значений). */
    const speed = Math.max(0.1, options.speed ?? 1);
    /** Этапы сценария. */
    const { stages, findings } = this.scenario;
    /** Момент старта всего скана. */
    const startedAt = performance.now();
    /** Индекс текущего этапа. */
    let stageIndex = 0;
    /** Момент старта текущего этапа. */
    let stageStartedAt = startedAt;
    /** Сколько строк лога текущего этапа уже выпущено. */
    let emittedLogs = 0;
    /** Сквозной счётчик id строк лога. */
    let logId = 0;
    /** Находки, накопленные к текущему моменту (для итогового отчёта). */
    const collected: Finding[] = [];

    handlers.onLog({ id: ++logId, elapsedMs: 0, text: MOCK_BOOT_LOG, level: 'info' });
    handlers.onStageStart(0);

    const timer = setInterval(() => {
      const now = performance.now();
      const stage = stages[stageIndex];
      const progress = Math.min(1, (now - stageStartedAt) / (stage.durationMs / speed));
      const elapsedMs = now - startedAt;

      // Выпускаем строки лога, чьи пороги уже пройдены.
      while (emittedLogs < stage.logs.length && progress >= logThreshold(emittedLogs, stage.logs.length)) {
        handlers.onLog({ id: ++logId, elapsedMs, ...stage.logs[emittedLogs] });
        emittedLogs++;
      }

      handlers.onStageProgress(stageIndex, progress, elapsedMs);
      if (progress < 1) return;

      // Этап завершён: стримим находки, привязанные к нему.
      handlers.onStageComplete(stageIndex, now - stageStartedAt);
      findings
        .filter((seed) => seed.revealAfterStage === stageIndex)
        .forEach((seed) => {
          const finding = toPublicFinding(seed);
          collected.push(finding);
          handlers.onFinding(finding);
        });

      if (stageIndex >= stages.length - 1) {
        clearInterval(timer);
        handlers.onComplete({
          target,
          sessionId: this.scenario.sessionId,
          riskScore: this.scenario.riskScore,
          findings: [...collected].sort((a, b) => b.score - a.score),
          factsCollected: this.scenario.factsCollected,
          durationMs: elapsedMs,
        });
        return;
      }

      stageIndex++;
      stageStartedAt = now;
      emittedLogs = 0;
      handlers.onStageStart(stageIndex);
    }, this.tickMs);

    return () => clearInterval(timer);
  }
}
