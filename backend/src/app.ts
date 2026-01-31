import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { config } from './config/unifiedConfig';
import { logger } from './utils/logger';
import { createMarketRoutes } from './routes/marketRoutes';
import { createLoanRoutes } from './routes/loanRoutes';
import { createUserRoutes } from './routes/userRoutes';
import { createAuthRoutes } from './routes/authRoutes';

const prisma = new PrismaClient();
const app = express();

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
