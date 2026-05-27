/**
 * Prometheus metrics middleware for the Express server.
 *
 * Exposes:
 *   - GET /metrics              : Prometheus text-format exposition
 *   - histogram http_request_duration_seconds{method,route,status}
 *   - counter   http_requests_total{method,route,status}
 *
 * `prom-client` is imported lazily so the build still passes when the
 * dependency isn't installed in offline test environments.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type PromModule = typeof import('prom-client');

let registry: import('prom-client').Registry | null = null;
let httpRequests: import('prom-client').Counter<string> | null = null;
let httpDuration: import('prom-client').Histogram<string> | null = null;
let promModule: PromModule | null = null;

function tryLoadProm(): PromModule | null {
  if (promModule) return promModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    promModule = require('prom-client') as PromModule;
    return promModule;
  } catch {
    return null;
  }
}

function ensureRegistry(): boolean {
  if (registry) return true;
  const prom = tryLoadProm();
  if (!prom) return false;
  registry = new prom.Registry();
  prom.collectDefaultMetrics({ register: registry });
  httpRequests = new prom.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by the API server',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });
  httpDuration = new prom.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });
  return true;
}

/** Middleware that records request count + latency per route. */
export function metricsMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!ensureRegistry()) {
      next();
      return;
    }
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const dur = Number(process.hrtime.bigint() - start) / 1e9;
      const route = (req.route?.path ?? req.path ?? 'unknown').toString();
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };
      httpRequests?.inc(labels);
      httpDuration?.observe(labels, dur);
    });
    next();
  };
}

/** Express handler that returns the current Prometheus exposition. */
export const metricsHandler: RequestHandler = async (_req: Request, res: Response) => {
  if (!ensureRegistry() || !registry) {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send('# prom-client not installed\n');
    return;
  }
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
};
