import pino from 'pino';

function getLogLevel(): string {
  try {
    const { config } = require('../config/unifiedConfig');
    return config.logLevel || process.env.LOG_LEVEL || 'info';
  } catch {
    return process.env.LOG_LEVEL || 'info';
  }
}

export const logger = pino({
  level: getLogLevel(),
  redact: {
    paths: [
      'privateKey',
      'KEEPER_PRIVATE_KEY',
      'keeper.privateKey',
      'config.privateKey',
      'config.keeper.privateKey',
      'JWT_SECRET',
      'jwtSecret',
      'config.jwtSecret',
      'password',
      'authorization',
      'headers.authorization',
      'req.headers.authorization',
      '*.privateKey',
      '*.JWT_SECRET',
      '*.jwtSecret',
      // Full RPC / webhook URLs often embed API keys
      'url',
      'rpcUrl',
      'RPC_URL',
      '*.url',
      '*.rpcUrl',
      'err.config.headers.Authorization',
    ],
    censor: '[Redacted]',
  },
});
