/**
 * @file useActivity.ts
 * @description User activity from backend, with on-chain fallback from markets and loan logs.
 */

import { useQuery } from '@tanstack/react-query';
import { parseAbi, type Address } from 'viem';
import { apiFetchJson } from '@/lib/apiClient';
import { useMarkets } from './useMarkets';
import { createChainClient } from '@/lib/chains';

export interface ActivityEvent {
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

function ownedMarkets(markets: { owner?: string; marketAddress: string; chainId?: number }[], address: string) {
  const lower = address.toLowerCase();
  return markets.filter((m) => m.owner && m.owner.toLowerCase() === lower);
}

async function fetchOnChainLoanActivity(address: string, marketAddresses: { marketAddress: string; chainId?: number }[]): Promise<ActivityEvent[]> {
  const grouped = new Map<number, string[]>();
  for (const market of marketAddresses) {
    const chainId = market.chainId;
    if (!chainId) continue;
    const list = grouped.get(chainId) || [];
    list.push(market.marketAddress);
    grouped.set(chainId, list);
  }

  const events: ActivityEvent[] = [];
  const loanCreated = parseAbi([
    'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateralAmount)',
  ])[0];
  const loanRepaid = parseAbi([
    'event LoanRepaid(uint256 indexed loanId, address indexed repayer, uint256 principal, uint256 interest)',
  ])[0];
  const liquidityDeposited = parseAbi([
    'event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares)',
  ])[0];

  for (const [chainId, addresses] of grouped) {
    const client = createChainClient(chainId);
    if (!client) continue;
    try {
      const [created, repaid, deposited] = await Promise.all([
        client.getLogs({
          address: addresses as Address[],
          event: loanCreated,
          args: { borrower: address as Address },
        }).catch(() => []),
        client.getLogs({
          address: addresses as Address[],
          event: loanRepaid,
          args: { repayer: address as Address },
        }).catch(() => []),
        client.getLogs({
          address: addresses as Address[],
          event: liquidityDeposited,
          args: { provider: address as Address },
        }).catch(() => []),
      ]);

      for (const log of created as any[]) {
        events.push({
          type: 'LOAN_ACTIVE',
          timestamp: new Date().toISOString(),
          details: {
            loanId: String(log.args?.loanId ?? ''),
            market: log.address,
          },
        });
      }
      for (const log of repaid as any[]) {
        events.push({
          type: 'LOAN_REPAID',
          timestamp: new Date().toISOString(),
          details: {
            loanId: String(log.args?.loanId ?? ''),
            market: log.address,
          },
        });
      }
      for (const log of deposited as any[]) {
        events.push({
          type: 'LIQUIDITY_DEPOSITED',
          timestamp: new Date().toISOString(),
          details: { market: log.address },
        });
      }
    } catch {
      /* RPC range limits — skip chain */
    }
  }
  return events;
}

export const useActivity = (address: string | undefined, { enabled = true }: { enabled?: boolean } = {}) => {
  const { data: marketsData } = useMarkets(0, 500);
  const markets = marketsData?.markets ?? [];

  return useQuery<{ events: ActivityEvent[]; total: number }>({
    queryKey: ['activity', address, markets.length],
    queryFn: async () => {
      if (!address) return { events: [], total: 0 };

      const data = await apiFetchJson<{ events: ActivityEvent[]; total: number }>(`/api/v1/users/${address}/activity`);
      if (data?.events?.length) {
        return { events: data.events, total: data.total ?? data.events.length };
      }

      const mine = ownedMarkets(markets, address);
      const events: ActivityEvent[] = mine.map((market) => ({
        type: 'MARKET_CREATED',
        timestamp: market.createdAt ? new Date(market.createdAt * 1000).toISOString() : new Date().toISOString(),
        details: { market: market.marketAddress },
      }));

      const loanEvents = await fetchOnChainLoanActivity(address, markets);
      events.push(...loanEvents);

      return { events, total: events.length };
    },
    enabled: !!address && address.startsWith('0x') && enabled,
    staleTime: 15000,
    gcTime: 300000,
    retry: 1,
    refetchInterval: 20000,
    placeholderData: (prev) => prev,
  });
};
