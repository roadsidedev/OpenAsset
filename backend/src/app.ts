import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/unifiedConfig';
import { logger } from './utils/logger';

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

import marketRoutes from './routes/marketRoutes';
import loanRoutes from './routes/loanRoutes';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/markets', marketRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/users', userRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
