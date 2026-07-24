import pino from 'pino';

function getLogLevel(): string {
  try {
    const { config } = require('../config/unifiedConfig');
    return config.logLevel || process.env.LOG_LEVEL || 'info';
  } catch {
    return process.env.LOG_LEVEL || 'info';
  }
}

export const logger = pino({ level: getLogLevel() });