/**
 * @file marketRoutes.ts
 * @description Market management routes
 */

import express from 'express';
import { MarketController } from '../controllers/MarketController';
import { PrismaClient } from '@prisma/client';

export function createMarketRoutes(prisma: PrismaClient): express.Router {
  const router = express.Router();
  const controller = new MarketController(prisma);

  // GET routes
  router.get('/', (req, res, next) => controller.getMarkets(req, res, next));
  router.get('/:address', (req, res, next) => controller.getMarket(req, res, next));
  router.get('/:address/liquidity', (req, res, next) => controller.getMarketLiquidity(req, res, next));

  // POST routes
  router.post('/estimate-creation', (req, res, next) => controller.estimateMarketCreation(req, res, next));

  return router;
}
