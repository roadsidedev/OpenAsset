import { config } from '../config/unifiedConfig';

export interface WorkerMetrics {
  name: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  lastRun?: Date;
  lastSuccess?: Date;
  lastError?: string;
  runCount: number;
  errorCount: number;
  avgDurationMs: number;
}

export interface SystemMetrics {
  uptimeMs: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  workers: Record<string, WorkerMetrics>;
  database: { connected: boolean; latencyMs?: number };
  rpc: Record<number, { connected: boolean; latencyMs?: number }>;
}

const workerMetrics = new Map<string, WorkerMetrics>();
const startTime = Date.now();

export function registerWorker(name: string): WorkerMetrics {
  const metrics: WorkerMetrics = {
    name,
    status: 'starting',
    runCount: 0,
    errorCount: 0,
    avgDurationMs: 0,
  };
  workerMetrics.set(name, metrics);
  return metrics;
}

export function updateWorkerStatus(name: string, status: WorkerMetrics['status']): void {
  const metrics = workerMetrics.get(name);
  if (metrics) metrics.status = status;
}

export function recordWorkerRun(name: string, durationMs: number, error?: Error): void {
  const metrics = workerMetrics.get(name);
  if (!metrics) return;
  
  metrics.lastRun = new Date();
  metrics.runCount++;
  metrics.avgDurationMs = (metrics.avgDurationMs * (metrics.runCount - 1) + durationMs) / metrics.runCount;
  
  if (error) {
    metrics.errorCount++;
    metrics.lastError = error.message;
    metrics.status = 'error';
  } else {
    metrics.lastSuccess = new Date();
    metrics.status = 'running';
  }
}

export function getSystemMetrics(): SystemMetrics {
  return {
    uptimeMs: Date.now() - startTime,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    workers: Object.fromEntries(workerMetrics),
    database: { connected: true }, // Updated by health check
    rpc: {}, // Updated by health check
  };
}

export function getWorkerMetrics(name: string): WorkerMetrics | undefined {
  return workerMetrics.get(name);
}