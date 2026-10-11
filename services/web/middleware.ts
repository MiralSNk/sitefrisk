import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logging';
import { buildTraceparent, newTrace } from '@/lib/trace';

/**
 * web — это edge системы: именно здесь рождается трасса, если браузер
 * её не прислал. Дальше traceparent уезжает в auth, scanner и ml.
 */
export function middleware(req: NextRequest) {
  const { traceId, spanId } = newTrace(req.headers.get('traceparent'));
  const traceparent = buildTraceparent(traceId, spanId);

  // Подменяем заголовки ЗАПРОСА, чтобы route handler ниже их увидел.
  const headers = new Headers(req.headers);
  headers.set('traceparent', traceparent);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('traceparent', traceparent);

  logger({ trace_id: traceId, span_id: spanId }).info('request started', {
    method: req.method,
    path: req.nextUrl.pathname,
  });

  return res;
}

// Только API-маршруты: статику и картинки трассировать незачем.
export const config = { matcher: '/api/:path*' };