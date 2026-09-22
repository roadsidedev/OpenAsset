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
  B20_FACTORY_ABI,
  B20_TOKEN_ABI,
} from '../web3/ContractAbisV2';

// B20 precompile addresses on Base mainnet (8453) — for indexer watch list
const KNOWN_B20_TOKENS_BASE: string[] = [
  "0xb200000000000000000000C2e324d24d7eEcd1fb",
  "0xb200000000000000000000d9192b6B456483C2E8",
  "0xb200000000000000000000c85a31389D71F3ecfb",
  "0xB20000000000000000000019f6E7C675b73C2e4D",
  "0xb2000000000000000000002D0BA3164cc74f58B7",
  "0xB2000000000000000000004AFF16039bA04bdFBc",
  "0xb2000000000000000000008bC8786B856E61707C",
  "0xB200000000000000000000Ab99cFa739E253872B",
  "0xb2000000000000000000004884b426556b92883d",
  "0xb20000000000000000000078ee7ce2fE4908108C",
  "0xb200000000000000000000397293Cb8cda9a10c5",
  "0xb2000000000000000000007b9fcbd005511aCBd5",
  "0xb2000000000000000000001e800a7f5189430cD0",
];

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
  private b20FactoryInterface: ethers.Interface;
  private b20TokenInterface: ethers.Interface;

  private factoryAddress: string;
  private registryAddress: string;
  private b20FactoryAddress: string;

  private knownPositionAdapters: Set<string> = new Set();
  private knownB20Tokens: Set<string> = new Set(KNOWN_B20_TOKENS_BASE.map(a => a.toLowerCase()));

  constructor(prisma: PrismaClient, provider: ethers.JsonRpcProvider, chainId: number) {
    this.prisma = prisma;
    this.chainId = chainId;
    this.provider = provider;

    this.factoryAddress = getContractAddress('marketFactory', chainId) || '';
    this.registryAddress = getContractAddress('adapterRegistry', chainId) || '';
    this.b20FactoryAddress = getContractAddress('b20Factory', chainId) || '';

    this.factoryInterface = new ethers.Interface(MARKET_FACTORY_V2_ABI);
    this.marketInterface = new ethers.Interface(LENDING_MARKET_V2_ABI);
    this.registryInterface = new ethers.Interface(ADAPTER_REGISTRY_ABI);
    this.b20FactoryInterface = new ethers.Interface(B20_FACTORY_ABI);
    this.b20TokenInterface = new ethers.Interface(B20_TOKEN_ABI);
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

    // B20 factory — auto-discovery of new listed stocks (topic0 0xfd9bf273...)
    if (this.b20FactoryAddress) {
      try {
        const b20FactoryLogs = await this.provider.getLogs({
          address: this.b20FactoryAddress,
          fromBlock,
          toBlock,
        });
        allLogs.push(...b20FactoryLogs);
      } catch (e) { /* B20 factory not configured */ }
    }

    // B20 token corporate-action events — poll known tokens (8453) each range
    // Covers: UIMultiplierUpdated (0x2205df45...), MultiplierUpdated (0x4dbe4840...),
    // Announcement (0xccebf821...)/EndAnnouncement (0x96d64daf...), ExtraMetadataUpdated (0xd7bb345b...)
    if (this.chainId === 8453 || this.chainId === 84532) {
      for (const token of this.knownB20Tokens) {
        try {
          const tokenLogs = await this.provider.getLogs({
            address: token,
            fromBlock,
            toBlock,
          });
          allLogs.push(...tokenLogs);
        } catch (e) { /* not a B20 token on this chain */ }
      }
    }

    for (const log of allLogs) {
      await this.processLog(log);
    }
  }

  private async processLog(log: ethers.Log): Promise<void> {
    try {
      // Try factory events
      if (this.factoryAddress && log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
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

      // Try B20 factory events
      if (this.b20FactoryAddress && log.address.toLowerCase() === this.b20FactoryAddress.toLowerCase()) {
        const parsed = this.b20FactoryInterface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === 'B20Created') {
          await this.handleB20Created(parsed.args);
          return;
        }
      }

      // Try B20 token events (corporate actions) — any known B20 token
      if (this.knownB20Tokens.has(log.address.toLowerCase())) {
        const parsed = this.b20TokenInterface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return;
        switch (parsed.name) {
          case 'UIMultiplierUpdated':
            await this.handleUIMultiplierUpdated(log.address, parsed.args, log);
            break;
          case 'MultiplierUpdated':
            await this.handleMultiplierUpdated(log.address, parsed.args, log);
            break;
          case 'UIMultiplierUpdateCancelled':
            await this.handleUIMultiplierCancelled(log.address, parsed.args);
            break;
          case 'Announcement':
            await this.handleAnnouncement(log.address, parsed.args, 'start');
            break;
          case 'EndAnnouncement':
            await this.handleAnnouncement(log.address, parsed.args, 'end');
            break;
          case 'ExtraMetadataUpdated':
            await this.handleExtraMetadataUpdated(log.address, parsed.args);
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
        case 'CircuitBreakerTriggered':
        case 'MarketPaused':
        case 'MarketResumed':
          await this.handleMarketStatusChange(log.address, parsed.name);
          break;
      }
    } catch (error) {
      logger.error({ err: error, topic: log.topics?.[0], chainId: this.chainId }, 'Failed to process log');
    }
  }

  // ============ Event Handlers ============

  /**
   * Circuit breaker / manual pause events: sync the DB market status from the
   * source of truth (on-chain status enum) so UI + monitoring see pauses
   * immediately instead of waiting for the 60s status poll.
   */
  private async handleMarketStatusChange(marketAddress: string, eventName: string): Promise<void> {
    try {
      const market = await this.prisma.market.findUnique({ where: { address: marketAddress.toLowerCase() } });
      if (!market) return;

      const contract = new ethers.Contract(marketAddress, LENDING_MARKET_V2_ABI, this.provider);
      const chainStatus = Number(await contract.status());
      const dbStatus = MARKET_STATUS_MAP[chainStatus] ?? 'ACTIVE';

      await this.prisma.market.update({
        where: { address: marketAddress.toLowerCase() },
        data: {
          status: dbStatus as any,
          pausedAt: chainStatus === 0 ? null : new Date(),
        },
      });

      logger.info({ chainId: this.chainId, market: marketAddress, eventName, chainStatus, dbStatus }, 'Market status synced from event');
    } catch (error) {
      logger.error({ err: error, market: marketAddress, chainId: this.chainId }, 'Failed to sync market status from event');
    }
  }

  private async handleMarketCreated(args: any): Promise<void> {
    const marketAddress = args.marketAddress;
    const lpAddress = args.lpAddress;
    const collateralAsset = args.collateralAsset;
    const initialLiquidity = args.initialLiquidity.toString();

    try {
      const marketContract = new ethers.Contract(marketAddress, LENDING_MARKET_V2_ABI, this.provider);
      const factoryContract = this.factoryAddress
        ? new ethers.Contract(this.factoryAddress, MARKET_FACTORY_V2_ABI, this.provider)
        : null;
      const [
        providerId,
        lendingAsset,
        assetAdapter,
        oracleAdapter,
        complianceAdapter,
        liquidationAdapter,
        positionAdapter,
        ltvBasisPoints,
        aprBasisPoints,
        durationSeconds,
        gracePeriodHours,
        enableHealthFactor,
        healthFactorThreshold,
      ] = await Promise.all([
        factoryContract
          ? factoryContract.marketProvider(marketAddress).catch(() => ethers.ZeroHash)
          : Promise.resolve(ethers.ZeroHash),
        marketContract.lendingAsset(),
        marketContract.assetAdapter(),
        marketContract.oracleAdapter(),
        marketContract.complianceAdapter(),
        marketContract.liquidationAdapter(),
        marketContract.positionAdapter(),
        marketContract.ltvBps(),
        marketContract.aprBps(),
        marketContract.durationSeconds(),
        marketContract.gracePeriodHours(),
        marketContract.enableHealthFactor(),
        marketContract.healthFactorThreshold(),
      ]);

      const hydrated = {
        lpAddress,
        collateralAsset,
        providerId: providerId && providerId !== ethers.ZeroHash ? providerId.toLowerCase() : null,
        lendingAsset,
        assetAdapter,
        oracleAdapter,
        complianceAdapter,
        liquidationAdapter,
        positionAdapter,
        ltvBasisPoints: Number(ltvBasisPoints),
        aprBasisPoints: Number(aprBasisPoints),
        durationSeconds: Number(durationSeconds),
        gracePeriodHours: Number(gracePeriodHours),
        enableHealthFactor,
        healthFactorThreshold: Number(healthFactorThreshold),
        totalLiquidity: initialLiquidity,
      };

      await this.prisma.market.upsert({
        where: { address: marketAddress },
        update: hydrated,
        create: {
          address: marketAddress,
          chainId: this.chainId,
          ...hydrated,
          circuitBreakerEnabled: true,
        },
      });

      await this.prisma.user.upsert({
        where: { address: lpAddress },
        update: {},
        create: { address: lpAddress },
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

  // ============ B20 (Base Tokenized Stocks) Events ============

  private async handleB20Created(args: any): Promise<void> {
    const token = args.token as string;
    this.knownB20Tokens.add(token.toLowerCase());
    logger.info({ chainId: this.chainId, token, name: args.name, symbol: args.symbol }, 'B20 token discovered');
    // Persist discovery for UI token list (best-effort; table may not exist yet)
    try {
      await (this.prisma as any).b20Token?.upsert?.({
        where: { address_chainId: { address: token, chainId: this.chainId } },
        update: { name: args.name, symbol: args.symbol },
        create: { address: token, chainId: this.chainId, name: args.name, symbol: args.symbol },
      } as any);
    } catch {}
  }

  private async handleUIMultiplierUpdated(token: string, args: any, log: ethers.Log): Promise<void> {
    logger.info({ chainId: this.chainId, token, newMultiplier: args.newMultiplier?.toString(), effectiveAt: args.effectiveAt?.toString(), tx: log.transactionHash }, 'B20 UIMultiplierUpdated (scheduled)');
    // Indexed corporate action — correlated with PAUSED_STALE_ORACLE to suppress false incident pages
    await this.recordB20CorporateAction(token, 'UIMultiplierUpdated', log, args);
  }

  private async handleMultiplierUpdated(token: string, args: any, log: ethers.Log): Promise<void> {
    logger.info({ chainId: this.chainId, token, oldMultiplier: args.oldMultiplier?.toString(), newMultiplier: args.newMultiplier?.toString(), tx: log.transactionHash }, 'B20 MultiplierUpdated (legacy instant)');
    await this.recordB20CorporateAction(token, 'MultiplierUpdated', log, args);
  }

  private async handleUIMultiplierCancelled(token: string, args: any): Promise<void> {
    logger.info({ chainId: this.chainId, token }, 'B20 UIMultiplierUpdateCancelled');
    await this.recordB20CorporateAction(token, 'UIMultiplierUpdateCancelled', null, args);
  }

  private async handleAnnouncement(token: string, args: any, kind: 'start' | 'end'): Promise<void> {
    const id = args.id as string;
    const description = args.description as string | undefined;
    logger.info({ chainId: this.chainId, token, id, description, kind }, `B20 Announcement ${kind}`);
    await this.recordB20CorporateAction(token, kind === 'start' ? 'Announcement' : 'EndAnnouncement', null, args);
  }

  private async handleExtraMetadataUpdated(token: string, args: any): Promise<void> {
    logger.info({ chainId: this.chainId, token, key: args.key, value: args.value }, 'B20 ExtraMetadataUpdated');
    // ISIN/CUSIP surface — update token metadata cache
    try {
      await (this.prisma as any).b20Token?.update?.({
        where: { address_chainId: { address: token, chainId: this.chainId } },
        data: { extraMetadata: { ...(args as any) } },
      } as any);
    } catch {}
  }

  private async recordB20CorporateAction(token: string, type: string, log: ethers.Log | null, args: any): Promise<void> {
    // Persist for monitoring correlation: oracle freeze during Announcement ≠ incident
    try {
      await (this.prisma as any).b20CorporateAction?.create?.({
        data: {
          tokenAddress: token,
          chainId: this.chainId,
          actionType: type,
          txHash: log?.transactionHash ?? null,
          blockNumber: log ? Number(log.blockNumber) : null,
          metadata: args ? JSON.stringify(args, (_, v) => (typeof v === 'bigint' ? v.toString() : v)) : null,
        },
      });
    } catch (e) {
      // Table optional until migration — log and continue; monitoring can still correlate via logs
      logger.debug({ err: e }, 'b20CorporateAction table not available');
    }
  }

  // ============ Utils ============

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}