'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';

export function WalletSync() {
  const { wallets } = useWallets();
  const { address } = useAccount();
  const { setActiveWallet } = useSetActiveWallet();
  const synced = useRef('');

  useEffect(() => {
    const next = wallets?.[0];
    if (!next?.address || typeof setActiveWallet !== 'function') return;
    const nextAddr = String(next.address).toLowerCase();
    if (address && address.toLowerCase() === nextAddr) return;
    if (synced.current === nextAddr) return;
    synced.current = nextAddr;
    Promise.resolve(setActiveWallet(next)).catch(() => {
      synced.current = '';
    });
  }, [wallets, address, setActiveWallet]);

  return null;
}
