"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { fetchFromApi } from '../lib/api';

const AUTH_STORAGE_KEY = 'openasset_auth_token';

interface AuthContextType {
  isAuthenticated: boolean;
  isSigning: boolean;
  isLoading: boolean;
  signLoginMessage: () => Promise<void>;
  authenticatedFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  logout: () => void;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decode JWT payload without verifying (client-side address binding check only). */
function decodeJwtAddress(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return typeof json.address === 'string' ? json.address.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const activeAddress = useMemo(() => {
    const fromUser = user?.wallet?.address?.toLowerCase();
    if (fromUser) return fromUser;
    return null;
  }, [user?.wallet?.address]);

  // Load auth token from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      setAuthToken(stored);
    }
  }, []);

  // Sync: If Privy has finished initializing and says not authenticated, clear our local state.
  useEffect(() => {
    if (ready && !authenticated && authToken) {
      setAuthToken(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [ready, authenticated, authToken]);

  // On wallet change / mount: if JWT address !== active address, clear token and require re-login
  useEffect(() => {
    if (!authToken || !activeAddress) return;
    const jwtAddress = decodeJwtAddress(authToken);
    if (jwtAddress && jwtAddress !== activeAddress) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthToken(null);
      toast.message('Wallet changed — please sign in again.');
    }
  }, [authToken, activeAddress]);

  const signLoginMessage = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address || !wallets.length) return;

    setIsSigning(true);
    try {
      const userAddress = user.wallet.address.toLowerCase();
      const wallet = wallets.find((w) => w.address.toLowerCase() === userAddress);

      if (!wallet) {
        // Active address exists but is not in the connected wallets list — do NOT fall back to wallets[0]
        console.error('Wallet not found for active address:', userAddress);
        toast.error('Connected wallet does not match your active address. Switch wallets and try again.');
        return;
      }

      const activeWallet = wallet;

      // 1. Fetch nonce from backend
      const { nonce } = await fetchFromApi(`/auth/nonce/${activeWallet.address}`);

      const message = `Login to OpenAsset Market: ${nonce}`;
      const signature = await activeWallet.sign(message);

      // 2. Login to get JWT
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
    const token = authToken || localStorage.getItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    // Best-effort server-side revocation
    if (token) {
      fetchFromApi('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [authToken]);

  const value = {
    isAuthenticated: !!authToken,
    isSigning,
    isLoading: !ready,
    signLoginMessage,
    authenticatedFetch,
    logout,
    user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      isAuthenticated: false,
      isSigning: false,
      isLoading: false,
      signLoginMessage: async () => {},
      authenticatedFetch: async () => null,
      logout: () => {},
      user: null,
    };
  }
  return context;
}
