'use client';
/**
 * RiskGauge: круговой индикатор риска 0–10.
 *
 * Два варианта:
 *  - `disc` — заполненный диск с подписью уровня (демо на первом экране);
 *  - `ring` — тонкое кольцо (итог отчёта).
 * Значение анимируется от 0 (useCountUp), цвет берётся из `riskTone()`.
 */
import { useCountUp } from '@/hooks/useCountUp';
import { riskLabel, riskTone } from '@/lib/scan/tone';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './RiskGauge.module.scss';

/** Пропсы индикатора. */
export interface RiskGaugeProps {
  /** Значение риска. */
  value: number;
  /** Максимум шкалы. */
  max?: number;
  /** Визуальный вариант. */
  variant?: 'disc' | 'ring';
  /** Подпись под числом. По умолчанию: уровень риска (disc) или «риск / 10» (ring). */
  caption?: string;
  /** Анимировать появление. */
  animate?: boolean;
}

export function RiskGauge({ value, max = 10, variant = 'disc', caption, animate = true }: RiskGaugeProps) {
  /** Анимированное значение. */
  const current = useCountUp(value, { enabled: animate });
  /** Заполненность в процентах. */
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  /** Подпись. */
  const label = caption ?? (variant === 'disc' ? riskLabel(current) : `риск / ${max}`);

  return (
    <div
      className={styles.gauge}
      data-variant={variant}
      data-tone={riskTone(current)}
      style={cssVars({ '--fill': `${percent}%` })}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(1))}
      aria-label={`Риск ${value.toFixed(1)} из ${max}`}
    >
      <div className={styles.track} />
      <div className={styles.center}>
        <span className={styles.value}>{current.toFixed(1)}</span>
        <span className={styles.caption}>{label}</span>
      </div>
    </div>
  );
}
