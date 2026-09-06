'use client';

/**
 * @file UserAvatar.tsx
 * @description Single-source avatar renderer. Shows the linked social profile
 * picture when available (Privy twitter/google/farcaster/…) and falls back to
 * a deterministic generated identicon for wallet-only users (or when the
 * remote image fails to load). Used by the navbar profile menu and the
 * account dashboard header.
 */

import { useId, useMemo, useState } from 'react';
import { identiconForAddress, type Identicon } from '@/lib/identity';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Wallet address — seeds the identicon fallback. */
  address?: string | null;
  /** Privy social profile picture URL; omit for the identicon. */
  avatarUrl?: string | null;
  className?: string;
  alt?: string;
}

export function UserAvatar({ address, avatarUrl, className, alt = 'Profile avatar' }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const identicon = useMemo(() => identiconForAddress(address), [address]);
  const showImage = !!avatarUrl && !failed;

  if (showImage) {
    // Plain <img> is the repo pattern for remote profile/logo images (see
    // TokenPreview) — next/image would require remotePatterns for every
    // social provider CDN (pbs.twimg.com, lh3.googleusercontent.com, …).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl ?? undefined}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('object-cover', className)}
      />
    );
  }
  return <IdenticonSvg identicon={identicon} className={className} alt={alt} />;
}

function IdenticonSvg({
  identicon,
  className,
  alt,
}: {
  identicon: Identicon;
  className?: string;
  alt: string;
}) {
  // useId keeps gradient defs unique across multiple avatars on one page.
  const uid = useId();
  const gradientId = useMemo(
    () => `oa-idn-${uid.replace(/[^a-zA-Z0-9]/g, '')}`,
    [uid],
  );

  const rects: Array<{ x: number; y: number }> = [];
  identicon.cells.forEach((on, i) => {
    if (!on) return;
    const col = i % 3;
    const row = Math.floor(i / 3);
    rects.push({ x: col, y: row });
    if (col !== 2) rects.push({ x: 4 - col, y: row });
  });

  return (
    <svg viewBox="0 0 5 5" role="img" aria-label={alt} className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={identicon.from} />
          <stop offset="100%" stopColor={identicon.to} />
        </linearGradient>
      </defs>
      <rect width="5" height="5" fill={`url(#${gradientId})`} opacity="0.14" />
      {rects.map((r, idx) => (
        <rect key={idx} x={r.x} y={r.y} width="1" height="1" fill={`url(#${gradientId})`} />
      ))}
    </svg>
  );
}
