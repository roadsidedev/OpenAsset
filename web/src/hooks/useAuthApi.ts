import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { fetchFromApi } from '../lib/api';

const AUTH_STORAGE_KEY = 'redchips_auth_token';

export function useAuthApi() {
  const { user, authenticated } = usePrivy();
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

  const signLoginMessage = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address || !wallets.length) return;
    
    setIsSigning(true);
    try {
      const wallet = wallets.find((w) => w.address === user.wallet?.address);
      if (!wallet) throw new Error('Wallet not found');

      // 1. Fetch nonce from backend
      const { nonce } = await fetchFromApi(`/auth/nonce/${user.wallet.address}`);

      const message = `Login to RedChips: ${nonce}`;
      const signature = await wallet.sign(message);
      
      // 2. Login to get JWT
      const { token } = await fetchFromApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          address: user.wallet.address,
          signature
        })
      });

      localStorage.setItem(AUTH_STORAGE_KEY, token);
      setAuthToken(token);
    } catch (err) {
      console.error('Failed to sign message:', err);
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

  return {
    isAuthenticated: !!authToken,
    isSigning,
    signLoginMessage,
    authenticatedFetch,
    logout,
    user
  };
}