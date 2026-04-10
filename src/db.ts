import { Pool } from 'pg';

let pool: Pool;

export function getDb(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return pool;
}

export async function initDb(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id           SERIAL PRIMARY KEY,
      name         TEXT    NOT NULL UNIQUE,
      price        NUMERIC(10,2) NOT NULL,
      category     TEXT    NOT NULL DEFAULT 'General',
      "imageUrl"   TEXT    NOT NULL DEFAULT '',
      total_stock  INTEGER NOT NULL DEFAULT 0,
      units_sold   INTEGER NOT NULL DEFAULT 0,
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
}
