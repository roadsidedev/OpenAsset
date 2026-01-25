import { EventIndexerService } from './services/indexer/EventIndexerService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const indexer = new EventIndexerService(prisma);

// Ideally, this should be run in a separate process or worker
indexer.start().catch((err) => {
  console.error('Failed to start indexer:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await indexer.stop();
  await prisma.$disconnect();
  process.exit(0);
});
