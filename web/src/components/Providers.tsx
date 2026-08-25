'use client';

import * as React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { WagmiProvider as WagmiProviderBase } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { config, supportedChains } from '../lib/wagmi';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from './ThemeProvider';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId || appId === 'test-app-id' || appId.startsWith('clp000')) {
  return (
    <ThemeProvider>
      <WagmiProviderBase config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </QueryClientProvider>
      </WagmiProviderBase>
    </ThemeProvider>
  );
  }

  return (
    <ThemeProvider>
      <PrivyProvider
        appId={appId}
        config={{
          supportedChains: [...supportedChains],
          appearance: {
            theme: 'dark',
            accentColor: '#A8D8FF',
            logo: undefined,
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </WagmiProvider>
        </QueryClientProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </PrivyProvider>
    </ThemeProvider>
  );
}
