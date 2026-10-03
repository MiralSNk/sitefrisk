'use client';
/**
 * ScanView: экран сессии скана.
 *
 * Шапка сессии (статус, цель, время, «новый скан») + контент по фазе:
 *  - scanning → радар, текущий этап, живой лог;
 *  - done     → отчёт и чат с моделью (`ScanResults`).
 *
 * При входе на экран фокус переносится на заголовок сессии: скринридер
 * сразу объявит, что начался скан.
 */
import { useEffect, useRef } from 'react';
import { ScanRadar } from '@/components/scan/ScanRadar/ScanRadar';
import { ScanResults } from '@/components/scan/ScanResults/ScanResults';
import { ScanTerminal } from '@/components/scan/ScanTerminal/ScanTerminal';
import { StageProgress } from '@/components/scan/StageProgress/StageProgress';
import { StatusDot } from '@/components/ui/StatusDot/StatusDot';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ChatProvider } from '@/lib/chat/types';
import { formatSeconds } from '@/lib/scan/format';
import styles from './ScanView.module.scss';

/** Пропсы экрана. */
export interface ScanViewProps {
  /** Сессия скана из `useScanSession`. */
  session: ScanSession;
  /** Провайдер чата (передаётся дальше в результаты). */
  chatProvider: ChatProvider;
}

export function ScanView({ session, chatProvider }: ScanViewProps) {
  const { state, stages, reset } = session;
  /** Скан завершён. */
  const isDone = state.phase === 'done';
  /** Заголовок сессии: на него переносим фокус. */
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.status}>
            <StatusDot tone={isDone ? 'sand' : 'cyan'} pulse="fast" />
            {isDone && state.report ? `скан завершён · сессия ${state.report.sessionId}` : 'сканирование'}
          </div>
          <h2 ref={headingRef} tabIndex={-1} className={styles.target}>
            {state.target}
          </h2>
        </div>
        <div className={styles.meta}>
          <span aria-live="off">{formatSeconds(state.elapsedMs)}</span>
          <button type="button" className={styles.reset} onClick={reset}>
            ← новый скан
          </button>
        </div>
      </div>

      {state.phase === 'scanning' && (
        <div className={styles.scanning}>
          <ScanRadar
            stages={stages}
            stageIndex={state.stageIndex}
            stageProgress={state.stageProgress}
            findings={state.findings}
          />
          <div className={styles.progressColumn}>
            <StageProgress stages={stages} stageIndex={state.stageIndex} stageProgress={state.stageProgress} />
            <ScanTerminal logs={state.logs} />
          </div>
        </div>
      )}

      {isDone && state.report && <ScanResults report={state.report} chatProvider={chatProvider} />}
    </div>
  );
}
