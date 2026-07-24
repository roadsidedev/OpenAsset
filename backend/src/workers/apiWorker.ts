import { Worker } from '../bootstrap/lifecycle';
import { config } from '../config/unifiedConfig';
import { logger } from '../utils/logger';

export class ApiWorker implements Worker {
  name: 'api' = 'api';
  private server: any = null;

  async start(): Promise<void> {
    const { default: app } = await import('../app');
    
    this.server = app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.env }, 'API server started');
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(resolve);
      });
      this.server = null;
    }
  }

  async healthCheck() {
    try {
      const { prisma } = await import('../bootstrap/prisma');
      await prisma.$queryRaw`SELECT 1`;
      return { healthy: true, details: { port: config.port } };
    } catch (error) {
      return { healthy: false, details: { error: String(error) } };
    }
  }
}