'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveTokenLogo } from '@/lib/brandLogos';
import { Coins, Image, Stamp, Lock, ArrowsClockwise, Swap, Gavel, ChartLine, TrendUp, PuzzlePiece } from '@phosphor-icons/react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Coins,
  Image,
  Stamp,
  Lock,
  ArrowsClockwise,
  Swap,
  Gavel,
  ChartLine,
  TrendUp,
  PuzzlePiece,
};

interface TokenPreviewProps {
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string | null;
  address?: string;
  error?: string | null;
  compact?: boolean;
}

function GenericTokenIcon({ symbol, className }: { symbol: string; className?: string }) {
  return (
    <div className={cn(
      'flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground',
      className,
    )}>
      {symbol ? symbol.charAt(0).toUpperCase() : '?'}
    </div>
  );
}

export function TokenPreview({ name, symbol, decimals, logoUri, address, error, compact }: TokenPreviewProps) {
  const resolvedLogo = resolveTokenLogo(symbol, logoUri);
  const [imgFailed, setImgFailed] = useState(false);
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
        <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"/>
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-500/10 dark:border-emerald-500/20',
      compact && 'p-2',
    )}>
      {resolvedLogo && !imgFailed ? (
        <img
          src={resolvedLogo}
          alt={`${symbol} logo`}
          className={cn('h-8 w-8 rounded-full object-contain bg-white dark:bg-white p-0.5 shadow-sm', compact && 'h-6 w-6')}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <GenericTokenIcon symbol={symbol} className={compact ? 'h-6 w-6 text-[10px]' : ''} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>
            {name}
          </span>
          <span className="text-xs text-muted-foreground">({symbol})</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{decimals} decimals</span>
          <span className="text-[10px] text-emerald-500 font-medium">ERC20 verified</span>
        </div>
      </div>
    </div>
  );
}

export function TokenIcon({ symbol, logoUri, className }: { symbol: string; logoUri?: string | null; className?: string }) {
  const { getLogoCandidates } = require('@/lib/brandLogos') as typeof import('@/lib/brandLogos');
  const candidates = getLogoCandidates(symbol, logoUri);
  const [idx, setIdx] = useState(0);
  const current = candidates[idx] || null;
  if (current) {
    return (
      <img
        src={current}
        alt={`${symbol} logo`}
        className={cn('h-6 w-6 rounded-full object-contain bg-white p-0.5 shadow-sm', className)}
        onError={() => {
          if (idx + 1 < candidates.length) setIdx((i) => i + 1);
          else setIdx(candidates.length); // exhaust → fallback
        }}
        loading="lazy"
      />
    );
  }
  return <GenericTokenIcon symbol={symbol} className={className} />;
}

export function BrandTokenIcon({ symbol, logoUri, className }: { symbol: string; logoUri?: string | null; className?: string }) {
  return <TokenIcon symbol={symbol} logoUri={logoUri} className={className} />;
}

export function AdapterIcon({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = ICON_MAP[iconName] || PuzzlePiece;
  return <IconComponent className={cn('h-5 w-5', className)} />;
}
