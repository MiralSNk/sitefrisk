/**
 * StatusDot: маленькая пульсирующая точка-индикатор.
 * Цвет задаётся тоном (`data-tone`), скорость пульса задаётся пропсом.
 */
import type { Tone } from '@/lib/scan/tone';
import styles from './StatusDot.module.scss';

/** Пропсы точки. */
export interface StatusDotProps {
  /** Цветовой тон. */
  tone?: Tone;
  /** Скорость пульса: slow (2 с), fast (1.2 с), none (без анимации). */
  pulse?: 'slow' | 'fast' | 'none';
  /** Доп. класс. */
  className?: string;
}

export function StatusDot({ tone = 'cyan', pulse = 'slow', className }: StatusDotProps) {
  return (
    <span
      className={[styles.dot, className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-pulse={pulse}
      aria-hidden="true"
    />
  );
}
