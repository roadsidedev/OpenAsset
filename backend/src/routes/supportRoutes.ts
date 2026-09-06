/**
 * @file supportRoutes.ts
 * @description Contact / support form routes
 */

import express from 'express';
import { SupportController } from '../controllers/SupportController';
import { PrismaClient } from '@prisma/client';

export function createSupportRoutes(_prisma: PrismaClient): express.Router {
  const router = express.Router();
  const controller = new SupportController();

  router.post('/', (req, res, next) => controller.submit(req, res, next));

  return router;
}
