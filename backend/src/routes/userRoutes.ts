/**
 * @file userRoutes.ts
 * @description User management routes
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, optionalAuth } from '../middleware/auth';
import {
  getUser,
  updateUser,
  requestEmailVerification,
  confirmEmailVerification,
  requestSmsVerification,
  confirmSmsVerification,
  getUserActivity,
} from '../controllers/UserController';
import { getNonce } from '../controllers/AuthController';

export function createUserRoutes(prisma: PrismaClient): express.Router {
  const router = express.Router();

  router.get('/:address/nonce', getNonce);
  // Activity includes alert messages — require authentication
  router.get('/:address/activity', requireAuth, getUserActivity);
  router.get('/:address', optionalAuth, getUser);
  router.put('/:address', requireAuth, updateUser);

  router.post('/:address/verify-email', requireAuth, requestEmailVerification);
  router.post('/:address/verify-email-confirm', requireAuth, confirmEmailVerification);

  router.post('/:address/verify-sms', requireAuth, requestSmsVerification);
  router.post('/:address/verify-sms-confirm', requireAuth, confirmSmsVerification);

  return router;
}
