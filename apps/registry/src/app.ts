import { Hono } from "hono";
import { cors } from "hono/cors";
import { type RegistryConfig, loadConfig } from "./config.js";
import { createDb, type RegistryDb } from "./db/connection.js";
import {
  createFsBlobStore,
  type BlobStore,
} from "./storage/blob-store.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRoutes } from "./routes/index.js";
import { type Auth, createAuth } from "./lib/auth.js";

export interface AppContext {
  config: RegistryConfig;
  db: RegistryDb;
  blobStore: BlobStore;
  auth: Auth;
}

export async function createApp(overrides?: Partial<AppContext>) {
  const config = overrides?.config ?? loadConfig();
  const { db, sqlite } = overrides?.db
    ? { db: overrides.db, sqlite: null }
    : createDb(config);
  const blobStore = overrides?.blobStore ?? createFsBlobStore(config.dataDir);
  const auth = overrides?.auth ?? createAuth(sqlite!, config);

  // Run BetterAuth migrations to create auth tables (user, session, account, etc.)
  if (!overrides?.auth) {
    const { getMigrations } = await import("better-auth/db/migration");
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  }

  const ctx: AppContext = { config, db, blobStore, auth };

  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization", "If-None-Match"],
      exposeHeaders: ["ETag"],
    }),
  );
  app.onError(errorHandler);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/", createRoutes(ctx));

  return app;
}
