'use client';
/**
 * useTypewriterLoop: печатает текст посимвольно, после паузы начинает заново.
 * Используется для фонового кода. Каждая колонка — отдельный компонент
 * со своим хуком, поэтому перерисовывается только она, а не весь хиро.
 */
import { useEffect, useState } from 'react';

/** Опции печати. */
export interface TypewriterLoopOptions {
  /** Задержка между символами, мс. */
  readonly charDelayMs?: number;
  /** Пауза после полной печати перед перезапуском, мс. */
  readonly restartPauseMs?: number;
  /** false: показать весь текст статично. */
  readonly enabled?: boolean;
}

/** @returns уже напечатанная часть текста */
export function useTypewriterLoop(text: string, options: TypewriterLoopOptions = {}): string {
  const { charDelayMs = 50, restartPauseMs = 2400, enabled = true } = options;
  /** Количество напечатанных символов. */
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    /** Текущий таймер (setTimeout вместо setInterval, чтобы задать паузу в конце). */
    let timer: ReturnType<typeof setTimeout>;
    /** Локальный счётчик: так не нужно читать state внутри таймера. */
    let local = 0;
    const tick = () => {
      if (local >= text.length) {
        timer = setTimeout(() => {
          local = 0;
          setCount(0);
          tick();
        }, restartPauseMs);
        return;
      }
      local++;
      setCount(local);
      timer = setTimeout(tick, charDelayMs);
    };
    tick();
    return () => clearTimeout(timer);
  }, [text, charDelayMs, restartPauseMs, enabled]);

  return enabled ? text.slice(0, count) : text;
}
