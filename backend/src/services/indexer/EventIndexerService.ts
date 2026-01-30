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
const MAX_ADDRESSES_PER_FILTER = 50;

export class EventIndexerService {
  private prisma: PrismaClient;
  private provider: ethers.FallbackProvider | ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private isRunning: boolean = false;
  private lastIndexedBlock: number = 0;
  private retryCount: number = 0;

  // Interfaces for parsing logs
  private factoryInterface: ethers.Interface;
  private lendingMarketInterface: ethers.Interface;
  private loanContractInterface: ethers.Interface;

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

    this.factoryInterface = new ethers.Interface(MARKET_FACTORY_ABI);
    this.lendingMarketInterface = new ethers.Interface(LENDING_MARKET_ABI);
    this.loanContractInterface = new ethers.Interface(LOAN_CONTRACT_ABI);

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

        await this.prisma.syncState.upsert({
          where: { id: 'event_indexer' },
          update: {},
          create: { id: 'event_indexer', lastBlock: this.lastIndexedBlock },
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

        // 1. Index Markets (Factory Events)
        await this.indexFactoryEvents(fromBlock, toBlock);

        // 2. Index Market-specific events (Liquidity, Loan Creation)
        await this.indexMarketEvents(fromBlock, toBlock);

        // 3. Index Loan lifecycle events (Repay, Liquidate)
        await this.indexLoanLifecycleEvents(fromBlock, toBlock);

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
          initialLiquidity,
        } = log.args;

        logger.info({ market }, 'Found new market');

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
          update: { updatedAt: new Date() },
          create: {
            address: market,
            lpAddress: owner,
            collateralAsset,
            assetType: this._mapAssetType(Number(assetType)),
            ltvBasisPoints: Number(ltvBps),
            aprBasisPoints: Number(marketInfo.aprBps),
            durationSeconds: Number(marketInfo.durationSeconds),
            gracePeriodHours: 72,
            enableHealthFactor: true,
            healthFactorThreshold: 12000, // 120%
            oracleType: this._mapOracleType(Number(marketInfo.oracleType)),
            primaryOracle: marketInfo.primaryOracle,
            twapPeriodSeconds: 1800,
            circuitBreakerEnabled: true,
            totalLiquidity: initialLiquidity.toString(),
            availableLiquidity: initialLiquidity.toString(),
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
   * Index events for all known markets (Liquidity and Loan Creation)
   */
  private async indexMarketEvents(fromBlock: number, toBlock: number) {
    const markets = await this.prisma.market.findMany({ select: { address: true, durationSeconds: true } });
    if (markets.length === 0) return;

    const marketAddresses = markets.map(m => m.address);
    const marketDurationMap = new Map(markets.map(m => [m.address, m.durationSeconds]));

    for (let i = 0; i < marketAddresses.length; i += MAX_ADDRESSES_PER_FILTER) {
      const batch = marketAddresses.slice(i, i + MAX_ADDRESSES_PER_FILTER);
      
      const logs = await this.provider.getLogs({
        address: batch,
        fromBlock,
        toBlock,
        topics: [[
          this.lendingMarketInterface.getEvent("LiquidityDeposited")?.topicHash,
          this.lendingMarketInterface.getEvent("LoanCreated")?.topicHash
        ].filter(Boolean) as string[]]
      });

      for (const log of logs) {
        const topic = log.topics[0];
        const marketAddress = log.address;

        if (topic === this.lendingMarketInterface.getEvent("LiquidityDeposited")?.topicHash) {
          const parsed = this.lendingMarketInterface.parseLog(log);
          if (parsed) {
            const { provider, amount, shares } = parsed.args;
            await this._handleLiquidityDeposit(marketAddress, provider, amount, shares);
          }
        } else if (topic === this.lendingMarketInterface.getEvent("LoanCreated")?.topicHash) {
          const parsed = this.lendingMarketInterface.parseLog(log);
          if (parsed) {
            const { loanContract, borrower, principal } = parsed.args;
            const duration = marketDurationMap.get(marketAddress) || 86400 * 30;
            await this._handleLoanCreation(marketAddress, loanContract, borrower, principal, duration);
          }
        }
      }
    }
  }

  private async _handleLiquidityDeposit(marketAddress: string, provider: string, amount: any, shares: any) {
    await this.prisma.user.upsert({
      where: { address: provider },
      update: { updatedAt: new Date() },
      create: { address: provider },
    });

    // In a real implementation, we'd have a LiquidityPosition model or update Market state
    // For now, let's update Market liquidity
    await this.prisma.market.update({
      where: { address: marketAddress },
      data: {
        totalLiquidity: { increment: amount.toString() } as any,
        availableLiquidity: { increment: amount.toString() } as any,
      }
    });
  }

  private async _handleLoanCreation(marketAddress: string, loanContract: string, borrower: string, principal: any, duration: number) {
    logger.info({ market: marketAddress, loanContract }, 'Found new loan contract');
    
    await this.prisma.user.upsert({
      where: { address: borrower },
      update: { updatedAt: new Date() },
      create: { address: borrower }
    });

    await this.prisma.loan.upsert({
      where: { marketAddress_contractLoanId: { marketAddress, contractLoanId: loanContract } },
      update: { updatedAt: new Date() },
      create: {
        marketAddress,
        address: loanContract,
        contractLoanId: loanContract,
        borrowerAddress: borrower,
        collateralAmount: "0", // Should ideally be in the event or fetched
        principal: principal.toString(),
        startTime: new Date(),
        expiryTime: new Date(Date.now() + duration * 1000),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }

  private async indexLoanLifecycleEvents(fromBlock: number, toBlock: number) {
    const activeLoans = await this.prisma.loan.findMany({ 
      where: { status: 'ACTIVE' },
      select: { contractLoanId: true }
    });

    if (activeLoans.length === 0) return;

    const loanAddresses = activeLoans.map(l => l.contractLoanId);

    for (let i = 0; i < loanAddresses.length; i += MAX_ADDRESSES_PER_FILTER) {
      const batch = loanAddresses.slice(i, i + MAX_ADDRESSES_PER_FILTER);

      const logs = await this.provider.getLogs({
        address: batch,
        fromBlock,
        toBlock,
        topics: [[
          this.loanContractInterface.getEvent("LoanRepaid")?.topicHash,
          this.loanContractInterface.getEvent("LoanLiquidated")?.topicHash
        ].filter(Boolean) as string[]]
      });

      for (const log of logs) {
        const topic = log.topics[0];
        const loanContract = log.address;

        if (topic === this.loanContractInterface.getEvent("LoanRepaid")?.topicHash) {
          logger.info({ loanContract }, 'Loan Repaid');
          await this.prisma.loan.updateMany({
            where: { contractLoanId: loanContract },
            data: { status: 'REPAID', repaidAt: new Date(), updatedAt: new Date() }
          });
        } else if (topic === this.loanContractInterface.getEvent("LoanLiquidated")?.topicHash) {
          logger.info({ loanContract }, 'Loan Liquidated');
          await this.prisma.loan.updateMany({
            where: { contractLoanId: loanContract },
            data: { status: 'LIQUIDATED', liquidatedAt: new Date(), updatedAt: new Date() }
          });
        }
      }
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
      0: OracleType.UNISWAP_V3_TWAP,
      1: OracleType.CHAINLINK,
      2: OracleType.MANUAL,
    };
    return mapping[value] || OracleType.UNISWAP_V3_TWAP;
  }
}
