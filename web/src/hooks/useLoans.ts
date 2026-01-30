/**
 * @file useLoans.ts
 * @description Hook for querying loans from backend API
 */

import { useQuery } from '@tanstack/react-query';

export interface Loan {
  address: string;
  marketAddress: string;
  borrowerAddress: string;
  collateralAmount: string;
  principal: string;
  startTime: string;
  expiryTime: string;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED';
  createdAt: string;
}

interface QueryParams {
  market?: string;
  borrower?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export const useLoans = (params: QueryParams = {}) => {
  const searchParams = new URLSearchParams();
  if (params.market) searchParams.append('market', params.market);
  if (params.borrower) searchParams.append('borrower', params.borrower);
  if (params.status) searchParams.append('status', params.status);
  if (params.skip) searchParams.append('skip', String(params.skip));
  if (params.take) searchParams.append('take', String(params.take));

  return useQuery<{ total: number; loans: Loan[] }>({
    queryKey: ['loans', params],
    queryFn: async () => {
      const res = await fetch(`/api/loans?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch loans');
      return res.json().then((r) => r.data);
    },
    staleTime: 30000,
  });
};

export const useLoan = (address: string) => {
  return useQuery<Loan>({
    queryKey: ['loan', address],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${address}`);
      if (!res.ok) throw new Error('Failed to fetch loan');
      return res.json().then((r) => r.data);
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 30000,
  });
};

export const useLoanLiquidationStatus = (address: string) => {
  return useQuery({
    queryKey: ['liquidationStatus', address],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${address}/liquidation-status`);
      if (!res.ok) throw new Error('Failed to fetch liquidation status');
      return res.json().then((r) => r.data);
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 10000,
  });
};
