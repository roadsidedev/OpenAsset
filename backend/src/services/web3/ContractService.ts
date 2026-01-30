/**
 * @file ContractService.ts
 * @description Production-grade Web3 contract interaction service
 * Handles all smart contract reads/writes with error handling and type safety
 */

import { ethers, Contract } from 'ethers';
import { config } from '../../config/unifiedConfig';
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
  initialLiquidity: string; // Use string for BigInt amounts
}

export interface RequestLoanParams {
  collateralAmount: string;
  tokenId: number;
  erc1155Amount: string;
  desiredPrincipal: string;
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
  private factoryContract: Contract | null = null;
  private provider: ethers.JsonRpcProvider;
  private contractAddresses: {
    marketFactory: string;
    loanImplementation: string;
    nftOracle: string;
    chainlinkOracle: string;
    oracleRouter: string;
    uniswapV3TWAPWrapper: string;
    treasury: string;
  };

  constructor() {
    // Initialize provider with fallback
    const rpcUrl = config.rpcUrls[0];
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Load contract addresses from config
    this.contractAddresses = {
      marketFactory: config.contracts.marketFactory,
      loanImplementation: config.contracts.loanImplementation || '',
      nftOracle: config.contracts.nftOracle || '',
      chainlinkOracle: config.contracts.chainlinkOracle || '',
      oracleRouter: config.contracts.oracleRouter || '',
      uniswapV3TWAPWrapper: config.contracts.uniswapV3TWAPWrapper || '',
      treasury: config.contracts.treasury || '',
    };

    this.initializeFactoryContract();
  }

  private initializeFactoryContract(): void {
    try {
      this.factoryContract = new ethers.Contract(
        this.contractAddresses.marketFactory,
        MARKET_FACTORY_ABI,
        this.provider
      );
      logger.info(
        { address: this.contractAddresses.marketFactory },
        'MarketFactory contract initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize MarketFactory contract');
      throw error;
    }
  }

  /**
   * Create a new lending market
   * @param params Market creation parameters
   * @param userAddress User address to execute transaction
   * @returns Transaction hash and market creation details
   */
  async createMarket(
    params: CreateMarketParams,
    userAddress: string
  ): Promise<{ txHash: string; estimatedGas: string }> {
    if (!this.factoryContract) {
      throw new Error('Factory contract not initialized');
    }

    try {
      // Validate parameters
      this._validateCreateMarketParams(params);

      // Estimate gas
      const gasEstimate = await this.factoryContract.createMarket.estimateGas(
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
        { gasEstimate: gasEstimate.toString(), userAddress },
        'Market creation estimated'
      );

      return {
        txHash: '', // Will be populated after user signs
        estimatedGas: gasEstimate.toString(),
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to estimate market creation');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get market information by address
   */
  async getMarketInfo(marketAddress: string): Promise<MarketInfo> {
    if (!this.factoryContract) {
      throw new Error('Factory contract not initialized');
    }

    try {
      const info = await this.factoryContract.getMarketInfo(marketAddress);

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
      logger.error({ error, marketAddress }, 'Failed to get market info');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get paginated list of markets
   */
  async getMarkets(start: number, count: number): Promise<string[]> {
    if (!this.factoryContract) {
      throw new Error('Factory contract not initialized');
    }

    try {
      const markets = await this.factoryContract.getMarkets(start, count);
      return markets;
    } catch (error) {
      logger.error({ error, start, count }, 'Failed to get markets');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get total market count
   */
  async getMarketCount(): Promise<number> {
    if (!this.factoryContract) {
      throw new Error('Factory contract not initialized');
    }

    try {
      const count = await this.factoryContract.getMarketCount();
      return Number(count);
    } catch (error) {
      logger.error({ error }, 'Failed to get market count');
      throw this._normalizeError(error);
    }
  }

  /**
   * Check if market exists
   */
  async checkMarketExists(
    collateralAsset: string,
    loanAsset: string,
    assetType: number,
    ltvBps: number,
    aprBps: number,
    durationSeconds: number
  ): Promise<{ exists: boolean; market: string }> {
    if (!this.factoryContract) {
      throw new Error('Factory contract not initialized');
    }

    try {
      const result = await this.factoryContract.checkMarketExists(
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
      logger.error({ error }, 'Failed to check market existence');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get lending market contract instance
   */
  getLendingMarketContract(marketAddress: string): Contract {
    return new ethers.Contract(
      marketAddress,
      LENDING_MARKET_ABI,
      this.provider
    );
  }

  /**
   * Get loan contract instance
   */
  getLoanContract(loanAddress: string): Contract {
    return new ethers.Contract(loanAddress, LOAN_CONTRACT_ABI, this.provider);
  }

  /**
   * Get ERC20 token contract instance
   */
  getERC20Contract(tokenAddress: string): Contract {
    return new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
  }

  /**
   * Get oracle contract instance
   */
  getOracleContract(oracleAddress: string): Contract {
    return new ethers.Contract(
      oracleAddress,
      ORACLE_ROUTER_ABI,
      this.provider
    );
  }

  /**
   * Get available liquidity for a market
   */
  async getMarketLiquidity(
    marketAddress: string
  ): Promise<{
    total: string;
    available: string;
    reserved: string;
  }> {
    const market = this.getLendingMarketContract(marketAddress);

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
      logger.error({ error, marketAddress }, 'Failed to get market liquidity');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get loan details
   */
  async getLoanDetails(
    loanAddress: string
  ): Promise<{
    borrower: string;
    principal: string;
    accruedInterest: string;
    healthFactor: string;
    expiryTime: number;
    status: number;
  }> {
    const loan = this.getLoanContract(loanAddress);

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
      logger.error({ error, loanAddress }, 'Failed to get loan details');
      throw this._normalizeError(error);
    }
  }

  /**
   * Get asset price from oracle
   */
  async getAssetPrice(
    oracleAddress: string,
    assetAddress: string
  ): Promise<string> {
    const oracle = this.getOracleContract(oracleAddress);

    try {
      const price = await oracle.getPrice(assetAddress);
      return price.toString();
    } catch (error) {
      logger.error(
        { error, oracleAddress, assetAddress },
        'Failed to get asset price'
      );
      throw this._normalizeError(error);
    }
  }

  /**
   * Get ERC20 balance
   */
  async getBalance(tokenAddress: string, accountAddress: string): Promise<string> {
    const token = this.getERC20Contract(tokenAddress);

    try {
      const balance = await token.balanceOf(accountAddress);
      return balance.toString();
    } catch (error) {
      logger.error(
        { error, tokenAddress, accountAddress },
        'Failed to get balance'
      );
      throw this._normalizeError(error);
    }
  }

  // Private helpers

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

// Singleton instance
export const contractService = new ContractService();
