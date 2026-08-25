import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';

export const supportedChains = [base] as const;

export const config = createConfig({
  chains: supportedChains,
  transports: {
    [base.id]: http(),
  },
});
