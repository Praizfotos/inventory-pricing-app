import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb } from './db';

const UPLOADS_DIR = '/data/uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed'));
    }
  },
});

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// GET /uploads/:filename — serve files from the persistent volume
app.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params['filename']); // prevent path traversal
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
});

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

// POST /api/admin/upload — upload an image to /data/uploads/
app.post('/api/admin/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename, size: req.file.size });
});

// Multer error handler for the upload route
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err && err.message) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

// POST /api/admin/items — accepts JSON body or multipart/form-data (with optional image file)
app.post('/api/admin/items', upload.single('image'), async (req: Request, res: Response) => {
  const body = req.body as { name?: string; price?: string | number; category?: string; imageUrl?: string };
  const name = body.name;
  const price = typeof body.price === 'string' ? parseFloat(body.price) : body.price;
  const category = body.category;
  // If a file was uploaded, use its path; otherwise fall back to the imageUrl field
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || '');

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    res.status(400).json({ error: 'price must be a number greater than 0' });
    return;
  }

  const db = getDb();
  const result = await db.query(
    `INSERT INTO items (name, price, category, "imageUrl", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, price, category, "imageUrl", "updatedAt"`,
    [name.trim(), price, (category || 'General').trim(), imageUrl.trim()]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/admin/items/:id — accepts JSON body or multipart/form-data (with optional image file)
app.put('/api/admin/items/:id', upload.single('image'), async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const body = req.body as { name?: string; price?: string | number; category?: string; imageUrl?: string };
  const name = body.name;
  const price = typeof body.price === 'string' ? parseFloat(body.price) : body.price;
  const category = body.category;
  // If a new file was uploaded, use its path; otherwise use the imageUrl field if provided
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : body.imageUrl;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (price !== undefined && (typeof price !== 'number' || isNaN(price) || price <= 0)) {
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
