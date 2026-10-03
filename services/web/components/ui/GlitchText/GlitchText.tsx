/**
 * GlitchText: текст с RGB-расслоением (cyan + magenta слои рвутся по clip-path).
 * Копии-слои скрыты от скринридеров, читается только основной текст.
 */
import styles from './GlitchText.module.scss';

/** Пропсы. */
export interface GlitchTextProps {
  /** Текст. */
  text: string;
  /** Усилить эффект (во время активного глитча). */
  intense?: boolean;
}

export function GlitchText({ text, intense = false }: GlitchTextProps) {
  return (
    <span className={styles.root} data-intense={intense || undefined}>
      <span className={styles.layer} data-layer="cyan" aria-hidden="true">{text}</span>
      <span className={styles.layer} data-layer="magenta" aria-hidden="true">{text}</span>
      <span className={styles.base}>{text}</span>
    </span>
  );
}
