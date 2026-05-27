import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { correlationId } from './middleware/correlationId';
import { metricsHandler, metricsMiddleware } from './middleware/metrics';
import { installSwagger } from './utils/swagger';

export function createApp(): Express {
  const app = express();

  // Security & infra middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
      exposedHeaders: ['X-Correlation-ID'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' })); // larger limit to accept base64 fridge photos
  app.use(express.urlencoded({ extended: true }));

  // Observability: correlation IDs first so logs + metrics can reference them.
  app.use(correlationId());
  if (env.NODE_ENV !== 'test') {
    app.use(metricsMiddleware());
  }

  // Logging (skip during tests)
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan(':method :url :status :response-time ms :res[x-correlation-id]', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  // Rate limiter on all /api routes
  app.use(
    '/api',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'mealmate-server',
      version: '0.3.0',
      env: env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Prometheus metrics (no auth — same convention as cAdvisor/kube-state).
  app.get('/metrics', metricsHandler);

  // OpenAPI documentation UI
  installSwagger(app);

  // Feature routes
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/auth', require('./routes/authRoutes').default);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/recipes', require('./routes/recipeRoutes').default);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/mealplans', require('./routes/mealPlanRoutes').default);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/grocery', require('./routes/groceryRoutes').default);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/nutrition', require('./routes/nutritionRoutes').default);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use('/api/ai', require('./routes/aiRoutes').default);

  // 404 + error handler (always last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
