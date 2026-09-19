/**
 * In-memory JWT denylist for logout/revocation.
 * Entries are keyed by jti and expire at the token's exp (ms).
 * Suitable for single-process deployments; replace with Redis/DB for multi-instance.
 */

const denylist = new Map<string, number>();

const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [jti, expMs] of denylist) {
      if (expMs <= now) denylist.delete(jti);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

export function revokeToken(jti: string, expSeconds: number): void {
  if (!jti) return;
  const expMs = expSeconds * 1000;
  if (expMs <= Date.now()) return;
  denylist.set(jti, expMs);
  ensureCleanup();
}

export function isTokenRevoked(jti: string | undefined): boolean {
  if (!jti) return false;
  const expMs = denylist.get(jti);
  if (expMs === undefined) return false;
  if (expMs <= Date.now()) {
    denylist.delete(jti);
    return false;
  }
  return true;
}

/** Test helper */
export function clearDenylist(): void {
  denylist.clear();
}

/** Test helper */
export function denylistSize(): number {
  return denylist.size;
}
