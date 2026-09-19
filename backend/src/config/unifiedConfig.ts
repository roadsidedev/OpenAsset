import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().url().default('postgresql://user:pass@localhost:5432/openasset'),
  NODE_ENV: z.string().default('development').transform((val) => val.toLowerCase()).pipe(z.enum(['development', 'production', 'test'])),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Multi-chain RPC URLs (comma-separated, or chainId:url format)
  // Format: "1:https://eth.llamarpc.com,https://backup.eth.com;11155111:https://rpc.sepolia.org"
  RPC_URLS: z.string().default('http://127.0.0.1:8545'),
  CHAIN_IDS: z.string().optional(), // e.g., "1,11155111"
  
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URLS: z.string().optional(),
  
  // Contract Addresses (chainId:address format for multi-chain, e.g. "84532:0x...;11155111:0x...")
  MARKET_FACTORY_ADDRESS: z.string().default(''),
  LOAN_IMPLEMENTATION_ADDRESS: z.string().default(''),
  NFT_ORACLE_ADDRESS: z.string().default(''),
  CHAINLINK_ORACLE_ADDRESS: z.string().default(''),
  ORACLE_ROUTER_ADDRESS: z.string().default(''),
  UNISWAP_V3_TWAP_WRAPPER_ADDRESS: z.string().default(''),
  TREASURY_ADDRESS: z.string().default(''),
  ADAPTER_REGISTRY_ADDRESS: z.string().default(''),
  MARKET_DEPLOYER_ADDRESS: z.string().default(''),
  // B20 (Base tokenized stocks)
  B20_FACTORY_ADDRESS: z.string().default(''),
  B20_POLICY_REGISTRY_ADDRESS: z.string().default(''),
  B20_ASSET_ADAPTER_ADDRESS: z.string().default(''),
  B20_COMPLIANCE_ADAPTER_ADDRESS: z.string().default(''),
  CHAINLINK_EQUITY_FEED_ADAPTER_ADDRESS: z.string().default(''),
  B20_PROVIDER_CONFIGURATOR_ADDRESS: z.string().default(''),
  ROBINHOOD_COMPLIANCE_ADAPTER_ADDRESS: z.string().default(''),
  ROBINHOOD_PROVIDER_CONFIGURATOR_ADDRESS: z.string().default(''),
  
  // Alert Services
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  
  // Keeper Service (Liquidation Execution)
  KEEPER_ENABLED: z.string().default('false').transform(v => v === 'true'),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  KEEPER_CHAIN_ID: z.string().default('11155111').transform(Number),
  KEEPER_MAX_GAS_PRICE_GWEI: z.string().default('100').transform(Number),
  KEEPER_POLL_INTERVAL_MS: z.string().default('30000').transform(Number),
  KEEPER_MIN_HEALTH_FACTOR_BPS: z.string().default('12000').transform(Number),
  KEEPER_BATCH_SIZE: z.string().default('10').transform(Number),
  
  // Database Pool
  DB_POOL_SIZE: z.string().default('10').transform(Number),
  DB_POOL_TIMEOUT: z.string().default('30000').transform(Number),
});

const env = envSchema.parse(process.env);

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'super-secret-change-me-in-production',
  'changeme',
  'secret',
  'jwt-secret',
  'your-secret-here',
]);

function assertSecureJwtSecret(secret: string | undefined, nodeEnv: string): string {
  if (!secret || !secret.trim()) {
    throw new Error(
      `JWT_SECRET is required (NODE_ENV=${nodeEnv}). Set a strong random secret via environment.`
    );
  }
  const normalized = secret.trim();
  if (INSECURE_JWT_PLACEHOLDERS.has(normalized.toLowerCase()) || INSECURE_JWT_PLACEHOLDERS.has(normalized)) {
    throw new Error(
      `JWT_SECRET must not use a known insecure placeholder (NODE_ENV=${nodeEnv}).`
    );
  }
  // Always reject placeholders; in production also require reasonable length
  if (nodeEnv === 'production' && normalized.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  return normalized;
}

const resolvedJwtSecret = assertSecureJwtSecret(env.JWT_SECRET, env.NODE_ENV);

function parseRpcUrls(input: string): Map<number, string[]> {
  const result = new Map<number, string[]>();
  
  // Method 1: Per-chain env vars (most Docker-safe, no special chars)
  // e.g. RPC_URL_84532=https://..., RPC_URL_11155111=https://...
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^RPC_URL_(\d+)$/);
    if (match && value) {
      const chainId = parseInt(match[1], 10);
      if (!isNaN(chainId)) {
        result.set(chainId, [value]);
      }
    }
  }
  if (result.size > 0) return result;
  
  // Method 2: Multi-chain format "chainId:url;chainId:url"
  if (input.includes(':') && input.includes(';')) {
    const parts = input.split(';');
    for (const part of parts) {
      const [chainIdStr, ...urlParts] = part.split(':');
      const chainId = parseInt(chainIdStr, 10);
      if (!isNaN(chainId) && urlParts.length > 0) {
        result.set(chainId, urlParts.join(':').split(',').filter(u => u.trim()));
      }
    }
  } else {
    // Method 3: Single URL with CHAIN_IDS
    const chainIds = env.CHAIN_IDS 
      ? env.CHAIN_IDS.split(',').map(s => parseInt(s.trim(), 10))
      : [11155111];
    const urls = input.split(',').filter(u => u.trim());
    for (const chainId of chainIds) {
      result.set(chainId, urls);
    }
  }
  
  return result;
}

function parseContractAddresses(input: string): Map<number, string> {
  const result = new Map<number, string>();
  if (!input) return result;
  
  // Format: "1:0x...;11155111:0x..."
  const parts = input.split(';');
  for (const part of parts) {
    const [chainIdStr, address] = part.split(':');
    const chainId = parseInt(chainIdStr, 10);
    if (!isNaN(chainId) && address) {
      result.set(chainId, address);
    }
  }
  return result;
}

function parseFrontendUrls(input?: string): string[] {
  if (!input) return [];
  return input.split(',').map((u) => u.trim()).filter(Boolean);
}

const rpcUrlsMap = parseRpcUrls(env.RPC_URLS);
const chainIds = Array.from(rpcUrlsMap.keys());
const allowedFrontendOrigins = parseFrontendUrls(env.FRONTEND_URLS).map((u) => {
  try { return new URL(u).origin; } catch { return u; }
});

// Production fallback: when FRONTEND_URLS is not set, allow known frontend origins
// so deployed backends do not hard-fail CORS after frontend domain changes.
const knownFrontendOrigins = [
  'https://www.openasset.markets',
  'https://openasset-market.vercel.app',
  'https://openasset.vercel.app',
];
const resolvedAllowedFrontendOrigins =
  allowedFrontendOrigins.length > 0
    ? allowedFrontendOrigins
    : knownFrontendOrigins;

export const config = {
  port: env.PORT,
  jwtSecret: resolvedJwtSecret,
  db: {
    url: env.DATABASE_URL,
    poolSize: env.DB_POOL_SIZE,
    poolTimeout: env.DB_POOL_TIMEOUT,
  },
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  rpcUrls: rpcUrlsMap,
  frontendUrl: env.FRONTEND_URL,
  frontendUrls: env.FRONTEND_URLS,
  allowedFrontendOrigins: resolvedAllowedFrontendOrigins,
  
  // Chain configuration
  chains: chainIds.map(id => ({ 
    id, 
    rpcUrls: rpcUrlsMap.get(id) || [],
  })),
  
  // Contract addresses per chain
  contracts: {
    marketFactory: parseContractAddresses(env.MARKET_FACTORY_ADDRESS),
    loanImplementation: parseContractAddresses(env.LOAN_IMPLEMENTATION_ADDRESS),
    nftOracle: parseContractAddresses(env.NFT_ORACLE_ADDRESS),
    chainlinkOracle: parseContractAddresses(env.CHAINLINK_ORACLE_ADDRESS),
    oracleRouter: parseContractAddresses(env.ORACLE_ROUTER_ADDRESS),
    uniswapV3TWAPWrapper: parseContractAddresses(env.UNISWAP_V3_TWAP_WRAPPER_ADDRESS),
    marketDeployer: parseContractAddresses(env.MARKET_DEPLOYER_ADDRESS),
    treasury: parseContractAddresses(env.TREASURY_ADDRESS),
    adapterRegistry: parseContractAddresses(env.ADAPTER_REGISTRY_ADDRESS),
    b20Factory: parseContractAddresses(env.B20_FACTORY_ADDRESS),
    b20PolicyRegistry: parseContractAddresses(env.B20_POLICY_REGISTRY_ADDRESS),
    b20AssetAdapter: parseContractAddresses(env.B20_ASSET_ADAPTER_ADDRESS),
    b20ComplianceAdapter: parseContractAddresses(env.B20_COMPLIANCE_ADAPTER_ADDRESS),
    chainlinkEquityFeedAdapter: parseContractAddresses(env.CHAINLINK_EQUITY_FEED_ADAPTER_ADDRESS),
    b20ProviderConfigurator: parseContractAddresses(env.B20_PROVIDER_CONFIGURATOR_ADDRESS),
    robinhoodComplianceAdapter: parseContractAddresses(env.ROBINHOOD_COMPLIANCE_ADAPTER_ADDRESS),
    robinhoodProviderConfigurator: parseContractAddresses(env.ROBINHOOD_PROVIDER_CONFIGURATOR_ADDRESS),
  },
  
  // Alert configuration with deduplication
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
    },
    dedup: {
      defaultWindowSec: 3600, // 1 hour default
      windows: {
        HEALTH_FACTOR: 1800,    // 30 min
        LIQUIDATION_RISK: 1800, // 30 min
        MARKET_PAUSED: 86400,   // 24 hours
        LOAN_EXPIRING: 3600,    // 1 hour
        LIQUIDATION_CURE_WARNING: 600, // 10 min
        CURE_WINDOW_EXPIRING: 600,     // 10 min
        SETTLEMENT_TIMEOUT: 86400,     // 24 hours
      } as Record<string, number>,
    },
  },
  
  // Keeper service configuration (private key is NOT exported on this plain object)
  keeper: {
    enabled: env.KEEPER_ENABLED,
    chainId: env.KEEPER_CHAIN_ID,
    maxGasPriceGwei: env.KEEPER_MAX_GAS_PRICE_GWEI,
    pollIntervalMs: env.KEEPER_POLL_INTERVAL_MS,
    minHealthFactorBps: env.KEEPER_MIN_HEALTH_FACTOR_BPS,
    batchSize: env.KEEPER_BATCH_SIZE,
  },
};

/** Resolve keeper private key without putting it on the exported config object */
export function getKeeperPrivateKey(): string | undefined {
  return env.KEEPER_PRIVATE_KEY;
}

// Helper methods
export function getRpcUrl(chainId: number): string | undefined {
  const urls = config.rpcUrls.get(chainId);
  return urls?.[0];
}

export function getRpcUrls(chainId: number): string[] {
  return config.rpcUrls.get(chainId) || [];
}

export function getContractAddress(name: keyof typeof config.contracts, chainId: number): string | undefined {
  return config.contracts[name]?.get(chainId);
}