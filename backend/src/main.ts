import { lifecycle } from './bootstrap/lifecycle';
import { logger } from './utils/logger';
import { config, getKeeperPrivateKey } from './config/unifiedConfig';
import { shutdown } from './bootstrap/workers';
import { ApiWorker } from './workers/apiWorker';
import { IndexerWorker } from './workers/indexerWorker';
import { LiquidationWorker } from './workers/liquidationWorker';
import { MonitorWorker } from './workers/monitorWorker';
import { KeeperWorker } from './workers/keeperWorker';

// Register workers
lifecycle.register(new ApiWorker());
lifecycle.register(new IndexerWorker());
lifecycle.register(new LiquidationWorker());

// Conditional workers based on config
if (config.alerts?.sendgrid?.apiKey || config.alerts?.twilio?.accountSid || config.alerts?.firebase?.serviceAccountKey) {
  lifecycle.register(new MonitorWorker());
}

if (config.keeper?.enabled && getKeeperPrivateKey()) {
  lifecycle.register(new KeeperWorker());
}

// Start application
async function main(): Promise<void> {
  logger.info('Starting OpenAsset Market Backend...');
  logger.info({ 
    port: config.port, 
    env: config.env,
    chains: config.rpcUrls.size > 0 ? 'configured' : 'none' 
  }, 'Configuration');

  try {
    await lifecycle.startAll();
    logger.info('All workers started successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to start workers');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  shutdown('unhandledRejection');
});

main();