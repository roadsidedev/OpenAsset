/**
 * @file identity.ts
 * @description Pure helpers for deriving a user's display identity: profile
 * picture and display name from linked Privy social accounts (twitter,
 * google, farcaster, …), plus a deterministic generated identicon for
 * wallet-only users. No React, no network — fully testable.
 */

export interface SocialIdentity {
  /** Profile picture URL from a linked social account, if any. */
  avatarUrl?: string;
  /** Best-effort display name (handle, real name, or email). */
  displayName?: string;
  /** 'social' when the avatar comes from a linked account, else 'none'. */
  source: 'social' | 'none';
}

interface LinkedAccountLike {
  profilePictureUrl?: string;
  profilePicture?: string;
  pfpUrl?: string;
  name?: string;
  username?: string;
  email?: string;
}

export interface PrivyUserLike {
  pfpUrl?: string;
  email?: { address?: string } | null;
  twitter?: LinkedAccountLike | null;
  google?: LinkedAccountLike | null;
  farcaster?: LinkedAccountLike | null;
  discord?: LinkedAccountLike | null;
  github?: LinkedAccountLike | null;
  apple?: LinkedAccountLike | null;
  tiktok?: LinkedAccountLike | null;
  instagram?: LinkedAccountLike | null;
  [key: string]: unknown;
}

function avatarOf(a?: LinkedAccountLike | null): string | undefined {
  return a?.profilePictureUrl ?? a?.profilePicture ?? a?.pfpUrl ?? undefined;
}

function nameOf(a?: LinkedAccountLike | null): string | undefined {
  return a?.name ?? a?.username ?? a?.email ?? undefined;
}

/** Ordered by typical avatar quality/coverage. */
const LINKED_ACCOUNT_KEYS = [
  'twitter',
  'google',
  'farcaster',
  'discord',
  'github',
  'apple',
  'tiktok',
  'instagram',
] as const;

/**
 * Resolve the identity visible in the UI from a Privy user object.
 *
 * Avatar priority: Privy's aggregated pfpUrl first, then linked accounts in
 * LINKED_ACCOUNT_KEYS order. Display name prefers handles/real names and
 * falls back to the email address. Email-only logins legitimately have no
 * picture — callers render a generated identicon for those.
 */
export function resolveSocialIdentity(user?: PrivyUserLike | null): SocialIdentity {
  if (!user) return { source: 'none' };

  let avatarUrl = user.pfpUrl || undefined;
  let displayName: string | undefined;

  for (const key of LINKED_ACCOUNT_KEYS) {
    const account = user[key] as LinkedAccountLike | null | undefined;
    if (!account) continue;
    if (!avatarUrl) avatarUrl = avatarOf(account);
    if (!displayName) displayName = nameOf(account);
  }

  if (!displayName && user.email?.address) displayName = user.email.address;

  return {
    avatarUrl: avatarUrl || undefined,
    displayName: displayName || undefined,
    source: avatarUrl ? 'social' : 'none',
  };
}

// ─── Identicon generation ─────────────────────────────────────────────────────

/** Curated two-stop gradients — tuned for legibility on light and dark. */
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#6366f1', '#22d3ee'],
  ['#8b5cf6', '#ec4899'],
  ['#0ea5e9', '#22c55e'],
  ['#f59e0b', '#ef4444'],
  ['#14b8a6', '#3b82f6'],
  ['#a855f7', '#6366f1'],
  ['#10b981', '#84cc16'],
  ['#f43f5e', '#f97316'],
  ['#06b6d4', '#8b5cf6'],
  ['#84cc16', '#0ea5e9'],
  ['#ec4899', '#f59e0b'],
  ['#3b82f6', '#14b8a6'],
];

export interface Identicon {
  from: string;
  to: string;
  /** 15 bits: 3 columns × 5 rows, rendered mirrored into a 5×5 grid. */
  cells: boolean[];
}

/** FNV-1a 32-bit — tiny, fast, and deterministic across runs. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic identicon seed for a wallet address. Same address always
 * yields the same gradient + pattern; different addresses virtually never
 * collide on both. Missing address renders a neutral placeholder.
 */
export function identiconForAddress(address?: string | null): Identicon {
  if (!address) {
    return { from: '#94a3b8', to: '#64748b', cells: new Array<boolean>(15).fill(false) };
  }
  const h = fnv1a(address.toLowerCase());
  const [from, to] = PALETTE[h % PALETTE.length];
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(((h >>> i) & 1) === 1);
  // Guarantee a non-empty pattern so small avatars never render blank.
  if (!cells.some(Boolean)) cells[7] = true;
  return { from, to, cells };
}
