"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { fetchFromApi } from '../lib/api';
import { WalletSync } from '../components/WalletSync';

const AUTH_STORAGE_KEY = 'openasset_auth_token';

interface AuthContextType {
  isAuthenticated: boolean;
  isSignedIn: boolean;
  walletAddress?: string;
  isSigning: boolean;
  isLoading: boolean;
  signLoginMessage: () => Promise<void>;
  authenticatedFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  login: () => Promise<void>;
  connectWallet: () => Promise<void>;
  ensureWallet: () => Promise<string | undefined>;
  logout: () => void;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const UNAUTHED: AuthContextType = {
  isAuthenticated: false,
  isSignedIn: false,
  walletAddress: undefined,
  isSigning: false,
  isLoading: false,
  signLoginMessage: async () => {},
  authenticatedFetch: async () => null,
  login: async () => {},
  connectWallet: async () => {},
  ensureWallet: async () => undefined,
  logout: () => {},
  user: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, authenticated, logout: privyLogout, ready, login: privyLogin, connectWallet: privyConnectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const walletAddress = wagmiAddress || user?.wallet?.address || wallets?.[0]?.address;

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      setAuthToken(stored);
    }
  }, []);

  useEffect(() => {
    if (ready && !authenticated && authToken) {
      setAuthToken(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [ready, authenticated, authToken]);

  const login = useCallback(async () => {
    if (typeof privyLogin === 'function') await privyLogin();
  }, [privyLogin]);

  const connectWallet = useCallback(async () => {
    if (typeof privyConnectWallet === 'function') await privyConnectWallet();
  }, [privyConnectWallet]);

  const ensureWallet = useCallback(async () => {
    if (walletAddress) return walletAddress;
    if (!authenticated) {
      await login();
      return undefined;
    }
    await connectWallet();
    return undefined;
  }, [walletAddress, authenticated, login, connectWallet]);

  const signLoginMessage = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address || !wallets.length) return;

    setIsSigning(true);
    try {
      const userAddress = user.wallet.address.toLowerCase();
      const wallet = wallets.find((w) => w.address.toLowerCase() === userAddress);

      if (!wallet) {
        const fallbackWallet = wallets[0];
        if (!fallbackWallet) throw new Error('No wallets connected');
      }

      const activeWallet = wallet || wallets[0];

      const { nonce } = await fetchFromApi(`/auth/nonce/${activeWallet.address}`);

      const message = `Login to OpenAsset Market: ${nonce}`;
      const signature = await activeWallet.sign(message);

      const { token } = await fetchFromApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          address: activeWallet.address,
          signature
        })
      });

      localStorage.setItem(AUTH_STORAGE_KEY, token);
      setAuthToken(token);
    } catch (err) {
      console.error('Failed to sign message:', err);
      toast.error('Failed to sign in. Please try again.');
    } finally {
      setIsSigning(false);
    }
  }, [authenticated, user, wallets]);

  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!authToken) {
      throw new Error('User not authenticated with backend');
    }

    return fetchFromApi(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`,
      },
    });
  }, [authToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated: !!authToken,
    isSignedIn: Boolean(authenticated || isConnected),
    walletAddress,
    isSigning,
    isLoading: !ready,
    signLoginMessage,
    authenticatedFetch,
    login,
    connectWallet,
    ensureWallet,
    logout,
    user
  }), [
    authToken,
    authenticated,
    isConnected,
    walletAddress,
    isSigning,
    ready,
    signLoginMessage,
    authenticatedFetch,
    login,
    connectWallet,
    ensureWallet,
    logout,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      <WalletSync />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return UNAUTHED;
  }
  return context;
}
