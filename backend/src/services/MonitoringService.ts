import { PrismaClient } from '@prisma/client';
import { AlertService } from './AlertService';
import { logger } from '../app';

export class MonitoringService {
  constructor(
    private prisma: PrismaClient,
    private alertService: AlertService
  ) {}

  async checkHealth() {
    logger.info('Running system health check...');
    // Check DB connection, external APIs, etc.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection healthy');
    } catch (error) {
      logger.error({ err: error }, 'Database health check failed');
    }
  }

  async checkLoanHealth() {
    logger.info('Checking loan health factors...');
    // Logic to iterate over active loans and check LTV against current prices
    
    // example:
    // const loans = await this.prisma.loan.findMany({ where: { status: 'ACTIVE' } });
    // for (const loan of loans) {
    //   const health = calculateHealth(loan);
    //   if (health < 1.0) {
    //     await this.alertService.createAlert(loan.borrowerAddress, 'LIQUIDATION_RISK', 'CRITICAL', 'Your loan is at risk!', loan.id);
    //   }
    // }
  }
}
