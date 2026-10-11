/** Структурный лог по контракту sitefrisk. */

export type Level = 'debug' | 'info' | 'warn' | 'error';
export type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** Возвращает логгер с дополнительными полями в каждой записи. */
  with(fields: Fields): Logger;
}

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SERVICE = 'web';

function minLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

function emit(level: Level, msg: string, fields?: Fields): void {
  if (LEVELS[level] < minLevel()) return;
  // toISOString уже даёт RFC3339 с миллисекундами и Z
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, msg, ...fields }));
}

export function logger(base: Fields = {}): Logger {
  const make = (level: Level) => (msg: string, fields?: Fields) =>
    emit(level, msg, { ...base, ...fields });

  return {
    debug: make('debug'),
    info: make('info'),
    warn: make('warn'),
    error: make('error'),
    with: (fields: Fields) => logger({ ...base, ...fields }),
  };
}