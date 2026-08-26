/**
 * Unified API client for market discovery
 * - tries backend via NEXT_PUBLIC_API_URL (or rewrites)
 * - treats 404/missing backend as empty, not error
 * - provides timeout + graceful fallback
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function buildUrl(path: string): string {
  // path should start with /
  if (API_BASE) {
    // NEXT_PUBLIC_API_URL already includes /api/v1 per DEPLOY.md
    // Ensure no double /api/v1
    if (path.startsWith('/api/v1')) {
      const suffix = path.replace(/^\/api\/v1/, '');
      return `${API_BASE}${suffix}`;
    }
    if (path.startsWith('/api/')) {
      const suffix = path.replace(/^\/api/, '');
      return `${API_BASE}${suffix}`;
    }
    return `${API_BASE}${path}`;
  }
  // relative — will hit Next.js rewrites if configured
  return path;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = buildUrl(path);
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
    if (res.ok) {
      const json = await res.json();
      // backend wraps in { success, data }
      return (json?.data ?? json) as T;
    }
    if (res.status === 404) {
      // treat missing route/backend not deployed as soft empty
      return null;
    }
    // other non-ok: soft null to allow fallback
    return null;
  } catch {
    return null;
  }
}

export function isBackendConfigured(): boolean {
  return !!API_BASE;
}
