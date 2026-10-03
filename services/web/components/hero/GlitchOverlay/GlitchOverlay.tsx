/**
 * GlitchOverlay: слой помех поверх контента во время scan-глитча.
 * Цветные полосы-смещения и всплывающие строки «вредоносного» кода.
 * Все числа заранее посчитаны в `createGlitchEvent`, здесь только рендер.
 */
import type { GlitchEvent } from '@/lib/glitch/glitchFactory';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './GlitchOverlay.module.scss';

/** Пропсы оверлея. */
export interface GlitchOverlayProps {
  /** Текущий глитч. Рисуем только для типа scan. */
  event: GlitchEvent | null;
}

export function GlitchOverlay({ event }: GlitchOverlayProps) {
  if (!event || event.type !== 'scan') return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      {event.bands.map((band, i) => (
        <div
          key={`b${event.id}-${i}`}
          className={styles.band}
          data-tone={band.tone}
          style={cssVars({
            '--top': `${band.topPct}%`,
            '--height': `${band.heightPx}px`,
            '--offset': `${band.offsetPx}px`,
            '--opacity': band.opacity,
          })}
        />
      ))}
      {event.snippets.map((snippet, i) => (
        <div
          key={`s${event.id}-${i}`}
          className={styles.snippet}
          data-tone={snippet.tone}
          style={cssVars({ '--top': `${snippet.topPct}%`, '--left': `${snippet.leftPct}%` })}
        >
          {snippet.text}
        </div>
      ))}
    </div>
  );
}
