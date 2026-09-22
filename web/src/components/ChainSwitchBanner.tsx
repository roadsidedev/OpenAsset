'use client';

/**
 * Global one-click network-switch banner. Normally never appears: chain
 * alignment happens automatically (silent for embedded wallets, the wallet's
 * own switch popup for external ones). It only shows as a FALLBACK when that
 * automatic switch was rejected or unavailable, giving the user a one-click
 * retry from any screen.
 */

import { useAccount } from 'wagmi';
import { useSwitchChain } from 'wagmi';
import { ArrowsClockwise, X, GlobeHemisphereWest } from '@phosphor-icons/react';
import { useChainSwitchStore } from '@/store/useChainSwitchStore';
import { getChainLabel } from '@/lib/chainLabels';

export function ChainSwitchBanner() {
  const { targetChainId, reason, clear } = useChainSwitchStore();
  const { chainId: currentChainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();

  if (!targetChainId || targetChainId === currentChainId) return null;

  const label = getChainLabel(targetChainId);

  const handleSwitch = async () => {
    try {
      await switchChainAsync({ chainId: targetChainId });
      clear();
    } catch {
      // Keep the banner up — user may cancel the wallet popup.
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-ice-300/40 dark:border-ice-400/25 bg-card p-4 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ice-400/15 text-ice-600 dark:text-ice-300">
          <GlobeHemisphereWest className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {reason || 'Different network required'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Switch to <span className="font-semibold text-foreground">{label}</span> to continue.
          </p>
          <button
            type="button"
            onClick={handleSwitch}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-ice-300 dark:bg-ice-400 px-4 py-2 text-xs font-bold text-slate-900 transition-premium hover:bg-ice-400 dark:hover:bg-ice-300 active-press disabled:opacity-60"
          >
            {isPending ? (
              <>
                <ArrowsClockwise className="h-3.5 w-3.5 animate-spin" />
                Switching…
              </>
            ) : (
              <>
                <ArrowsClockwise className="h-3.5 w-3.5" />
                Switch to {label}
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dismiss network switch prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
