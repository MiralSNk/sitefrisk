'use client';
/**
 * useGlitchScheduler: планировщик случайных глитчей.
 *
 * Раз в 2.2–4.8 с выбирает тип из пула и создаёт событие через
 * `createGlitchEvent`. Компоненты читают `event` и реагируют. Ручной запуск
 * делается через `trigger()`, например «удар» при смене этапа скана.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGlitchEvent, type GlitchEvent, type GlitchType } from '@/lib/glitch/glitchFactory';
import { randomBetween, randomFrom } from '@/lib/utils/random';

/** Опции планировщика. */
export interface GlitchSchedulerOptions {
  /** Включён ли планировщик (false при reduced motion). */
  readonly enabled: boolean;
  /** Из каких типов выбирать. Можно менять на лету, таймер не перезапускается. */
  readonly pool: ReadonlyArray<GlitchType>;
  /** Минимальная пауза между глитчами, мс. */
  readonly minDelayMs?: number;
  /** Максимальная пауза, мс. */
  readonly maxDelayMs?: number;
}

/** Публичный API хука. */
export interface GlitchScheduler {
  /** Текущий активный глитч или null. */
  readonly event: GlitchEvent | null;
  /** Запустить глитч вручную. */
  trigger(type: GlitchType, intensity?: number): void;
}

export function useGlitchScheduler({
  enabled,
  pool,
  minDelayMs = 2200,
  maxDelayMs = 4800,
}: GlitchSchedulerOptions): GlitchScheduler {
  /** Активное событие. */
  const [event, setEvent] = useState<GlitchEvent | null>(null);
  /** Актуальный пул в ref: смена пула не перезапускает таймер. */
  const poolRef = useRef(pool);
  /** Таймер окончания текущего глитча. */
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  const trigger = useCallback(
    (type: GlitchType, intensity = 1) => {
      if (!enabled) return;
      clearTimeout(endTimerRef.current);
      const next = createGlitchEvent(type, intensity);
      setEvent(next);
      endTimerRef.current = setTimeout(() => setEvent(null), next.durationMs);
    },
    [enabled],
  );

  // Фоновый цикл: случайная пауза → глитч → снова пауза.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (poolRef.current.length > 0) trigger(randomFrom(poolRef.current));
        schedule();
      }, randomBetween(minDelayMs, maxDelayMs));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, trigger, minDelayMs, maxDelayMs]);

  useEffect(() => () => clearTimeout(endTimerRef.current), []);

  return { event, trigger };
}
