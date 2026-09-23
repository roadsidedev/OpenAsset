"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTxTrail } from "@/store/useTxTrail";

/**
 * Central TxTrail → React Query bridge. When any transaction confirmation is
 * recorded (deposit, withdraw, borrow, repay, market created, adapter
 * registered), invalidate every derived read family so dashboard tiles, earn
 * positions, portfolio, markets, activity, and risk all refetch immediately
 * instead of each call site manually poking a partial subset of keys.
 *
 * Renders null; mount once inside AppShell.
 */
const RELEVANT_QUERY_KEYS = [
  "activity",
  "lpPositions",
  "loans",
  "loan",
  "liquidationStatus",
  "accountRisk",
  "markets",
  "market",
  "marketLiquidity",
  "platformStats",
  "protocolStats",
] as const;

export function TxTrailBridge() {
  const queryClient = useQueryClient();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Baseline the persisted trail so history loaded from localStorage never
    // triggers a burst of invalidations on mount — only NEW confirmations do.
    lastIdRef.current = useTxTrail.getState().entries[0]?.id ?? null;

    const unsubscribe = useTxTrail.subscribe((state) => {
      const top = state.entries[0];
      if (!top || top.id === lastIdRef.current) return;
      lastIdRef.current = top.id;
      for (const key of RELEVANT_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  return null;
}
