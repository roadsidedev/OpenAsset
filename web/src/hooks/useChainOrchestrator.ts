'use client';

/**
 * @file useChainOrchestrator.ts
 * @description Dynamic chain handling. `ensureChain(target)` resolves the
 * wallet onto the target chain with the least user friction:
 * - Embedded (Privy) wallets: silent background switch, no popup.
 * - External wallets (MetaMask etc): sets a global banner request via
 *   useChainSwitchStore for one-click resolution (wallet popup required).
 *
 * Every write path in useContractInteraction calls ensureChain as the last
 * line of defense; typed ChainMismatchError carries UI metadata.
 */

import { useCallback, useMemo } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { useSession } from '@/context/SessionContext';
import { useChainSwitchStore } from '@/store/useChainSwitchStore';
import { getChainLabel } from '@/lib/chainLabels';

export class ChainMismatchError extends Error {
  readonly targetChainId: number;
  readonly currentChainId: number | null;
  readonly reason?: string;
  constructor(targetChainId: number, currentChainId: number | null, reason?: string) {
    super(
      `Wallet is on chain ${currentChainId ?? 'unknown'} but chain ${targetChainId} is required${reason ? ` (${reason})` : ''}.`,
    );
    this.name = 'ChainMismatchError';
    this.targetChainId = targetChainId;
    this.currentChainId = currentChainId;
    this.reason = reason;
  }
}

export type EnsureChainResult =
  | { ok: true }
  | { ok: false; needsUser: true; targetChainId: number; reason?: string };

export function useChainOrchestrator() {
  const { chainId: walletChainId } = useAccount();
  const currentChainId = useChainId();
  const { walletType, switchChain: switchEmbeddedChain } = useSession();
  const { switchChainAsync } = useSwitchChain();
  const { request: requestBanner, clear: clearBanner } = useChainSwitchStore();

  const activeChainId = walletChainId ?? currentChainId ?? null;

  const ensureChain = useCallback(
    async (targetChainId: number | null | undefined, reason?: string): Promise<EnsureChainResult> => {
      if (!targetChainId) return { ok: true };
      const current = activeChainId;
      if (current === targetChainId) {
        clearBanner();
        return { ok: true };
      }

      if (walletType === 'embedded') {
        // Privy's embedded wallet owns the provider. Calling wagmi's generic
        // switcher alone can leave the Privy provider on the old chain and the
        // UI stuck on the same switch prompt, so use its native method first.
        try {
          if (switchEmbeddedChain) {
            await switchEmbeddedChain(targetChainId);
          } else {
            await switchChainAsync({ chainId: targetChainId });
          }
          clearBanner();
          return { ok: true };
        } catch {
          // Rare: embedded switch failed — fall through to banner.
        }
      }

      // External wallet: can't switch without a user-confirmed popup. Surface
      // the one-click banner and report back to the caller.
      requestBanner(targetChainId, reason);
      return { ok: false, needsUser: true, targetChainId, reason };
    },
    [activeChainId, walletType, switchEmbeddedChain, switchChainAsync, requestBanner, clearBanner],
  );

  /** Fire-and-forget nudge used on page mount / selection (never throws). */
  const nudgeChain = useCallback(
    (targetChainId: number | null | undefined, reason?: string) => {
      void ensureChain(targetChainId, reason);
    },
    [ensureChain],
  );

  const isOnChain = useCallback(
    (targetChainId: number | null | undefined) =>
      !targetChainId || activeChainId === targetChainId,
    [activeChainId],
  );

  const chainLabel = useMemo(() => getChainLabel(activeChainId), [activeChainId]);

  return { ensureChain, nudgeChain, isOnChain, activeChainId, chainLabel, walletType };
}
