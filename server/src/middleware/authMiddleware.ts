import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { verifyAccessToken, type JwtPayload } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Require a valid JWT in `Authorization: Bearer <token>`. */
export function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or malformed Authorization header'));
  }
  const token = header.slice(7).trim();
  if (!token) return next(AppError.unauthorized('Empty bearer token'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

/** Restrict to specific roles (use after `protect`). */
export function requireRole(...roles: Array<'user' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Insufficient role'));
    next();
  };
}
