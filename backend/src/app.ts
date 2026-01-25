import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { config } from './config/unifiedConfig';

export const logger = pino({ level: config.logLevel });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

import marketRoutes from './routes/marketRoutes';
import loanRoutes from './routes/loanRoutes';

app.use('/api/v1/markets', marketRoutes);
app.use('/api/v1/loans', loanRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
