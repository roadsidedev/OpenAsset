/**
 * @file useActivity.ts
 * @description Hook for fetching user activity events from backend API
 */

import { useQuery } from '@tanstack/react-query';

export interface ActivityEvent {
  type: string;
  timestamp: string;
  details: Record<string, string>;
}

export const useActivity = (address: string | undefined, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery<{ events: ActivityEvent[]; total: number }>({
    queryKey: ['activity', address],
    queryFn: async () => {
      if (!address) throw new Error('No address');
      const res = await fetch(`/api/v1/users/${address}/activity`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      const json = await res.json();
      return json.data;
    },
    enabled: !!address && address.startsWith('0x') && enabled,
    staleTime: 30000,
  });
};
