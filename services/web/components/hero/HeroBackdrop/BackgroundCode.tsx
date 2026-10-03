'use client';
/**
 * BackgroundCode: одна колонка фонового кода, печатается по кругу.
 *
 * Обёрнута в `memo`: колонка перерисовывается ~20 раз/с из-за печати, но
 * эти перерисовки не выходят за её пределы и не трогают остальной хиро.
 */
import { memo } from 'react';
import { useTypewriterLoop } from '@/hooks/useTypewriterLoop';
import type { BackgroundCodeColumn } from '@/lib/content/backgroundCode';
import styles from './BackgroundCode.module.scss';

/** Пропсы колонки. */
export interface BackgroundCodeProps {
  /** Описание колонки (код, позиция, скорость). */
  column: BackgroundCodeColumn;
  /** false: показать код статично. */
  animated?: boolean;
}

function BackgroundCodeImpl({ column, animated = true }: BackgroundCodeProps) {
  /** Напечатанная часть кода. */
  const typed = useTypewriterLoop(column.code, { charDelayMs: column.charDelayMs, enabled: animated });
  return (
    <pre className={styles.code} data-position={column.position}>
      {typed}
    </pre>
  );
}

export const BackgroundCode = memo(BackgroundCodeImpl);
