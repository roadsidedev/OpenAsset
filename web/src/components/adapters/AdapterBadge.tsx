'use client';

import { cn } from '@/lib/utils';

interface AdapterBadgeProps {
  verified: boolean;
  deprecated?: boolean;
  className?: string;
}

export function AdapterBadge({ verified, deprecated, className }: AdapterBadgeProps) {
  if (deprecated) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        'bg-red-500/10 text-red-400 border border-red-500/20',
        className
      )}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Deprecated
      </span>
    );
  }

  if (verified) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        className
      )}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Verified
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
      className
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      Unverified
    </span>
  );
}
