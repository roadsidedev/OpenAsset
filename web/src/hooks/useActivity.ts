/**
 * @file useActivity.ts
 * @description Hook for fetching user activity events from backend API
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/apiClient';

export interface ActivityEvent {
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

export const useActivity = (address: string | undefined, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery<{ events: ActivityEvent[]; total: number }>({
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
};
