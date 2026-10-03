'use client';
/**
 * useScrambleText: посимвольное «расшифровывание» текста.
 * Слева проявляется настоящий текст, справа бежит хвост из «битых» символов.
 */
import { useEffect, useState } from 'react';
import { randomGlitchString } from '@/lib/utils/random';

/** Опции эффекта. */
export interface ScrambleOptions {
  /** Интервал между символами, мс. */
  readonly charIntervalMs?: number;
  /** Длина хвоста из случайных символов. */
  readonly tailLength?: number;
  /** false: сразу показать весь текст (reduced motion). */
  readonly enabled?: boolean;
}

/**
 * @param text    итоговый текст
 * @param options настройки скорости и хвоста
 * @returns строка для отображения в текущем кадре
 */
export function useScrambleText(text: string, options: ScrambleOptions = {}): string {
  const { charIntervalMs = 32, tailLength = 5, enabled = true } = options;
  /** Сколько символов настоящего текста уже проявлено. */
  const [revealed, setRevealed] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) {
      setRevealed(text.length);
      return;
    }
    setRevealed(0);
    const timer = setInterval(() => {
      setRevealed((count) => {
        if (count >= text.length) {
          clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, charIntervalMs);
    return () => clearInterval(timer);
  }, [text, charIntervalMs, enabled]);

  /** Хвост пересобирается на каждом рендере, поэтому символы «кипят»? */
  const tail = randomGlitchString(Math.min(tailLength, text.length - revealed));
  return text.slice(0, revealed) + tail;
}
