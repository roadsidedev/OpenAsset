import { Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export abstract class BaseController {
  protected handleSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({
      success: true,
      data,
    });
  }

  protected handleError(error: unknown, res: Response, source = 'BaseController'): void {
    logger.error({ err: error, source }, 'Request failed');

    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}
