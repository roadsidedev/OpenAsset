'use client';

/**
 * Per-alert-bucket preferences backing the Account "Config & Rules" toggles.
 * GET/PUT /users/:address (JWT-authenticated via AuthContext). Optimistic
 * updates with rollback on failure; defaults to enabled (matches backend).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export interface UserAlertPrefs {
  alertLiquidation: boolean;
  alertMarketPaused: boolean;
}

const DEFAULT_PREFS: UserAlertPrefs = { alertLiquidation: true, alertMarketPaused: true };

function normalize(user: Partial<UserAlertPrefs> | null | undefined): UserAlertPrefs {
  return {
    alertLiquidation: user?.alertLiquidation !== false,
    alertMarketPaused: user?.alertMarketPaused !== false,
  };
}

export function useUserAlertPrefs(address?: string | null) {
  const { isAuthenticated, authenticatedFetch, ensureAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const normalizedAddress = address?.toLowerCase() ?? '';
  const key = ['userAlertPrefs', normalizedAddress];
  const enabled = isAuthenticated && !!normalizedAddress;

  const query = useQuery<UserAlertPrefs>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const user = await authenticatedFetch(`/users/${normalizedAddress}`);
      return normalize(user);
    },
    staleTime: 60_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<UserAlertPrefs>) => {
      // Identity already established by the page gate; this only ensures the
      // API-capability JWT exists (one wallet signature on the FIRST save,
      // silent no-op afterwards) — works for embedded and external wallets.
      const ok = await ensureAuthenticated();
      if (!ok) throw new Error('SIGNATURE_REQUIRED');
      const updated = await authenticatedFetch(`/users/${normalizedAddress}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      return normalize(updated);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      // queryClient is untyped in this build; narrow manually.
      const prev = queryClient.getQueryData(key) as UserAlertPrefs | undefined;
      queryClient.setQueryData(key, (cur: UserAlertPrefs | undefined) => ({ ...normalize(cur ?? prev ?? DEFAULT_PREFS), ...patch }));
      return { prev };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
      // Signature rejection already toasted inside signLoginMessage — don't double-toast.
      if (!(err instanceof Error && err.message.includes('SIGNATURE_REQUIRED'))) {
        toast.error('Could not save alert preference. Please try again.');
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    /** Server truth (or defaults before first load). */
    prefs: query.data ?? DEFAULT_PREFS,
    isLoading: query.isLoading,
    /** Signed in but prefs could not be loaded (backend down / error). */
    isUnavailable: enabled && query.isError,
    isSaving: mutation.isPending,
    isAuthenticated,
    setPref: (patch: Partial<UserAlertPrefs>) => mutation.mutate(patch),
  };
}
