/**
 * Разбор и генерация заголовка W3C traceparent.
 *
 * Только Web Crypto и строки — работает и в Edge-рантайме (middleware),
 * и в Node-рантайме (route handlers). Именно поэтому здесь нет pino:
 * он требует Node API и в Edge не поднимется.
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
}

const HEX = /^[0-9a-f]+$/;

export function parseTraceparent(value: string | null | undefined): TraceContext | null {
  if (!value) return null;

  const parts = value.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts;

  // Длины проверяем ПЕРВЫМИ и это важно: в JS `$` матчится и перед
  // завершающим \n, так что HEX.test("01\n") вернёт true.
  if (version.length !== 2 || traceId.length !== 32 || spanId.length !== 16 || flags.length !== 2) {
    return null;
  }
  if (!parts.every((p) => HEX.test(p))) return null;
  if (version === 'ff') return null;
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;

  return { traceId, spanId };
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildTraceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`;
}

/** trace_id сохраняем из входящего заголовка, span_id всегда свой. */
export function newTrace(incoming: string | null | undefined): TraceContext {
  const parsed = parseTraceparent(incoming);
  return { traceId: parsed?.traceId ?? randomHex(16), spanId: randomHex(8) };
}