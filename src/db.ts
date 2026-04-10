import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'inventory.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(dbPath: string = DB_PATH): Database.Database {
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL UNIQUE,
      price     REAL    NOT NULL,
      category  TEXT    NOT NULL DEFAULT 'General',
      imageUrl  TEXT    NOT NULL DEFAULT '',
      updatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
