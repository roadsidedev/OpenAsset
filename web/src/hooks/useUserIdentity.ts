'use client';

/**
 * @file useUserIdentity.ts
 * @description Derives the signed-in user's display identity: profile picture
 * and display name from linked Privy social accounts (twitter, google,
 * farcaster, …), with the wallet address exposed for the deterministic
 * identicon fallback used by wallet-only users.
 */

import { useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSession } from '@/context/SessionContext';
import { resolveSocialIdentity, type PrivyUserLike } from '@/lib/identity';

export interface UserIdentity {
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  walletType: 'embedded' | 'external' | null;
  avatarUrl: string | null;
  displayName: string | null;
  /** True when the avatar comes from a linked social account (twitter/google/…). */
  hasSocialAvatar: boolean;
}

export function useUserIdentity(): UserIdentity {
  const { user, authenticated, ready } = usePrivy();
  const session = useSession();

  const identity = useMemo(
    () => resolveSocialIdentity(user as PrivyUserLike | null | undefined),
    [user],
  );

  return {
    ready: ready !== false && session.ready,
    authenticated: !!authenticated || session.isAuthenticated,
    address: session.address,
    walletType: session.walletType,
    avatarUrl: identity.avatarUrl ?? null,
    displayName: identity.displayName ?? null,
    hasSocialAvatar: identity.source === 'social',
  };
}
