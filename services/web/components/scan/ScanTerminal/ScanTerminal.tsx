/**
 * ScanTerminal: живой лог скана.
 * Новые строки внизу, старые постепенно тают (прозрачность зависит от «возраста»).
 */
import { formatLogTimestamp } from '@/lib/scan/format';
import { LOG_LEVEL_TONE } from '@/lib/scan/tone';
import type { ScanLogEntry } from '@/lib/scan/types';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './ScanTerminal.module.scss';

/** Пропсы. */
export interface ScanTerminalProps {
  /** Последние строки лога. */
  logs: ReadonlyArray<ScanLogEntry>;
}

/** На сколько тускнеет каждая следующая (более старая) строка. */
const FADE_STEP = 0.13;
/** Минимальная прозрачность самой старой строки. */
const MIN_OPACITY = 0.2;

export function ScanTerminal({ logs }: ScanTerminalProps) {
  return (
    <div className={styles.terminal} role="log" aria-label="Лог скана">
      {logs.map((entry, i) => {
        const age = logs.length - 1 - i;
        return (
          <div
            key={entry.id}
            className={styles.line}
            style={cssVars({ '--opacity': Math.max(MIN_OPACITY, 1 - age * FADE_STEP) })}
          >
            <span className={styles.time}>{formatLogTimestamp(entry.elapsedMs)}</span>
            <span className={styles.text} data-tone={LOG_LEVEL_TONE[entry.level]}>
              {entry.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
