import { z } from 'zod';
import { AssetType, OracleType } from '@prisma/client';

export const createMarketSchema = z.object({
  address: z.string(),
  lpAddress: z.string(),
  collateralAsset: z.string(),
  assetType: z.nativeEnum(AssetType),
  ltvBasisPoints: z.number().int().min(0).max(10000),
  aprBasisPoints: z.number().int().min(0).max(10000),
  durationSeconds: z.number().int().positive(),
  gracePeriodHours: z.number().int().nonnegative(),
  enableHealthFactor: z.boolean(),
  healthFactorThreshold: z.number().int().optional(),
  oracleType: z.nativeEnum(OracleType),
  primaryOracle: z.string(),
  twapPeriodSeconds: z.number().int().positive(),
  circuitBreakerEnabled: z.boolean(),
  pauseThresholdBps: z.number().int().optional(),
  lookbackPeriodSeconds: z.number().int().optional(),
  resumeThresholdBps: z.number().int().optional(),
  cooldownSeconds: z.number().int().optional(),
});
