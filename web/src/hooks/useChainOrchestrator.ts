'use client';

/**
 * @file useChainOrchestrator.ts
 * @description Dynamic chain handling. `ensureChain(target)` resolves the
 * wallet onto the target chain with the least user friction:
 * - Embedded (Privy) wallets: silent background switch, no popup.
 * - External wallets (MetaMask etc): the wallet's own switch popup fires
 *   automatically — there is no in-app "switch network" button to click.
 *   Only if the user rejects the popup does the global ChainSwitchBanner
 *   appear as a one-click fallback.
 *
 * Live chain state is read from the wagmi store (getAccount) rather than
 * React state, so a switch that just resolved is immediately visible to
 * callers that continue straight into a write.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useAccount, useSwitchChain, useChainId, useConfig } from 'wagmi';
import { getAccount } from '@wagmi/core';
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
  const config = useConfig();
  const { walletType, switchChain: switchEmbeddedChain } = useSession();
  const { switchChainAsync } = useSwitchChain();
  const { request: requestBanner, clear: clearBanner } = useChainSwitchStore();
  /** In-flight switch, shared so a mount nudge and a CTA click never open two popups. */
  const switchInFlight = useRef<Promise<boolean> | null>(null);

  const activeChainId = walletChainId ?? currentChainId ?? null;

  /** Store-fresh chain id — reflects a just-completed switch before React re-renders. */
  const readLiveChain = useCallback(
    (): number | null => getAccount(config).chainId ?? activeChainId,
    [config, activeChainId],
  );

  const performSwitch = useCallback(
    async (targetChainId: number): Promise<boolean> => {
      try {
        // Privy's embedded wallet owns the provider. Calling wagmi's generic
        // switcher alone can leave the Privy provider on the old chain, so use
        // its native method first; success is authoritative for embedded.
        if (walletType === 'embedded' && switchEmbeddedChain) {
          await switchEmbeddedChain(targetChainId);
          return true;
        }
        // External wallet: this pops the wallet's own network-switch dialog —
        // no in-app button involved. Wallets that already track the target
        // chain switch instantly with no popup at all.
        await switchChainAsync({ chainId: targetChainId });
        if (getAccount(config).chainId === targetChainId) return true;
        // Store may take a beat to settle on slower connectors.
        await new Promise((resolve) => setTimeout(resolve, 250));
        return getAccount(config).chainId === targetChainId;
      } catch {
        return false;
      }
    },
    [walletType, switchEmbeddedChain, switchChainAsync, config],
  );

  const ensureChain = useCallback(
    async (targetChainId: number | null | undefined, reason?: string): Promise<EnsureChainResult> => {
      if (!targetChainId) return { ok: true };
      if (readLiveChain() === targetChainId) {
        clearBanner();
        return { ok: true };
      }

      // A switch is already running (e.g. page-mount nudge racing a CTA
      // click). Wait for it instead of opening a second popup.
      const inFlight = switchInFlight.current;
      if (inFlight) {
        await inFlight;
        if (readLiveChain() === targetChainId) {
          clearBanner();
          return { ok: true };
        }
      }

      const attempt = performSwitch(targetChainId);
      switchInFlight.current = attempt;
      const ok = await attempt;
      if (switchInFlight.current === attempt) switchInFlight.current = null;

      if (ok) {
        clearBanner();
        return { ok: true };
      }

      // Rejected or unavailable: fall back to the one-click banner.
      requestBanner(targetChainId, reason ?? `Switch to ${getChainLabel(targetChainId)}`);
      return { ok: false, needsUser: true, targetChainId, reason };
    },
    [readLiveChain, performSwitch, clearBanner, requestBanner],
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
      !targetChainId || readLiveChain() === targetChainId,
    [readLiveChain],
  );

  const chainLabel = useMemo(() => getChainLabel(activeChainId), [activeChainId]);

  return { ensureChain, nudgeChain, isOnChain, activeChainId, chainLabel, walletType };
}
