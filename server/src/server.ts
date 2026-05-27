import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { initRealtime } from './services/realtime';

async function bootstrap() {
  await connectDB();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 MealMate server listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  initRealtime(server);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
