"use client";

/**
 * Backend JWT (SIWE-style nonce + wallet signature) for authenticated API
 * calls (PUT /users/:address, GET activity, …).
 *
 * Identity itself lives in SessionContext — this context never decides WHO
 * you are, only whether an API-capability token exists. Address and signing
 * both come from the session, so behavior is identical for Privy social
 * (embedded) logins, Privy-connected external wallets (MetaMask), and plain
 * wagmi connections. Use `ensureAuthenticated()` before authenticated calls:
 * it no-ops when a token exists and requests one signature when it doesn't.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { fetchFromApi } from '../lib/api';
import { useSession } from './SessionContext';

const AUTH_STORAGE_KEY = 'openasset_auth_token';

interface AuthContextType {
  /** True when a backend JWT is present (API capability, NOT identity). */
  isAuthenticated: boolean;
  isSigning: boolean;
  isLoading: boolean;
  /** Establish the JWT via one wallet signature. Resolves true on success. */
  signLoginMessage: () => Promise<boolean>;
  /** No-op success if JWT exists; otherwise signLoginMessage(). */
  ensureAuthenticated: () => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape varies per endpoint; callers narrow.
  authenticatedFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  logout: () => void;
  user: unknown;
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
  const session = useSession();
  const { address: sessionAddress, signMessage: sessionSignMessage } = session;
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Universal active address: whatever SessionContext resolved for the
  // connected wallet (Privy social, Privy external, or plain wagmi).
  const activeAddress = session.address?.toLowerCase() ?? null;

  // Load auth token from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      setAuthToken(stored);
    }
  }, []);

  // Session signed out (Privy logout / disconnect) → drop the API token too,
  // so backend auth can never outlive the visible session.
  useEffect(() => {
    if (session.ready && !session.isAuthenticated && authToken) {
      setAuthToken(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [session.ready, session.isAuthenticated, authToken]);

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

  const signLoginMessage = useCallback(async (): Promise<boolean> => {
    if (!sessionAddress || !sessionSignMessage) {
      toast.error('Connect a wallet to continue.');
      return false;
    }

    setIsSigning(true);
    try {
      const userAddress = sessionAddress;

      // 1. Fetch nonce from backend
      const { nonce } = await fetchFromApi(`/auth/nonce/${userAddress}`);

      const message = `Login to OpenAsset Market: ${nonce}`;
      const signature = await sessionSignMessage(message);

      // 2. Login to get JWT
      const { token } = await fetchFromApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          address: userAddress,
          signature
        })
      });

      localStorage.setItem(AUTH_STORAGE_KEY, token);
      setAuthToken(token);
      return true;
    } catch (err) {
      console.error('Failed to sign message:', err);
      toast.error('Failed to sign in. Please try again.');
      return false;
    } finally {
      setIsSigning(false);
    }
  }, [sessionAddress, sessionSignMessage]);

  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    if (authToken) return true;
    return signLoginMessage();
  }, [authToken, signLoginMessage]);

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

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated: !!authToken,
      isSigning,
      isLoading: !session.ready,
      signLoginMessage,
      ensureAuthenticated,
      authenticatedFetch,
      logout,
      user: null,
    }),
    [authToken, isSigning, session.ready, signLoginMessage, ensureAuthenticated, authenticatedFetch, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      isAuthenticated: false,
      isSigning: false,
      isLoading: false,
      signLoginMessage: async () => false,
      ensureAuthenticated: async () => false,
      authenticatedFetch: async () => null,
      logout: () => {},
      user: null,
    };
  }
  return context;
}
