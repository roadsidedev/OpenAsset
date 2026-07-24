import { Worker } from '../bootstrap/lifecycle';
import { EventIndexerServiceV2 } from '../services/indexer/EventIndexerServiceV2';
import { prisma } from '../bootstrap/prisma';
import { getProvider, getConfiguredChains } from '../bootstrap/provider';
import { logger } from '../utils/logger';

export class IndexerWorker implements Worker {
  name: 'indexer' = 'indexer';
  private indexers: Map<number, EventIndexerServiceV2> = new Map();

  async start(): Promise<void> {
    const chains = getConfiguredChains();
    
    for (const chainId of chains) {
      try {
        const indexer = new EventIndexerServiceV2(prisma, getProvider(chainId), chainId);
        await indexer.start();
        this.indexers.set(chainId, indexer);
        logger.info({ chainId }, 'Indexer started for chain');
      } catch (error) {
        logger.error({ err: error, chainId }, 'Failed to start indexer for chain');
        throw error;
      }
    }
  }

  async stop(): Promise<void> {
    for (const [chainId, indexer] of this.indexers) {
      try {
        await indexer.stop();
        logger.info({ chainId }, 'Indexer stopped for chain');
      } catch (error) {
        logger.error({ err: error, chainId }, 'Error stopping indexer');
      }
    }
    this.indexers.clear();
  }

  async healthCheck() {
    const details: Record<number, any> = {};
    let allHealthy = true;

    for (const [chainId, indexer] of this.indexers) {
      try {
        const state = await prisma.syncState.findUnique({ 
          where: { id: `event_indexer_v2_${chainId}` } 
        });
        const provider = getProvider(chainId);
        const latestBlock = await provider.getBlockNumber();
        const lag = latestBlock - (state?.lastBlock || 0);
        
        const healthy = lag < 100;
        if (!healthy) allHealthy = false;
        
        details[chainId] = { healthy, lag, lastBlock: state?.lastBlock, latestBlock };
      } catch (error) {
        allHealthy = false;
        details[chainId] = { healthy: false, error: String(error) };
      }
    }

    return { healthy: allHealthy, details };
  }
}