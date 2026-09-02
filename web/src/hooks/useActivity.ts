/**
 * @file useActivity.ts
 * @description Hook for fetching user activity events from backend API,
 * merged with the local tx trail (instant, pre-indexer entries). Backend
 * events are canonical; local trail entries whose txHash appears in the
 * backend result are pruned so nothing double-reports.
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/apiClient';
import { useTxTrail, txTrailToActivityEvents } from '@/store/useTxTrail';

export interface ActivityEvent {
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

export const useActivity = (address: string | undefined, { enabled = true }: { enabled?: boolean } = {}) => {
  const trailEntries = useTxTrail((s) => s.entries);
  const pruneMerged = useTxTrail((s) => s.pruneMerged);

  const query = useQuery<{ events: ActivityEvent[]; total: number }>({
    queryKey: ['activity', address],
    queryFn: async () => {
      if (!address) return { events: [], total: 0 };
      const data = await apiFetchJson<{ events: ActivityEvent[]; total: number }>(`/api/v1/users/${address}/activity`);
      return data ?? { events: [], total: 0 };
    },
    enabled: !!address && address.startsWith('0x') && enabled,
    staleTime: 30000,
    gcTime: 300000,
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
