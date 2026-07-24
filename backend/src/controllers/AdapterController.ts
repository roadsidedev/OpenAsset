/**
 * @file AdapterController.ts
 * @description Controller for adapter registry API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, AdapterType } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';

const prisma = new PrismaClient();

// Default chain ID for adapter queries
const DEFAULT_CHAIN_ID = 11155111;

export class AdapterController {
  /**
   * GET /adapters
   * List all registered adapters, optionally filtered by type
   */
  async getAdapters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, verified, deprecated, chainId } = req.query;
      const chain = parseInt(String(chainId || DEFAULT_CHAIN_ID), 10);

      const where: any = { chainId };
      if (type && typeof type === 'string') where.adapterType = type;
      if (verified !== undefined) where.verified = verified === 'true';
      if (deprecated !== undefined) where.deprecated = deprecated === 'true';

      const adapters = await prisma.adapter.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
      });

      res.json({ success: true, data: adapters });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapters');
      next(error);
    }
  }

  /**
   * GET /adapters/:address
   * Get adapter detail by address
   */
  async getAdapter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);

      const adapter = await prisma.adapter.findUnique({
        where: { adapterAddress_chainId: { adapterAddress: address, chainId } },
      });

      if (!adapter) {
        res.status(404).json({ success: false, error: 'Adapter not found' });
        return;
      }

      res.json({ success: true, data: adapter });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapter');
      next(error);
    }
  }

  /**
   * GET /adapters/verified
   * List all verified adapters
   */
  async getVerifiedAdapters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      
      const adapters = await prisma.adapter.findMany({
        where: { chainId, verified: true, deprecated: false },
        orderBy: { totalValueSecured: 'desc' },
      });

      res.json({ success: true, data: adapters });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching verified adapters');
      next(error);
    }
  }

  /**
   * GET /adapters/stats
   * Get adapter registry statistics
   */
  async getAdapterStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      
      const total = await prisma.adapter.count({ where: { chainId } });
      const verified = await prisma.adapter.count({ where: { chainId, verified: true } });
      const deprecated = await prisma.adapter.count({ where: { chainId, deprecated: true } });

      const byType = await prisma.adapter.groupBy({
        by: ['adapterType'],
        where: { chainId },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          total,
          verified,
          deprecated,
          unverified: total - verified - deprecated,
          byType: byType.map((g) => ({ type: g.adapterType, count: g._count })),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapter stats');
      next(error);
    }
  }

  /**
   * POST /adapters/upsert
   * Upsert adapter from indexer event (internal use)
   */
  async upsertAdapter(data: {
    adapterAddress: string;
    adapterType: AdapterType;
    registeredBy: string;
    chainId?: number;
    verified?: boolean;
    deprecated?: boolean;
    auditReference?: string;
  }): Promise<void> {
    try {
      const chainId = data.chainId || DEFAULT_CHAIN_ID;
      
      await prisma.adapter.upsert({
        where: { adapterAddress_chainId: { adapterAddress: data.adapterAddress, chainId } },
        update: {
          verified: data.verified ?? false,
          deprecated: data.deprecated ?? false,
          auditReference: data.auditReference,
        },
        create: {
          adapterAddress: data.adapterAddress,
          chainId,
          adapterType: data.adapterType,
          registeredBy: data.registeredBy,
          verified: data.verified ?? false,
          deprecated: data.deprecated ?? false,
          auditReference: data.auditReference,
        },
      });
    } catch (error) {
      logger.error({ err: error, address: data.adapterAddress }, 'Error upserting adapter');
    }
  }
}