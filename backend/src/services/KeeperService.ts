import { PrismaClient, LoanStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { LENDING_MARKET_V2_ABI, ILIQUIDATION_ADAPTER_ABI } from './web3/ContractAbisV2';

/** On-chain LendingMarketV2.LoanStatus → Prisma LoanStatus */
const ON_CHAIN_LOAN_STATUS: Record<number, LoanStatus> = {
  0: 'ACTIVE',
  1: 'GRACE_PERIOD',
  2: 'LIQUIDATION_CURE',
  3: 'LIQUIDATION_SETTLING',
  4: 'REPAID',
  5: 'LIQUIDATED',
};

interface KeeperRuntimeConfig {
  chainId: number;
  gasLimit: number;
  maxGasPriceGwei: number;
  pollIntervalMs: number;
  minHealthFactorBps: number;
  batchSize: number;
}

interface KeeperConfigInput {
  /** Used only to construct the wallet; never stored on the service config object */
  privateKey?: string;
  chainId?: number;
  gasLimit?: number;
  maxGasPriceGwei?: number;
  pollIntervalMs?: number;
  minHealthFactorBps?: number;
  batchSize?: number;
}

export class KeeperService {
  private prisma: PrismaClient;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private chainId: number;
  /** Runtime knobs only — never includes privateKey */
  private config: KeeperRuntimeConfig;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBlockChecked = 0;

  constructor(
    prisma: PrismaClient,
    provider: ethers.Provider,
    chainId: number,
    config?: Partial<KeeperConfigInput>
  ) {
    this.prisma = prisma;
    this.provider = provider;
    this.chainId = chainId;

    // Resolve private key in a local closure; do not assign onto exported/plain config
    const privateKey = (() => {
      const key = config?.privateKey || process.env.KEEPER_PRIVATE_KEY;
      if (!key) {
        throw new Error('Keeper private key not configured');
      }
      return key;
    })();

    this.wallet = new ethers.Wallet(privateKey, provider);

    this.config = {
      chainId,
      gasLimit: config?.gasLimit || 500_000,
      maxGasPriceGwei: config?.maxGasPriceGwei || 100,
      pollIntervalMs: config?.pollIntervalMs || 30_000,
      minHealthFactorBps: config?.minHealthFactorBps || 12000, // 1.2
      batchSize: config?.batchSize || 10,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ chainId: this.chainId, address: this.wallet.address }, 'Keeper service started');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info({ chainId: this.chainId }, 'Keeper service stopped');
  }

  isRunningStatus(): boolean {
    return this.isRunning;
  }

  private mapOnChainStatus(status: number): LoanStatus | null {
    return ON_CHAIN_LOAN_STATUS[status] ?? null;
  }

  private async queryCureWindowSeconds(liquidationAdapter: string): Promise<number> {
    try {
      const adapter = new ethers.Contract(
        liquidationAdapter,
        ILIQUIDATION_ADAPTER_ABI,
        this.provider
      );
      const cureWindow = await adapter.cureWindowSeconds();
      const seconds = Number(cureWindow);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        logger.warn({ liquidationAdapter }, 'Invalid cureWindowSeconds from adapter; skipping settle');
        return 0;
      }
      return seconds;
    } catch (error) {
      logger.warn({ err: error, liquidationAdapter }, 'Failed to query cureWindowSeconds');
      return 0;
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.executeLiquidations();
      await this.executeSettlements();
      await this.checkExpiredCureWindows();
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'Keeper poll error');
    }

    this.pollTimer = setTimeout(() => this.poll(), this.config.pollIntervalMs);
  }

  /**
   * Execute liquidate() on loans that are eligible for liquidation
   * (health factor below threshold, not in cure/settling state)
   */
  private async executeLiquidations(): Promise<void> {
    const loans = await this.prisma.loan.findMany({
      where: {
        status: { in: ['ACTIVE', 'GRACE_PERIOD'] as LoanStatus[] },
        healthFactor: { lt: this.config.minHealthFactorBps / 10000 }, // Convert to decimal
        market: { chainId: this.chainId },
      },
      include: { market: true },
      take: this.config.batchSize,
      orderBy: { healthFactor: 'asc' },
    });

    for (const loan of loans) {
      try {
        const marketContract = new ethers.Contract(
          loan.marketAddress,
          LENDING_MARKET_V2_ABI,
          this.wallet
        );

        const healthFactorStr = await marketContract.getHealthFactor(loan.contractLoanId);
        const healthFactor = Number(healthFactorStr) / 10000;

        if (healthFactor >= this.config.minHealthFactorBps / 10000) {
          continue; // Health recovered, skip
        }

        // Check if already liquidated / in cure on-chain
        const loanDetails = await marketContract.getLoanDetails(loan.contractLoanId);
        const onChainStatus = Number(loanDetails.status);
        const mapped = this.mapOnChainStatus(onChainStatus);
        if (mapped && mapped !== 'ACTIVE' && mapped !== 'GRACE_PERIOD') {
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              status: mapped,
              ...(mapped === 'LIQUIDATED' ? { liquidatedAt: new Date() } : {}),
            },
          });
          continue;
        }

        // Estimate gas
        const gasEstimate = await marketContract.liquidate.estimateGas(loan.contractLoanId);
        const gasLimit = gasEstimate + 50_000n; // Buffer

        // Check gas price
        const feeData = await this.provider.getFeeData();
        const maxGasPrice = ethers.parseUnits(this.config.maxGasPriceGwei.toString(), 'gwei');
        if (feeData.gasPrice && feeData.gasPrice > maxGasPrice) {
          logger.warn({ chainId: this.chainId, gasPrice: feeData.gasPrice.toString() }, 'Gas price too high, skipping');
          continue;
        }

        logger.info({ loanId: loan.contractLoanId, market: loan.marketAddress, healthFactor }, 'Executing liquidation');

        const tx = await marketContract.liquidate(loan.contractLoanId, { gasLimit });
        const receipt = await tx.wait();

        logger.info({ loanId: loan.contractLoanId, txHash: receipt?.hash }, 'Liquidation executed');

        // Re-read on-chain status (async → LIQUIDATION_CURE, sync → LIQUIDATED)
        const after = await marketContract.getLoanDetails(loan.contractLoanId);
        const afterMapped = this.mapOnChainStatus(Number(after.status)) || 'LIQUIDATION_CURE';

        await this.prisma.loan.update({
          where: { id: loan.id },
          data: {
            status: afterMapped,
            frozenInterestAt:
              afterMapped === 'LIQUIDATION_CURE' && Number(after.frozenInterestAt) > 0
                ? new Date(Number(after.frozenInterestAt) * 1000)
                : undefined,
            ...(afterMapped === 'LIQUIDATED' ? { liquidatedAt: new Date() } : {}),
          },
        });

        await this.prisma.alert.create({
          data: {
            userId: loan.positionHolderAddress,
            loanId: loan.id,
            type: 'LIQUIDATION_RISK',
            level: 'CRITICAL',
            message: `Loan ${loan.contractLoanId} liquidated. Transaction: ${receipt?.hash}`,
          },
        });

      } catch (error) {
        logger.error({ err: error, loanId: loan.contractLoanId }, 'Liquidation execution failed');
      }
    }
  }

  /**
   * Execute settleLiquidation() on loans where cure window has expired
   */
  private async executeSettlements(): Promise<void> {
    const loans = await this.prisma.loan.findMany({
      where: {
        status: 'LIQUIDATION_CURE' as LoanStatus,
        market: { chainId: this.chainId },
      },
      include: { market: true },
      take: this.config.batchSize,
    });

    for (const loan of loans) {
      try {
        const marketContract = new ethers.Contract(
          loan.marketAddress,
          LENDING_MARKET_V2_ABI,
          this.wallet
        );

        const loanDetails = await marketContract.getLoanDetails(loan.contractLoanId);
        const onChainStatus = Number(loanDetails.status);
        const mapped = this.mapOnChainStatus(onChainStatus);

        // Sync DB if chain already moved past CURE
        if (mapped && mapped !== 'LIQUIDATION_CURE') {
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              status: mapped,
              ...(mapped === 'LIQUIDATED' ? { liquidatedAt: new Date() } : {}),
            },
          });
          continue;
        }

        const frozenInterestAt = Number(loanDetails.frozenInterestAt);
        if (frozenInterestAt === 0) continue;

        const liquidationAdapter = (loan as any).market?.liquidationAdapter as string | undefined;
        if (!liquidationAdapter) {
          logger.warn({ loanId: loan.contractLoanId }, 'No liquidationAdapter on market; skipping settle');
          continue;
        }

        const cureWindow = await this.queryCureWindowSeconds(liquidationAdapter);
        if (cureWindow <= 0) continue;

        const cureDeadline = frozenInterestAt + cureWindow;
        if (Date.now() / 1000 < cureDeadline) continue; // Window not expired

        logger.info({ loanId: loan.contractLoanId, market: loan.marketAddress, cureWindow }, 'Executing settlement');

        const tx = await marketContract.settleLiquidation(loan.contractLoanId, {
          gasLimit: this.config.gasLimit
        });
        const receipt = await tx.wait();

        logger.info({ loanId: loan.contractLoanId, txHash: receipt?.hash }, 'Settlement executed');

        // settleLiquidation → LIQUIDATION_SETTLING on-chain (not LIQUIDATED yet)
        const after = await marketContract.getLoanDetails(loan.contractLoanId);
        const afterMapped = this.mapOnChainStatus(Number(after.status)) || 'LIQUIDATION_SETTLING';

        await this.prisma.loan.update({
          where: { id: loan.id },
          data: { status: afterMapped },
        });

      } catch (error) {
        logger.error({ err: error, loanId: loan.contractLoanId }, 'Settlement execution failed');
      }
    }
  }

  /**
   * Check for loans in LIQUIDATION_SETTLING that have timed out
   * and flag for manual intervention
   */
  private async checkExpiredCureWindows(): Promise<void> {
    const SETTLEMENT_TIMEOUT = 7 * 24 * 60 * 60; // 7 days

    const loans = await this.prisma.loan.findMany({
      where: {
        status: 'LIQUIDATION_SETTLING' as LoanStatus,
        market: { chainId: this.chainId },
      },
      include: { market: true },
    });

    for (const loan of loans) {
      const loanAge = (Date.now() - loan.createdAt.getTime()) / 1000;

      if (loanAge > SETTLEMENT_TIMEOUT) {
        logger.warn(
          { loanId: loan.contractLoanId, market: loan.marketAddress, age: loanAge },
          'Settlement timeout exceeded — flagging for manual intervention'
        );

        await this.prisma.alert.create({
          data: {
            userId: loan.positionHolderAddress,
            loanId: loan.id,
            type: 'SETTLEMENT_TIMEOUT',
            level: 'CRITICAL',
            message: `Loan ${loan.contractLoanId} settlement timeout exceeded (${Math.floor(loanAge / 86400)} days). Manual intervention required.`,
          },
        });
      }
    }
  }
}
