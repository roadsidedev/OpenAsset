'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getLogoCandidates } from '@/lib/brandLogos';
import { Coins, Image, Stamp, Lock, ArrowsClockwise, Swap, Gavel, ChartLine, TrendUp, PuzzlePiece } from '@phosphor-icons/react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function GenericTokenIcon({ symbol, className }: { symbol: string; className?: string }) {
  const letter = symbol ? symbol.charAt(0).toUpperCase() : '?';
  // Deterministic pastel color from symbol for the background
  const hue = Math.abs(hashStr(symbol || '?')) % 360;
  return (
    <div className={cn(
      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0',
      className,
    )} style={{ backgroundColor: `hsl(${hue}, 50%, 85%)`, color: `hsl(${hue}, 50%, 25%)` }}>
      {letter}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

/** Internal: renders a single image candidate with a letter‑avatar skeleton underneath.
 *  The letter shows instantly; the img swaps in on load, hides on error, and
 *  cycles to the next candidate on failure. Keyed by src so a candidate change
 *  remounts (resets load/fail state) without a useEffect. */
function CandidateImage({ src, symbol, className, onError }: { src: string; symbol: string; className?: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative inline-flex shrink-0">
      {(!loaded || failed) && <GenericTokenIcon symbol={symbol} className={className} />}
      {!failed && (
        <img
          src={src}
          alt={`${symbol} logo`}
          className={cn('absolute inset-0 rounded-full object-contain bg-white p-0.5 shadow-sm transition-opacity duration-200', className, loaded ? 'opacity-100' : 'opacity-0')}
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); onError(); }}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      )}
    </span>
  );
}

export function TokenPreview({ name, symbol, decimals, logoUri, address, error, compact }: TokenPreviewProps) {
  const candidates = getLogoCandidates(symbol, logoUri);
  const [idx, setIdx] = useState(0);
  const current = idx < candidates.length ? candidates[idx] : null;

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
      {current ? (
        <CandidateImage key={current} src={current} symbol={symbol} className={compact ? 'h-6 w-6' : 'h-8 w-8'} onError={() => setIdx((i) => i + 1)} />
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
  const candidates = getLogoCandidates(symbol, logoUri);
  const [idx, setIdx] = useState(0);
  const current = idx < candidates.length ? candidates[idx] : null;

  if (current) {
    return (
      <CandidateImage key={current} src={current} symbol={symbol} className={className} onError={() => setIdx((i) => i + 1)} />
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
