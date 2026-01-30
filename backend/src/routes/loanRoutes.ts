/**
 * @file loanRoutes.ts
 * @description Loan management routes
 */

import express from 'express';
import { LoanController } from '../controllers/LoanController';
import { PrismaClient } from '@prisma/client';

export function createLoanRoutes(prisma: PrismaClient): express.Router {
  const router = express.Router();
  const controller = new LoanController(prisma);

  // GET routes
  router.get('/', (req, res, next) => controller.getLoans(req, res, next));
  router.get('/:address', (req, res, next) => controller.getLoan(req, res, next));
  router.get('/:address/liquidation-status', (req, res, next) => controller.getLiquidationStatus(req, res, next));

  // POST routes
  router.post('/:market/estimate-request', (req, res, next) => controller.estimateLoanRequest(req, res, next));

  return router;
}
