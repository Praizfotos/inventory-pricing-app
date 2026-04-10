import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { getDb } from './db';

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    maxAge: 24 * 60 * 60 * 1000,
  })
);

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
app.get('/api/items', async (req: Request, res: Response) => {
  const db = getDb();
  const search = (req.query['search'] as string || '').trim();
  const category = (req.query['category'] as string || '').trim();

  let query = `SELECT id, name, price, category, "imageUrl", "updatedAt" FROM items WHERE 1=1`;
  const params: string[] = [];
  let i = 1;

  if (search) { query += ` AND name ILIKE $${i++}`; params.push(`%${search}%`); }
  if (category) { query += ` AND category = $${i++}`; params.push(category); }
  query += ' ORDER BY category, name';

  const result = await db.query(query, params);
  res.json(result.rows);
});

// GET /api/categories
app.get('/api/categories', async (_req: Request, res: Response) => {
  const db = getDb();
  const result = await db.query('SELECT DISTINCT category FROM items ORDER BY category');
  res.json(result.rows.map((r: { category: string }) => r.category));
});

// POST /api/admin/login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();

  if (!hash) {
    if (password === 'admin') {
      req.session!['admin'] = true;
      res.status(200).json({ ok: true });
    } else {
      res.status(401).json({ error: 'No admin password configured. Use "admin" as temporary password.' });
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
app.post('/api/admin/items', async (req: Request, res: Response) => {
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
  const result = await db.query(
    `INSERT INTO items (name, price, category, "imageUrl", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, price, category, "imageUrl", "updatedAt"`,
    [name.trim(), price, (category || 'General').trim(), (imageUrl || '').trim()]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/admin/items/:id
app.put('/api/admin/items/:id', async (req: Request, res: Response) => {
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
  const existing = await db.query('SELECT id FROM items WHERE id = $1', [id]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }

  const updates: string[] = [];
  const params: (string | number)[] = [];
  let i = 1;

  if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name.trim()); }
  if (price !== undefined) { updates.push(`price = $${i++}`); params.push(price); }
  if (category !== undefined) { updates.push(`category = $${i++}`); params.push(category.trim()); }
  if (imageUrl !== undefined) { updates.push(`"imageUrl" = $${i++}`); params.push(imageUrl.trim()); }
  updates.push(`"updatedAt" = NOW()`);
  params.push(id);

  const result = await db.query(
    `UPDATE items SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, price, category, "imageUrl", "updatedAt"`,
    params
  );
  res.json(result.rows[0]);
});

// DELETE /api/admin/items/:id
app.delete('/api/admin/items/:id', async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const db = getDb();
  const existing = await db.query('SELECT id FROM items WHERE id = $1', [id]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
  await db.query('DELETE FROM items WHERE id = $1', [id]);
  res.status(204).send();
});

export default app;
