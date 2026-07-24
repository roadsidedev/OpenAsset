/**
 * @file adapterRoutes.ts
 * @description Adapter registry routes
 */

import express from 'express';
import { AdapterController } from '../controllers/AdapterController';
import { PrismaClient } from '@prisma/client';

export function createAdapterRoutes(prisma: PrismaClient): express.Router {
  const router = express.Router();
  const controller = new AdapterController();

  // GET routes
  router.get('/', (req, res, next) => controller.getAdapters(req, res, next));
  router.get('/verified', (req, res, next) => controller.getVerifiedAdapters(req, res, next));
  router.get('/stats', (req, res, next) => controller.getAdapterStats(req, res, next));
  router.get('/:address', (req, res, next) => controller.getAdapter(req, res, next));

  return router;
}
