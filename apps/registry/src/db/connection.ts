import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import type { RegistryConfig } from "../config.js";

export type RegistryDb = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(config: RegistryConfig): {
  db: RegistryDb;
  sqlite: import("better-sqlite3").Database;
} {
  const dir = path.dirname(config.databasePath);
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(config.databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  runMigrations(sqlite);

  return { db, sqlite };
}

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner           TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      clip_count      INTEGER NOT NULL DEFAULT 0,
      edge_count      INTEGER NOT NULL DEFAULT 0,
      artifact_count  INTEGER NOT NULL DEFAULT 0,
      latest_pack_hash TEXT,
      created_at      TEXT NOT NULL,
      last_published_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_owner_name ON projects(owner, name);
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);
    CREATE INDEX IF NOT EXISTS idx_projects_last_published ON projects(last_published_at);

    CREATE TABLE IF NOT EXISTS bundles (
      bundle_hash   TEXT PRIMARY KEY,
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      byte_size     INTEGER NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clips (
      clip_hash     TEXT PRIMARY KEY,
      text_hash     TEXT NOT NULL,
      content       TEXT,
      source_refs   TEXT NOT NULL,
      bundle_hash   TEXT NOT NULL REFERENCES bundles(bundle_hash),
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
    CREATE INDEX IF NOT EXISTS idx_clips_text_hash ON clips(text_hash);

    CREATE TABLE IF NOT EXISTS edges (
      id            TEXT PRIMARY KEY,
      edge_type     TEXT NOT NULL,
      subject_ref   TEXT NOT NULL,
      object_ref    TEXT NOT NULL,
      transformation_type TEXT,
      confidence    REAL,
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      bundle_hash   TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_edges_subject_type ON edges(subject_ref, edge_type);
    CREATE INDEX IF NOT EXISTS idx_edges_object_type ON edges(object_ref, edge_type);
    CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_hash TEXT PRIMARY KEY,
      artifact_type TEXT NOT NULL,
      file_name     TEXT NOT NULL,
      mime_type     TEXT NOT NULL,
      byte_size     INTEGER NOT NULL,
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);

    CREATE TABLE IF NOT EXISTS packs (
      pack_hash     TEXT PRIMARY KEY,
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      clip_count    INTEGER NOT NULL,
      artifact_count INTEGER NOT NULL,
      edge_count    INTEGER NOT NULL,
      byte_size     INTEGER NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clip_artifact_refs (
      clip_hash     TEXT NOT NULL,
      artifact_hash TEXT NOT NULL,
      relationship  TEXT NOT NULL,
      PRIMARY KEY (clip_hash, artifact_hash)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
      clip_hash UNINDEXED,
      owner UNINDEXED,
      project_name UNINDEXED,
      content
    );
  `);
}
