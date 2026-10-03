'use client';
/**
 * DemoLog: мини-терминал на первом экране, печатает строки по кругу.
 * Показывает, что продукт «живой», ещё до того, как пользователь что-то ввёл.
 */
import { memo } from 'react';
import { useLineTyper } from '@/hooks/useLineTyper';
import { DEMO_LOG_LINES } from '@/lib/content/hero';
import styles from './DemoLog.module.scss';

/** Пропсы. */
export interface DemoLogProps {
  /** Подпись блока. */
  label: string;
  /** Строки (по умолчанию из контента). */
  lines?: ReadonlyArray<string>;
  /** false: статично. */
  animated?: boolean;
}

function DemoLogImpl({ label, lines = DEMO_LOG_LINES, animated = true }: DemoLogProps) {
  /** Текущая частично напечатанная строка. */
  const line = useLineTyper(lines, { enabled: animated });
  return (
    <div className={styles.log} aria-hidden="true">
      <div className={styles.label}>{label}</div>
      <div className={styles.line}>
        {line}
        <span className={styles.caret}>▌</span>
      </div>
    </div>
  );
}

export const DemoLog = memo(DemoLogImpl);
