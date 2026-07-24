import { ethers } from 'ethers';
import { config, getRpcUrl } from '../config/unifiedConfig';
import { logger } from '../utils/logger';

const providers: Map<number, ethers.JsonRpcProvider> = new Map();
const currentProviderIndex: Map<number, number> = new Map();

export function getConfiguredChains(): number[] {
  return config.chains.map(c => c.id);
}

export function getProvider(chainId: number = 11155111): ethers.JsonRpcProvider {
  if (providers.has(chainId)) {
    return providers.get(chainId)!;
  }
  
  const url = getRpcUrl(chainId);
  if (!url) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  
  const provider = new ethers.JsonRpcProvider(url, undefined, {
    staticNetwork: true,
    batchMaxCount: 100,
    cacheTimeout: 30_000,
    polling: false,
  });
  
  providers.set(chainId, provider);
  currentProviderIndex.set(chainId, 0);
  
  provider.on('error', async (error) => {
    logger.warn({ err: error, chainId, url }, 'Provider error, attempting failover');
    // Could implement failover here if multiple URLs per chain
  });
  
  return provider;
}

export function getAllProviders(): Map<number, ethers.JsonRpcProvider> {
  for (const chainId of getConfiguredChains()) {
    getProvider(chainId);
  }
  return providers;
}

export async function destroyAllProviders(): Promise<void> {
  for (const [chainId, provider] of providers) {
    try {
      await provider.destroy();
    } catch (error) {
      logger.error({ err: error, chainId }, 'Error destroying provider');
    }
  }
  providers.clear();
  currentProviderIndex.clear();
}

// Placeholder for future failover implementation
export async function rotateProvider(chainId: number): Promise<void> {
  logger.warn({ chainId }, 'Provider rotation not yet implemented');
}

export function isProviderHealthy(chainId: number): boolean {
  return providers.has(chainId);
}