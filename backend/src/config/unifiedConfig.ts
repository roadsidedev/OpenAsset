import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  db: {
    url: env.DATABASE_URL,
  },
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
};
