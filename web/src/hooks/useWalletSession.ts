'use client';

import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';

export function useWalletSession() {
  const auth = useAuth();
  const { address: wagmiAddress, chain, isConnected } = useAccount();
  const address = wagmiAddress || auth.walletAddress;
  const isSignedIn = Boolean(auth.isSignedIn || isConnected);
  const hasWallet = Boolean(address);

  return {
    address,
    isSignedIn,
    hasWallet,
    isReady: !auth.isLoading,
    chain,
    login: auth.login,
    connectWallet: auth.connectWallet,
    ensureWallet: auth.ensureWallet,
  };
}
