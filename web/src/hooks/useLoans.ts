/**
 * @file useLoans.ts
 * @description Hook for querying loans from backend API
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/apiClient';

export interface Loan {
  id: string;
  address?: string;
  marketAddress: string;
  borrowerAddress: string;
  positionHolderAddress: string;
  contractLoanId: string;
  collateralAmount: string;
  principal: string;
  startTime: string;
  expiryTime: string;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED' | 'GRACE_PERIOD' | 'LIQUIDATION_CURE' | 'LIQUIDATION_SETTLING';
  createdAt: string;
}

interface QueryParams {
  market?: string;
  borrower?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export const useLoans = (params: QueryParams = {}, { enabled = true }: { enabled?: boolean } = {}) => {
  const searchParams = new URLSearchParams();
  if (params.market) searchParams.append('market', params.market);
  if (params.borrower) searchParams.append('borrower', params.borrower);
  if (params.status) searchParams.append('status', params.status);
  if (params.skip) searchParams.append('skip', String(params.skip));
  if (params.take) searchParams.append('take', String(params.take));

  return useQuery<{ total: number; loans: Loan[] }>({
    queryKey: ['loans', params],
    queryFn: async () => {
      const data = await apiFetchJson<{ total: number; loans: Loan[] }>(`/api/v1/loans?${searchParams.toString()}`);
      // graceful empty on 404/backend down — unified discovery should not error
      if (!data) return { total: 0, loans: [] };
      const raw = (data.loans ?? []) as unknown as Record<string, unknown>[];
      const loans = raw.map((l) => ({
        ...(l as object),
        borrowerAddress: ((l as { borrowerAddress?: string; positionHolderAddress?: string }).borrowerAddress
          ?? (l as { positionHolderAddress?: string }).positionHolderAddress
          ?? '') as string,
        positionHolderAddress: ((l as { positionHolderAddress?: string; borrowerAddress?: string }).positionHolderAddress
          ?? (l as { borrowerAddress?: string }).borrowerAddress
          ?? '') as string,
      })) as unknown as Loan[];
      return { total: data.total ?? loans.length, loans };
    },
    enabled,
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
};

export const useLoan = (address: string) => {
  return useQuery<Loan>({
    queryKey: ['loan', address],
    queryFn: async () => {
      const data = await apiFetchJson<Loan>(`/api/v1/loans/${address}`);
      if (!data) throw new Error('Loan not found');
      return data;
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
  });
};

export const useLoanLiquidationStatus = (address: string) => {
  return useQuery({
    queryKey: ['liquidationStatus', address],
    queryFn: async () => {
      const data = await apiFetchJson<any>(`/api/v1/loans/${address}/liquidation-status`);
      if (!data) return null;
      return data;
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 10000,
    gcTime: 120000,
    retry: 1,
  });
};
