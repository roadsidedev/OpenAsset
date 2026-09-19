import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/unifiedConfig';
import { logger } from './utils/logger';
import { createMarketRoutes } from './routes/marketRoutes';
import { createLoanRoutes } from './routes/loanRoutes';
import { createUserRoutes } from './routes/userRoutes';
import { createAuthRoutes } from './routes/authRoutes';
import { createAdapterRoutes } from './routes/adapterRoutes';
import { createSupportRoutes } from './routes/supportRoutes';
import { prisma } from './bootstrap/prisma';
import { lifecycle } from './bootstrap/lifecycle';
import { requireAuth } from './middleware/auth';

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedFrontendOrigins.includes('*') || config.allowedFrontendOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Initialize routes with Prisma client
app.use('/api/v1/auth', createAuthRoutes(prisma));
app.use('/api/v1/markets', createMarketRoutes(prisma));
app.use('/api/v1/loans', createLoanRoutes(prisma));
app.use('/api/v1/users', createUserRoutes(prisma));
app.use('/api/v1/adapters', createAdapterRoutes(prisma));
app.use('/api/v1/support', createSupportRoutes(prisma));

async function computeOverallStatus(): Promise<'ok' | 'degraded'> {
  try {
    const workerHealth = await lifecycle.healthCheck();
    const overallHealthy = Object.values(workerHealth).every((h: any) => h?.healthy !== false);
    return overallHealthy ? 'ok' : 'degraded';
  } catch {
    return 'degraded';
  }
}

// Public health: status only — never expose worker details or String(error)
app.get('/health', async (_req, res) => {
  const status = await computeOverallStatus();
  res.status(status === 'ok' ? 200 : 503).json({ status });
});

// Authenticated detailed health for operators
app.get('/health/detailed', requireAuth, async (_req, res) => {
  try {
    const workerHealth = await lifecycle.healthCheck();
    const overallHealthy = Object.values(workerHealth).every((h: any) => h?.healthy !== false);
    // Sanitize: never include raw String(error) — map to boolean/status only at public-facing keys;
    // detailed route is auth-gated and returns structured worker health without stacking error strings into the top level.
    const sanitized: Record<string, { healthy: boolean }> = {};
    for (const [name, h] of Object.entries(workerHealth)) {
      sanitized[name] = { healthy: !!(h as any)?.healthy };
    }
    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'ok' : 'degraded',
      workers: sanitized,
    });
  } catch {
    res.status(503).json({ status: 'degraded', workers: {} });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const client = await import('prom-client');
    const registry = client.register;
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Metrics not available' });
  }
});

// Error handling middleware (must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error: err }, 'Unhandled error');
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
