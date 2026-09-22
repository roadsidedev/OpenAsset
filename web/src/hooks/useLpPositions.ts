/**
 * @file useLpPositions.ts
 * @description Batched on-chain LP share reads for a wallet across active markets.
 * Groups by chain and uses viem multicall to avoid N+1 RPC in render.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { type Address, parseAbi, isAddress } from 'viem';
import { LENDING_MARKET_ABI, LP_TOKEN_ABI } from '@/lib/contractAbis';
import { createChainClient, DEFAULT_CHAIN_ID } from '@/lib/chains';
import { useMarkets, type Market } from '@/hooks/useMarkets';

export interface LpPosition {
  market: Market;
  lpToken: Address;
  userShares: bigint;
  totalSupply: bigint;
  totalLiquidity: bigint;
  /** Claimable lending-asset value: shares × totalLiquidity / totalSupply */
  claimable: bigint;
  /** Share of pool in basis points (0–10000). */
  shareOfPoolBps: number;
}

async function fetchPositionsForChain(
  markets: Market[],
  userAddress: Address,
  chainId: number,
): Promise<LpPosition[]> {
  const client = createChainClient(chainId);
  if (!client || markets.length === 0) return [];

  const marketAbi = parseAbi([...LENDING_MARKET_ABI]);
  const lpAbi = parseAbi([...LP_TOKEN_ABI]);

  const lpResults = await client.multicall({
    contracts: markets.map((m) => ({
      address: m.marketAddress as Address,
      abi: marketAbi,
      functionName: 'lpToken' as const,
    })),
    allowFailure: true,
  });

  const withLp: Array<{ market: Market; lpToken: Address }> = [];
  for (let i = 0; i < markets.length; i++) {
    const r = lpResults[i];
    if (r.status !== 'success') continue;
    const lp = r.result as Address;
    if (!lp || !isAddress(lp) || lp === '0x0000000000000000000000000000000000000000') continue;
    withLp.push({ market: markets[i], lpToken: lp });
  }
  if (withLp.length === 0) return [];

  const contracts = withLp.flatMap((row) => [
    {
      address: row.lpToken,
      abi: lpAbi,
      functionName: 'balanceOf' as const,
      args: [userAddress] as const,
    },
    {
      address: row.lpToken,
      abi: lpAbi,
      functionName: 'totalSupply' as const,
    },
    {
      address: row.market.marketAddress as Address,
      abi: marketAbi,
      functionName: 'totalLiquidity' as const,
    },
  ]);

  const reads = await client.multicall({
    contracts: contracts as any,
    allowFailure: true,
  });

  const positions: LpPosition[] = [];
  for (let i = 0; i < withLp.length; i++) {
    const base = i * 3;
    const sharesR = reads[base];
    const supplyR = reads[base + 1];
    const liqR = reads[base + 2];
    if (sharesR.status !== 'success' || supplyR.status !== 'success' || liqR.status !== 'success') {
      continue;
    }
    const userShares = sharesR.result as bigint;
    if (userShares <= 0n) continue;
    const totalSupply = supplyR.result as bigint;
    const totalLiquidity = liqR.result as bigint;
    const claimable =
      totalSupply > 0n && totalLiquidity > 0n
        ? (userShares * totalLiquidity) / totalSupply
        : 0n;
    const shareOfPoolBps =
      totalSupply > 0n ? Number((userShares * 10000n) / totalSupply) : 0;
    positions.push({
      market: withLp[i].market,
      lpToken: withLp[i].lpToken,
      userShares,
      totalSupply,
      totalLiquidity,
      claimable,
      shareOfPoolBps,
    });
  }
  return positions;
}

async function fetchAllLpPositions(
  markets: Market[],
  userAddress: string,
): Promise<LpPosition[]> {
  if (!userAddress || !isAddress(userAddress)) return [];
  const active = markets.filter((m) => m.active !== false && isAddress(m.marketAddress));
  if (active.length === 0) return [];

  const byChain = new Map<number, Market[]>();
  for (const m of active) {
    const chainId = m.chainId ?? DEFAULT_CHAIN_ID;
    const list = byChain.get(chainId) ?? [];
    list.push(m);
    byChain.set(chainId, list);
  }

  const batches = await Promise.all(
    Array.from(byChain.entries()).map(([chainId, ms]) =>
      fetchPositionsForChain(ms, userAddress as Address, chainId).catch(() => [] as LpPosition[]),
    ),
  );
  return batches.flat();
}

/**
 * Returns LP positions for `address` across the unified markets list.
 * Cached via TanStack Query; refreshes every 30s while mounted.
 */
export function useLpPositions(address: string | undefined) {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets(0, 100);
  const markets = marketsData?.markets ?? [];

  const query = useQuery<LpPosition[]>({
    queryKey: [
      'lpPositions',
      address?.toLowerCase(),
      markets.map((m) => m.marketAddress.toLowerCase()).sort().join(','),
    ],
    queryFn: () => fetchAllLpPositions(markets, address!),
    enabled: !!address && address.startsWith('0x') && markets.length > 0,
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const positions = query.data ?? [];
  const totalClaimable = positions.reduce((sum, p) => sum + p.claimable, 0n);

  return {
    positions,
    totalClaimable,
    isLoading: marketsLoading || (!!address && query.isLoading),
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
