/**
 * Валидация адреса цели перед сканом.
 * Это только UX-подсказка на клиенте. Настоящая защита (SSRF-guard) живёт
 * на стороне Go-сканера, и её нельзя переносить на фронтенд.
 */

/** Статус введённого значения. */
export type TargetStatus =
  /** Поле пустое. */
  | 'empty'
  /** Корректный URL со схемой. */
  | 'valid'
  /** Домен без схемы: подставим https:// сами. */
  | 'autofix'
  /** Не похоже на адрес. */
  | 'invalid';

/** Результат валидации. */
export interface TargetValidation {
  /** Статус. */
  readonly status: TargetStatus;
  /** Подсказка для пользователя под полем. */
  readonly message: string;
  /** Нормализованный URL, готовый к скану (null, если сканировать нельзя). */
  readonly normalized: string | null;
}

/** URL со схемой http(s) и доменом. */
const URL_WITH_SCHEME = /^https?:\/\/[^\s/]+\.[^\s]{2,}/i;
/** Голый домен вида example.com или sub.example.com/path. */
const BARE_DOMAIN = /^[^\s/:]+\.[^\s]{2,}$/;

/** Проверяет и нормализует ввод пользователя. */
export function validateTarget(raw: string): TargetValidation {
  const value = raw.trim();
  if (!value) return { status: 'empty', message: 'введите адрес сайта', normalized: null };
  if (URL_WITH_SCHEME.test(value)) return { status: 'valid', message: '✓ похоже на корректный URL', normalized: value };
  if (BARE_DOMAIN.test(value)) {
    return { status: 'autofix', message: '✓ подставим https:// автоматически', normalized: `https://${value}` };
  }
  return { status: 'invalid', message: 'нужен домен, например example.com', normalized: null };
}
