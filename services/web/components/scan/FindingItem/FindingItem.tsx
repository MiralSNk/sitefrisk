/**
 * FindingItem: строка списка находок.
 * Вся строка — кнопка: клик отправляет вопрос модели.
 * Слева три точки критичности, по центру суть и доказательство, справа статус.
 */
import { SEVERITY_LABEL, SEVERITY_LEVEL, SEVERITY_TONE } from '@/lib/scan/tone';
import type { Finding } from '@/lib/scan/types';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './FindingItem.module.scss';

/** Пропсы. */
export interface FindingItemProps {
  /** Находка. */
  finding: Finding;
  /** Порядковый номер (для каскадной анимации появления). */
  index: number;
  /** Сейчас обсуждается в чате. */
  active: boolean;
  /** Модель занята: клики временно не принимаются. */
  disabled?: boolean;
  /** Обработчик выбора. */
  onSelect: (finding: Finding) => void;
}

/** Задержка между появлением соседних строк, с. */
const STAGGER_S = 0.12;

export function FindingItem({ finding, index, active, disabled = false, onSelect }: FindingItemProps) {
  /** Тон по критичности. */
  const tone = SEVERITY_TONE[finding.severity];
  /** Сколько точек закрасить. */
  const level = SEVERITY_LEVEL[finding.severity];

  return (
    <button
      type="button"
      className={styles.item}
      data-active={active || undefined}
      data-tone={tone}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={() => !disabled && onSelect(finding)}
      style={cssVars({ '--delay': `${0.2 + index * STAGGER_S}s` })}
    >
      <span className={styles.dots} aria-label={`Критичность: ${SEVERITY_LABEL[finding.severity]}`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={styles.dot} data-on={n <= level || undefined} />
        ))}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{finding.title}</span>
        <span className={styles.evidence}>{finding.evidence}</span>
        <span className={styles.meta}>
          {SEVERITY_LABEL[finding.severity]} · {finding.cwe} · {finding.score.toFixed(1)}
        </span>
      </span>
      <span className={styles.cta}>{active ? '● в обсуждении' : 'обсудить →'}</span>
    </button>
  );
}
