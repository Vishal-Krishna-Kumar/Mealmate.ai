import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | undefined;

/**
 * Boot an in-memory MongoDB and connect mongoose. Call in beforeAll.
 *
 * The default `MongoMemoryServer.create()` waits up to 10s for `mongod` to
 * bind a port, which is flaky on slow CI and on Windows when several suites
 * run back-to-back. We bump the launch timeout to 60s and retry once on
 * failure so the suite stays green without affecting test speed.
 */
export async function connectInMemoryDB(): Promise<void> {
  const launch = async (): Promise<MongoMemoryServer> =>
    MongoMemoryServer.create({
      instance: {
        // 60s is generous but only kicks in if startup is slow.
        launchTimeout: 60_000,
      },
    });
  try {
    mongoServer = await launch();
  } catch {
    // One retry handles transient Windows AV / port contention failures.
    mongoServer = await launch();
  }
  await mongoose.connect(mongoServer.getUri());
}

/** Drop all data between tests. */
export async function clearDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]?.deleteMany({});
  }
}

/** Tear down. Call in afterAll. */
export async function disconnectInMemoryDB(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer?.stop();
}
