'use client';
/**
 * useScanSession: конечный автомат сессии скана (idle → scanning → done).
 *
 * Хук подписывается на события `ScanProvider` (Observer) и сворачивает их
 * в одно состояние через reducer. UI получает готовое состояние и две
 * команды: `start(url)` и `reset()`. Хук не знает, мок внутри или реальный бэкенд.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Finding, ScanLogEntry, ScanProvider, ScanReport, ScanStageDefinition } from '@/lib/scan/types';

/** Фаза сессии. */
export type ScanPhase = 'idle' | 'scanning' | 'done';

/** Полное состояние сессии. */
export interface ScanSessionState {
  /** Текущая фаза. */
  readonly phase: ScanPhase;
  /** Сканируемый URL. */
  readonly target: string;
  /** Индекс текущего этапа. */
  readonly stageIndex: number;
  /** Прогресс текущего этапа 0..1. */
  readonly stageProgress: number;
  /** Длительности завершённых этапов, мс (индекс = этап). */
  readonly stageDurationsMs: ReadonlyArray<number>;
  /** Последние строки лога (не больше MAX_LOG_LINES). */
  readonly logs: ReadonlyArray<ScanLogEntry>;
  /** Находки, обнаруженные к этому моменту. */
  readonly findings: ReadonlyArray<Finding>;
  /** Прошло времени от старта, мс. */
  readonly elapsedMs: number;
  /** Итоговый отчёт (есть только в фазе done). */
  readonly report: ScanReport | null;
  /** Текст ошибки, если скан упал. */
  readonly error: string | null;
}

/** Сколько строк лога держать в памяти: старые плавно уходят. */
const MAX_LOG_LINES = 8;

/** Начальное состояние. */
const INITIAL_STATE: ScanSessionState = {
  phase: 'idle',
  target: '',
  stageIndex: 0,
  stageProgress: 0,
  stageDurationsMs: [],
  logs: [],
  findings: [],
  elapsedMs: 0,
  report: null,
  error: null,
};

/** Все действия reducer’а: по одному на каждое событие провайдера. */
type ScanAction =
  | { type: 'start'; target: string }
  | { type: 'stageStart'; index: number }
  | { type: 'progress'; index: number; progress: number; elapsedMs: number }
  | { type: 'log'; entry: ScanLogEntry }
  | { type: 'finding'; finding: Finding }
  | { type: 'stageComplete'; index: number; durationMs: number }
  | { type: 'complete'; report: ScanReport }
  | { type: 'error'; message: string }
  | { type: 'reset' };

/** Чистая функция переходов автомата. */
function scanReducer(state: ScanSessionState, action: ScanAction): ScanSessionState {
  switch (action.type) {
    case 'start':
      return { ...INITIAL_STATE, phase: 'scanning', target: action.target };
    case 'stageStart':
      return { ...state, stageIndex: action.index, stageProgress: 0 };
    case 'progress':
      return { ...state, stageIndex: action.index, stageProgress: action.progress, elapsedMs: action.elapsedMs };
    case 'log':
      return { ...state, logs: [...state.logs, action.entry].slice(-MAX_LOG_LINES) };
    case 'finding':
      return { ...state, findings: [...state.findings, action.finding] };
    case 'stageComplete': {
      const durations = [...state.stageDurationsMs];
      durations[action.index] = action.durationMs;
      return { ...state, stageDurationsMs: durations };
    }
    case 'complete':
      return {
        ...state,
        phase: 'done',
        stageProgress: 1,
        report: action.report,
        findings: action.report.findings,
        elapsedMs: action.report.durationMs,
      };
    case 'error':
      return { ...INITIAL_STATE, error: action.message };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

/** Опции хука. */
export interface UseScanSessionOptions {
  /** Множитель скорости скана. */
  readonly speed?: number;
  /** Колбэк на завершение этапа (используется для глитч-«удара»). */
  readonly onStageComplete?: (index: number) => void;
}

/** Публичный API сессии. */
export interface ScanSession {
  /** Текущее состояние. */
  readonly state: ScanSessionState;
  /** Список этапов провайдера. */
  readonly stages: ReadonlyArray<ScanStageDefinition>;
  /** Запустить скан нормализованного URL. */
  start(target: string): void;
  /** Вернуться на первый экран. */
  reset(): void;
}

export function useScanSession(provider: ScanProvider, options: UseScanSessionOptions = {}): ScanSession {
  const [state, dispatch] = useReducer(scanReducer, INITIAL_STATE);
  /** Функция отмены активного скана. */
  const cancelRef = useRef<(() => void) | null>(null);
  /** Актуальные опции в ref: колбэки не пересоздают `start`. */
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const start = useCallback(
    (target: string) => {
      cancelRef.current?.();
      dispatch({ type: 'start', target });
      cancelRef.current = provider.start(
        target,
        {
          onStageStart: (index) => dispatch({ type: 'stageStart', index }),
          onStageProgress: (index, progress, elapsedMs) => dispatch({ type: 'progress', index, progress, elapsedMs }),
          onLog: (entry) => dispatch({ type: 'log', entry }),
          onFinding: (finding) => dispatch({ type: 'finding', finding }),
          onStageComplete: (index, durationMs) => {
            dispatch({ type: 'stageComplete', index, durationMs });
            optionsRef.current.onStageComplete?.(index);
          },
          onComplete: (report) => {
            dispatch({ type: 'complete', report });
            cancelRef.current = null;
          },
          onError: (error) => {
            dispatch({ type: 'error', message: error.message });
            cancelRef.current = null;
          },
        },
        { speed: optionsRef.current.speed },
      );
    },
    [provider],
  );

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  // При размонтировании гасим активный скан.
  useEffect(() => () => cancelRef.current?.(), []);

  return { state, stages: provider.stages, start, reset };
}
