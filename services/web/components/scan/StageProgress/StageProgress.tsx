/**
 * StageProgress: крупный вывод текущего этапа.
 * «ЭТАП 03 / 05» → заголовок → бегущий статус с «битым» хвостом → сегментная шкала.
 */
import { stageFlagTone } from '@/lib/scan/tone';
import type { ScanStageDefinition } from '@/lib/scan/types';
import { cssVars } from '@/lib/utils/cssVars';
import { randomGlitchString } from '@/lib/utils/random';
import styles from './StageProgress.module.scss';

/** Пропсы. */
export interface StageProgressProps {
  /** Этапы. */
  stages: ReadonlyArray<ScanStageDefinition>;
  /** Индекс текущего этапа. */
  stageIndex: number;
  /** Прогресс текущего этапа 0..1. */
  stageProgress: number;
}

/** Форматирует номер: 3 → «03». */
const pad = (n: number) => String(n).padStart(2, '0');

export function StageProgress({ stages, stageIndex, stageProgress }: StageProgressProps) {
  /** Текущий этап (с защитой от выхода за границы). */
  const current = stages[Math.min(stageIndex, stages.length - 1)];

  return (
    <div className={styles.root}>
      <div className={styles.counter}>
        ЭТАП {pad(stageIndex + 1)} / {pad(stages.length)}
      </div>
      {/* key = id этапа: при смене этапа заголовок заново «въезжает». */}
      <div key={current.id} className={styles.title} aria-live="polite">
        {current.title}
      </div>
      <div className={styles.detail} aria-hidden="true">
        {current.runningText} {randomGlitchString(4)}
      </div>
      <div className={styles.bars}>
        {stages.map((stage, i) => {
          const pct = i < stageIndex ? 100 : i === stageIndex ? Math.round(stageProgress * 100) : 0;
          const tone = i < stageIndex ? stageFlagTone(stage.flag) : 'cyan';
          return (
            <div key={stage.id} className={styles.bar}>
              <div className={styles.fill} data-tone={tone} style={cssVars({ '--pct': `${pct}%` })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
