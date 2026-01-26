import pino from 'pino';
import { config } from '../config/unifiedConfig';

export const logger = pino({ level: config.logLevel });
