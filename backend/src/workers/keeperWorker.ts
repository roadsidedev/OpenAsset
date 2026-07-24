import { Worker } from '../bootstrap/lifecycle';
import { KeeperService } from '../services/KeeperService';
import { config } from '../config/unifiedConfig';
import { logger } from '../utils/logger';
import { prisma } from '../bootstrap/prisma';
import { getProvider } from '../bootstrap/provider';

export class KeeperWorker implements Worker {
  name: 'keeper' = 'keeper';
  private service: KeeperService | null = null;

  async start(): Promise<void> {
    // Check if keeper is enabled
    if (!config.keeper?.enabled) {
      logger.info('Keeper service disabled via config');
      return;
    }

    // Keeper needs a signer wallet
    if (!config.keeper?.privateKey) {
      logger.warn('Keeper private key not configured, skipping keeper service');
      return;
    }

    try {
      const chainId = config.keeper.chainId || 11155111;
      this.service = new KeeperService(prisma, getProvider(chainId), chainId, {
        privateKey: config.keeper.privateKey,
        maxGasPriceGwei: config.keeper.maxGasPriceGwei || 100,
        pollIntervalMs: config.keeper.pollIntervalMs || 30_000,
        minHealthFactorBps: config.keeper.minHealthFactorBps || 12000,
        batchSize: config.keeper.batchSize || 10,
      });

      await this.service.start();
      logger.info({ chainId }, 'Keeper service started');
    } catch (error) {
      logger.error({ err: error }, 'Failed to start keeper service');
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.service) {
      this.service.stop();
      this.service = null;
    }
  }

  async healthCheck() {
    if (!config.keeper?.enabled) {
      return { healthy: true, details: { status: 'disabled' } };
    }

    if (!this.service) {
      return { healthy: false, details: { error: 'Service not started' } };
    }

    try {
      const healthy = this.service.isRunningStatus?.() ?? false;
      return { healthy, details: { running: healthy } };
    } catch (error) {
      return { healthy: false, details: { error: String(error) } };
    }
  }
}