import { Worker } from '../bootstrap/lifecycle';
import { MonitoringService } from '../services/MonitoringServiceV2';
import { AlertService } from '../services/AlertService';
import { prisma } from '../bootstrap/prisma';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';

export class MonitorWorker implements Worker {
  name: 'monitor' = 'monitor';
  private services: Map<number, MonitoringService> = new Map();
  private intervals: Map<number, NodeJS.Timeout> = new Map();
  private readonly CHECK_INTERVAL = 60_000; // 1 minute

  async start(): Promise<void> {
    const alertService = new AlertService(prisma);
    
    // Default to sepolia if no chains configured
    const chains = config.chains.length > 0 ? config.chains.map(c => c.id) : [11155111];
    
    for (const chainId of chains) {
      this.services.set(chainId, new MonitoringService(prisma, alertService, chainId));
      
      // Initial health check
      await this.services.get(chainId)!.checkHealth();
      
      // Start periodic checks
      const interval = setInterval(async () => {
        try {
          await this.services.get(chainId)!.checkLoanHealth();
          await this.services.get(chainId)!.checkCircuitBreakerStatus();
        } catch (error) {
          logger.error({ err: error, chainId }, 'Error in monitoring loop');
        }
      }, this.CHECK_INTERVAL);
      
      this.intervals.set(chainId, interval);
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.services.clear();
  }

  async healthCheck() {
    const details: Record<number, any> = {};
    let allHealthy = true;
    
    for (const [chainId, service] of this.services) {
      try {
        // Just check database connectivity for now
        await prisma.$queryRaw`SELECT 1`;
        details[chainId] = { healthy: true };
      } catch (error) {
        allHealthy = false;
        details[chainId] = { healthy: false, error: String(error) };
      }
    }
    
    return { healthy: allHealthy, details };
  }
}