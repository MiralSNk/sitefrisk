'use client';
/**
 * ShieldPanel: рамка с 3D-щитом и подписями.
 *
 * Сам WebGL-вьюпорт грузится лениво и только в браузере (`ssr: false`):
 * three.js не нужен серверу и не попадает в первичный бандл. Пока модуль
 * грузится, виден пульсирующий плейсхолдер того же размера, без сдвига вёрстки.
 */
import dynamic from 'next/dynamic';
import { CornerFrame } from '@/components/ui/CornerFrame/CornerFrame';
import styles from './ShieldPanel.module.scss';

/** Ленивый импорт вьюпорта. */
const ShieldCanvas = dynamic(() => import('@/components/shield/ShieldCanvas/ShieldCanvas'), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

/** Пропсы панели. */
export interface ShieldPanelProps {
  /** Подпись слева снизу (имя «объекта»). */
  caption: string;
  /** Метка «live» справа снизу. */
  liveLabel: string;
  /** Автоповорот модели. */
  autoRotate?: boolean;
}

export function ShieldPanel({ caption, liveLabel, autoRotate = true }: ShieldPanelProps) {
  return (
    <CornerFrame className={styles.panel}>
      <ShieldCanvas autoRotate={autoRotate} />
      <div className={styles.labels} aria-hidden="true">
        <span>{caption}</span>
        <span className={styles.live}>{liveLabel}</span>
      </div>
    </CornerFrame>
  );
}
