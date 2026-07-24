import { Worker } from '../bootstrap/lifecycle';
import { LiquidationBotService } from '../services/LiquidationBotService';
import { prisma } from '../bootstrap/prisma';
import { getProvider, getConfiguredChains } from '../bootstrap/provider';
import { logger } from '../utils/logger';

export class LiquidationWorker implements Worker {
  name: 'liquidation' = 'liquidation';
  private services: Map<number, LiquidationBotService> = new Map();

  async start(): Promise<void> {
    const chains = getConfiguredChains();
    
    for (const chainId of chains) {
      try {
        const service = new LiquidationBotService(prisma, getProvider(chainId));
        service.start();
        this.services.set(chainId, service);
        logger.info({ chainId }, 'Liquidation bot started');
      } catch (error) {
        logger.error({ err: error, chainId }, 'Failed to start liquidation bot');
        throw error;
      }
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, service] of this.services) {
      try {
        service.stop();
        logger.info({ chainId }, 'Liquidation bot stopped');
      } catch (error) {
        logger.error({ err: error, chainId }, 'Error stopping liquidation bot');
      }
    }
    this.services.clear();
  }

  async healthCheck() {
    const details: Record<number, any> = {};
    let allHealthy = true;

    for (const [chainId, service] of this.services) {
      try {
        const healthy = service.isRunningStatus?.() ?? true;
        if (!healthy) allHealthy = false;
        details[chainId] = { healthy };
      } catch (error) {
        allHealthy = false;
        details[chainId] = { healthy: false, error: String(error) };
      }
    }

    return { healthy: allHealthy, details };
  }
}