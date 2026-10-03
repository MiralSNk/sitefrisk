/**
 * Глитч-система: типы событий и фабрика их создания.
 *
 * Глитч — короткое (0.2–0.9 с) событие, которое ломает интерфейс:
 *  - scan   — цветные полосы-смещения + всплывающие строки «атакующего» кода;
 *  - lang   — вторая строка заголовка на миг переключается на английский;
 *  - button — кнопка CTA показывает «ACCESS GRANTED» и т.п.;
 *  - invert — весь контент инвертируется на долю секунды;
 *  - shake  — контент дёргается.
 *
 * Новый тип добавляется -> допишите его в `GlitchType`, в `GLITCH_DURATIONS`
 * и в пул, потом обработайте в компоненте (обычно через `data-glitch` в SCSS).
 */
import { randomBetween, randomFrom } from '../utils/random';

/** Все виды глитчей. */
export type GlitchType = 'scan' | 'lang' | 'button' | 'invert' | 'shake';

/** Горизонтальная полоса-смещение (для scan). */
export interface GlitchBand {
  /** Вертикальная позиция полосы, % от высоты. */
  readonly topPct: number;
  /** Высота полосы, px. */
  readonly heightPx: number;
  /** Горизонтальный сдвиг, px. */
  readonly offsetPx: number;
  /** Прозрачность 0..1. */
  readonly opacity: number;
  /** Тон полосы. */
  readonly tone: 'cyan' | 'magenta' | 'gold';
}

/** Всплывающая строка «вредоносного» кода (для scan). */
export interface GlitchSnippet {
  /** Текст. */
  readonly text: string;
  /** Позиция сверху, %. */
  readonly topPct: number;
  /** Позиция слева, %. */
  readonly leftPct: number;
  /** Тон. */
  readonly tone: 'cyan' | 'magenta';
}

/** Готовое событие глитча: всё, что нужно для рендера, уже посчитано. */
export interface GlitchEvent {
  /** Уникальный id (для key и сравнения). */
  readonly id: number;
  /** Тип. */
  readonly type: GlitchType;
  /** Сколько длится, мс. */
  readonly durationMs: number;
  /** Полосы (пусто, если тип не scan). */
  readonly bands: ReadonlyArray<GlitchBand>;
  /** Строки кода (пусто, если тип не scan). */
  readonly snippets: ReadonlyArray<GlitchSnippet>;
  /** Смещение для shake, px. */
  readonly shake: { readonly x: number; readonly y: number };
  /** Подмена текста кнопки (null, если тип не button). */
  readonly buttonLabel: string | null;
}

/** Длительность каждого типа, мс. */
export const GLITCH_DURATIONS: Record<GlitchType, number> = {
  scan: 420,
  lang: 900,
  button: 550,
  invert: 160,
  shake: 320,
};

/** Пул глитчей на первом экране. Повтор = больший вес (scan выпадает вдвое чаще). */
export const IDLE_GLITCH_POOL: ReadonlyArray<GlitchType> = ['scan', 'scan', 'lang', 'button', 'invert', 'shake'];

/** Пул во время скана и чата: только «безопасный» scan, чтобы не мешать чтению. */
export const ACTIVE_GLITCH_POOL: ReadonlyArray<GlitchType> = ['scan'];

/** Строки, которые всплывают во время scan-глитча. */
export const ATTACK_SNIPPETS: ReadonlyArray<string> = [
  '<img src=x onerror=alert(1)>',
  'SELECT * FROM users WHERE 1=1;',
  'rm -rf /var/www/*',
  'root:$6$xJ9...:0:0:',
  '[ALERT] unauthorized access 03:14:12',
  'eval(atob("c2VsZWN0IC0t"))',
  'ssh root@10.0.4.12 — accepted',
  '0x41414141414141',
];

/** Подмены текста кнопки. */
export const BUTTON_GLITCH_LABELS: ReadonlyArray<string> = [
  'ACCESS GRANTED',
  '>>> ROOT',
  'SUDO OK',
  '0xDEADBEEF',
  'PWNED',
  'BACKDOOR_FOUND',
];

/** Базовая раскладка полос: позиция, высота и тон фиксированы, сдвиг случайный. */
const BAND_LAYOUT: ReadonlyArray<Pick<GlitchBand, 'topPct' | 'heightPx' | 'tone'>> = [
  { topPct: 22, heightPx: 16, tone: 'cyan' },
  { topPct: 48, heightPx: 11, tone: 'magenta' },
  { topPct: 70, heightPx: 20, tone: 'gold' },
];

/** Сквозной счётчик id событий. */
let nextGlitchId = 1;

/**
 * Фабрика глитч-событий: вся случайность сосредоточена здесь, компоненты
 * получают уже готовые числа.
 * @param type      тип глитча
 * @param intensity множитель силы (1 = обычный; 1.3 = «удар» при смене этапа скана)
 */
export function createGlitchEvent(type: GlitchType, intensity = 1): GlitchEvent {
  const isScan = type === 'scan';
  return {
    id: nextGlitchId++,
    type,
    durationMs: isScan && intensity > 1 ? 240 : GLITCH_DURATIONS[type],
    bands: isScan
      ? BAND_LAYOUT.map((band) => ({
          ...band,
          offsetPx: randomBetween(-25, 25) * intensity,
          opacity: randomBetween(0.08, 0.2) * intensity,
        }))
      : [],
    snippets: isScan
      ? (['magenta', 'cyan'] as const).map((tone) => ({
          text: randomFrom(ATTACK_SNIPPETS),
          topPct: randomBetween(10, 80),
          leftPct: randomBetween(5, 70),
          tone,
        }))
      : [],
    shake: type === 'shake' ? { x: randomBetween(-8, 8), y: randomBetween(-5, 5) } : { x: 0, y: 0 },
    buttonLabel: type === 'button' ? randomFrom(BUTTON_GLITCH_LABELS) : null,
  };
}
