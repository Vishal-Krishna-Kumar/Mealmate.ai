import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler so thrown errors flow into Express error middleware.
 */
export const asyncHandler =
  <P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction
    ) => Promise<unknown>
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
