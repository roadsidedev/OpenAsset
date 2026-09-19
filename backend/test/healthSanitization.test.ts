/**
 * Public /health must return only { status: 'ok' | 'degraded' }.
 */

jest.mock('../src/bootstrap/lifecycle', () => ({
  lifecycle: {
    healthCheck: jest.fn(),
  },
}));

jest.mock('../src/bootstrap/prisma', () => ({
  prisma: {},
}));

import request from 'supertest';

describe('Public /health sanitization', () => {
  let app: any;
  let healthCheck: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    // Re-apply mock implementations after resetModules
    jest.doMock('../src/bootstrap/lifecycle', () => ({
      lifecycle: {
        healthCheck: jest.fn(),
      },
    }));
    jest.doMock('../src/bootstrap/prisma', () => ({
      prisma: {},
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app = require('../src/app').default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { lifecycle } = require('../src/bootstrap/lifecycle');
    healthCheck = lifecycle.healthCheck as jest.Mock;
    healthCheck.mockReset();
  });

  it('returns only status when healthy', async () => {
    healthCheck.mockResolvedValue({
      api: { healthy: true, details: { error: 'should-not-leak' } },
      indexer: { healthy: true },
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.body).not.toHaveProperty('workers');
    expect(JSON.stringify(res.body)).not.toContain('should-not-leak');
  });

  it('returns degraded without worker/error details', async () => {
    healthCheck.mockResolvedValue({
      api: { healthy: false, error: String(new Error('db connection refused at 10.0.0.5')) },
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded' });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });

  it('returns degraded when healthCheck throws', async () => {
    healthCheck.mockRejectedValue(new Error('boom internal'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded' });
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
