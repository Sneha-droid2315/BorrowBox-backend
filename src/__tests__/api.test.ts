import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('BorrowBox Express API', () => {
  it('GET /api/health returns 200 and service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('BorrowBox API');
    expect(res.body.status).toBe('ok');
  });

  it('Returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });

  it('Enforces authentication on protected student routes', async () => {
    const dashboardRes = await request(app).get('/api/requests/dashboard');
    expect(dashboardRes.status).toBe(401);
    expect(dashboardRes.body.success).toBe(false);

    const wishlistRes = await request(app).get('/api/wishlist');
    expect(wishlistRes.status).toBe(401);

    const notificationsRes = await request(app).get('/api/notifications');
    expect(notificationsRes.status).toBe(401);
  });

  it('Enforces authentication on protected admin routes', async () => {
    const adminRes = await request(app).get('/api/admin/stats');
    expect(adminRes.status).toBe(401);
    expect(adminRes.body.success).toBe(false);
  });

  it('Validates registration request payload with Zod before hitting DB', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
      department: '',
      year: '',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('Validates login request payload with Zod', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'invalid-email',
      password: '',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('Clears auth cookie on POST /api/auth/logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
