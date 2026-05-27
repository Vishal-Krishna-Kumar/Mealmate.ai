/**
 * Socket.IO realtime hub for collaborative meal-plan editing.
 *
 * Clients connect with a JWT and join a room keyed by the meal-plan id they
 * want to follow. The mealPlanController emits `mealplan:updated` whenever
 * the plan changes; every other client viewing the same plan receives the
 * payload and can invalidate its cached state.
 *
 * Module is intentionally light on hard dependencies — `socket.io` and
 * `jsonwebtoken` are imported lazily so tests still pass without realtime.
 */
import type { Server as HttpServer } from 'node:http';
import { env } from '../config/env';
import { logger } from '../config/logger';

type SocketIO = typeof import('socket.io');
type JWT = typeof import('jsonwebtoken');

interface RoomEvent {
  type: 'mealplan:updated' | 'mealplan:deleted';
  mealPlanId: string;
  payload?: unknown;
  actorId?: string;
}

let io: import('socket.io').Server | null = null;

function tryLoad<T>(name: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name) as T;
  } catch {
    return null;
  }
}

interface AuthedSocketData {
  userId: string;
}

export function initRealtime(httpServer: HttpServer): import('socket.io').Server | null {
  const sio = tryLoad<SocketIO>('socket.io');
  const jwt = tryLoad<JWT>('jsonwebtoken');
  if (!sio || !jwt) {
    logger.info('realtime disabled — socket.io / jsonwebtoken not installed');
    return null;
  }

  io = new sio.Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    },
    // Keep the path under the same /api prefix the rest of the API uses so
    // a reverse proxy only needs one mapping rule.
    path: '/api/realtime',
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: string; id?: string };
      const userId = decoded.sub ?? decoded.id;
      if (!userId) return next(new Error('unauthorized'));
      (socket.data as AuthedSocketData).userId = userId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('mealplan:join', (mealPlanId: string) => {
      if (typeof mealPlanId !== 'string' || mealPlanId.length === 0) return;
      socket.join(`mealplan:${mealPlanId}`);
    });
    socket.on('mealplan:leave', (mealPlanId: string) => {
      if (typeof mealPlanId !== 'string' || mealPlanId.length === 0) return;
      socket.leave(`mealplan:${mealPlanId}`);
    });
  });

  logger.info('realtime gateway listening at /api/realtime');
  return io;
}

/** Broadcast an event to every client subscribed to a meal plan room. */
export function broadcastMealPlan(event: RoomEvent): void {
  if (!io) return;
  io.to(`mealplan:${event.mealPlanId}`).emit(event.type, event);
}

export function getIO(): import('socket.io').Server | null {
  return io;
}
