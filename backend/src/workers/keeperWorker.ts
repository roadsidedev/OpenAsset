import { Worker } from '../bootstrap/lifecycle';
import { KeeperService } from '../services/KeeperService';
import { config, getKeeperPrivateKey } from '../config/unifiedConfig';
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

    // Keeper needs a signer wallet (resolved via closure helper, not plain config)
    const keeperPrivateKey = getKeeperPrivateKey();
    if (!keeperPrivateKey) {
      logger.warn('Keeper private key not configured, skipping keeper service');
      return;
    }

    try {
      const chainId = config.keeper.chainId || 11155111;
      let provider;
      try {
        provider = getProvider(chainId);
      } catch {
        logger.warn({ chainId }, 'No RPC URL for keeper chain, skipping keeper service');
        return;
      }
      this.service = new KeeperService(prisma, provider, chainId, {
        privateKey: keeperPrivateKey,
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