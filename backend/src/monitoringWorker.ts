import { PrismaClient } from '@prisma/client';
import { MonitoringService } from './services/MonitoringService';
import { AlertService } from './services/AlertService';
import { logger } from './utils/logger';
import { healthTracker } from './utils/health';

const prisma = new PrismaClient();
const alertService = new AlertService(prisma);
const monitoringService = new MonitoringService(prisma, alertService);

const CHECK_INTERVAL = 60 * 1000; // 1 minute

async function start() {
  logger.info('Starting Monitoring Worker...');
  
  // Initial check
  await monitoringService.checkHealth();

  setInterval(async () => {
    try {
      healthTracker.updateWorker('monitoring', { isHealthy: true });
      await monitoringService.checkLoanHealth();
    } catch (error) {
      healthTracker.updateWorker('monitoring', { isHealthy: false, error: (error as Error).message });
      logger.error({ err: error }, 'Error in monitoring loop');
    }
  }, CHECK_INTERVAL);
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start monitoring worker');
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Stopping Monitoring Worker...');
  await prisma.$disconnect();
  process.exit(0);
});
