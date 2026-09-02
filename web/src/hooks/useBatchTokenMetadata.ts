'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { isAddress, getAddress } from 'viem';
import { parseAbi } from 'viem';
import { createChainClient } from '@/lib/chains';
import { getBrandLogoUrl } from '@/lib/brandLogos';

const ERC20_READ_ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
]);

export interface BatchTokenInfo {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoUri: string | null;
  isValid: boolean;
}

const TOKEN_LIST_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/Uniswap/token-lists/main/token-lists/src/tokens/mainnet.json',
  11155111: 'https://raw.githubusercontent.com/Uniswap/token-lists/main/token-lists/src/tokens/sepolia.json',
  84532: 'https://tokens.coingecko.com/base/all.json',
  8453: 'https://tokens.coingecko.com/base/all.json',
};

const logoMapCache = new Map<number, Map<string, string>>();

async function getLogoMap(chainId: number): Promise<Map<string, string>> {
  if (logoMapCache.has(chainId)) return logoMapCache.get(chainId)!;
  const url = TOKEN_LIST_LOGOS[chainId];
  if (!url) return new Map();
  try {
    const res = await fetch(url);
    if (!res.ok) return new Map();
    const data = await res.json();
    const tokens: any[] = Array.isArray(data) ? data : (data?.tokens || []);
    const m = new Map<string, string>();
    for (const t of tokens) {
      const logo = t.logoURI || t.image || t.logo;
      if (logo && t.address) m.set(t.address.toLowerCase(), logo);
    }
    logoMapCache.set(chainId, m);
    return m;
  } catch {
    return new Map();
  }
}

function localLogo(symbol: string): string | null {
  const known: Record<string, string> = {
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    DAI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
    WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    PEPE: 'https://assets.coingecko.com/coins/images/14261/small/pepe-token.jpeg',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  };
  const up = symbol.toUpperCase();
  if (known[up]) return known[up];
  return getBrandLogoUrl(symbol);
}

/**
 * Batch hook: fetches name/symbol/decimals/logo for many addresses on a single chain.
 * Uses the market's chainId, NOT wallet chain.
 * Deduplicates via queryKey and caps per address.
 */
export function useBatchTokenMetadata(addresses: string[], chainId: number | undefined) {
  const effectiveChainId = chainId ?? 84532;
  // Standalone client (not wagmi lazy per-chain) — chain-agnostic, never throws on render.
  const publicClient = useMemo(() => createChainClient(effectiveChainId), [effectiveChainId]);

  // Dedupe + valid addresses only
  const unique = Array.from(
    new Set(addresses.filter((a) => a && isAddress(a)).map((a) => a.toLowerCase()))
  );

  const queries = useQueries({
    queries: unique.map((addr) => ({
      queryKey: ['batchTokenMeta', addr, effectiveChainId],
      queryFn: async (): Promise<BatchTokenInfo> => {
        if (!publicClient) {
          return { address: addr, symbol: null, name: null, decimals: null, logoUri: null, isValid: false };
        }
        let checksum: string;
        try {
          checksum = getAddress(addr);
        } catch {
          return { address: addr, symbol: null, name: null, decimals: null, logoUri: null, isValid: false };
        }
        try {
          const [nameRes, symbolRes, decimalsRes] = await Promise.allSettled([
            publicClient.readContract({ address: checksum as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'name' }),
            publicClient.readContract({ address: checksum as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'symbol' }),
            publicClient.readContract({ address: checksum as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'decimals' }),
          ]);
          const symbol = symbolRes.status === 'fulfilled' ? String(symbolRes.value) : null;
          const name = nameRes.status === 'fulfilled' ? String(nameRes.value) : null;
          const decimals = decimalsRes.status === 'fulfilled' ? Number(decimalsRes.value) : null;
          if (!symbol && !name) {
            return { address: checksum, symbol: null, name: null, decimals, logoUri: null, isValid: false };
          }
          let logoUri: string | null = null;
          try {
            const map = await getLogoMap(effectiveChainId);
            logoUri = map.get(checksum.toLowerCase()) || (symbol ? localLogo(symbol) : null);
          } catch {
            logoUri = symbol ? localLogo(symbol) : null;
          }
          return { address: checksum, symbol, name, decimals, logoUri, isValid: true };
        } catch {
          return { address: checksum!, symbol: null, name: null, decimals: null, logoUri: null, isValid: false };
        }
      },
      enabled: !!publicClient && isAddress(addr as `0x${string}`),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: false,
    })),
  });

  // Build lookup map
  const map = new Map<string, BatchTokenInfo>();
  unique.forEach((addr, idx) => {
    const q = queries[idx];
    if (q?.data) map.set(addr.toLowerCase(), q.data);
    else if (q?.isError) map.set(addr.toLowerCase(), { address: addr, symbol: null, name: null, decimals: null, logoUri: null, isValid: false });
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isFetched = queries.every((q) => q.isFetched || q.isError || q.isPending === false);

  return { data: map, isLoading, isFetched, queries };
}
