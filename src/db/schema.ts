export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL UNIQUE,
    passwordHash TEXT    NOT NULL,
    role         TEXT    NOT NULL CHECK(role IN ('admin', 'associate')),
    createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL UNIQUE,
    price     REAL    NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_PRICE_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS price_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    itemId    INTEGER NOT NULL REFERENCES items(id),
    oldPrice  REAL    NOT NULL,
    newPrice  REAL    NOT NULL,
    changedBy INTEGER NOT NULL REFERENCES users(id),
    changedAt TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_ITEMS_NAME_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)
`;
