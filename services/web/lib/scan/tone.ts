/**
 * Визуальные тона статусов.
 *
 * Единое место, где домен (severity, log level, флаг этапа, risk score)
 * превращается в «тон» для атрибута `data-tone`. Сами цвета живут в SCSS
 * (`$tones` в `_tokens.scss`). Значения `Tone` должны совпадать с ключами этой карты.
 */
import type { LogLevel, Severity, StageFlag } from './types';

/** Набор допустимых тонов. Синхронизирован с `$tones` в SCSS. */
export type Tone = 'cyan' | 'teal' | 'sand' | 'rose' | 'muted' | 'fg';

/** Тон по критичности находки. */
export const SEVERITY_TONE: Record<Severity, Tone> = {
  high: 'rose',
  medium: 'sand',
  low: 'teal',
};

/** Русская подпись критичности. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'высокий',
  medium: 'средний',
  low: 'низкий',
};

/** Сколько «точек» из трёх закрашивать в индикаторе критичности. */
export const SEVERITY_LEVEL: Record<Severity, 1 | 2 | 3> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Тон строки лога по уровню. */
export const LOG_LEVEL_TONE: Record<LogLevel, Tone> = {
  info: 'muted',
  ok: 'teal',
  warn: 'sand',
  alert: 'rose',
};

/** Тон завершённого этапа по его флагу. */
export function stageFlagTone(flag?: StageFlag): Tone {
  if (flag === 'alert') return 'rose';
  if (flag === 'warn') return 'sand';
  return 'teal';
}

/** Пороги risk score → тон/подпись. Поменяйте здесь, если изменится шкала. */
export const RISK_THRESHOLDS = { high: 7, medium: 4 } as const;

/** Тон по общему risk score (0–10). */
export function riskTone(score: number): Tone {
  if (score >= RISK_THRESHOLDS.high) return 'rose';
  if (score >= RISK_THRESHOLDS.medium) return 'sand';
  return 'teal';
}

/** Подпись уровня риска по score. */
export function riskLabel(score: number): string {
  if (score >= RISK_THRESHOLDS.high) return 'высокий риск';
  if (score >= RISK_THRESHOLDS.medium) return 'средний риск';
  return 'низкий риск';
}
