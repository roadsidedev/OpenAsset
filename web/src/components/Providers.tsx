'use client';

import * as React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { WagmiProvider as WagmiProviderBase } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { config, supportedChains } from '../lib/wagmi';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from './ThemeProvider';

const queryClient = new QueryClient();

function ThemedPrivyProvider({ children, appId }: { children: React.ReactNode; appId: string }) {
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
          <AuthProvider>{children}</AuthProvider>
        </WagmiProvider>
      </QueryClientProvider>
      <Toaster position="bottom-right" richColors closeButton theme={theme as any} />
    </PrivyProvider>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors closeButton theme={theme as any} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId || appId === 'test-app-id' || appId.startsWith('clp000')) {
  return (
    <ThemeProvider>
      <WagmiProviderBase config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
          <ThemedToaster />
        </QueryClientProvider>
      </WagmiProviderBase>
    </ThemeProvider>
  );
  }

  return (
    <ThemeProvider>
      <ThemedPrivyProvider appId={appId}>{children}</ThemedPrivyProvider>
    </ThemeProvider>
  );
}
