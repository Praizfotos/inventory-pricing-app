import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { initDb, getDb } from './db';

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    maxAge: 24 * 60 * 60 * 1000,
  })
);

// Admin auth middleware — applies to all /api/admin/* except login
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session['admin'] === true) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/login') return next();
  requireAdmin(req, res, next);
});

// GET /api/items?search=
app.get('/api/items', (req: Request, res: Response) => {
  const db = getDb();
  const search = req.query['search'] as string | undefined;

  let rows;
  if (search) {
    rows = db
      .prepare('SELECT id, name, price, updatedAt FROM items WHERE name LIKE ? ORDER BY name')
      .all(`%${search}%`);
  } else {
    rows = db
      .prepare('SELECT id, name, price, updatedAt FROM items ORDER BY name')
      .all();
  }

  res.json(rows);
});

// POST /api/admin/login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  const match = await bcrypt.compare(password, hash);

  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  req.session!['admin'] = true;
  res.status(200).json({ ok: true });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  req.session = null;
  res.status(200).json({ ok: true });
});

// POST /api/admin/items
app.post('/api/admin/items', (req: Request, res: Response) => {
  const { name, price } = req.body as { name?: string; price?: number };

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (typeof price !== 'number' || price <= 0) {
    res.status(400).json({ error: 'price must be a number greater than 0' });
    return;
  }

  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO items (name, price, updatedAt) VALUES (?, ?, datetime(\'now\')) RETURNING id, name, price, updatedAt'
  );
  const item = stmt.get(name.trim(), price);

  res.status(201).json(item);
});

// PUT /api/admin/items/:id
app.put('/api/admin/items/:id', (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const { name, price } = req.body as { name?: string; price?: number };

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
    res.status(400).json({ error: 'price must be a number greater than 0' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (price !== undefined) {
    updates.push('price = ?');
    params.push(price);
  }
  updates.push("updatedAt = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db
    .prepare('SELECT id, name, price, updatedAt FROM items WHERE id = ?')
    .get(id);

  res.json(updated);
});

// DELETE /api/admin/items/:id
app.delete('/api/admin/items/:id', (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const db = getDb();

  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.status(204).send();
});

export function createApp() {
  initDb();
  return app;
}

export default app;
