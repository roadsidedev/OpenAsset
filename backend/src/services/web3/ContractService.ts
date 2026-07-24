/**
 * @file ContractService.ts
 * @description Legacy V1 contract interaction service (updated for multi-chain config)
 * Handles V1 smart contract reads/writes with error handling and type safety
 */

import { ethers, Contract } from 'ethers';
import { config, getRpcUrl, getContractAddress } from '../../config/unifiedConfig';
import { logger } from '../../utils/logger';
import {
  MARKET_FACTORY_ABI,
  LENDING_MARKET_ABI,
  LOAN_CONTRACT_ABI,
  ORACLE_ROUTER_ABI,
  ERC20_ABI,
} from './ContractAbis';

export interface CreateMarketParams {
  collateralAsset: string;
  loanAsset: string;
  assetType: number; // 0=ERC20, 1=ERC721, 2=ERC1155
  oracleType: number; // 0=CHAINLINK, 1=UNISWAP_V3_TWAP, 2=ORACLE_ROUTER, 3=NFT_ORACLE
  primaryOracle: string;
  nftOracle: string;
  ltvBps: number;
  aprBps: number;
  durationSeconds: number;
  initialLiquidity: string;
}

export interface MarketInfo {
  marketAddress: string;
  owner: string;
  collateralAsset: string;
  loanAsset: string;
  assetType: number;
  oracleType: number;
  ltvBps: number;
  aprBps: number;
  durationSeconds: number;
  createdAt: number;
  active: boolean;
}

export class ContractService {
  private factoryContracts: Map<number, Contract> = new Map();
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

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
    }
    
    // Initialize factory contracts per chain
    for (const chain of config.chains) {
      const factoryAddress = getContractAddress('marketFactory', chain.id);
      const provider = this.providers.get(chain.id);
      if (factoryAddress && provider) {
        try {
          this.factoryContracts.set(chain.id, new ethers.Contract(
            factoryAddress,
            MARKET_FACTORY_ABI,
            provider
          ));
          logger.info({ chainId: chain.id, address: factoryAddress }, 'MarketFactory contract initialized');
        } catch (error) {
          logger.error({ error, chainId: chain.id }, 'Failed to initialize MarketFactory contract');
        }
      }
    }
  }

  private getProvider(chainId: number = 11155111): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) throw new Error(`RPC provider not configured for chain ${chainId}`);
    return provider;
  }

  private getFactoryContract(chainId: number = 11155111): Contract {
    const factory = this.factoryContracts.get(chainId);
    if (!factory) throw new Error(`Factory contract not initialized for chain ${chainId}`);
    return factory;
  }

  async createMarket(
    chainId: number,
    params: CreateMarketParams,
    userAddress: string
  ): Promise<{ txHash: string; estimatedGas: string }> {
    const factoryContract = this.getFactoryContract(chainId);

    try {
      this._validateCreateMarketParams(params);

      const gasEstimate = await factoryContract.createMarket.estimateGas(
        params.collateralAsset,
        params.loanAsset,
        params.assetType,
        params.oracleType,
        params.primaryOracle,
        params.nftOracle,
        params.ltvBps,
        params.aprBps,
        params.durationSeconds,
        ethers.parseUnits(params.initialLiquidity, 18)
      );

      logger.info(
        { gasEstimate: gasEstimate.toString(), userAddress, chainId },
        'Market creation estimated'
      );

      return {
        txHash: '',
        estimatedGas: gasEstimate.toString(),
      };
    } catch (error) {
      logger.error({ error, params, chainId }, 'Failed to estimate market creation');
      throw this._normalizeError(error);
    }
  }

  async getMarketInfo(chainId: number = 11155111, marketAddress: string): Promise<MarketInfo> {
    const factoryContract = this.getFactoryContract(chainId);

    try {
      const info = await factoryContract.getMarketInfo(marketAddress);

      return {
        marketAddress: info.marketAddress,
        owner: info.owner,
        collateralAsset: info.collateralAsset,
        loanAsset: info.loanAsset,
        assetType: Number(info.assetType),
        oracleType: Number(info.oracleType),
        ltvBps: Number(info.ltvBps),
        aprBps: Number(info.aprBps),
        durationSeconds: Number(info.durationSeconds),
        createdAt: Number(info.createdAt),
        active: info.active,
      };
    } catch (error) {
      logger.error({ error, chainId, marketAddress }, 'Failed to get market info');
      throw this._normalizeError(error);
    }
  }

  async getMarkets(chainId: number = 11155111, start: number, count: number): Promise<string[]> {
    try {
      const factoryContract = this.getFactoryContract(chainId);
      const markets = await factoryContract.getMarkets(start, count);
      return markets;
    } catch (error) {
      logger.error({ error, chainId, start, count }, 'Failed to get markets');
      throw this._normalizeError(error);
    }
  }

  async getMarketCount(chainId: number = 11155111): Promise<number> {
    try {
      const factoryContract = this.getFactoryContract(chainId);
      const count = await factoryContract.getMarketCount();
      return Number(count);
    } catch (error) {
      logger.error({ error, chainId }, 'Failed to get market count');
      throw this._normalizeError(error);
    }
  }

  async checkMarketExists(
    chainId: number,
    collateralAsset: string,
    loanAsset: string,
    assetType: number,
    ltvBps: number,
    aprBps: number,
    durationSeconds: number
  ): Promise<{ exists: boolean; market: string }> {
    const factoryContract = this.getFactoryContract(chainId);

    try {
      const result = await factoryContract.checkMarketExists(
        collateralAsset,
        loanAsset,
        assetType,
        ltvBps,
        aprBps,
        durationSeconds
      );

      return {
        exists: result.exists,
        market: result.market,
      };
    } catch (error) {
      logger.error({ error, chainId }, 'Failed to check market existence');
      throw this._normalizeError(error);
    }
  }

  getLendingMarketContract(chainId: number, marketAddress: string): Contract {
    return new ethers.Contract(
      marketAddress,
      LENDING_MARKET_ABI,
      this.getProvider(chainId)
    );
  }

  getLoanContract(loanAddress: string, chainId: number = 11155111): Contract {
    return new ethers.Contract(loanAddress, LOAN_CONTRACT_ABI, this.getProvider(chainId));
  }

  getERC20Contract(tokenAddress: string, chainId: number = 11155111): Contract {
    return new ethers.Contract(tokenAddress, ERC20_ABI, this.getProvider(chainId));
  }

  getOracleContract(oracleAddress: string, chainId: number = 11155111): Contract {
    return new ethers.Contract(
      oracleAddress,
      ORACLE_ROUTER_ABI,
      this.getProvider(chainId)
    );
  }

  async getMarketLiquidity(
    chainId: number,
    marketAddress: string
  ): Promise<{
    total: string;
    available: string;
    reserved: string;
  }> {
    const market = this.getLendingMarketContract(chainId, marketAddress);

    try {
      const total = await market.getTotalLiquidity();
      const available = await market.getAvailableLiquidity();
      const reserved = BigInt(total) - BigInt(available);

      return {
        total: total.toString(),
        available: available.toString(),
        reserved: reserved.toString(),
      };
    } catch (error) {
      logger.error({ error, chainId, marketAddress }, 'Failed to get market liquidity');
      throw this._normalizeError(error);
    }
  }

  async getLoanDetails(
    chainId: number,
    loanAddress: string
  ): Promise<{
    borrower: string;
    principal: string;
    accruedInterest: string;
    healthFactor: string;
    expiryTime: number;
    status: number;
  }> {
    const loan = this.getLoanContract(loanAddress, chainId);

    try {
      const [borrower, principal, interest, healthFactor, expiry, status] =
        await Promise.all([
          loan.getBorrower(),
          loan.getPrincipal(),
          loan.getAccruedInterest(),
          loan.getHealthFactor(),
          loan.getExpiryTime(),
          loan.getStatus(),
        ]);

      return {
        borrower,
        principal: principal.toString(),
        accruedInterest: interest.toString(),
        healthFactor: healthFactor.toString(),
        expiryTime: Number(expiry),
        status: Number(status),
      };
    } catch (error) {
      logger.error({ error, chainId, loanAddress }, 'Failed to get loan details');
      throw this._normalizeError(error);
    }
  }

  async getAssetPrice(
    chainId: number,
    oracleAddress: string,
    assetAddress: string
  ): Promise<string> {
    const oracle = this.getOracleContract(oracleAddress, chainId);

    try {
      const price = await oracle.getPrice(assetAddress);
      return price.toString();
    } catch (error) {
      logger.error(
        { error, chainId, oracleAddress, assetAddress },
        'Failed to get asset price'
      );
      throw this._normalizeError(error);
    }
  }

  async getBalance(tokenAddress: string, accountAddress: string, chainId: number = 11155111): Promise<string> {
    const token = this.getERC20Contract(tokenAddress, chainId);

    try {
      const balance = await token.balanceOf(accountAddress);
      return balance.toString();
    } catch (error) {
      logger.error(
        { error, tokenAddress, accountAddress, chainId },
        'Failed to get balance'
      );
      throw this._normalizeError(error);
    }
  }

  private _validateCreateMarketParams(params: CreateMarketParams): void {
    if (!ethers.isAddress(params.collateralAsset)) {
      throw new Error('Invalid collateral asset address');
    }
    if (!ethers.isAddress(params.loanAsset)) {
      throw new Error('Invalid loan asset address');
    }
    if (params.assetType < 0 || params.assetType > 2) {
      throw new Error('Invalid asset type');
    }
    if (params.oracleType < 0 || params.oracleType > 3) {
      throw new Error('Invalid oracle type');
    }
    if (params.ltvBps < 100 || params.ltvBps > 9500) {
      throw new Error('LTV must be between 1% and 95%');
    }
    if (params.aprBps < 0 || params.aprBps > 10000) {
      throw new Error('APR must be between 0% and 100%');
    }
    if (
      params.durationSeconds < 3600 ||
      params.durationSeconds > 365 * 86400
    ) {
      throw new Error('Duration must be between 1 hour and 365 days');
    }
  }

  private _normalizeError(error: any): Error {
    if (error.reason) {
      return new Error(`Contract error: ${error.reason}`);
    }
    if (error.message?.includes('insufficient funds')) {
      return new Error('Insufficient funds for transaction');
    }
    if (error.message?.includes('revert')) {
      return new Error('Transaction reverted');
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

export const contractService = new ContractService();