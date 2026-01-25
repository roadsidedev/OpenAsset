import app, { logger } from './app';
import { config } from './config/unifiedConfig';

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.env} mode`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});
