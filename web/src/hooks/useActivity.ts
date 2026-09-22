/**
 * @file useActivity.ts
 * @description Hook for fetching user activity events from backend API,
 * merged with the local tx trail (instant, pre-indexer entries). Backend
 * events are canonical; local trail entries whose txHash appears in the
 * backend result are pruned so nothing double-reports.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useTxTrail, txTrailToActivityEvents } from '@/store/useTxTrail';

export interface ActivityEvent {
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

export const useActivity = (address: string | undefined, { enabled = true }: { enabled?: boolean } = {}) => {
  const trailEntries = useTxTrail((s) => s.entries);
  const pruneMerged = useTxTrail((s) => s.pruneMerged);
  const { isAuthenticated: hasJwt, ensureAuthenticated, authenticatedFetch } = useAuth();
  // Ask for a signature at most once per mount: background refetches (15s)
  // must never re-prompt after a rejection.
  const ensureAttemptedRef = useRef(false);

  const query = useQuery<{ events: ActivityEvent[]; total: number }>({
    queryKey: ['activity', address, hasJwt],
    queryFn: async () => {
      if (!address) return { events: [], total: 0 };
      if (!hasJwt) {
        // GET /users/:address/activity is requireAuth — without a JWT this
        // would 401 silently. Establish it ONCE (wallet signature), then use
        // the Bearer fetch. If declined/skipped, fall back to the local trail.
        if (!ensureAttemptedRef.current) {
          ensureAttemptedRef.current = true;
          const ok = await ensureAuthenticated();
          if (ok) {
            const data = await authenticatedFetch(`/users/${address}/activity`);
            return (data ?? { events: [], total: 0 }) as { events: ActivityEvent[]; total: number };
          }
        }
        return { events: [], total: 0 };
      }
      const data = await authenticatedFetch(`/users/${address}/activity`);
      return (data ?? { events: [], total: 0 }) as { events: ActivityEvent[]; total: number };
    },
    enabled: !!address && address.startsWith('0x') && enabled,
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: hasJwt ? 15_000 : false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const userEntries = useMemo(
    () => (address ? trailEntries.filter((e) => e.address.toLowerCase() === address.toLowerCase()) : []),
    [trailEntries, address],
  );

  // Prune trail entries the indexer has already derived (dedup by txHash).
  useEffect(() => {
    const backend = query.data?.events ?? [];
    if (!backend.length || !userEntries.length) return;
    const hashes: string[] = [];
    for (const ev of backend) {
      const hash = ev.details?.txHash || ev.details?.transactionHash || ev.details?.tx;
      if (hash) hashes.push(hash);
    }
    if (hashes.length) pruneMerged(hashes);
  }, [query.data, userEntries.length, pruneMerged]);

  const events = useMemo<ActivityEvent[]>(() => {
    const backend = query.data?.events ?? [];
    const backendHashes = new Set(
      backend
        .map((ev) => (ev.details?.txHash || ev.details?.transactionHash || ev.details?.tx || '').toLowerCase())
        .filter(Boolean),
    );
    const localOnly = txTrailToActivityEvents(userEntries).filter(
      (ev) => !backendHashes.has((ev.details?.txHash || '').toLowerCase()),
    );
    return [...localOnly, ...backend].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [query.data, userEntries]);

  return {
    ...query,
    events,
    total: events.length,
  };
};
