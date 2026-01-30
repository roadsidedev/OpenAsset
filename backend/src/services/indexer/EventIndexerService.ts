/**
 * @file EventIndexerService.ts
 * @description Production-grade event indexer for Red Chips protocol
 * Listens to all contract events and syncs state to database
 */

import { PrismaClient, AssetType, OracleType } from '@prisma/client';

import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { config } from '../../config/unifiedConfig';
import { healthTracker } from '../../utils/health';
import {
  MARKET_FACTORY_ABI,
  LENDING_MARKET_ABI,
  LOAN_CONTRACT_ABI,
} from '../web3/ContractAbis';

const BLOCK_CHUNK_SIZE = 100;
const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

export class EventIndexerService {
  private prisma: PrismaClient;
  private provider: ethers.FallbackProvider | ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private isRunning: boolean = false;
  private lastIndexedBlock: number = 0;
  private retryCount: number = 0;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;

    // Initialize FallbackProvider with all RPC URLs
    const providers = config.rpcUrls.map(
      (url) => new ethers.JsonRpcProvider(url)
    );
    this.provider =
      providers.length > 1
        ? new ethers.FallbackProvider(providers)
        : providers[0];

    // Initialize factory contract
    this.factoryContract = new ethers.Contract(
      config.contracts.marketFactory,
      MARKET_FACTORY_ABI,
      this.provider
    );

    logger.info(
      { factory: config.contracts.marketFactory },
      'EventIndexerService initialized'
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event Indexer is already running');
      return;
    }

    this.isRunning = true;
    this.retryCount = 0;

    try {
      // Load last indexed block from database
      const state = await this.prisma.syncState.findUnique({
        where: { id: 'event_indexer' },
      });

      if (state) {
        this.lastIndexedBlock = state.lastBlock;
        logger.info(
          { lastBlock: this.lastIndexedBlock },
          'Resuming Event Indexer from saved state'
        );
      } else {
        // Start from current block if no state
        this.lastIndexedBlock = await this.provider.getBlockNumber();
        logger.info(
          { block: this.lastIndexedBlock },
          'Starting Event Indexer from current block'
        );

        await this.prisma.syncState.create({
          data: { id: 'event_indexer', lastBlock: this.lastIndexedBlock },
        });
      }

      // Start polling
      this.pollEvents();
    } catch (error) {
      logger.error({ error }, 'Failed to start Event Indexer');
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Stopping Event Indexer Service...');
  }

  private async pollEvents(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock > this.lastIndexedBlock) {
        const fromBlock = this.lastIndexedBlock + 1;
        const toBlock = Math.min(currentBlock, fromBlock + BLOCK_CHUNK_SIZE);

        logger.info({ fromBlock, toBlock }, 'Indexing blocks');

        // Index factory events (market creation)
        await this.indexFactoryEvents(fromBlock, toBlock);

        // Index all market and loan events
        await this.indexMarketAndLoanEvents(fromBlock, toBlock);

        // Update last indexed block
        this.lastIndexedBlock = toBlock;
        await this.prisma.syncState.update({
          where: { id: 'event_indexer' },
          data: { lastBlock: toBlock },
        });

        this.retryCount = 0;
        healthTracker.updateWorker('event_indexer', { isHealthy: true });
      }
    } catch (error) {
      this.retryCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error(
        { error: errorMsg, retryCount: this.retryCount },
        'Error polling events'
      );

      if (this.retryCount > MAX_RETRIES) {
        healthTracker.updateWorker('event_indexer', {
          isHealthy: false,
          error: `Max retries exceeded: ${errorMsg}`,
        });
      } else {
        healthTracker.updateWorker('event_indexer', { isHealthy: true });
      }
    }

    // Schedule next poll
    setTimeout(() => this.pollEvents(), POLL_INTERVAL_MS);
  }

  /**
   * Index MarketCreated events from factory
   */
  private async indexFactoryEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const logs = await this.factoryContract.queryFilter(
        'MarketCreated',
        fromBlock,
        toBlock
      );

      for (const log of logs) {
        if (!(log instanceof ethers.EventLog)) continue;

        const {
          market,
          owner,
          collateralAsset,
          loanAsset,
          assetType,
          ltvBps,
        } = log.args;

        logger.info(
          {
            market,
            owner,
            collateralAsset,
            assetType: Number(assetType),
          },
          'New market created'
        );

        // Upsert user (LP)
        await this.prisma.user.upsert({
          where: { address: owner },
          update: { updatedAt: new Date() },
          create: {
            address: owner,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Fetch full market info from contract
        const marketInfo = await this.factoryContract.getMarketInfo(market);

        // Create market record
        await this.prisma.market.upsert({
          where: { address: market },
          update: { isActive: true, updatedAt: new Date() },
          create: {
            address: market,
            lpAddress: owner,
            collateralAsset,
            loanAsset,
            assetType: this._mapAssetType(Number(marketInfo.assetType)),
            ltvBasisPoints: Number(marketInfo.ltvBps),
            aprBasisPoints: Number(marketInfo.aprBps),
            durationSeconds: Number(marketInfo.durationSeconds),
            gracePeriodHours: 72,
            enableHealthFactor: true,
            healthFactorThreshold: 12000, // 120%
            oracleType: this._mapOracleType(Number(marketInfo.oracleType)),
            primaryOracle: marketInfo.primaryOracle,
            nftOracle: marketInfo.nftOracle,
            twapPeriodSeconds: 1800,
            circuitBreakerEnabled: true,
            isActive: true,
            createdAt: new Date(Number(marketInfo.createdAt) * 1000),
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error(
        { error, fromBlock, toBlock },
        'Failed to index factory events'
      );
      throw error;
    }
  }

  /**
   * Index all market and loan events
   */
  private async indexMarketAndLoanEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      // Get all known markets
      const markets = await this.prisma.market.findMany({
        select: { address: true },
      });

      for (const market of markets) {
        await this.indexMarketEvents(market.address, fromBlock, toBlock);
      }
    } catch (error) {
      logger.error(
        { error, fromBlock, toBlock },
        'Failed to index market and loan events'
      );
      // Don't throw - continue indexing
    }
  }

  /**
   * Index events for a specific market
   */
  private async indexMarketEvents(
    marketAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    const marketContract = new ethers.Contract(
      marketAddress,
      LENDING_MARKET_ABI,
      this.provider
    );

    try {
      // Index LiquidityDeposited events
      const deposits = await marketContract.queryFilter(
        'LiquidityDeposited',
        fromBlock,
        toBlock
      );
      for (const log of deposits) {
        if (!(log instanceof ethers.EventLog)) continue;
        const { provider, amount, sharesIssued } = log.args;

        await this.prisma.user.upsert({
          where: { address: provider },
          update: { updatedAt: new Date() },
          create: {
            address: provider,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await this.prisma.liquidityPosition.upsert({
          where: {
            marketAddress_lpAddress: {
              marketAddress,
              lpAddress: provider,
            },
          },
          update: {
            lpTokenBalance: { increment: BigInt(sharesIssued.toString()) },
            stablecoinDeposited: { increment: BigInt(amount.toString()) },
            updatedAt: new Date(),
          },
          create: {
            marketAddress,
            lpAddress: provider,
            lpTokenBalance: BigInt(sharesIssued.toString()),
            stablecoinDeposited: BigInt(amount.toString()),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Index LoanRequested events
      const loanRequests = await marketContract.queryFilter(
        'LoanRequested',
        fromBlock,
        toBlock
      );
      for (const log of loanRequests) {
        if (!(log instanceof ethers.EventLog)) continue;
        const { loanAddress, borrower, collateral, principal } = log.args;

        await this.prisma.user.upsert({
          where: { address: borrower },
          update: { updatedAt: new Date() },
          create: {
            address: borrower,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const loanContract = new ethers.Contract(
          loanAddress,
          LOAN_CONTRACT_ABI,
          this.provider
        );

        const expiryTime = await loanContract.getExpiryTime();

        await this.prisma.loan.upsert({
          where: { address: loanAddress },
          update: { updatedAt: new Date() },
          create: {
            address: loanAddress,
            contractLoanId: loanAddress,
            marketAddress,
            borrowerAddress: borrower,
            collateralAmount: collateral.toString(),
            principal: principal.toString(),
            startTime: new Date(),
            expiryTime: new Date(Number(expiryTime) * 1000),
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Index LoanRepaid events
      const repayments = await marketContract.queryFilter(
        'LoanRepaid',
        fromBlock,
        toBlock
      );
      for (const log of repayments) {
        if (!(log instanceof ethers.EventLog)) continue;
        const { borrower, totalRepayment } = log.args;

        await this.prisma.loan.updateMany({
          where: {
            marketAddress,
            borrowerAddress: borrower,
            status: 'ACTIVE',
          },
          data: {
            status: 'REPAID',
            repaymentAmount: totalRepayment.toString(),
            repaidAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Index LoanLiquidated events
      const liquidations = await marketContract.queryFilter(
        'LoanLiquidated',
        fromBlock,
        toBlock
      );
      for (const log of liquidations) {
        if (!(log instanceof ethers.EventLog)) continue;
        const { loanAddress } = log.args;

        await this.prisma.loan.update({
          where: { address: loanAddress },
          data: {
            status: 'LIQUIDATED',
            liquidatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.warn(
        { error, marketAddress, fromBlock, toBlock },
        'Failed to index events for market (market may be recently created)'
      );
      // Don't throw - continue with other markets
    }
  }

  // Helper functions
  private _mapAssetType(value: number): AssetType {
    const mapping: Record<number, AssetType> = {
      0: AssetType.ERC20,
      1: AssetType.ERC721,
      2: AssetType.ERC1155,
    };
    return mapping[value] || AssetType.ERC20;
  }

  private _mapOracleType(value: number): OracleType {
    const mapping: Record<number, OracleType> = {
      0: OracleType.CHAINLINK,
      1: OracleType.UNISWAP_V3_TWAP,
      2: OracleType.ORACLE_ROUTER,
      3: OracleType.MANUAL,
    };
    return mapping[value] || OracleType.CHAINLINK;
  }
}