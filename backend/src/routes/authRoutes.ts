/**
 * @file authRoutes.ts
 * @description Authentication routes
 */

import express from 'express';
import { getNonce, login, verifyToken } from '../controllers/AuthController';
import { PrismaClient } from '@prisma/client';

export function createAuthRoutes(prisma: PrismaClient): express.Router {
   const router = express.Router();
 
   router.get('/nonce/:address', getNonce);
   router.post('/login', login);
   router.get('/me', verifyToken);
 
   return router;
}
