import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/client';
import { User, JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60;

export const login: RequestHandler = async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  // Req 1.3: skip DB lookup on empty inputs
  if (!username || !password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as User | undefined;

  // Req 1.2: generic 401 for any credential mismatch
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Req 1.1: sign JWT with userId, role, exp +8h
  const payload: JwtPayload = {
    userId: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + EIGHT_HOURS_IN_SECONDS,
  };

  const token = jwt.sign(payload, JWT_SECRET);

  res.json({ token });
};
