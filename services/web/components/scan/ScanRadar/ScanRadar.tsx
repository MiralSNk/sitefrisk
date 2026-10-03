/**
 * ScanRadar: круговой радар скана.
 *
 * - Пять узлов-этапов по окружности: ожидание → активный («дышит») → готов (тон флага).
 * - Внешнее кольцо заполняется по общему прогрессу.
 * - Вращающийся луч, концентрические круги, перекрестие.
 * - Найденные уязвимости появляются «блипами» с расходящимся кольцом и CWE-меткой.
 *
 * Компонент чисто презентационный: всё нужное приходит в пропсах.
 */
import { SEVERITY_TONE, stageFlagTone, type Tone } from '@/lib/scan/tone';
import type { Finding, ScanStageDefinition } from '@/lib/scan/types';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './ScanRadar.module.scss';

/** Пропсы радара. */
export interface ScanRadarProps {
  /** Этапы. */
  stages: ReadonlyArray<ScanStageDefinition>;
  /** Индекс текущего этапа. */
  stageIndex: number;
  /** Прогресс текущего этапа 0..1. */
  stageProgress: number;
  /** Обнаруженные находки. */
  findings: ReadonlyArray<Finding>;
}

/**
 * Позиции блипов внутри радара (% от размера). Находки занимают их по порядку.
 * Это решение UI, а не данных, поэтому координаты живут здесь, а не в API.
 */
const BLIP_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 68, y: 67 },
  { x: 30, y: 62 },
  { x: 64, y: 30 },
  { x: 38, y: 28 },
  { x: 74, y: 46 },
];

/** Состояние узла этапа. */
type NodeState = 'wait' | 'run' | 'done';

export function ScanRadar({ stages, stageIndex, stageProgress, findings }: ScanRadarProps) {
  /** Общий прогресс скана, %. */
  const overall = Math.round(((stageIndex + stageProgress) / stages.length) * 100);
  /** Шаг между узлами по окружности, градусы. */
  const step = 360 / stages.length;

  return (
    <div className={styles.radar} style={cssVars({ '--overall': `${overall}%` })} role="img" aria-label={`Прогресс скана ${overall}%`}>
      <div className={styles.ring} data-ring="outer" />
      <div className={styles.ring} data-ring="mid" />
      <div className={styles.ring} data-ring="inner" />
      <div className={styles.axis} data-axis="v" />
      <div className={styles.axis} data-axis="h" />
      <div className={styles.beam} />
      <div className={styles.progressRing} />

      {findings.map((finding, i) => {
        const pos = BLIP_POSITIONS[i % BLIP_POSITIONS.length];
        return (
          <div
            key={finding.id}
            className={styles.blip}
            data-tone={SEVERITY_TONE[finding.severity]}
            style={cssVars({ '--x': `${pos.x}%`, '--y': `${pos.y}%` })}
          >
            <span className={styles.blipDot} />
            <span className={styles.blipPing} />
            <span className={styles.blipLabel}>{finding.cwe}</span>
          </div>
        );
      })}

      {stages.map((stage, i) => {
        const state: NodeState = i < stageIndex ? 'done' : i === stageIndex ? 'run' : 'wait';
        const angle = ((-90 + i * step) * Math.PI) / 180;
        const tone: Tone = state === 'done' ? stageFlagTone(stage.flag) : state === 'run' ? 'cyan' : 'muted';
        return (
          <div
            key={stage.id}
            className={styles.node}
            data-state={state}
            data-tone={tone}
            style={cssVars({ '--x': `${50 + 50 * Math.cos(angle)}%`, '--y': `${50 + 50 * Math.sin(angle)}%` })}
            title={stage.title}
          >
            {String(i + 1).padStart(2, '0')}
          </div>
        );
      })}

      <div className={styles.center}>
        <span className={styles.percent}>
          {overall}
          <span className={styles.percentSign}>%</span>
        </span>
        <span className={styles.centerLabel}>{findings.length ? `находок: ${findings.length}` : 'сканирование'}</span>
      </div>
    </div>
  );
}
