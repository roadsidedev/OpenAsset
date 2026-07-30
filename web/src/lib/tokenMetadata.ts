'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { isAddress, getAddress } from 'viem';
import { parseAbi } from 'viem';

const ERC20_READ_ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
]);

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logoUri: string | null;
}

interface TokenInfo extends TokenMetadata {
  address: string;
  isValid: boolean;
  error: string | null;
}

const UNISWAP_TOKEN_LISTS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/Uniswap/token-lists/main/token-lists/src/tokens/mainnet.json',
  11155111: 'https://raw.githubusercontent.com/Uniswap/token-lists/main/token-lists/src/tokens/sepolia.json',
  84532: 'https://raw.githubusercontent.com/Uniswap/token-lists/main/token-lists/src/tokens/base.json',
};

const logoCache = new Map<string, string | null>();

async function fetchTokenListLogos(chainId: number): Promise<Map<string, string>> {
  const url = UNISWAP_TOKEN_LISTS[chainId];
  if (!url) return new Map();

  const cached = logoCache.get(`list:${chainId}`);
  if (cached !== undefined) {
    if (cached === null) return new Map();
    try {
      const parsed = JSON.parse(cached as string);
      return new Map(parsed.map((t: any) => [t.address.toLowerCase(), t.logoURI]));
    } catch {
      return new Map();
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logoCache.set(`list:${chainId}`, null);
      return new Map();
    }
    const data = await res.json();
    const tokens = data.tokens || [];
    const logoMap = new Map<string, string>();
    for (const token of tokens) {
      if (token.logoURI) {
        logoMap.set(token.address.toLowerCase(), token.logoURI);
      }
    }
    logoCache.set(`list:${chainId}`, JSON.stringify(tokens));
    return logoMap;
  } catch {
    logoCache.set(`list:${chainId}`, null);
    return new Map();
  }
}

function getLocalLogo(symbol: string): string | null {
  const known: Record<string, string> = {
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    DAI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
    WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    PEPE: 'https://assets.coingecko.com/coins/images/14261/small/pepe-token.jpeg',
  };
  return known[symbol.toUpperCase()] || null;
}

export function useTokenMetadata(address: string | undefined, chainId?: number) {
  const effectiveChainId = chainId || 84532;
  const publicClient = usePublicClient({ chainId: effectiveChainId });

  const enabled = !!address && isAddress(address) && !!publicClient;

  return useQuery<TokenInfo>({
    queryKey: ['tokenMetadata', address?.toLowerCase(), effectiveChainId],
    queryFn: async () => {
      if (!address || !publicClient) {
        return { address: address || '', isValid: false, name: '', symbol: '', decimals: 18, logoUri: null, error: 'No wallet connected' };
      }

      let checksumAddr: string;
      try {
        checksumAddr = getAddress(address);
      } catch {
        return { address, isValid: false, name: '', symbol: '', decimals: 18, logoUri: null, error: 'Invalid address format.' };
      }

      try {
        const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
          publicClient.readContract({ address: checksumAddr as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'name' }),
          publicClient.readContract({ address: checksumAddr as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'symbol' }),
          publicClient.readContract({ address: checksumAddr as `0x${string}`, abi: ERC20_READ_ABI, functionName: 'decimals' }),
        ]);

        const hasFailure = [nameResult, symbolResult, decimalsResult].some(r => r.status === 'rejected');
        if (hasFailure && nameResult.status === 'rejected' && symbolResult.status === 'rejected') {
          return {
            address: checksumAddr,
            isValid: false,
            name: '',
            symbol: '',
            decimals: 18,
            logoUri: null,
            error: 'Could not read token metadata. This may not be an ERC20 contract.',
          };
        }

        const name = nameResult.status === 'fulfilled' ? String(nameResult.value) : 'Unknown';
        const symbol = symbolResult.status === 'fulfilled' ? String(symbolResult.value) : '???';
        const decimals = decimalsResult.status === 'fulfilled' ? Number(decimalsResult.value) : 18;

        let logoUri: string | null = null;
        try {
          const logos = await fetchTokenListLogos(effectiveChainId);
          logoUri = logos.get(checksumAddr.toLowerCase()) || getLocalLogo(symbol);
        } catch {
          logoUri = getLocalLogo(symbol);
        }

        return {
          address: checksumAddr,
          isValid: true,
          name,
          symbol,
          decimals,
          logoUri,
          error: null,
        };
      } catch (err: any) {
        return {
          address: checksumAddr || address,
          isValid: false,
          name: '',
          symbol: '',
          decimals: 18,
          logoUri: null,
          error: err?.message?.includes('execution reverted')
            ? 'Could not read token metadata. This may not be an ERC20 contract.'
            : 'Failed to fetch token information.',
        };
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
