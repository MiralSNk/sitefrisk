'use client';
/**
 * useLineTyper: печатает строки по одной, по кругу (демо-лог на первом экране).
 */
import { useEffect, useState } from 'react';

/** Опции. */
export interface LineTyperOptions {
  /** Задержка между символами, мс. */
  readonly charDelayMs?: number;
  /** Пауза после строки, мс. */
  readonly linePauseMs?: number;
  /** false: показывать первую строку целиком. */
  readonly enabled?: boolean;
}

/** @returns текущая (частично напечатанная) строка */
export function useLineTyper(lines: ReadonlyArray<string>, options: LineTyperOptions = {}): string {
  const { charDelayMs = 26, linePauseMs = 1000, enabled = true } = options;
  /** Индекс текущей строки. */
  const [lineIndex, setLineIndex] = useState(0);
  /** Сколько символов строки напечатано. */
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!enabled || lines.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    let line = 0;
    let chars = 0;
    const tick = () => {
      const current = lines[line % lines.length];
      if (chars < current.length) {
        chars++;
        setCharCount(chars);
        timer = setTimeout(tick, charDelayMs);
      } else {
        timer = setTimeout(() => {
          line++;
          chars = 0;
          setLineIndex(line);
          setCharCount(0);
          tick();
        }, linePauseMs);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [lines, charDelayMs, linePauseMs, enabled]);

  if (lines.length === 0) return '';
  if (!enabled) return lines[0];
  return lines[lineIndex % lines.length].slice(0, charCount);
}
