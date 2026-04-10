osted web app# Design: Inventory Pricing App

## Overview

A minimal web app. Associates visit a page to look up current item prices. An admin visits a separate page, enters a password, and can add/edit/remove items and their prices.

No stock counts. No user accounts. No complex auth. Just prices.

## Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: Plain HTML + vanilla JS (no framework)
- **Admin auth**: Single hardcoded admin password stored as a bcrypt hash in an env variable

## Pages

- `GET /` — Associate price lookup page (public, no login)
- `GET /admin` — Admin login page
- `GET /admin/dashboard` — Admin dashboard (requires session cookie)

## API Routes

- `GET /api/items?search=` — Returns all active items, optionally filtered by name
- `POST /api/admin/login` — Validates admin password, sets session cookie
- `POST /api/admin/logout` — Clears session cookie
- `POST /api/admin/items` — Create item `{ name, price }`
- `PUT /api/admin/items/:id` — Update item `{ name?, price? }`
- `DELETE /api/admin/items/:id` — Delete item

## Data Model

```sql
CREATE TABLE items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE,
  price     REAL    NOT NULL,
  updatedAt TEXT    NOT NULL DEFAULT (datetime('now'))
)
```

## Admin Auth

- Admin password set via `ADMIN_PASSWORD_HASH` env variable (bcrypt hash)
- On successful login, server sets a signed session cookie (using `cookie-session`)
- All `/api/admin/*` routes check for valid session; return 401 if missing

## Validation

- `name`: non-empty string
- `price`: number > 0
