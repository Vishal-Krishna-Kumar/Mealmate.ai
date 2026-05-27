import request from 'supertest';
import { createApp } from '../app';

describe('GET /api/health', () => {
  const app = createApp();

  it('returns service health information', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      service: 'mealmate-server',
      env: 'test',
    });
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
