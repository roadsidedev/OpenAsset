// @ts-nocheck — LEGACY V1 monitoring, superseded by MonitoringServiceV2.ts
import { PrismaClient, AlertType, AlertLevel } from '@prisma/client';
import { AlertService } from './AlertService';
import { logger } from '../utils/logger';

export class MonitoringService {
  constructor(
    private prisma: PrismaClient,
    private alertService: AlertService
  ) {}

  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info({ component: 'database' }, 'Health check passed');
    } catch (error) {
      logger.error({ err: error, component: 'database' }, 'Health check failed');
    }
  }

  async checkLoanHealth() {
    logger.info('Starting loan health check cycle...');
    
    try {
      const activeLoans = await this.prisma.loan.findMany({
        where: { status: 'ACTIVE' },
        include: { market: true }
      });

      for (const loan of activeLoans) {
        // Get latest price
        const latestPrice = await this.prisma.priceHistory.findFirst({
            where: { marketAddress: loan.marketAddress },
            orderBy: { timestamp: 'desc' }
        });

        if (!latestPrice) {
            logger.warn({ market: loan.marketAddress }, 'No price data found for market');
            continue;
        }

        const currentPrice = Number(latestPrice.price);
        
        const collateralValue = Number(loan.collateralAmount) * currentPrice;
        const debt = Number(loan.principal);
        
        const healthFactor = debt > 0 ? (collateralValue / debt) : 999;

        // Update health factor in DB
        await this.prisma.loan.update({
            where: { id: loan.id },
            data: { 
                healthFactor,
                lastHealthCheck: new Date()
            }
        });

        // Per-market threshold (bps); 1.2 fallback when unset/invalid.
        const configuredThreshold = loan.market?.healthFactorThreshold ?? 0;
        const thresholdBps = configuredThreshold > 10000 ? configuredThreshold : 12000;
        const healthFactorEnabled = loan.market?.enableHealthFactor !== false;
        if (healthFactorEnabled && healthFactor < thresholdBps / 10000) {
          await this.alertService.createAlert(
            loan.borrowerAddress,
            AlertType.LIQUIDATION_RISK, 
            AlertLevel.WARNING, 
            `Loan ${loan.contractLoanId} health is low (${healthFactor.toFixed(2)}, threshold ${(thresholdBps / 10000).toFixed(2)})`,
            String(loan.id)
          );
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error during loan health check');
    }
  }
}
