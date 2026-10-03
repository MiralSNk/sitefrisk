'use client';
/**
 * useCountUp: плавно доводит число от 0 до target (индикаторы риска).
 * Работает на requestAnimationFrame с ease-out кривой.
 */
import { useEffect, useState } from 'react';

/** Опции. */
export interface CountUpOptions {
  /** Длительность анимации, мс. */
  readonly durationMs?: number;
  /** false: сразу вернуть target. */
  readonly enabled?: boolean;
}

/** Кривая ease-out cubic: быстро стартует, мягко останавливается. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** @returns текущее анимированное значение */
export function useCountUp(target: number, options: CountUpOptions = {}): number {
  const { durationMs = 1800, enabled = true } = options;
  /** Текущее значение. */
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    /** Момент старта анимации. */
    const startedAt = performance.now();
    /** id кадра для отмены. */
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled]);

  return value;
}
