/**
 * Утилиты случайности для анимаций и глитчей.
 */

/** Алфавит «битых» символов для эффекта расшифровки текста. */
export const GLITCH_ALPHABET = '01#%&$@?/\\<>{}[]■◆▒░';

/** Случайное число в диапазоне [min, max). */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Случайный элемент массива. Массив не должен быть пустым. */
export function randomFrom<T>(items: ReadonlyArray<T>): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Строка из случайных «битых» символов.
 * @param length   длина
 * @param alphabet набор символов
 */
export function randomGlitchString(length: number, alphabet: string = GLITCH_ALPHABET): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
