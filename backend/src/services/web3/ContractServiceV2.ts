/**
 * @file ContractServiceV2.ts
 * @description V2 contract interaction service with multi-chain support and caching
 */

import { ethers, Contract } from 'ethers';
import { config, getRpcUrl, getContractAddress } from '../../config/unifiedConfig';
import { logger } from '../../utils/logger';
import {
  MARKET_FACTORY_V2_ABI,
  LENDING_MARKET_V2_ABI,
  ADAPTER_REGISTRY_ABI,
  IORACLE_ADAPTER_ABI,
  ICOMPLIANCE_ADAPTER_ABI,
  ILIQUIDATION_ADAPTER_ABI,
  IPOSITION_ADAPTER_ABI,
  IERC20_ABI,
} from './ContractAbisV2';

export interface MarketConfig {
  lpAddress: string;
  collateralAsset: string;
  assetAdapter: string;
  oracleAdapter: string;
  complianceAdapter: string;
  liquidationAdapter: string;
  positionAdapter: string;
  lendingAsset: string;
  ltvBasisPoints: number;
  aprBasisPoints: number;
  durationSeconds: number;
  gracePeriodHours: number;
  enableHealthFactor: boolean;
  healthFactorThreshold: number;
  enableCircuitBreaker: boolean;
  pauseThresholdBps: number;
  lookbackPeriodSeconds: number;
  resumeThresholdBps: number;
  cooldownSeconds: number;
}

export interface MarketInfo {
  marketAddress: string;
  status: number;
  totalLiquidity: string;
  availableLiquidity: string;
  totalBorrowed: string;
  activeLoans: number;
  lpToken: string;
}

export interface OnChainLoanDetails {
  collateralAmount: string;
  principal: string;
  startTime: number;
  expiryTime: number;
  frozenInterestAt: number;
  status: number;
  healthFactor: string;
  positionHolder: string;
}

export interface AdapterInfo {
  adapterAddress: string;
  adapterType: number;
  registeredBy: string;
  verified: boolean;
  deprecated: boolean;
  auditReference: string;
  registeredAt: number;
  totalValueSecured: string;
}

// Cache entry
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ContractServiceV2 {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private factoryAddresses: Map<number, string> = new Map();
  private registryAddresses: Map<number, string> = new Map();
  
  // Caches
  private marketStatsCache = new Map<string, CacheEntry<MarketInfo>>();
  private loanDetailsCache = new Map<string, CacheEntry<OnChainLoanDetails>>();
  private healthFactorCache = new Map<string, CacheEntry<string>>();
  private oraclePriceCache = new Map<string, CacheEntry<{ price: string; isTrusted: boolean; updatedAt: number }>>();
  private adapterInfoCache = new Map<string, CacheEntry<AdapterInfo | null>>();
  private contractCache = new Map<string, Contract>();

  // Cache TTLs (ms)
  private readonly MARKET_STATS_TTL = 30_000;
  private readonly LOAN_DETAILS_TTL = 10_000;
  private readonly HEALTH_FACTOR_TTL = 10_000;
  private readonly ORACLE_PRICE_TTL = 30_000;
  private readonly ADAPTER_INFO_TTL = 60_000;

  constructor() {
    // Initialize providers for all configured chains
    for (const chain of config.chains) {
      const rpcUrl = getRpcUrl(chain.id);
      if (rpcUrl) {
        this.providers.set(chain.id, new ethers.JsonRpcProvider(rpcUrl, undefined, {
          staticNetwork: true,
          batchMaxCount: 100,
          cacheTimeout: 30_000,
        }));
      }
      
      // Contract addresses per chain
      this.factoryAddresses.set(chain.id, getContractAddress('marketFactory', chain.id) || '');
      this.registryAddresses.set(chain.id, getContractAddress('adapterRegistry', chain.id) || '');
    }
  }

  private getProvider(chainId: number): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) throw new Error(`RPC provider not configured for chain ${chainId}`);
    return provider;
  }

  private getFactoryAddress(chainId: number): string {
    return this.factoryAddresses.get(chainId) || '';
  }

  private getRegistryAddress(chainId: number): string {
    return this.registryAddresses.get(chainId) || '';
  }

  // ============ Cache Helpers ============

  private getCacheKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }

  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  private getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    if (entry) cache.delete(key);
    return null;
  }

  private async cached<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    ttl: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cached = this.getCache(cache, key);
    if (cached) return cached;
    
    const data = await fn();
    this.setCache(cache, key, data, ttl);
    return data;
  }

  // ============ Factory ============

  getFactoryContract(chainId: number): Contract {
    return new Contract(this.getFactoryAddress(chainId), MARKET_FACTORY_V2_ABI, this.getProvider(chainId));
  }

  async getMarketCount(chainId: number): Promise<number> {
    try {
      const factory = this.getFactoryContract(chainId);
      const count = await factory.getMarketCount();
      return Number(count);
    } catch (error) {
      logger.error({ error, chainId }, 'Failed to get market count');
      throw this._normalizeError(error);
    }
  }

  async getAllMarkets(chainId: number): Promise<string[]> {
    try {
      const factory = this.getFactoryContract(chainId);
      const markets = await factory.getAllMarkets();
      return [...markets];
    } catch (error) {
      logger.error({ error, chainId }, 'Failed to get all markets');
      throw this._normalizeError(error);
    }
  }

  async isMarket(chainId: number, address: string): Promise<boolean> {
    try {
      const factory = this.getFactoryContract(chainId);
      return await factory.isMarket(address);
    } catch (error) {
      return false;
    }
  }

  // ============ Lending Market ============

  getLendingMarketContract(chainId: number, marketAddress: string): Contract {
    return new Contract(marketAddress, LENDING_MARKET_V2_ABI, this.getProvider(chainId));
  }

  async getMarketStats(chainId: number, marketAddress: string): Promise<MarketInfo> {
    const key = this.getCacheKey('marketStats', chainId, marketAddress);
    return this.cached(this.marketStatsCache, key, this.MARKET_STATS_TTL, async () => {
      try {
        const market = this.getLendingMarketContract(chainId, marketAddress);
        const [totalLiquidity, availableLiquidity, totalBorrowed, activeLoans, marketStatus] =
          await market.getMarketStats();
        const lpToken = await market.lpToken();

        return {
          marketAddress,
          status: Number(marketStatus),
          totalLiquidity: totalLiquidity.toString(),
          availableLiquidity: availableLiquidity.toString(),
          totalBorrowed: totalBorrowed.toString(),
          activeLoans: Number(activeLoans),
          lpToken,
        };
      } catch (error) {
        logger.error({ error, chainId, marketAddress }, 'Failed to get market stats');
        throw this._normalizeError(error);
      }
    });
  }

  async getLoanDetails(chainId: number, marketAddress: string, loanId: string): Promise<OnChainLoanDetails> {
    const key = this.getCacheKey('loanDetails', chainId, marketAddress, loanId);
    return this.cached(this.loanDetailsCache, key, this.LOAN_DETAILS_TTL, async () => {
      try {
        const market = this.getLendingMarketContract(chainId, marketAddress);
        const result = await market.getLoanDetails(loanId);

        return {
          collateralAmount: result.collateralAmount.toString(),
          principal: result.principal.toString(),
          startTime: Number(result.startTime),
          expiryTime: Number(result.expiryTime),
          frozenInterestAt: Number(result.frozenInterestAt),
          status: Number(result.status),
          healthFactor: result.healthFactor.toString(),
          positionHolder: result.positionHolder,
        };
      } catch (error) {
        logger.error({ error, chainId, marketAddress, loanId }, 'Failed to get loan details');
        throw this._normalizeError(error);
      }
    });
  }

  async getHealthFactor(chainId: number, marketAddress: string, loanId: string): Promise<string> {
    const key = this.getCacheKey('healthFactor', chainId, marketAddress, loanId);
    return this.cached(this.healthFactorCache, key, this.HEALTH_FACTOR_TTL, async () => {
      try {
        const market = this.getLendingMarketContract(chainId, marketAddress);
        const hf = await market.getHealthFactor(loanId);
        return hf.toString();
      } catch (error) {
        logger.error({ error, chainId, marketAddress, loanId }, 'Failed to get health factor');
        throw this._normalizeError(error);
      }
    });
  }

  // ============ Adapter Registry ============

  getRegistryContract(chainId: number): Contract {
    return new Contract(this.getRegistryAddress(chainId), ADAPTER_REGISTRY_ABI, this.getProvider(chainId));
  }

  async getAdapterInfo(chainId: number, adapterAddress: string): Promise<AdapterInfo | null> {
    const key = this.getCacheKey('adapterInfo', chainId, adapterAddress);
    return this.cached(this.adapterInfoCache, key, this.ADAPTER_INFO_TTL, async () => {
      try {
        const registry = this.getRegistryContract(chainId);
        const info = await registry.getAdapterInfo(adapterAddress);

        return {
          adapterAddress: info.adapterAddress,
          adapterType: Number(info.adapterType),
          registeredBy: info.registeredBy,
          verified: info.verified,
          deprecated: info.deprecated,
          auditReference: info.auditReference,
          registeredAt: Number(info.registeredAt),
          totalValueSecured: info.totalValueSecured.toString(),
        };
      } catch (error) {
        logger.warn({ adapterAddress, chainId }, 'Adapter not found in registry');
        return null;
      }
    });
  }

  async isAdapterSelectable(chainId: number, adapterAddress: string): Promise<boolean> {
    try {
      const registry = this.getRegistryContract(chainId);
      return await registry.isSelectable(adapterAddress);
    } catch (error) {
      return false;
    }
  }

  async getAllAdapters(chainId: number): Promise<string[]> {
    try {
      const registry = this.getRegistryContract(chainId);
      const adapters = await registry.getAllAdapters();
      return [...adapters];
    } catch (error) {
      logger.error({ error, chainId }, 'Failed to get all adapters');
      return [];
    }
  }

  async getAdaptersByType(chainId: number, adapterType: number): Promise<string[]> {
    try {
      const registry = this.getRegistryContract(chainId);
      const adapters = await registry.getAdaptersByType(adapterType);
      return [...adapters];
    } catch (error) {
      logger.error({ error, chainId, adapterType }, 'Failed to get adapters by type');
      return [];
    }
  }

  // ============ Adapter Reads ============

  async getOraclePrice(chainId: number, oracleAddress: string): Promise<{ price: string; isTrusted: boolean; updatedAt: number }> {
    const key = this.getCacheKey('oraclePrice', chainId, oracleAddress);
    return this.cached(this.oraclePriceCache, key, this.ORACLE_PRICE_TTL, async () => {
      try {
        const oracle = new Contract(oracleAddress, IORACLE_ADAPTER_ABI, this.getProvider(chainId));
        const result = await oracle.getPrice();
        return {
          price: result.price.toString(),
          isTrusted: result.isTrusted,
          updatedAt: Number(result.updatedAt),
        };
      } catch (error) {
        logger.error({ error, oracleAddress, chainId }, 'Failed to get oracle price');
        return { price: '0', isTrusted: false, updatedAt: 0 };
      }
    });
  }

  async checkComplianceEligibility(chainId: number, complianceAddress: string, participant: string): Promise<boolean> {
    if (!complianceAddress || complianceAddress === ethers.ZeroAddress) return true;
    try {
      const compliance = new Contract(complianceAddress, ICOMPLIANCE_ADAPTER_ABI, this.getProvider(chainId));
      return await compliance.isEligible(participant);
    } catch (error) {
      return false; // fail-closed
    }
  }

  async checkLiquidationAsync(chainId: number, liquidationAddress: string): Promise<{ isAsync: boolean; cureWindow: number }> {
    try {
      const liq = new Contract(liquidationAddress, ILIQUIDATION_ADAPTER_ABI, this.getProvider(chainId));
      const [isAsync, cureWindow] = await Promise.all([
        liq.isAsynchronous(),
        liq.cureWindowSeconds(),
      ]);
      return { isAsync, cureWindow: Number(cureWindow) };
    } catch (error) {
      return { isAsync: false, cureWindow: 0 };
    }
  }

  async getPositionHolder(chainId: number, positionAddress: string, loanId: string): Promise<string> {
    try {
      const pos = new Contract(positionAddress, IPOSITION_ADAPTER_ABI, this.getProvider(chainId));
      return await pos.ownerOf(loanId);
    } catch (error) {
      return ethers.ZeroAddress;
    }
  }

  // ============ Utility ============

  async getERC20Balance(chainId: number, tokenAddress: string, account: string): Promise<string> {
    try {
      const token = new Contract(tokenAddress, IERC20_ABI, this.getProvider(chainId));
      const balance = await token.balanceOf(account);
      return balance.toString();
    } catch (error) {
      return '0';
    }
  }

  // ============ Cache Management ============

  clearCache(): void {
    this.marketStatsCache.clear();
    this.loanDetailsCache.clear();
    this.healthFactorCache.clear();
    this.oraclePriceCache.clear();
    this.adapterInfoCache.clear();
    this.contractCache.clear();
  }

  getCacheStats(): Record<string, number> {
    return {
      marketStats: this.marketStatsCache.size,
      loanDetails: this.loanDetailsCache.size,
      healthFactor: this.healthFactorCache.size,
      oraclePrice: this.oraclePriceCache.size,
      adapterInfo: this.adapterInfoCache.size,
      contracts: this.contractCache.size,
    };
  }

  private _normalizeError(error: any): Error {
    if (error.reason) return new Error(`Contract error: ${error.reason}`);
    if (error.message?.includes('insufficient funds')) return new Error('Insufficient funds for transaction');
    if (error.message?.includes('revert')) return new Error('Transaction reverted');
    return error instanceof Error ? error : new Error(String(error));
  }
}

export const contractServiceV2 = new ContractServiceV2();