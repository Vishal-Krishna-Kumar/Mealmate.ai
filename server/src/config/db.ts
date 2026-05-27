import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDB(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
    });
    logger.info(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.error({ err }, '❌ MongoDB connection error');
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
