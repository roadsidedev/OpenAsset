import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RPC_URLS: z.string().default('http://127.0.0.1:8545').transform(s => s.split(',')),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Contract Addresses
  MARKET_FACTORY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  LOAN_IMPLEMENTATION_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  NFT_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CHAINLINK_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ORACLE_ROUTER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  UNISWAP_V3_TWAP_WRAPPER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  TREASURY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  
  // Alert Services
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  JWT_SECRET: z.string().default('super-secret-change-me-in-production'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  db: {
    url: env.DATABASE_URL,
  },
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  rpcUrls: env.RPC_URLS,
  frontendUrl: env.FRONTEND_URL,
  contracts: {
    marketFactory: env.MARKET_FACTORY_ADDRESS,
    loanImplementation: env.LOAN_IMPLEMENTATION_ADDRESS,
    nftOracle: env.NFT_ORACLE_ADDRESS,
    chainlinkOracle: env.CHAINLINK_ORACLE_ADDRESS,
    oracleRouter: env.ORACLE_ROUTER_ADDRESS,
    uniswapV3TWAPWrapper: env.UNISWAP_V3_TWAP_WRAPPER_ADDRESS,
    treasury: env.TREASURY_ADDRESS,
  },
  alerts: {
    sendgrid: {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SENDGRID_FROM_EMAIL,
    },
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromNumber: env.TWILIO_FROM_NUMBER,
    },
    firebase: {
      serviceAccountKey: env.FIREBASE_SERVICE_ACCOUNT_KEY,
    }
  }
};
