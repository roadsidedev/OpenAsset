import { http, createConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
} as const;

export const supportedChains = [mainnet, polygon, optimism, arbitrum, base, sepolia, baseSepolia] as const;

export const config = createConfig({
  chains: supportedChains,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});
