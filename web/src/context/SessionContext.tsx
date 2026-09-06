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
  connectorName?: string,
  privyAuthenticated = false,
): WalletType {
  if (!address && !isConnected) return null;
  const active = wallets.find(
    (w) => address && w.address?.toLowerCase() === address.toLowerCase(),
  );
  if (active) {
    if (
      active.walletClientType === 'privy' ||
      active.connectorType === 'embedded' ||
      active.walletClientType === 'privy-embedded' ||
      active.connectorType === 'privy'
    )
      return 'embedded';
    return 'external';
  }
  // Privy connector names/ids vary across versions ('io.privy.wallet',
  // 'privy', 'Privy'). If the active wagmi connector looks like Privy — or
  // Privy reports authenticated and wagmi has no external wallet — treat as
  // embedded so silent chain-switching works instead of the banner path.
  if (connectorName && connectorName.toLowerCase().includes('privy')) return 'embedded';
  if (privyAuthenticated && (isConnected || address)) return 'embedded';
  if (isConnected || address) return 'external';
  return null;
}

export function SessionProviderPrivy({ children }: { children: React.ReactNode }) {
  const { address, chainId, isConnected, connector } = useAccount();
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

  // Auto-bridge: Privy authenticated but wagmi not connected yet.
  // Retries as the connector list populates — the Privy connector only appears
  // after Privy initialises, so a "seen" key must NOT be recorded when the
  // connector is still missing (otherwise the bridge never retries and the UI
  // keeps asking logged-in users to sign in).
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (isConnected || connectPending) return;
    if (!privyAddress) return;

    const key = privyAddress.toLowerCase();
    if (attemptedRef.current === key) return;

    const privyConnector =
      connectors.find((c) => c.id === 'io.privy.wallet' || c.id === 'privy' || c.id === 'privy-wallet') ||
      connectors.find((c) => c.name?.toLowerCase().includes('privy'));

    // Connector list not populated yet — retry on the next connectors change.
    if (!privyConnector) return;

    attemptedRef.current = key;

    connectAsync({ connector: privyConnector }).catch(() => {
      // Allow one retry per address on genuine failure: the connector list may
      // have rotated. Silent — the UI falls back to an explicit connect CTA.
      attemptedRef.current = null;
    });
  }, [ready, authenticated, privyAddress, isConnected, connectPending, connectors, connectAsync]);

  const state = useMemo<SessionState>(
    () => ({
      ready,
      isAuthenticated: authenticated || isConnected || !!address || !!privyAddress,
      address: address ?? privyAddress ?? null,
      walletType: resolveWalletType(
        wallets,
        address ?? privyAddress ?? null,
        isConnected,
        connector?.name ?? connector?.id,
        authenticated,
      ),
      chainId: chainId ?? (embeddedWallet?.chainId ? Number(embeddedWallet.chainId) : null),
      isConnected: isConnected || !!address || !!privyAddress,
      switchChain: embeddedWallet?.switchChain,
    }),
    [ready, authenticated, address, privyAddress, wallets, embeddedWallet, isConnected, chainId, connector],
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
