// Dev-only launcher: starts a local MongoDB on a fixed port using
// `mongodb-memory-server` so the API can connect without a system MongoDB
// install.
//
// PERSISTENCE: By default we use the `wiredTiger` storage engine and write
// the database files to `mealmate/server/.mongo-data/` so users, recipes,
// meal plans, etc. survive restarts of this script. Delete that folder to
// start fresh.
//
// Usage:
//   node scripts/dev-mongo.mjs                      # persistent, port 27017
//   MONGO_PORT=27018 node scripts/dev-mongo.mjs
//   MONGO_EPHEMERAL=1 node scripts/dev-mongo.mjs    # in-memory only
//   MONGO_DATA_DIR=/some/path node scripts/dev-mongo.mjs
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = Number(process.env.MONGO_PORT || 27017);
const dbName = process.env.MONGO_DB_NAME || "mealmate";
const ephemeral = process.env.MONGO_EPHEMERAL === "1";

// Persist alongside the server folder so data is colocated with the app
// it serves and easy to wipe (.gitignored).
const dataDir = resolve(
  process.env.MONGO_DATA_DIR || resolve(__dirname, "..", ".mongo-data")
);

const instance = { port, ip: "127.0.0.1", dbName };
if (!ephemeral) {
  mkdirSync(dataDir, { recursive: true });
  instance.storageEngine = "wiredTiger";
  instance.dbPath = dataDir;
}

const server = await MongoMemoryServer.create({ instance });

const uri = server.getUri();
console.log(`[dev-mongo] running at ${uri}`);
console.log(
  `[dev-mongo] storage: ${
    ephemeral ? "EPHEMERAL (wiped on exit)" : `persistent → ${dataDir}`
  }`
);
console.log(`[dev-mongo] press Ctrl+C to stop`);

const shutdown = async (signal) => {
  console.log(`[dev-mongo] received ${signal}, stopping…`);
  try {
    // cleanup(false) -> stop mongod but KEEP the data files on disk.
    await server.stop({ doCleanup: false, force: false });
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

