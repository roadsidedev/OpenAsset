/**
 * @file minDeposit.ts
 * @description Protocol minimum initial liquidity for market creators.
 *
 * Verified from contracts:
 * - MarketFactory.sol:40 — MIN_LIQUIDITY_USD = 1000e18, normalized to 18-decimal
 *   USD terms and validated on net liquidity after the 0.5% creation fee
 *   (_validateMinimumLiquidity, reverts with InsufficientInitialLiquidity).
 * - MarketFactoryV2.sol (deployed) only enforces initialLiquidity > 0, so the
 *   $1,000 protocol minimum is enforced client-side here — no contract change.
 */

export const MIN_INITIAL_LIQUIDITY_USD = 1000;

/** MarketFactoryV2.sol:39 — CREATION_FEE_BPS = 50 (0.5%). */
export const CREATION_FEE_BPS = 50;

export interface LiquidityValidation {
  ok: boolean;
  error?: string;
  minimum: number;
}

/**
 * Validates a user-entered liquidity amount (in lending-asset units, i.e. USD
 * for the stablecoin lending assets the protocol allowlists).
 */
export function validateInitialLiquidityUSD(value: string | number | null | undefined): LiquidityValidation {
  const minimum = MIN_INITIAL_LIQUIDITY_USD;
  const raw = typeof value === 'number' ? value : parseFloat(value ?? '');
  if (value === null || value === undefined || value === '' || !isFinite(raw) || raw <= 0) {
    return { ok: false, error: 'Initial liquidity is required.', minimum };
  }
  if (raw < minimum) {
    return {
      ok: false,
      error: `Minimum initial liquidity is $${minimum.toLocaleString()} — the protocol minimum for market creators.`,
      minimum,
    };
  }
  return { ok: true, minimum };
}

/** 0.5% creation fee preview, matching calculateCreationFee on-chain. */
export function calculateCreationFeeUsd(amountUsd: number): number {
  return (amountUsd * CREATION_FEE_BPS) / 10000;
}
