import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function openDb() {
  return open({
    filename: process.env.DB_PATH || "./database.sqlite",
    driver: sqlite3.Database,
  });
}

export async function initDb() {
  const db = await openDb();

  // Create tables if they don't exist (original schema)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tmdb_key TEXT DEFAULT '',
      rd_token TEXT DEFAULT '',
      plex_url TEXT DEFAULT '',
      plex_token TEXT DEFAULT '',
      plex_lib_id TEXT DEFAULT ''
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id TEXT,
      title TEXT,
      poster_path TEXT,
      status TEXT,
      requested_by TEXT,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blocklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      info_hash TEXT UNIQUE,
      title TEXT,
      added_by TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

  `);

  // Safely run migrations for new columns added after initial release.
  // SQLite doesn't support "ADD COLUMN IF NOT EXISTS" so we catch the
  // error silently if it already exists.
  const migrations = [
    `ALTER TABLE settings ADD COLUMN plex_tv_lib_id TEXT DEFAULT ''`,
    `ALTER TABLE requests ADD COLUMN media_type TEXT DEFAULT 'movie'`,
    `ALTER TABLE requests ADD COLUMN season INTEGER DEFAULT NULL`,
    `ALTER TABLE requests ADD COLUMN episode INTEGER DEFAULT NULL`,
    `ALTER TABLE requests ADD COLUMN info_hash TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN preferred_resolution TEXT DEFAULT '1080p'`,
    `ALTER TABLE settings ADD COLUMN preferred_language TEXT DEFAULT 'en'`,
    // New migrations
    `ALTER TABLE requests ADD COLUMN approved INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN notify_email TEXT DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS blocklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      info_hash TEXT UNIQUE,
      title TEXT,
      added_by TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS auto_episode_retry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id TEXT NOT NULL,
      show_name TEXT NOT NULL,
      poster_path TEXT,
      season INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      episode_name TEXT NOT NULL,
      air_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tmdb_id, season, episode)
    )`,
  ];

  for (const migration of migrations) {
    try {
      await db.run(migration);
    } catch (e: unknown) {
      // "duplicate column name" error is expected if migration already ran — safe to ignore
      if (e instanceof Error) {
        if (!e.message.includes("duplicate column name")) {
          console.error("Migration error:", e.message);
        }
      } else {
        console.error("Migration error:", e);
      }
    }
  }

  return db;
}
