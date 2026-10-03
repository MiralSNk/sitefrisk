/**
 * ThinkingIndicator: модель «думает» и показывает шаги по одному.
 * Пройденные шаги получают ✓, текущий светится. Так ожидание читается
 * как работа, а не как зависание.
 */
import type { ThinkingState } from '@/hooks/useModelChat';
import styles from './ThinkingIndicator.module.scss';

/** Пропсы. */
export interface ThinkingIndicatorProps {
  /** Состояние размышления. */
  thinking: ThinkingState;
}

export function ThinkingIndicator({ thinking }: ThinkingIndicatorProps) {
  /** Уже видимые шаги. */
  const visible = thinking.steps.slice(0, thinking.visibleCount);

  return (
    <div className={styles.root} aria-label="Модель анализирует отчёт">
      <div className={styles.avatar} aria-hidden="true">›</div>
      <ol className={styles.steps}>
        {visible.map((step, i) => {
          const done = i < visible.length - 1;
          return (
            <li key={step} className={styles.step} data-done={done || undefined}>
              <span className={styles.mark} aria-hidden="true">{done ? '✓' : '›'}</span>
              {step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
