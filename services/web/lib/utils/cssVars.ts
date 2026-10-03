/**
 * Хелпер для CSS custom properties в inline-стилях.
 *
 * Динамические числа (прогресс, координаты, смещения) передаём в SCSS через
 * CSS-переменные, а все остальные стили живут в модулях. TypeScript по
 * умолчанию не пускает `--var` в `style`, этот хелпер типобезопасно решает проблему.
 *
 * @example <div style={cssVars({ '--progress': '42%' })} />
 */
import type { CSSProperties } from 'react';

/** Объект CSS-переменных: ключ обязан начинаться с `--`. */
export type CssVariables = Record<`--${string}`, string | number>;

/** Превращает объект CSS-переменных в валидный `style`. */
export function cssVars(vars: CssVariables): CSSProperties {
  return vars as CSSProperties;
}
