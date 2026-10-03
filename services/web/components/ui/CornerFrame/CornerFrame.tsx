/**
 * CornerFrame: обёртка с золотыми уголками-«скобками» по углам.
 * Визуальная отсылка к колоннам/рамкам из референса. Используется вокруг 3D-щита.
 */
import type { ReactNode } from 'react';
import styles from './CornerFrame.module.scss';

/** Пропсы рамки. */
export interface CornerFrameProps {
  /** Содержимое. */
  children: ReactNode;
  /** Размер уголков: sm = 22px, md = 26px. */
  size?: 'sm' | 'md';
  /** Доп. класс (размеры и пропорции задаёт родитель). */
  className?: string;
}

/** Список углов: так разметку не нужно дублировать четыре раза. */
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

export function CornerFrame({ children, size = 'md', className }: CornerFrameProps) {
  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')} data-size={size}>
      {CORNERS.map((corner) => (
        <span key={corner} className={styles.corner} data-corner={corner} aria-hidden="true" />
      ))}
      {children}
    </div>
  );
}
