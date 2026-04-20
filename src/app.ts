import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { getDb } from './db';

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  maxAge: 24 * 60 * 60 * 1000,
}));

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session['admin'] === true) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/login') return next();
  requireAdmin(req, res, next);
});

// ── PUBLIC ──────────────────────────────────────────────

// GET /api/items?search=&category=
app.get('/api/items', async (req: Request, res: Response) => {
  const db = getDb();
  const search = (req.query['search'] as string || '').trim();
  const category = (req.query['category'] as string || '').trim();
  let query = `SELECT id, name, price, category, "imageUrl", total_stock, units_sold,
               (total_stock - units_sold) AS units_remaining, "updatedAt"
               FROM items WHERE 1=1`;
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

// POST /api/sale — record a sale (associate)
app.post('/api/sale', async (req: Request, res: Response) => {
  const { itemId, quantity } = req.body as { itemId?: number; quantity?: number };
  if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
    res.status(400).json({ error: 'itemId and quantity > 0 are required' });
    return;
  }
  const db = getDb();
  const existing = await db.query(
    'SELECT id, total_stock, units_sold FROM items WHERE id = $1', [itemId]
  );
  if (!existing.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
  const item = existing.rows[0];
  const remaining = item.total_stock - item.units_sold;
  if (quantity > remaining) {
    res.status(400).json({ error: `Only ${remaining} units remaining` });
    return;
  }
  const result = await db.query(
    `UPDATE items SET units_sold = units_sold + $1, "updatedAt" = NOW()
     WHERE id = $2
     RETURNING id, name, price, total_stock, units_sold,
               (total_stock - units_sold) AS units_remaining`,
    [quantity, itemId]
  );
  res.json(result.rows[0]);
});

// POST /api/sale/reverse — undo a sale
app.post('/api/sale/reverse', async (req: Request, res: Response) => {
  const { itemId, quantity } = req.body as { itemId?: number; quantity?: number };
  if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
    res.status(400).json({ error: 'itemId and quantity > 0 are required' });
    return;
  }
  const db = getDb();
  const existing = await db.query(
    'SELECT id, units_sold FROM items WHERE id = $1', [itemId]
  );
  if (!existing.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
  const item = existing.rows[0];
  const newSold = Math.max(0, item.units_sold - quantity);
  const result = await db.query(
    `UPDATE items SET units_sold = $1, "updatedAt" = NOW()
     WHERE id = $2
     RETURNING id, name, price, total_stock, units_sold,
               (total_stock - units_sold) AS units_remaining`,
    [newSold, itemId]
  );
  res.json(result.rows[0]);
});



app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password) { res.status(401).json({ error: 'Invalid credentials' }); return; }
  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (!hash) {
    if (password === 'admin') { req.session!['admin'] = true; res.json({ ok: true }); }
    else res.status(401).json({ error: 'Use "admin" as temporary password.' });
    return;
  }
  const match = await bcrypt.compare(password, hash);
  if (!match) { res.status(401).json({ error: 'Invalid credentials' }); return; }
  req.session!['admin'] = true;
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  req.session = null;
  res.json({ ok: true });
});

// GET /api/admin/analytics — dashboard stats
app.get('/api/admin/analytics', async (_req: Request, res: Response) => {
  const db = getDb();
  const items = await db.query(`
    SELECT 
      COUNT(*) AS total_products,
      SUM(units_sold) AS total_units_sold,
      SUM(units_sold * price) AS total_revenue,
      SUM(total_stock) AS total_stock,
      SUM(CASE WHEN total_stock - units_sold <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
      SUM(CASE WHEN total_stock - units_sold > 0 AND total_stock - units_sold < 20 THEN 1 ELSE 0 END) AS low_stock
    FROM items
  `);
  const topSelling = await db.query(`
    SELECT name, units_sold, price, (units_sold * price) AS revenue, category
    FROM items ORDER BY units_sold DESC LIMIT 5
  `);
  const byCategory = await db.query(`
    SELECT category, SUM(units_sold) AS units_sold, SUM(units_sold * price) AS revenue
    FROM items GROUP BY category ORDER BY revenue DESC
  `);
  res.json({
    stats: items.rows[0],
    topSelling: topSelling.rows,
    byCategory: byCategory.rows,
  });
});



app.post('/api/admin/items', async (req: Request, res: Response) => {
  const { name, price, category, imageUrl, total_stock } = req.body as {
    name?: string; price?: number; category?: string; imageUrl?: string; total_stock?: number;
  };
  if (!name || name.trim() === '') { res.status(400).json({ error: 'name is required' }); return; }
  if (typeof price !== 'number' || price <= 0) { res.status(400).json({ error: 'price must be > 0' }); return; }
  const db = getDb();
  const result = await db.query(
    `INSERT INTO items (name, price, category, "imageUrl", total_stock, units_sold, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 0, NOW())
     RETURNING id, name, price, category, "imageUrl", total_stock, units_sold,
               (total_stock - units_sold) AS units_remaining, "updatedAt"`,
    [name.trim(), price, (category || 'General').trim(), (imageUrl || '').trim(), total_stock || 0]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/admin/items/:id', async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const { name, price, category, imageUrl, total_stock, units_sold } = req.body as {
    name?: string; price?: number; category?: string; imageUrl?: string;
    total_stock?: number; units_sold?: number;
  };
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
  if (total_stock !== undefined) { updates.push(`total_stock = $${i++}`); params.push(total_stock); }
  if (units_sold !== undefined) { updates.push(`units_sold = $${i++}`); params.push(units_sold); }
  updates.push(`"updatedAt" = NOW()`);
  params.push(id);

  const result = await db.query(
    `UPDATE items SET ${updates.join(', ')} WHERE id = $${i}
     RETURNING id, name, price, category, "imageUrl", total_stock, units_sold,
               (total_stock - units_sold) AS units_remaining, "updatedAt"`,
    params
  );
  res.json(result.rows[0]);
});

app.delete('/api/admin/items/:id', async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const db = getDb();
  const existing = await db.query('SELECT id FROM items WHERE id = $1', [id]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Item not found' }); return; }
  await db.query('DELETE FROM items WHERE id = $1', [id]);
  res.status(204).send();
});

export default app;
