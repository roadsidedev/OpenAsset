/**
 * @file LiquidationBotService.ts
 * @description Liquidation bot/keeper for handling async liquidation states
 *
 * Handles:
 * - Detecting loans in LIQUIDATION_CURE state
 * - Tracking cure window countdown
 * - Submitting liquidate() on cure window expiry
 * - Polling for settlement confirmation on LIQUIDATION_SETTLING loans
 * - Flagging settlement timeout for manual intervention
 */

import { ethers } from 'ethers';
import { PrismaClient, LoanStatus, AlertType, AlertLevel } from '@prisma/client';
import { logger } from '../utils/logger';
import { LENDING_MARKET_V2_ABI, ILIQUIDATION_ADAPTER_ABI } from './web3/ContractAbisV2';
import { AlertService } from './AlertService';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export class LiquidationBotService {
  private prisma: PrismaClient;
  private provider: ethers.Provider;
  private isRunning: boolean = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private alertService: AlertService;

  constructor(prisma: PrismaClient, provider: ethers.Provider) {
    this.prisma = prisma;
    this.provider = provider;
    // Alerts must dispatch through AlertService (user prefs + channels);
    // raw prisma.alert.create rows were never delivered anywhere.
    this.alertService = new AlertService(prisma);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Liquidation bot started');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('Liquidation bot stopped');
  }

  isRunningStatus(): boolean {
    return this.isRunning;
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.checkCureWindowExpiries();
      await this.checkSettlementTimeouts();
    } catch (error) {
      logger.error({ err: error }, 'Liquidation bot poll error');
    }

    this.pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL_MS);
  }

  /**
   * Detect loans in LIQUIDATION_CURE whose cure window has expired.
   * Execution of settleLiquidation() belongs to KeeperService (it holds the
   * signer wallet); this bot owns detection and the adapter's real window.
   */
  private async checkCureWindowExpiries(): Promise<void> {
    const curingLoans = await this.prisma.loan.findMany({
      where: { status: 'LIQUIDATION_CURE' as LoanStatus },
      include: { market: true },
    });

    for (const loan of curingLoans) {
      try {
        const marketContract = new ethers.Contract(
          loan.marketAddress,
          LENDING_MARKET_V2_ABI,
          this.provider
        );

        // Get loan details from chain
        const onChainLoan = await marketContract.getLoanDetails(loan.contractLoanId);
        const frozenInterestAt = Number(onChainLoan.frozenInterestAt);

        if (frozenInterestAt === 0) continue;

        // Real cure window from the market's liquidation adapter (never a
        // hardcoded default — windows differ per adapter/asset class).
        const cureWindow = await this.queryCureWindowSeconds(loan.market.liquidationAdapter);
        if (cureWindow <= 0) continue;
        const cureDeadline = frozenInterestAt + cureWindow;

        if (Date.now() / 1000 >= cureDeadline) {
          logger.info({ loanId: loan.contractLoanId, market: loan.marketAddress, cureWindow }, 'Cure window expired — awaiting keeper settleLiquidation');
        }
      } catch (error) {
        logger.error({ err: error, loanId: loan.contractLoanId }, 'Error checking cure window');
      }
    }
  }

  private async queryCureWindowSeconds(liquidationAdapter?: string): Promise<number> {
    if (!liquidationAdapter) return 0;
    try {
      const adapter = new ethers.Contract(liquidationAdapter, ILIQUIDATION_ADAPTER_ABI, this.provider);
      const cureWindow = await adapter.cureWindowSeconds();
      const seconds = Number(cureWindow);
      if (!Number.isFinite(seconds) || seconds <= 0) return 0;
      return seconds;
    } catch (error) {
      logger.warn({ err: error, liquidationAdapter }, 'Failed to query cureWindowSeconds');
      return 0;
    }
  }

  /**
   * Check for loans in LIQUIDATION_SETTLING that have timed out
   * and flag for manual intervention
   */
  private async checkSettlementTimeouts(): Promise<void> {
    const settlingLoans = await this.prisma.loan.findMany({
      where: { status: 'LIQUIDATION_SETTLING' as LoanStatus },
      include: { market: true },
    });

    for (const loan of settlingLoans) {
      try {
        // Check if settlement has timed out (e.g., > 7 days)
        const SETTLEMENT_TIMEOUT = 7 * 24 * 60 * 60; // 7 days
        const loanAge = (Date.now() - loan.createdAt.getTime()) / 1000;

        if (loanAge > SETTLEMENT_TIMEOUT) {
          logger.warn(
            { loanId: loan.contractLoanId, market: loan.marketAddress, age: loanAge },
            'Settlement timeout exceeded — flagging for manual intervention'
          );

          // Create alert for manual intervention
          await this.alertService.createAlert(
            loan.positionHolderAddress,
            AlertType.SETTLEMENT_TIMEOUT,
            AlertLevel.CRITICAL,
            `Loan ${loan.contractLoanId} on market ${loan.marketAddress} has exceeded settlement timeout. Manual intervention required.`,
            loan.id
          );
        }
      } catch (error) {
        logger.error({ err: error, loanId: loan.contractLoanId }, 'Error checking settlement timeout');
      }
    }
  }
}
