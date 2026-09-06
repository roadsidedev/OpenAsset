'use client';

/**
 * @file SessionContext.tsx
 * @description Unified session context reconciling Privy auth (social login +
 * embedded wallets) with wagmi tx capability.
 *
 * Root fix for "logged in via Privy but UI asks to Connect Wallet": the Privy
 * provider implementation auto-bridges — when Privy reports ready+authenticated
 * and wagmi has no account, it connects the Privy wagmi connector so
 * `useAccount()` populates for embedded-wallet users everywhere.
 *
 * Two provider implementations (Privy / plain-wagmi fallback) selected by the
 * provider tree in Providers.tsx — each calls its hooks unconditionally.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export type WalletType = 'embedded' | 'external' | null;

export interface SessionState {
  /** True once Privy (when present) has finished initializing. */
  ready: boolean;
  /** Signed-in at the auth layer (Privy) OR connected via wallet. */
  isAuthenticated: boolean;
  /** Wallet address usable for on-chain txs. */
  address: string | null;
  /** 'embedded' (Privy wallet) | 'external' (MetaMask etc) | null. */
  walletType: WalletType;
  /** Chain of the active wallet, if any. */
  chainId: number | null;
  /** wagmi-level connection state. */
  isConnected: boolean;
  /** Native Privy embedded-wallet chain switch, when available. */
  switchChain?: (chainId: number) => Promise<unknown>;
}

const SessionContext = createContext<SessionState | null>(null);

interface WalletLike {
  address?: string;
  walletClientType?: string;
  connectorType?: string;
  chainId?: number | string;
  switchChain?: (chainId: number) => Promise<unknown>;
}

function resolveWalletType(
  wallets: WalletLike[],
  address: string | null,
  isConnected: boolean,
): WalletType {
  if (!address && !isConnected) return null;
  const active = wallets.find(
    (w) => address && w.address?.toLowerCase() === address.toLowerCase(),
  );
  if (active) {
    if (active.walletClientType === 'privy' || active.connectorType === 'embedded') return 'embedded';
    return 'external';
  }
  if (isConnected || address) return 'external';
  return null;
}

export function SessionProviderPrivy({ children }: { children: React.ReactNode }) {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: connectPending } = useConnect();
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets() as { wallets: WalletLike[] };

  // Social logins can expose the embedded wallet through useWallets() before
  // Privy's legacy user.wallet field is populated.
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy' || wallet.connectorType === 'embedded',
  );
  const privyAddress = embeddedWallet?.address ?? (user?.wallet?.address as string | undefined) ?? null;
  const attemptedRef = useRef<string | null>(null);

  // Auto-bridge: Privy authenticated but wagmi not connected yet. Attempts once
  // per address; silent failure falls back to explicit connect CTAs.
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (isConnected || connectPending) return;
    if (!privyAddress) return;

    const key = privyAddress.toLowerCase();
    if (attemptedRef.current === key) return;

    const privyConnector =
      connectors.find((c) => c.id === 'io.privy.wallet' || c.id === 'privy' || c.id === 'privy-wallet') ||
      connectors.find((c) => c.name?.toLowerCase().includes('privy'));

    attemptedRef.current = key;
    if (!privyConnector) return;

    connectAsync({ connector: privyConnector }).catch(() => {
      // Silent — the UI falls back to an explicit connect CTA.
    });
  }, [ready, authenticated, privyAddress, isConnected, connectPending, connectors, connectAsync]);

  const state = useMemo<SessionState>(
    () => ({
      ready,
      isAuthenticated: authenticated || isConnected || !!address || !!privyAddress,
      address: address ?? privyAddress ?? null,
      walletType: resolveWalletType(wallets, address ?? privyAddress ?? null, isConnected),
      chainId: chainId ?? (embeddedWallet?.chainId ? Number(embeddedWallet.chainId) : null),
      isConnected: isConnected || !!address || !!privyAddress,
      switchChain: embeddedWallet?.switchChain,
    }),
    [ready, authenticated, address, privyAddress, wallets, embeddedWallet, isConnected, chainId],
  );

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function SessionProviderPlain({ children }: { children: React.ReactNode }) {
  const { address, chainId, isConnected } = useAccount();

  const state = useMemo<SessionState>(
    () => ({
      ready: true,
      isAuthenticated: isConnected || !!address,
      address: address ?? null,
      walletType: resolveWalletType([], address ?? null, isConnected),
      chainId: chainId ?? null,
      isConnected,
    }),
    [address, isConnected, chainId],
  );

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (ctx) return ctx;
  // Fallback (context not mounted — e.g. early render outside Providers): derive
  // from wagmi alone so callers never crash.
  return {
    ready: false,
    isAuthenticated: false,
    address: null,
    walletType: null,
    chainId: null,
    isConnected: false,
    switchChain: undefined,
  };
}
