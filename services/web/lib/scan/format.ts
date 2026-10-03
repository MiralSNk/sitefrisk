/**
 * Форматтеры для отчёта: время, плюрализация, заголовок итогов.
 * Чистые функции без зависимостей, легко покрываются тестами.
 */
import type { Finding } from './types';

/** Числительные прописью для красивого заголовка («Три находки»). */
const NUMBER_WORDS = ['Ноль', 'Одна', 'Две', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'];

/**
 * Русская плюрализация.
 * @param n     число
 * @param forms формы для 1 / 2–4 / 5+ (например ['находка', 'находки', 'находок'])
 */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Миллисекунды → «8.9 с». */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} с`;
}

/** Миллисекунды → таймстемп лога «+1.24s». */
export function formatLogTimestamp(ms: number): string {
  return `+${(ms / 1000).toFixed(2)}s`;
}

/** Две строки итогового заголовка отчёта. */
export interface FindingsHeadline {
  /** Первая строка: «Три находки.» */
  readonly lead: string;
  /** Вторая строка (курсив): что делать. */
  readonly tail: string;
}

/** Собирает заголовок итогов по списку находок. */
export function buildFindingsHeadline(findings: ReadonlyArray<Finding>): FindingsHeadline {
  const total = findings.length;
  const critical = findings.filter((f) => f.severity === 'high').length;
  const word = NUMBER_WORDS[total] ?? String(total);
  const lead = `${word} ${pluralRu(total, ['находка', 'находки', 'находок'])}.`;

  if (total === 0) return { lead: 'Чисто.', tail: 'Явных проблем не найдено.' };
  if (critical === 0) return { lead, tail: 'Срочного ничего — но есть что улучшить.' };
  if (critical === 1) return { lead, tail: 'Одна требует внимания сегодня.' };
  return { lead, tail: `${critical} требуют внимания сегодня.` };
}
