// @ts-nocheck — LEGACY V1 controller, needs update for V2 schema
/**
 * @file LoanController.ts
 * @description Production-grade loan management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { BaseController } from './BaseController';
import { contractService } from '../services/web3/ContractService';
import { PrismaClient } from '@prisma/client';

export class LoanController extends BaseController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  async getLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { market, borrower, status, skip = 0, take = 20 } = req.query;
      const where: any = {};
      if (market && typeof market === 'string') where.marketAddress = market;
      if (borrower && typeof borrower === 'string') where.borrowerAddress = borrower.toLowerCase();
      if (status && typeof status === 'string') where.status = status;

      const loans = await this.prisma.loan.findMany({
        where,
        skip: parseInt(String(skip)) || 0,
        take: Math.min(100, parseInt(String(take)) || 20),
        include: { market: { select: { address: true, aprBasisPoints: true } } },
      });

      const count = await this.prisma.loan.count({ where });
      this.sendSuccess(res, { total: count, loans });
    } catch (error) {
      next(error);
    }
  }

  async getLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return this.sendError(res, 'Invalid loan address', 400);
      }

      const dbLoan = await this.prisma.loan.findUnique({
        where: { address },
        include: { market: true },
      });

      if (!dbLoan) return this.sendError(res, 'Loan not found', 404);

      const loanDetails = await contractService.getLoanDetails(address);
      this.sendSuccess(res, { ...dbLoan, onChain: loanDetails });
    } catch (error) {
      next(error);
    }
  }

  async estimateLoanRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const market = req.params.market as string;
      const { collateralAmount, tokenId, erc1155Amount, desiredPrincipal } = req.body;

      if (!market.match(/^0x[a-fA-F0-9]{40}$/)) {
        return this.sendError(res, 'Invalid market address', 400);
      }

      if (!collateralAmount || !desiredPrincipal) {
        return this.sendError(res, 'Missing collateral or principal', 400);
      }

      const marketInfo = await contractService.getMarketInfo(market);
      const { available } = await contractService.getMarketLiquidity(market);

      if (BigInt(available) < BigInt(desiredPrincipal)) {
        return this.sendSuccess(res, {
          canRequest: false,
          reason: 'Insufficient liquidity',
          available,
        });
      }

      const estimatedInterest = this._calculateInterest(
        desiredPrincipal,
        marketInfo.aprBps,
        marketInfo.durationSeconds
      );

      this.sendSuccess(res, {
        market,
        marketInfo,
        parameters: { collateralAmount, tokenId: tokenId || 0, erc1155Amount: erc1155Amount || 0, desiredPrincipal },
        availableLiquidity: available,
        estimatedInterest,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLiquidationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return this.sendError(res, 'Invalid loan address', 400);
      }

      const loanDetails = await contractService.getLoanDetails(address);
      const dbLoan = await this.prisma.loan.findUnique({ where: { address }, include: { market: true } });

      if (!dbLoan) return this.sendError(res, 'Loan not found', 404);

      const healthFactor = BigInt(loanDetails.healthFactor);
      const threshold = BigInt(dbLoan.market.healthFactorThreshold || 12000);
      const isLiquidatable = healthFactor < threshold;
      const isExpired = Date.now() > loanDetails.expiryTime * 1000;

      this.sendSuccess(res, {
        address,
        healthFactor: loanDetails.healthFactor,
        healthFactorThreshold: threshold.toString(),
        isLiquidatable: isLiquidatable || isExpired,
        isExpired,
        principal: loanDetails.principal,
        accruedInterest: loanDetails.accruedInterest,
        totalDebt: (BigInt(loanDetails.principal) + BigInt(loanDetails.accruedInterest)).toString(),
      });
    } catch (error) {
      next(error);
    }
  }

  private _calculateInterest(principal: string, aprBps: number, durationSeconds: number): string {
    const principalBig = BigInt(principal);
    const aprRate = BigInt(aprBps);
    const daysInYear = BigInt(365 * 86400);
    const denominator = BigInt(10000);
    const interest = (principalBig * aprRate * BigInt(durationSeconds)) / (denominator * daysInYear);
    return interest.toString();
  }
}
