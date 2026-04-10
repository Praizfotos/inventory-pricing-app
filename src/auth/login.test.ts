import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDb, closeDb } from '../db/client';
import { login } from './login';

// supertest is not in package.json — use a lightweight in-process approach instead
// We'll call the handler directly via a minimal express app and node's http module.

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/auth/login', login);
  return app;
}

describe('login handler', () => {
  beforeAll(() => {
    // Use an in-memory SQLite DB for tests
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  const app = buildApp();

  it('returns 401 when username is empty', async () => {
    const res = await makeRequest(app, { username: '', password: 'admin123' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 when password is empty', async () => {
    const res = await makeRequest(app, { username: 'admin', password: '' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 when both fields are missing', async () => {
    const res = await makeRequest(app, {});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 for unknown username', async () => {
    const res = await makeRequest(app, { username: 'nobody', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 for wrong password', async () => {
    const res = await makeRequest(app, { username: 'admin', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns a JWT token on valid admin credentials', async () => {
    const res = await makeRequest(app, { username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('returns a JWT token on valid associate credentials', async () => {
    const res = await makeRequest(app, { username: 'associate', password: 'associate123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('JWT payload contains correct userId, role, and ~8h expiry', async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await makeRequest(app, { username: 'admin', password: 'admin123' });
    const after = Math.floor(Date.now() / 1000);

    const [, payloadB64] = res.body.token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    expect(payload.role).toBe('admin');
    expect(typeof payload.userId).toBe('number');

    const eightHours = 8 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + eightHours);
    expect(payload.exp).toBeLessThanOrEqual(after + eightHours + 5); // 5s tolerance
  });
});

// ---------------------------------------------------------------------------
// Minimal HTTP helper — avoids adding supertest as a dependency
// ---------------------------------------------------------------------------
async function makeRequest(
  app: express.Express,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const data = JSON.stringify(body);

      const http = require('http') as typeof import('http');
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/auth/login', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          });
        }
      );
      req.on('error', (err) => { server.close(); reject(err); });
      req.write(data);
      req.end();
    });
  });
}
