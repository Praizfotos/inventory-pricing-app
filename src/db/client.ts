import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import {
  CREATE_USERS_TABLE,
  CREATE_ITEMS_TABLE,
  CREATE_PRICE_HISTORY_TABLE,
  CREATE_ITEMS_NAME_INDEX,
} from './schema';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'inventory.db');
const BCRYPT_COST = 12;

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(dbPath: string = DB_PATH): Database.Database {
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaultUsers(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(CREATE_USERS_TABLE);
  database.exec(CREATE_ITEMS_TABLE);
  database.exec(CREATE_PRICE_HISTORY_TABLE);
  database.exec(CREATE_ITEMS_NAME_INDEX);
}

function seedDefaultUsers(database: Database.Database): void {
  const existingAdmin = database
    .prepare('SELECT id FROM users WHERE username = ?')
    .get('admin');

  if (existingAdmin) {
    // Seeds already applied
    return;
  }

  const adminHash = bcrypt.hashSync('admin123', BCRYPT_COST);
  const associateHash = bcrypt.hashSync('associate123', BCRYPT_COST);

  const insert = database.prepare(
    'INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)'
  );

  const seedMany = database.transaction(() => {
    insert.run('admin', adminHash, 'admin');
    insert.run('associate', associateHash, 'associate');
  });

  seedMany();
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
