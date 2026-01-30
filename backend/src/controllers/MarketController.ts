/**
 * @file MarketController.ts
 * @description Production-grade market management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { BaseController } from './BaseController';
import { contractService } from '../services/web3/ContractService';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

export class MarketController extends BaseController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  async getMarkets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { start = 0, count = 20 } = req.query;
      const startNum = Math.max(0, parseInt(String(start)) || 0);
      const countNum = Math.min(100, Math.max(1, parseInt(String(count)) || 20));

      const totalCount = await contractService.getMarketCount();
      const marketAddresses = await contractService.getMarkets(startNum, countNum);

      const markets = await Promise.all(
        marketAddresses.map(async (addr) => {
          try {
            const info = await contractService.getMarketInfo(addr);
            const liquidity = await contractService.getMarketLiquidity(addr);
            return { ...info, liquidity };
          } catch (err) {
            logger.warn({ error: err, market: addr }, 'Failed to fetch market');
            return null;
          }
        })
      );

      this.sendSuccess(res, {
        total: totalCount,
        start: startNum,
        count: markets.filter((m) => m !== null).length,
        markets: markets.filter((m) => m !== null),
      });
    } catch (error) {
      next(error);
    }
  }

  async getMarket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return this.sendError(res, 'Invalid market address', 400);
      }

      const info = await contractService.getMarketInfo(address);
      const liquidity = await contractService.getMarketLiquidity(address);
      const loanCount = await this.getMarketLoanCount(address);
      const dbMarket = await this.prisma.market.findUnique({ where: { address } });

      this.sendSuccess(res, { ...info, liquidity, loanCount, dbInfo: dbMarket });
    } catch (error) {
      next(error);
    }
  }

  async estimateMarketCreation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        collateralAsset,
        loanAsset,
        assetType,
        oracleType,
        primaryOracle,
        nftOracle,
        ltvBps,
        aprBps,
        durationSeconds,
        initialLiquidity,
      } = req.body;

      this._validateCreateMarketRequest({
        collateralAsset,
        loanAsset,
        assetType,
        oracleType,
        primaryOracle,
        nftOracle,
        ltvBps,
        aprBps,
        durationSeconds,
        initialLiquidity,
      });

      const { exists, market: existingMarket } = await contractService.checkMarketExists(
        collateralAsset,
        loanAsset,
        assetType,
        ltvBps,
        aprBps,
        durationSeconds
      );

      if (exists) {
        return this.sendSuccess(res, {
          exists: true,
          market: existingMarket,
          message: 'Market with this configuration already exists',
        });
      }

      const { estimatedGas } = await contractService.createMarket(
        {
          collateralAsset,
          loanAsset,
          assetType,
          oracleType,
          primaryOracle,
          nftOracle,
          ltvBps,
          aprBps,
          durationSeconds,
          initialLiquidity,
        },
        (req as any).user?.address || '0x'
      );

      this.sendSuccess(res, {
        estimatedGas,
        parameters: {
          collateralAsset,
          loanAsset,
          assetType,
          oracleType,
          ltvBps,
          aprBps,
          durationSeconds,
          initialLiquidity,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMarketLiquidity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return this.sendError(res, 'Invalid market address', 400);
      }

      const liquidity = await contractService.getMarketLiquidity(address);
      const positions = await this.prisma.liquidityPosition.findMany({
        where: { marketAddress: address },
      });

      this.sendSuccess(res, { onChain: liquidity, positionCount: positions.length, positions });
    } catch (error) {
      next(error);
    }
  }

  private async getMarketLoanCount(marketAddress: string): Promise<number> {
    const market = contractService.getLendingMarketContract(marketAddress);
    try {
      const count = await market.getLoanCount();
      return Number(count);
    } catch {
      return 0;
    }
  }

  private _validateCreateMarketRequest(data: any): void {
    const required = [
      'collateralAsset',
      'loanAsset',
      'assetType',
      'oracleType',
      'primaryOracle',
      'nftOracle',
      'ltvBps',
      'aprBps',
      'durationSeconds',
      'initialLiquidity',
    ];

    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}
