import { create } from 'zustand';

/**
 * Global chain-switch request state. Any code path that needs the wallet on a
 * different chain sets a request; the ChainSwitchBanner (mounted app-wide)
 * renders the one-click resolution UI and clears it.
 */
interface ChainSwitchState {
  targetChainId: number | null;
  /** Short human reason shown in the banner, e.g. "AAPL lives on Robinhood Chain". */
  reason: string | null;
  request: (targetChainId: number, reason?: string) => void;
  clear: () => void;
}

export const useChainSwitchStore = create<ChainSwitchState>((set) => ({
  targetChainId: null,
  reason: null,
  request: (targetChainId, reason) => set({ targetChainId, reason: reason ?? null }),
  clear: () => set({ targetChainId: null, reason: null }),
}));
