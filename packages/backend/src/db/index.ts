import Database from 'better-sqlite3';
import { drizzle }  from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname }   from 'path';
import { config }    from '../config.js';
import * as schema   from './schema.js';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;

  // Создать директорию если не существует
  mkdirSync(dirname(config.dbPath), { recursive: true });

  _sqlite = new Database(config.dbPath);

  // Включить WAL mode для лучшей concurrent производительности
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');

  _db = drizzle(_sqlite, { schema });

  runMigrations(_sqlite);

  return _db;
}

export function getSqlite(): Database.Database {
  getDb(); // инициализируем если нужно
  return _sqlite!;
}

// ─────────────────────────────────────────────
//  INLINE MIGRATIONS (без drizzle-kit на старте)
// ─────────────────────────────────────────────

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT,
      display_name TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      last_seen    INTEGER
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      host_id     TEXT NOT NULL REFERENCES users(id),
      status      TEXT NOT NULL DEFAULT 'waiting',
      max_players INTEGER NOT NULL DEFAULT 2,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_players (
      room_id    TEXT NOT NULL REFERENCES rooms(id),
      user_id    TEXT NOT NULL REFERENCES users(id),
      seat_index INTEGER NOT NULL,
      joined_at  INTEGER NOT NULL,
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id          TEXT PRIMARY KEY,
      room_id     TEXT NOT NULL REFERENCES rooms(id),
      status      TEXT NOT NULL DEFAULT 'active',
      state_json  TEXT NOT NULL,
      round       INTEGER NOT NULL DEFAULT 1,
      max_rounds  INTEGER NOT NULL DEFAULT 12,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     TEXT NOT NULL REFERENCES matches(id),
      round        INTEGER NOT NULL,
      player_id    TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rooms_code     ON rooms(code);
    CREATE INDEX IF NOT EXISTS idx_matches_room   ON matches(room_id);
    CREATE INDEX IF NOT EXISTS idx_events_match   ON match_events(match_id);
  `);
}
