import { PrismaClient, AlertType, AlertLevel } from '@prisma/client';
import { AlertService } from './AlertService';
import { contractServiceV2 } from './web3/ContractServiceV2';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';

export class MonitoringService {
  constructor(
    private prisma: PrismaClient,
    private alertService: AlertService,
    private chainId: number = 11155111
  ) {}

  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info({ component: 'database', chainId: this.chainId }, 'Health check passed');
    } catch (error) {
      logger.error({ err: error, component: 'database', chainId: this.chainId }, 'Health check failed');
    }
  }

  /**
   * Check health of all active loans for this chain
   */
  async checkLoanHealth() {
    logger.info({ chainId: this.chainId }, 'Starting loan health check cycle...');

    try {
      const activeLoans = await this.prisma.loan.findMany({
        where: {
          status: { in: ['ACTIVE', 'GRACE_PERIOD', 'LIQUIDATION_CURE'] },
          market: { chainId: this.chainId },
        },
        include: { market: true },
      });

      for (const loan of activeLoans) {
        try {
          const healthFactorStr = await contractServiceV2.getHealthFactor(
            this.chainId,
            loan.marketAddress,
            loan.contractLoanId
          );
          const healthFactor = Number(healthFactorStr) / 10000;

          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              healthFactor,
              lastHealthCheck: new Date(),
            },
          });

          if (healthFactor < 1.2) {
            const positionHolder = await this.resolvePositionHolder(loan);
            await this.alertService.createAlert(
              positionHolder,
              AlertType.LIQUIDATION_RISK,
              AlertLevel.WARNING,
              `Loan ${loan.contractLoanId} health is low (${healthFactor.toFixed(2)}). Market: ${loan.marketAddress}`,
              loan.id
            );
          }

          if (loan.status === 'LIQUIDATION_CURE') {
            await this.checkCureWindow(loan);
          }

          if (loan.status === 'LIQUIDATION_SETTLING') {
            await this.checkSettlementTimeout(loan);
          }
        } catch (error) {
          logger.error(
            { err: error, chainId: this.chainId, loanId: loan.contractLoanId },
            'Error checking loan health'
          );
        }
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'Error during loan health check cycle');
    }
  }

  async checkCircuitBreakerStatus() {
    logger.info({ chainId: this.chainId }, 'Checking circuit breaker status...');

    try {
      const markets = await this.prisma.market.findMany({
        where: { 
          chainId: this.chainId,
          status: { not: 'PAUSED_MANUAL' } 
        },
      });

      for (const market of markets) {
        try {
          const onChainStatus = await contractServiceV2.getMarketStats(this.chainId, market.address);
          const dbStatus = market.status;
          const chainStatus = onChainStatus.status;

          if (dbStatus === 'ACTIVE' && chainStatus !== 0) {
            await this.prisma.market.update({
              where: { address: market.address },
              data: {
                status: chainStatus === 1 ? 'PAUSED_VOLATILITY' :
                        chainStatus === 2 ? 'PAUSED_STALE_ORACLE' :
                        'PAUSED_MANUAL',
                pausedAt: new Date(),
              },
            });

            await this.alertService.createAlert(
              market.lpAddress,
              AlertType.MARKET_PAUSED,
              AlertLevel.CRITICAL,
              `Market ${market.address} has been paused on-chain (status: ${chainStatus}).`,
              undefined
            );
          }
        } catch (error) {
          logger.error(
            { err: error, chainId: this.chainId, market: market.address },
            'Error checking circuit breaker'
          );
        }
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId }, 'Error during circuit breaker check');
    }
  }

  private async resolvePositionHolder(loan: any): Promise<string> {
    if (loan.market.positionAdapter && loan.market.positionAdapter !== '0x0000000000000000000000000000000000000000') {
      try {
        const holder = await contractServiceV2.getPositionHolder(
          this.chainId,
          loan.market.positionAdapter,
          loan.contractLoanId
        );
        if (holder && holder !== '0x0000000000000000000000000000000000000000') {
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: { positionHolderAddress: holder },
          });
          return holder;
        }
      } catch (error) {
        logger.warn(
          { chainId: this.chainId, loanId: loan.contractLoanId },
          'Failed to resolve position holder on-chain'
        );
      }
    }

    return loan.positionHolderAddress;
  }

  private async checkCureWindow(loan: any): Promise<void> {
    if (!loan.frozenInterestAt) return;

    try {
      const liqInfo = await contractServiceV2.checkLiquidationAsync(
        this.chainId,
        loan.market.liquidationAdapter
      );

      if (!liqInfo.isAsync) return;

      const frozenTime = Math.floor(loan.frozenInterestAt.getTime() / 1000);
      const cureDeadline = frozenTime + liqInfo.cureWindow;
      const now = Math.floor(Date.now() / 1000);
      const remaining = cureDeadline - now;

      if (remaining <= 0) {
        const holder = await this.resolvePositionHolder(loan);
        await this.alertService.createAlert(
          holder,
          AlertType.CURE_WINDOW_EXPIRING,
          AlertLevel.CRITICAL,
          `Loan ${loan.contractLoanId} cure window expired. Settlement can be submitted.`,
          loan.id
        );
      } else if (remaining <= 3600) {
        const holder = await this.resolvePositionHolder(loan);
        await this.alertService.createAlert(
          holder,
          AlertType.CURE_WINDOW_EXPIRING,
          AlertLevel.WARNING,
          `Loan ${loan.contractLoanId} cure window expires in ${Math.floor(remaining / 60)} minutes.`,
          loan.id
        );
      }
    } catch (error) {
      logger.error({ err: error, chainId: this.chainId, loanId: loan.contractLoanId }, 'Error checking cure window');
    }
  }

  private async checkSettlementTimeout(loan: any): Promise<void> {
    const SETTLEMENT_TIMEOUT = 7 * 24 * 60 * 60;
    const loanAge = (Date.now() - loan.createdAt.getTime()) / 1000;

    if (loanAge > SETTLEMENT_TIMEOUT) {
      const holder = await this.resolvePositionHolder(loan);
      await this.alertService.createAlert(
        holder,
        AlertType.SETTLEMENT_TIMEOUT,
        AlertLevel.CRITICAL,
        `Loan ${loan.contractLoanId} settlement timeout exceeded (${Math.floor(loanAge / 86400)} days). Manual intervention required.`,
        loan.id
      );
    }
  }
}