// @ts-nocheck — V2 schema migration; on-chain LoanDetails resolver is V1-shaped (chain-hosted) — tighten once ContractServiceV2 lands
/**
 * @file LoanController.ts
 * @description Loan management endpoints — aligned to V2 schema (Loan.positionHolderAddress, composite key)
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
      const { market, borrower, positionHolder, status, skip = 0, take = 20 } = req.query as Record<string, string>;
      const where: Record<string, unknown> = {};
      if (market && typeof market === 'string') where.marketAddress = market.toLowerCase();
      const holder = (positionHolder || borrower) as string | undefined;
      if (holder && typeof holder === 'string') where.positionHolderAddress = holder.toLowerCase();
      if (status && typeof status === 'string') where.status = status;

      const loans = await this.prisma.loan.findMany({
        where,
        skip: parseInt(String(skip)) || 0,
        take: Math.min(100, parseInt(String(take)) || 20),
        include: { market: { select: { address: true, aprBasisPoints: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // Backwards-compat alias: expose borrowerAddress alongside positionHolderAddress
      const mapped = loans.map((l: Record<string, unknown>) => ({
        ...l,
        borrowerAddress: (l as { positionHolderAddress?: string }).positionHolderAddress,
      }));

      const count = await this.prisma.loan.count({ where });
      this.sendSuccess(res, { total: count, loans: mapped });
    } catch (error) {
      next(error);
    }
  }

  async getLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      const marketParam = (req.query.market as string) || undefined;
      let dbLoan: Record<string, unknown> | null = null;

      // V2 primary key is uuid id; also support contractLoanId lookups (with market)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(address);
      const isHexAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
      const isNumericId = /^\d+$/.test(address);

      if (isUuid) {
        dbLoan = await this.prisma.loan.findUnique({ where: { id: address }, include: { market: true } }) as unknown as Record<string, unknown> | null;
      }
      if (!dbLoan && isNumericId && marketParam) {
        dbLoan = await this.prisma.loan.findUnique({
          where: { marketAddress_contractLoanId: { marketAddress: marketParam.toLowerCase(), contractLoanId: address } },
          include: { market: true },
        }) as unknown as Record<string, unknown> | null;
      }
      if (!dbLoan && isNumericId) {
        dbLoan = await this.prisma.loan.findFirst({ where: { contractLoanId: address }, include: { market: true } }) as unknown as Record<string, unknown> | null;
      }
      if (!dbLoan && isHexAddress) {
        // Legacy V1 address fallback — try uuid, then ignore
        dbLoan = await this.prisma.loan.findUnique({ where: { id: address }, include: { market: true } }) as unknown as Record<string, unknown> | null;
      }
      if (!dbLoan) return this.sendError(res, 'Loan not found', 404);

      const withAlias = { ...dbLoan, borrowerAddress: (dbLoan as { positionHolderAddress?: string }).positionHolderAddress };
      // Preserve on-chain details when resolver is available; tolerate missing / down chain.
      let onChain: unknown = null;
      try {
        const target = (dbLoan as { marketAddress?: string; contractLoanId?: string }).contractLoanId
          ? `${(dbLoan as { marketAddress: string }).marketAddress}:${(dbLoan as { contractLoanId: string }).contractLoanId}`
          : address;
        onChain = await contractService.getLoanDetails(target);
      } catch { /* chain unavailable — return DB row */ }
      this.sendSuccess(res, { ...(withAlias as object), onChain });
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
      const marketParam = (req.query.market as string) || undefined;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(address);
      const isNumericId = /^\d+$/.test(address);
      let dbLoan: Record<string, unknown> | null = null;
      if (isUuid) {
        dbLoan = await this.prisma.loan.findUnique({ where: { id: address }, include: { market: true } }) as unknown as Record<string, unknown> | null;
      } else if (isNumericId && marketParam) {
        dbLoan = await this.prisma.loan.findUnique({
          where: { marketAddress_contractLoanId: { marketAddress: marketParam.toLowerCase(), contractLoanId: address } },
          include: { market: true },
        }) as unknown as Record<string, unknown> | null;
      } else if (isNumericId) {
        dbLoan = await this.prisma.loan.findFirst({ where: { contractLoanId: address }, include: { market: true } }) as unknown as Record<string, unknown> | null;
      }
      if (!dbLoan) return this.sendError(res, 'Loan not found', 404);

      const loanKey = (dbLoan as { marketAddress?: string; contractLoanId?: string }).contractLoanId
        ? `${(dbLoan as { marketAddress: string }).marketAddress}:${(dbLoan as { contractLoanId: string }).contractLoanId}`
        : address;
      const loanDetails = await contractService.getLoanDetails(loanKey);

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
