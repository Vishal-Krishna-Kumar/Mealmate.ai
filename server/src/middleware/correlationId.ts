/**
 * Correlation-ID middleware.
 *
 * Reads an incoming `X-Correlation-ID` (or `X-Request-ID`) header — or
 * generates a fresh UUID — attaches it to `req.correlationId`, echoes it on
 * the response, and exposes a `getCorrelationId()` helper for use in
 * downstream service calls / logs.
 */
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

const HEADER = 'x-correlation-id';
const HEADER_ALT = 'x-request-id';

export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming =
      (req.headers[HEADER] as string | undefined) ??
      (req.headers[HEADER_ALT] as string | undefined);
    const id = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    next();
  };
}
