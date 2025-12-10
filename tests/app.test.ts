import request from 'supertest';
import { app } from '../src/app';

describe('API routes', () => {
  it('responds to GET /health', async () => {
    const response = await request(app).get('/health');
    const body = response.body as {
      status: string;
      uptime: number;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('responds to GET /hello with default name', async () => {
    const response = await request(app).get('/hello');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello, world!' });
  });

  it('responds to GET /hello with provided name', async () => {
    const response = await request(app).get('/hello').query({ name: 'Copilot' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello, Copilot!' });
  });
});
