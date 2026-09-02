import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @file useTxTrail.ts
 * @description Local, per-user transaction trail recorded at the moment a tx is
 * confirmed on-chain. Gives the Account "Activity" tab instant, offline-accurate
 * entries that bridge the gap until the backend indexer derives the canonical
 * event (both are merged and deduped by txHash in the activity hook).
 */

export type TxTrailType =
  | 'MARKET_CREATED'
  | 'LOAN_REQUESTED'
  | 'LOAN_REPAID'
  | 'LIQUIDITY_DEPOSITED';

export interface TxTrailEntry {
  id: string;
  type: TxTrailType;
  txHash: string;
  chainId: number;
  address: string;
  timestamp: number;
  /** Human summary, e.g. "AAPLc market · 1,000 USDC liquidity". */
  summary: string;
  details: Record<string, string>;
}

interface TxTrailState {
  entries: TxTrailEntry[];
  record: (entry: Omit<TxTrailEntry, 'id' | 'timestamp'>) => void;
  /** Removes entries already represented by backend indexer events. */
  pruneMerged: (backendTxHashes: string[]) => void;
  clearForAddress: (address: string) => void;
}

const MAX_ENTRIES = 100;

export const useTxTrail = create<TxTrailState>()(
  persist(
    (set) => ({
      entries: [],
      record: (entry) =>
        set((state) => ({
          entries: [
            {
              ...entry,
              id: `${entry.txHash}-${entry.type}`,
              timestamp: Date.now(),
            },
            ...state.entries.filter((e) => e.id !== `${entry.txHash}-${entry.type}`),
          ].slice(0, MAX_ENTRIES),
        })),
      pruneMerged: (backendTxHashes) =>
        set((state) => {
          if (!backendTxHashes.length) return state;
          const seen = new Set(backendTxHashes.map((h) => h.toLowerCase()));
          const kept = state.entries.filter((e) => !seen.has(e.txHash.toLowerCase()));
          return kept.length === state.entries.length ? state : { entries: kept };
        }),
      clearForAddress: (address) =>
        set((state) => ({
          entries: state.entries.filter(
            (e) => e.address.toLowerCase() !== address.toLowerCase(),
          ),
        })),
    }),
    { name: 'openasset_tx_trail', version: 1 },
  ),
);

/** Activity-event shape-compatible projection for the activity UI. */
export function txTrailToActivityEvents(entries: TxTrailEntry[]): Array<{
  type: string;
  timestamp: string;
  details: Record<string, string>;
}> {
  return entries.map((e) => ({
    type: e.type,
    timestamp: new Date(e.timestamp).toISOString(),
    details: e.details,
  }));
}
