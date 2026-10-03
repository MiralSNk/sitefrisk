'use client';
/**
 * FeatureChips: три чипа с ключевыми фичами.
 * На десктопе деталь раскрывается при наведении, на тач-экранах по тапу.
 * С клавиатуры работают фокус и Enter/Space.
 */
import { useState } from 'react';
import type { FeatureChip } from '@/lib/content/hero';
import styles from './FeatureChips.module.scss';

/** Пропсы. */
export interface FeatureChipsProps {
  /** Список чипов. */
  chips: ReadonlyArray<FeatureChip>;
  /** Подсказка, пока ни один чип не выбран. */
  hint: string;
}

export function FeatureChips({ chips, hint }: FeatureChipsProps) {
  /** id активного чипа (null = ни один). */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Активный чип. */
  const active = chips.find((chip) => chip.id === activeId);

  return (
    <div className={styles.root}>
      <div className={styles.list}>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={styles.chip}
            aria-pressed={chip.id === activeId}
            // Hover только для мыши: на тач-экранах эмулированный hover
            // конфликтовал бы с тапом (открыл и сразу закрыл).
            onPointerEnter={(e) => e.pointerType === 'mouse' && setActiveId(chip.id)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActiveId(null)}
            onBlur={() => setActiveId(null)}
            onClick={() => setActiveId((current) => (current === chip.id ? null : chip.id))}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <p className={styles.detail} data-active={active ? true : undefined} aria-live="polite">
        {active?.detail ?? hint}
      </p>
    </div>
  );
}
