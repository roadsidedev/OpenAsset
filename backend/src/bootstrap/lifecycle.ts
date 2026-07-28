import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { healthTracker } from '../utils/health';
import { registerWorker, updateWorkerStatus, recordWorkerRun, getWorkerMetrics } from './metrics';

export type WorkerName = 'api' | 'indexer' | 'liquidation' | 'monitor' | 'keeper';

export interface Worker {
  name: WorkerName;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
}

export interface LifecycleOptions {
  shutdownTimeoutMs?: number;
  healthCheckIntervalMs?: number;
}

export class LifecycleManager extends EventEmitter {
  private workers: Map<WorkerName, Worker> = new Map();
  private shutdownInitiated = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private options: Required<LifecycleOptions>;

  constructor(options: LifecycleOptions = {}) {
    super();
    this.options = {
      shutdownTimeoutMs: options.shutdownTimeoutMs || 30_000,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 60_000,
    };
  }

  register(worker: Worker): void {
    if (this.workers.has(worker.name)) {
      throw new Error(`Worker ${worker.name} already registered`);
    }
    this.workers.set(worker.name, worker);
    registerWorker(worker.name);
    logger.info({ worker: worker.name }, 'Worker registered');
  }

  async startAll(): Promise<void> {
    logger.info('Starting all workers...');
    const startOrder: WorkerName[] = ['api', 'indexer', 'liquidation', 'monitor', 'keeper'];
    
    for (const name of startOrder) {
      const worker = this.workers.get(name);
      if (!worker) continue;
      
      const startTime = Date.now();
      updateWorkerStatus(name, 'starting');
      
      try {
        await worker.start();
        const duration = Date.now() - startTime;
        recordWorkerRun(name, duration);
        logger.info({ worker: name, durationMs: duration }, 'Worker started');
        healthTracker.updateWorker(name, { isHealthy: true });
      } catch (error) {
        const duration = Date.now() - startTime;
        recordWorkerRun(name, duration, error as Error);
        logger.error({ err: error, worker: name }, 'Worker failed to start');
        healthTracker.updateWorker(name, { isHealthy: false, error: String(error) });
        if (name === 'api') {
          throw error;
        }
        logger.warn({ worker: name }, 'Non-critical worker failed, continuing startup');
      }
    }
    
    this.startHealthChecks();
    this.emit('started');
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const [name, worker] of this.workers) {
        try {
          const health = await worker.healthCheck();
          healthTracker.updateWorker(name, { isHealthy: health.healthy });
          
          if (!health.healthy) {
            logger.warn({ worker: name, details: health.details }, 'Worker health check failed');
          }
        } catch (error) {
          logger.error({ err: error, worker: name }, 'Worker health check error');
          healthTracker.updateWorker(name, { isHealthy: false, error: String(error) });
        }
      }
    }, this.options.healthCheckIntervalMs);
    
    // Don't prevent process exit
    this.healthCheckTimer.unref?.();
  }

  async stopAll(signal: string): Promise<void> {
    if (this.shutdownInitiated) return;
    this.shutdownInitiated = true;
    
    logger.info({ signal }, 'Graceful shutdown initiated');
    this.emit('shutdown', signal);
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Stop in reverse dependency order
    const stopOrder: WorkerName[] = ['keeper', 'monitor', 'liquidation', 'indexer', 'api'];
    const timeoutMs = this.options.shutdownTimeoutMs;
    const startTime = Date.now();

    for (const name of stopOrder) {
      const worker = this.workers.get(name);
      if (!worker) continue;
      
      const remainingTime = timeoutMs - (Date.now() - startTime);
      if (remainingTime <= 0) {
        logger.warn({ worker: name }, 'Shutdown timeout reached, skipping');
        break;
      }
      
      updateWorkerStatus(name, 'stopping');
      
      try {
        await Promise.race([
          worker.stop(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), remainingTime)),
        ]);
        updateWorkerStatus(name, 'stopped');
        logger.info({ worker: name }, 'Worker stopped');
      } catch (error) {
        logger.error({ err: error, worker: name }, 'Worker stop failed');
        updateWorkerStatus(name, 'error');
      }
    }
    
    this.emit('stopped');
  }

  async healthCheck(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const [name, worker] of this.workers) {
      try {
        results[name] = await worker.healthCheck();
      } catch (error) {
        results[name] = { healthy: false, error: String(error) };
      }
    }
    return results;
  }

  getWorker(name: WorkerName): Worker | undefined {
    return this.workers.get(name);
  }

  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const name of this.workers.keys()) {
      metrics[name] = getWorkerMetrics(name);
    }
    return metrics;
  }
}

export const lifecycle = new LifecycleManager();