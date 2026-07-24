/**
 * @file EventIndexerServiceV2.ts
 * @description V2 event indexer for adapter-based architecture with multi-chain support
 * Handles:
 * - MarketCreated events from MarketFactoryV2
 * - LoanCreated, LoanRepaid, LoanLiquidated, LiquidationCureStarted from LendingMarketV2
 * - AdapterRegistered, AdapterVerified, AdapterDeprecated from AdapterRegistry
 * - Transfer events on TransferablePosition NFTs (position holder tracking)
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { config, getRpcUrl, getContractAddress } from '../../config/unifiedConfig';
import { healthTracker } from '../../utils/health';
import {
  MARKET_FACTORY_V2_ABI,
  LENDING_MARKET_V2_ABI,
  ADAPTER_REGISTRY_ABI,
} from '../web3/ContractAbisV2';

const BLOCK_CHUNK_SIZE = 100;
const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

const ADAPTER_TYPE_MAP: Record<number, string> = {
  0: 'ASSET',
  1: 'ORACLE',
  2: 'COMPLIANCE',
  3: 'LIQUIDATION',
  4: 'POSITION',
};

const LOAN_STATUS_MAP: Record<number, string> = {
  0: 'ACTIVE',
  1: 'GRACE_PERIOD',
  2: 'LIQUIDATION_CURE',
  3: 'LIQUIDATION_SETTLING',
  4: 'REPAID',
  5: 'LIQUIDATED',
};

const MARKET_STATUS_MAP: Record<number, string> = {
  0: 'ACTIVE',
  1: 'PAUSED_VOLATILITY',
  2: 'PAUSED_STALE_ORACLE',
  3: 'PAUSED_MANUAL',
};

export class EventIndexerServiceV2 {
  private prisma: PrismaClient;
  private chainId: number;
  private provider: ethers.JsonRpcProvider;
  private isRunning = false;
  private retryCount = 0;

  private factoryInterface: ethers.Interface;
  private marketInterface: ethers.Interface;
  private registryInterface: ethers.Interface;

  private factoryAddress: string;
  private registryAddress: string;

  private knownPositionAdapters: Set<string> = new Set();

  constructor(prisma: PrismaClient, provider: ethers.JsonRpcProvider, chainId: number) {
    this.prisma = prisma;
    this.chainId = chainId;
    this.provider = provider;

    this.factoryAddress = getContractAddress('marketFactory', chainId) || '';
    this.registryAddress = getContractAddress('adapterRegistry', chainId) || '';

    this.factoryInterface = new ethers.Interface(MARKET_FACTORY_V2_ABI);
    this.marketInterface = new ethers.Interface(LENDING_MARKET_V2_ABI);
    this.registryInterface = new ethers.Interface(ADAPTER_REGISTRY_ABI);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const state = await this.prisma.syncState.findUnique({
        where: { id: `event_indexer_v2_${this.chainId}` },
      });
      const lastBlock = state ? state.lastBlock : 0;
      logger.info({ chainId: this.chainId, lastBlock }, `EventIndexer starting for chain ${this.chainId}`);

      await this.indexLoop(lastBlock);
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'EventIndexer failed to start');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info({ chainId: this.chainId }, `EventIndexer stopped for chain ${this.chainId}`);
  }

  isRunningStatus(): boolean {
    return this.isRunning;
  }

  private async indexLoop(fromBlock: number): Promise<void> {
    while (this.isRunning) {
      try {
        const latestBlock = await this.provider.getBlockNumber();

        if (fromBlock >= latestBlock) {
          await this.sleep(POLL_INTERVAL_MS * 10);
          continue;
        }

        const toBlock = Math.min(fromBlock + BLOCK_CHUNK_SIZE, latestBlock);
        await this.processBlockRange(fromBlock + 1, toBlock);
        fromBlock = toBlock;

        await this.prisma.syncState.upsert({
          where: { id: `event_indexer_v2_${this.chainId}` },
          update: { lastBlock: toBlock },
          create: { id: `event_indexer_v2_${this.chainId}`, lastBlock: toBlock },
        });

        this.retryCount = 0;
        healthTracker.updateWorker(`indexer:${this.chainId}`, { isHealthy: true });
      } catch (error) {
        this.retryCount++;
        logger.error({ err: error, retryCount: this.retryCount, chainId: this.chainId }, 'Indexer error');
        if (this.retryCount >= MAX_RETRIES) {
          logger.fatal({ chainId: this.chainId }, 'Max retries reached, stopping indexer');
          healthTracker.updateWorker(`indexer:${this.chainId}`, { isHealthy: false, error: 'Max retries reached' });
          break;
        }
        await this.sleep(POLL_INTERVAL_MS * this.retryCount);
      }
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    const allLogs: ethers.Log[] = [];

    // Factory events
    if (this.factoryAddress) {
      try {
        const factoryLogs = await this.provider.getLogs({
          address: this.factoryAddress,
          fromBlock,
          toBlock,
        });
        allLogs.push(...factoryLogs);
      } catch (e) { /* factory not deployed on this chain */ }
    }

    // Registry events
    if (this.registryAddress) {
      try {
        const registryLogs = await this.provider.getLogs({
          address: this.registryAddress,
          fromBlock,
          toBlock,
        });
        allLogs.push(...registryLogs);
      } catch (e) { /* registry not deployed */ }
    }

    for (const log of allLogs) {
      await this.processLog(log);
    }
  }

  private async processLog(log: ethers.Log): Promise<void> {
    try {
      // Try factory events
      if (log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
        const parsed = this.factoryInterface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return;

        switch (parsed.name) {
          case 'MarketCreated':
            await this.handleMarketCreated(parsed.args);
            break;
        }
        return;
      }

      // Try registry events
      if (this.registryAddress && log.address.toLowerCase() === this.registryAddress.toLowerCase()) {
        const parsed = this.registryInterface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return;

        switch (parsed.name) {
          case 'AdapterRegistered':
            await this.handleAdapterRegistered(parsed.args);
            break;
          case 'AdapterVerified':
            await this.handleAdapterVerified(parsed.args);
            break;
          case 'AdapterDeprecated':
            await this.handleAdapterDeprecated(parsed.args);
            break;
        }
        return;
      }

      // Try lending market events (any non-factory, non-registry contract)
      const parsed = this.marketInterface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) return;

      switch (parsed.name) {
        case 'LoanCreated':
          await this.handleLoanCreated(log.address, parsed.args);
          break;
        case 'LoanRepaid':
          await this.handleLoanRepaid(log.address, parsed.args);
          break;
        case 'LoanLiquidated':
          await this.handleLoanLiquidated(log.address, parsed.args);
          break;
        case 'LiquidationCureStarted':
          await this.handleLiquidationCureStarted(log.address, parsed.args);
          break;
        case 'LiquidityDeposited':
          await this.handleLiquidityDeposited(log.address, parsed.args);
          break;
      }
    } catch (error) {
      logger.error({ err: error, topic: log.topics?.[0], chainId: this.chainId }, 'Failed to process log');
    }
  }

  // ============ Event Handlers ============

  private async handleMarketCreated(args: any): Promise<void> {
    const marketAddress = args.marketAddress;
    const lpAddress = args.lpAddress;
    const collateralAsset = args.collateralAsset;
    const initialLiquidity = args.initialLiquidity.toString();

    try {
      const marketContract = new ethers.Contract(marketAddress, LENDING_MARKET_V2_ABI, this.provider);

      await this.prisma.market.upsert({
        where: { address: marketAddress },
        update: {
          lpAddress,
          collateralAsset,
          totalLiquidity: initialLiquidity,
        },
        create: {
          address: marketAddress,
          chainId: this.chainId,
          lpAddress,
          collateralAsset,
          lendingAsset: ethers.ZeroAddress,
          assetAdapter: ethers.ZeroAddress,
          oracleAdapter: ethers.ZeroAddress,
          liquidationAdapter: ethers.ZeroAddress,
          positionAdapter: ethers.ZeroAddress,
          ltvBasisPoints: 0,
          aprBasisPoints: 0,
          durationSeconds: 0,
          gracePeriodHours: 1,
          enableHealthFactor: true,
          healthFactorThreshold: 12000,
          circuitBreakerEnabled: true,
          totalLiquidity: initialLiquidity,
        },
      });

      logger.info({ chainId: this.chainId, marketAddress, lpAddress }, 'Market indexed');
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress }, 'Failed to index market');
    }
  }

  private async handleLoanCreated(marketAddress: string, args: any): Promise<void> {
    const loanId = args.loanId.toString();
    const borrower = args.borrower;
    const principal = args.principal.toString();
    const collateralAmount = args.collateralAmount.toString();

    try {
      const marketContract = new ethers.Contract(marketAddress, LENDING_MARKET_V2_ABI, this.provider);
      const details = await marketContract.getLoanDetails(loanId);

      await this.prisma.user.upsert({
        where: { address: borrower },
        update: {},
        create: { address: borrower },
      });

      const market = await this.prisma.market.findUnique({ where: { address: marketAddress } });
      if (!market) {
        logger.warn({ chainId: this.chainId, marketAddress }, 'Market not found in DB, skipping loan index');
        return;
      }

      await this.prisma.loan.upsert({
        where: {
          marketAddress_contractLoanId: { marketAddress, contractLoanId: loanId },
        },
        update: {
          positionHolderAddress: details.positionHolder,
          collateralAmount: details.collateralAmount.toString(),
          principal: details.principal.toString(),
          status: LOAN_STATUS_MAP[details.status] as any || 'ACTIVE',
        },
        create: {
          contractLoanId: loanId,
          marketAddress,
          positionHolderAddress: details.positionHolder,
          collateralAmount: details.collateralAmount.toString(),
          principal: details.principal.toString(),
          startTime: new Date(Number(details.startTime) * 1000),
          expiryTime: new Date(Number(details.expiryTime) * 1000),
          status: LOAN_STATUS_MAP[details.status] as any || 'ACTIVE',
        },
      });

      logger.info({ chainId: this.chainId, marketAddress, loanId, borrower }, 'Loan indexed');
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress, loanId }, 'Failed to index loan');
    }
  }

  private async handleLoanRepaid(marketAddress: string, args: any): Promise<void> {
    const loanId = args.loanId.toString();
    try {
      const existing = await this.prisma.loan.findUnique({
        where: { marketAddress_contractLoanId: { marketAddress, contractLoanId: loanId } },
      });
      if (existing) {
        await this.prisma.loan.update({
          where: { id: existing.id },
          data: { status: 'REPAID', repaidAt: new Date() },
        });
        logger.info({ chainId: this.chainId, marketAddress, loanId }, 'Loan repaid');
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress, loanId }, 'Failed to index loan repay');
    }
  }

  private async handleLoanLiquidated(marketAddress: string, args: any): Promise<void> {
    const loanId = args.loanId.toString();
    try {
      const existing = await this.prisma.loan.findUnique({
        where: { marketAddress_contractLoanId: { marketAddress, contractLoanId: loanId } },
      });
      if (existing) {
        await this.prisma.loan.update({
          where: { id: existing.id },
          data: { status: 'LIQUIDATED', liquidatedAt: new Date() },
        });
        logger.info({ chainId: this.chainId, marketAddress, loanId }, 'Loan liquidated');
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress, loanId }, 'Failed to index loan liquidation');
    }
  }

  private async handleLiquidationCureStarted(marketAddress: string, args: any): Promise<void> {
    const loanId = args.loanId.toString();
    try {
      const existing = await this.prisma.loan.findUnique({
        where: { marketAddress_contractLoanId: { marketAddress, contractLoanId: loanId } },
      });
      if (existing) {
        await this.prisma.loan.update({
          where: { id: existing.id },
          data: {
            status: 'LIQUIDATION_CURE',
            frozenInterestAt: new Date(),
          },
        });

        await this.prisma.alert.create({
          data: {
            userId: existing.positionHolderAddress,
            loanId: existing.id,
            type: 'LIQUIDATION_CURE_WARNING',
            level: 'WARNING',
            message: `Loan ${loanId} on market ${marketAddress} entered LIQUIDATION_CURE. Cure window: 24 hours.`,
          },
        });

        logger.info({ chainId: this.chainId, marketAddress, loanId }, 'Liquidation cure started');
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress, loanId }, 'Failed to index liquidation cure');
    }
  }

  private async handleLiquidityDeposited(marketAddress: string, args: any): Promise<void> {
    const provider = args.provider;
    const amount = args.amount.toString();

    try {
      await this.prisma.liquidityPosition.upsert({
        where: { marketAddress_lpAddress: { marketAddress, lpAddress: provider } },
        update: { stablecoinDeposited: { increment: BigInt(amount) } },
        create: {
          marketAddress,
          lpAddress: provider,
          stablecoinDeposited: BigInt(amount),
        },
      });
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, marketAddress }, 'Failed to index liquidity deposit');
    }
  }

  // ============ Adapter Registry Events ============

  private async handleAdapterRegistered(args: any): Promise<void> {
    const adapterAddress = args.adapter;
    const adapterType = ADAPTER_TYPE_MAP[Number(args.adapterType)] || 'ASSET';
    const registeredBy = args.registeredBy;

    try {
      await this.prisma.adapter.upsert({
        where: { adapterAddress_chainId: { adapterAddress, chainId: this.chainId } },
        update: {},
        create: {
          adapterAddress,
          chainId: this.chainId,
          adapterType: adapterType as any,
          registeredBy,
        },
      });
      logger.info({ chainId: this.chainId, adapterAddress, adapterType }, 'Adapter indexed');
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, adapterAddress }, 'Failed to index adapter');
    }
  }

  private async handleAdapterVerified(args: any): Promise<void> {
    try {
      await this.prisma.adapter.update({
        where: { adapterAddress_chainId: { adapterAddress: args.adapter, chainId: this.chainId } },
        data: { verified: true, auditReference: args.auditReference },
      });
      logger.info({ chainId: this.chainId, adapter: args.adapter }, 'Adapter verified');
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'Failed to index adapter verification');
    }
  }

  private async handleAdapterDeprecated(args: any): Promise<void> {
    try {
      await this.prisma.adapter.update({
        where: { adapterAddress_chainId: { adapterAddress: args.adapter, chainId: this.chainId } },
        data: { deprecated: true },
      });
      logger.info({ chainId: this.chainId, adapter: args.adapter, reason: args.reason }, 'Adapter deprecated');
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'Failed to index adapter deprecation');
    }
  }

  // ============ Utils ============

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}