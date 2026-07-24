import { PrismaClient, LoanStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { LENDING_MARKET_V2_ABI } from './web3/ContractAbisV2';

interface KeeperConfig {
  privateKey: string;
  chainId: number;
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
  private config: Required<KeeperConfig>;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBlockChecked = 0;

  constructor(
    prisma: PrismaClient,
    provider: ethers.Provider,
    chainId: number,
    config?: Partial<KeeperConfig>
  ) {
    this.prisma = prisma;
    this.provider = provider;
    this.chainId = chainId;
    
    const privateKey = config?.privateKey || process.env.KEEPER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Keeper private key not configured');
    }
    
    this.wallet = new ethers.Wallet(privateKey, provider);
    
    this.config = {
      privateKey,
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
        // Double-check on-chain health factor
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

        // Check if already liquidated on-chain
        const loanDetails = await marketContract.getLoanDetails(loan.contractLoanId);
        const onChainStatus = Number(loanDetails.status);
        if (onChainStatus === 5 || onChainStatus === 6) { // LIQUIDATED or LIQUIDATION_SETTLING
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: { status: onChainStatus === 5 ? 'LIQUIDATED' : 'LIQUIDATION_SETTLING' },
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

        // Execute liquidation
        logger.info({ loanId: loan.contractLoanId, market: loan.marketAddress, healthFactor }, 'Executing liquidation');
        
        const tx = await marketContract.liquidate(loan.contractLoanId, { gasLimit });
        const receipt = await tx.wait();
        
        logger.info({ loanId: loan.contractLoanId, txHash: receipt?.hash }, 'Liquidation executed');
        
        // Update DB
        await this.prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'LIQUIDATION_SETTLING' },
        });
        
        // Create alert
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
        
        // If already settled on-chain
        if (onChainStatus === 5 || onChainStatus === 6) {
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: { status: onChainStatus === 5 ? 'LIQUIDATED' : 'LIQUIDATION_SETTLING' },
          });
          continue;
        }
        
        // Check cure window expiry
        const frozenInterestAt = Number(loanDetails.frozenInterestAt);
        if (frozenInterestAt === 0) continue;
        
        // Get cure window from liquidation adapter
        // For now use default 24h, but should query adapter
        const cureWindow = 24 * 60 * 60; // 24 hours default
        const cureDeadline = frozenInterestAt + cureWindow;
        
        if (Date.now() / 1000 < cureDeadline) continue; // Window not expired
        
        // Execute settlement
        logger.info({ loanId: loan.contractLoanId, market: loan.marketAddress }, 'Executing settlement');
        
        const tx = await marketContract.settleLiquidation(loan.contractLoanId, { 
          gasLimit: this.config.gasLimit 
        });
        const receipt = await tx.wait();
        
        logger.info({ loanId: loan.contractLoanId, txHash: receipt?.hash }, 'Settlement executed');
        
        await this.prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'LIQUIDATED', liquidatedAt: new Date() },
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