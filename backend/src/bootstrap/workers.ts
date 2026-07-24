import { PrismaClient } from '@prisma/client';
import { getProvider, getConfiguredChains, rotateProvider } from './provider';
import { lifecycle, Worker, WorkerName } from './lifecycle';
import { prisma, disconnectPrisma } from './prisma';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';

export class ApiWorker implements Worker {
  name: WorkerName = 'api';
  private server: any;

  async start(): Promise<void> {
    const { default: app } = await import('../app');
    this.server = app.listen(config.port, () => {
      logger.info(`API server running on port ${config.port}`);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server.close(resolve));
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { healthy: true, details: { port: config.port } };
    } catch (error) {
      return { healthy: false, details: { error: String(error) } };
    }
  }
}

export class IndexerWorker implements Worker {
  name: WorkerName = 'indexer';
  private indexerServices: Map<number, any> = new Map();

  async start(): Promise<void> {
    const { EventIndexerServiceV2 } = await import('../services/indexer/EventIndexerServiceV2');
    
    for (const chainId of getConfiguredChains()) {
      const provider = getProvider(chainId);
      const indexer = new EventIndexerServiceV2(prisma, provider, chainId);
      this.indexerServices.set(chainId, indexer);
      await indexer.start();
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, indexer] of this.indexerServices) {
      await indexer.stop();
    }
    this.indexerServices.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    const results: Record<number, any> = {};
    let allHealthy = true;
    
    for (const [chainId, indexer] of this.indexerServices) {
      try {
        const healthy = indexer.isRunning?.() ?? true;
        results[chainId] = { healthy };
        if (!healthy) allHealthy = false;
      } catch {
        results[chainId] = { healthy: false };
        allHealthy = false;
      }
    }
    
    return { healthy: allHealthy, details: { chains: results } };
  }
}

export class LiquidationWorker implements Worker {
  name: WorkerName = 'liquidation';
  private liquidationServices: Map<number, any> = new Map();

  async start(): Promise<void> {
    const { LiquidationBotService } = await import('../services/LiquidationBotService');
    
    for (const chainId of getConfiguredChains()) {
      const provider = getProvider(chainId);
      const service = new LiquidationBotService(prisma, provider);
      this.liquidationServices.set(chainId, service);
      service.start();
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, service] of this.liquidationServices) {
      service.stop();
    }
    this.liquidationServices.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    const results: Record<number, any> = {};
    let allHealthy = true;
    
    for (const [chainId, service] of this.liquidationServices) {
      try {
        const healthy = service.isRunning?.() ?? true;
        results[chainId] = { healthy };
        if (!healthy) allHealthy = false;
      } catch {
        results[chainId] = { healthy: false };
        allHealthy = false;
      }
    }
    
    return { healthy: allHealthy, details: { chains: results } };
  }
}

export class MonitorWorker implements Worker {
  name: WorkerName = 'monitor';
  private monitorServices: Map<number, any> = new Map();
  private intervals: Map<number, NodeJS.Timeout> = new Map();

  async start(): Promise<void> {
    const { MonitoringService } = await import('../services/MonitoringServiceV2');
    const { AlertService } = await import('../services/AlertService');
    
    const alertService = new AlertService(prisma);
    
    for (const chainId of getConfiguredChains()) {
      const monitor = new MonitoringService(prisma, alertService, chainId);
      this.monitorServices.set(chainId, monitor);
      
      // Initial check
      await monitor.checkHealth();
      
      // Schedule periodic checks
      const interval = setInterval(async () => {
        try {
          await monitor.checkLoanHealth();
          await monitor.checkCircuitBreakerStatus();
        } catch (error) {
          logger.error({ err: error, chainId }, 'Monitor check failed');
        }
      }, 60_000); // 1 minute
      
      interval.unref?.();
      this.intervals.set(chainId, interval);
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.monitorServices.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    const results: Record<number, any> = {};
    let allHealthy = true;
    
    for (const [chainId] of this.monitorServices) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        results[chainId] = { healthy: true };
      } catch {
        results[chainId] = { healthy: false };
        allHealthy = false;
      }
    }
    
    return { healthy: allHealthy, details: { chains: results } };
  }
}

export class KeeperWorker implements Worker {
  name: WorkerName = 'keeper';
  private keeperServices: Map<number, any> = new Map();
  private intervals: Map<number, NodeJS.Timeout> = new Map();

  async start(): Promise<void> {
    const { KeeperService } = await import('../services/KeeperService');
    
    for (const chainId of getConfiguredChains()) {
      const provider = getProvider(chainId);
      const keeper = new KeeperService(prisma, provider, chainId);
      this.keeperServices.set(chainId, keeper);
      
      // Start keeper loop
      await keeper.start();
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, keeper] of this.keeperServices) {
      await keeper.stop();
    }
    this.keeperServices.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    const results: Record<number, any> = {};
    let allHealthy = true;
    
    for (const [chainId, keeper] of this.keeperServices) {
      try {
        const healthy = keeper.isRunning?.() ?? true;
        results[chainId] = { healthy };
        if (!healthy) allHealthy = false;
      } catch {
        results[chainId] = { healthy: false };
        allHealthy = false;
      }
    }
    
    return { healthy: allHealthy, details: { chains: results } };
  }
}

export async function bootstrap(): Promise<void> {
  logger.info('Bootstrapping application...');
  
  // Test database connection
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connected');
  
  // Test RPC connections
  for (const chainId of getConfiguredChains()) {
    try {
      const provider = getProvider(chainId);
      await provider.getBlockNumber();
      logger.info({ chainId }, 'RPC connection verified');
    } catch (error) {
      logger.warn({ err: error, chainId }, 'RPC connection failed, will retry');
    }
  }
  
  // Register workers based on enabled features
  const workers: Worker[] = [
    new ApiWorker(),
  ];
  
  // Always run indexer and liquidation
  workers.push(new IndexerWorker());
  workers.push(new LiquidationWorker());
  
  // Monitor if alerts configured
  if (config.alerts?.sendgrid?.apiKey || config.alerts?.twilio?.accountSid || config.alerts?.firebase?.serviceAccountKey) {
    workers.push(new MonitorWorker());
  }
  
  // Keeper if signer configured
  if (config.keeper?.privateKey) {
    workers.push(new KeeperWorker());
  }
  
  for (const worker of workers) {
    lifecycle.register(worker);
  }
  
  await lifecycle.startAll();
  logger.info('All workers started');
}

export async function shutdown(signal: string): Promise<void> {
  await lifecycle.stopAll(signal);
  await disconnectPrisma();
  logger.info('Shutdown complete');
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));