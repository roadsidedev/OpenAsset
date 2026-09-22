'use client';

/**
 * Aggregate account risk from the user's open loans: worst-case status via
 * the backend's per-loan liquidation-status endpoint (health factor vs the
 * market's own threshold, plus expiry). Replaces the old hardcoded
 * "Healthy" tiles on Account and Portfolio.
 */

import { useQuery } from '@tanstack/react-query';
import { useLoans } from './useLoans';
import { apiFetchJson } from '@/lib/apiClient';

export type AccountRiskLevel = 'healthy' | 'atRisk' | 'liquidatable' | 'unknown';

export interface AccountRisk {
  level: AccountRiskLevel;
  label: string;
  /** e.g. "HF 1.15 / 1.20" for the worst open loan. */
  detail?: string;
}

interface LiquidationStatus {
  healthFactor: string;
  healthFactorThreshold: string;
  isLiquidatable: boolean;
  isExpired?: boolean;
}

const HEALTHY: AccountRisk = { level: 'healthy', label: 'Healthy' };

export function useAccountRisk(address?: string | null) {
  const normalized = address?.toLowerCase() ?? '';
  const { data: loansData, isLoading: loansLoading } = useLoans(
    { borrower: address ?? undefined, status: 'ACTIVE' },
    { enabled: !!address }
  );

  const loans = loansData?.loans ?? [];
  const loanIds = loans.map((l) => l.id).join(',');

  const query = useQuery<AccountRisk>({
    queryKey: ['accountRisk', normalized, loanIds],
    enabled: !!normalized && !loansLoading,
    queryFn: async () => {
      if (loans.length === 0) return { ...HEALTHY, detail: 'No open loans' };

      const results = await Promise.all(
        loans.map((l) => apiFetchJson<LiquidationStatus>(`/api/v1/loans/${l.id}/liquidation-status`))
      );
      const valid = results.filter((r): r is LiquidationStatus => !!r && r.healthFactor !== undefined);
      if (valid.length === 0) return { level: 'unknown', label: 'Unavailable' };

      let level: AccountRiskLevel = 'healthy';
      let detail: string | undefined;

      for (const s of valid) {
        const hfRaw = Number(s.healthFactor);
        const thRaw = Number(s.healthFactorThreshold);
        const hf = hfRaw / 10000;
        const th = thRaw / 10000;
        // Health factor disabled on-chain returns uint256 max — never show the number.
        const line = hfRaw > 1e15 ? undefined : `HF ${hf.toFixed(2)} / ${th.toFixed(2)}`;

        if (s.isLiquidatable) {
          return { level: 'liquidatable', label: 'Liquidatable', detail: line ?? 'Expired or below threshold' };
        }
        if (line && hf < th * 1.2) {
          level = 'atRisk';
          detail = line;
        }
      }

      if (level === 'atRisk') return { level, label: 'At risk', detail };
      return HEALTHY;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const isLoading = !!address && (loansLoading || query.isLoading);
  const risk: AccountRisk = !address ? HEALTHY : query.data ?? (isLoading ? HEALTHY : HEALTHY);

  return { risk, isLoading };
}
