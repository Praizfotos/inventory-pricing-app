import { Pool } from 'pg';
import fs from 'fs';

let pool: Pool;

export function getDb(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return pool;
}

export async function initDb(): Promise<void> {
  // Ensure persistent uploads directory exists
  const uploadsDir = '/data/uploads';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id        SERIAL PRIMARY KEY,
      name      TEXT    NOT NULL UNIQUE,
      price     NUMERIC(10,2) NOT NULL,
      category  TEXT    NOT NULL DEFAULT 'General',
      "imageUrl" TEXT   NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
}
