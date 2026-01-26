import { EventIndexerService } from './services/indexer/EventIndexerService';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';

const prisma = new PrismaClient();
const indexer = new EventIndexerService(prisma);

// Ideally, this should be run in a separate process or worker
logger.info('Starting Indexer Worker...');
indexer.start().catch((err) => {
  logger.error({ err }, 'Failed to start indexer');
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Stopping Indexer Worker...');
  await indexer.stop();
  await prisma.$disconnect();
  process.exit(0);
});
