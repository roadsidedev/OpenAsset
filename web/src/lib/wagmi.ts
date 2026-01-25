import { http, createConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
});
