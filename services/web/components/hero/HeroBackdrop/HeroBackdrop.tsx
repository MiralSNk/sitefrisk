/**
 * HeroBackdrop: декоративный фон хиро (всё `aria-hidden`, кликов не ловит).
 *
 * Слои снизу вверх:
 *  1. сканлайны — тонкие горизонтальные линии «ЭЛТ-монитора»;
 *  2. фоновый код — три колонки, печатаются сами по себе;
 *  3. сканирующая полоса — проходит сверху вниз;
 *  4. боковые «рельсы» — дрейфующие штрихи по краям;
 *  5. подсветка под курсором (координаты из CSS-переменных родителя).
 */
import { BACKGROUND_CODE_COLUMNS } from '@/lib/content/backgroundCode';
import { BackgroundCode } from './BackgroundCode';
import styles from './HeroBackdrop.module.scss';

/** Пропсы фона. */
export interface HeroBackdropProps {
  /** false: всё статично (reduced motion). */
  animated?: boolean;
}

export function HeroBackdrop({ animated = true }: HeroBackdropProps) {
  return (
    <div className={styles.root} data-animated={animated} aria-hidden="true">
      <div className={styles.scanlines} />
      {BACKGROUND_CODE_COLUMNS.map((column) => (
        <BackgroundCode key={column.id} column={column} animated={animated} />
      ))}
      <div className={styles.sweep} />
      <div className={styles.rail} data-side="left" />
      <div className={styles.rail} data-side="right" />
      <div className={styles.spotlight} />
    </div>
  );
}
