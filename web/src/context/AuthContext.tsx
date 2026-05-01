"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { fetchFromApi } from '../lib/api';

const AUTH_STORAGE_KEY = 'redchips_auth_token';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, authenticated, logout: privyLogout, ready } = usePrivy();
  const { wallets } = useWallets();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Load auth token from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      setAuthToken(stored);
    }
  }, []);

  // Sync: If Privy has finished initializing and says not authenticated, clear our local state.
  // We only clear when `ready` is true to avoid wiping the token during page refresh while
  // Privy is still loading.
  useEffect(() => {
    if (ready && !authenticated && authToken) {
      setAuthToken(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [ready, authenticated, authToken]);

  const signLoginMessage = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address || !wallets.length) return;
    
    setIsSigning(true);
    try {
      // FIX: Case-insensitive comparison for wallet address
      const userAddress = user.wallet.address.toLowerCase();
      const wallet = wallets.find((w) => w.address.toLowerCase() === userAddress);
      
      if (!wallet) {
        console.error('Wallet not found for address:', userAddress);
        // Fallback: use the first connected wallet if specific match fails 
        // (sometimes Privy user object lags behind wallet list)
        const fallbackWallet = wallets[0];
        if (!fallbackWallet) throw new Error('No wallets connected');
        
        // warn if mismatch
        if (fallbackWallet.address.toLowerCase() !== userAddress) {
             console.warn('Using fallback wallet:', fallbackWallet.address);
        }
      }

      const activeWallet = wallet || wallets[0];

      // 1. Fetch nonce from backend
      const { nonce } = await fetchFromApi(`/auth/nonce/${activeWallet.address}`);

      const message = `Login to RedChips: ${nonce}`;
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
      // Optional: Show toast error
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
    // We don't call privyLogout() here to separate concerns, 
    // but the effect above will clean up if Privy logs out.
  }, []);

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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
