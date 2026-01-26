export interface WorkerStatus {
  lastSeen: Date;
  isHealthy: boolean;
  error?: string;
}

class HealthTracker {
  private workers: Record<string, WorkerStatus> = {};

  updateWorker(name: string, status: Partial<WorkerStatus>) {
    this.workers[name] = {
      lastSeen: new Date(),
      isHealthy: status.isHealthy ?? true,
      error: status.error,
    };
  }

  getHealth() {
    const now = Date.now();
    const health: Record<string, any> = {
      status: 'ok',
      timestamp: new Date(),
      workers: {},
    };

    for (const [name, status] of Object.entries(this.workers)) {
      // If worker hasn't been seen for 5 minutes, mark as unhealthy
      const isStale = now - status.lastSeen.getTime() > 5 * 60 * 1000;
      health.workers[name] = {
        ...status,
        isHealthy: status.isHealthy && !isStale,
        stale: isStale,
      };

      if (!health.workers[name].isHealthy) {
        health.status = 'error';
      }
    }

    return health;
  }
}

export const healthTracker = new HealthTracker();
