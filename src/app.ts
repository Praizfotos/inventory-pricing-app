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

// GET /api/items?search=&category=
app.get('/api/items', (req: Request, res: Response) => {
  const db = getDb();
  const search = (req.query['search'] as string || '').trim();
  const category = (req.query['category'] as string || '').trim();

  let query = 'SELECT id, name, price, category, imageUrl, updatedAt FROM items WHERE 1=1';
  const params: string[] = [];

  if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY category, name';

  res.json(db.prepare(query).all(...params));
});

// GET /api/categories
app.get('/api/categories', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT category FROM items ORDER BY category').all() as { category: string }[];
  res.json(rows.map(r => r.category));
});

// POST /api/admin/login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();

  // Fallback: if no hash set, allow login with password "admin"
  if (!hash) {
    if (password === 'admin') {
      req.session!['admin'] = true;
      res.status(200).json({ ok: true });
    } else {
      res.status(401).json({ error: 'No admin password configured. Use "admin" as password or set ADMIN_PASSWORD_HASH.' });
    }
    return;
  }

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
  const { name, price, category, imageUrl } = req.body as { name?: string; price?: number; category?: string; imageUrl?: string };

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (typeof price !== 'number' || price <= 0) {
    res.status(400).json({ error: 'price must be a number greater than 0' });
    return;
  }

  const db = getDb();
  const item = db.prepare(
    `INSERT INTO items (name, price, category, imageUrl, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     RETURNING id, name, price, category, imageUrl, updatedAt`
  ).get(name.trim(), price, (category || 'General').trim(), (imageUrl || '').trim());

  res.status(201).json(item);
});

// PUT /api/admin/items/:id
app.put('/api/admin/items/:id', (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const { name, price, category, imageUrl } = req.body as { name?: string; price?: number; category?: string; imageUrl?: string };

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
  if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
  if (price !== undefined) { updates.push('price = ?'); params.push(price); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category.trim()); }
  if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl.trim()); }
  updates.push("updatedAt = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT id, name, price, category, imageUrl, updatedAt FROM items WHERE id = ?').get(id));
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
