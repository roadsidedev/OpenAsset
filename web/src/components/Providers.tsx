'use client';

import * as React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { WagmiProvider as WagmiProviderBase } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { config, supportedChains } from '../lib/wagmi';
import { AuthProvider } from '../context/AuthContext';
import { SessionProviderPrivy, SessionProviderPlain } from '../context/SessionContext';
import { ChainSwitchBanner } from './ChainSwitchBanner';
import { ThemeProvider, useTheme } from './ThemeProvider';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        // Backward compatible: focus-return refreshes stale data so pages feel
        // alive without manual reloads. staleTime above prevents hot loops.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 1 },
    },
  });
}

/**
 * Eagerly creates the wagmi public client for every supported chain once, at
 * app mount. wagmi v3 creates clients lazily; a chain-switching render (e.g.
 * opening a market on a chain other than the wallet's) could trigger a
 * synchronous client-construction throw inside usePublicClient's getSnapshot,
 * landing on the global error boundary ("Connection failed" until refresh).
 * Pre-warming moves that construction off the render path entirely.
 */
function ChainPrewarmer() {
  React.useEffect(() => {
    for (const chain of supportedChains) {
      try {
        getPublicClient(config, { chainId: chain.id });
      } catch {
        // Transport for this chain may be unavailable — discovery handles it.
      }
    }
  }, []);
  return null;
}

function ThemedPrivyProvider({ children, appId, queryClient }: { children: React.ReactNode; appId: string; queryClient: InstanceType<typeof QueryClient> }) {
  const { theme } = useTheme();
  return (
    <PrivyProvider
      appId={appId}
      config={{
        supportedChains: [...supportedChains],
        appearance: {
          theme: theme === 'dark' ? 'dark' : 'light',
          accentColor: '#A8D8FF',
          logo: undefined,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <ChainPrewarmer />
          <SessionProviderPrivy>
            <AuthProvider>{children}</AuthProvider>
          </SessionProviderPrivy>
          <ChainSwitchBanner />
        </WagmiProvider>
      </QueryClientProvider>
      <Toaster position="bottom-right" richColors closeButton theme={theme as "dark" | "light"} />
    </PrivyProvider>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors closeButton theme={theme as "dark" | "light"} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [queryClient] = React.useState(() => makeQueryClient());

  if (!appId || appId === 'test-app-id' || appId.startsWith('clp000')) {
  return (
    <ThemeProvider>
      <WagmiProviderBase config={config}>
        <ChainPrewarmer />
        <QueryClientProvider client={queryClient}>
          <SessionProviderPlain>
            {children}
          </SessionProviderPlain>
          <ChainSwitchBanner />
          <ThemedToaster />
        </QueryClientProvider>
      </WagmiProviderBase>
    </ThemeProvider>
  );
  }

  return (
    <ThemeProvider>
      <ThemedPrivyProvider appId={appId} queryClient={queryClient}>{children}</ThemedPrivyProvider>
    </ThemeProvider>
  );
}
