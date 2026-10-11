import { logger } from '@/lib/logging';
import { parseTraceparent } from '@/lib/trace';

export async function GET(req: Request) {
  const trace = parseTraceparent(req.headers.get('traceparent'));
  const log = logger({ trace_id: trace?.traceId, span_id: trace?.spanId });

  log.info('health checked');
  return Response.json({ status: 'ok', service: 'web' });
}