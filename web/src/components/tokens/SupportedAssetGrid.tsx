'use client';

import { useState, useMemo } from 'react';
import { MagnifyingGlass, CheckCircle, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/components/tokens/TokenPreview';
import { isWithinB20TradingWindow } from '@/lib/b20';
import type { SupportedAsset } from '@/lib/supportedAssets';

interface SupportedAssetGridProps {
  assets: SupportedAsset[];
  selectedAddress?: string;
  onSelect: (asset: SupportedAsset) => void;
  isLoading?: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  chainId?: number;
}

export function SupportedAssetGrid({
  assets,
  selectedAddress,
  onSelect,
  isLoading,
  query,
  onQueryChange,
  chainId,
}: SupportedAssetGridProps) {
  const [category, setCategory] = useState<'All' | 'B20' | 'Stable' | 'AllMarkets'>('All');

  const categories: Array<{ id: typeof category; label: string }> = [
    { id: 'All', label: 'All' },
    { id: 'B20', label: 'B20' },
    { id: 'Stable', label: 'Stable' },
    { id: 'AllMarkets', label: 'With Markets' },
  ];

  const filtered = useMemo(() => {
    let list = assets;
    if (category === 'B20') list = list.filter(a => a.isB20);
    if (category === 'Stable') list = list.filter(a => ['USDC', 'USDT', 'DAI'].includes(a.symbol.toUpperCase()));
    if (category === 'AllMarkets') list = list.filter(a => a.marketCount > 0);
    return list;
  }, [assets, category]);

  const hoursOpen = isWithinB20TradingWindow();

  return (
    <div className="space-y-3">
      {/* Search + category pills */}
      <div className="space-y-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search supported assets by symbol, name or address"
            aria-controls="supported-asset-list"
            placeholder="Search AAPLc, USDC or 0xb200…"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            className="h-9 w-full rounded-2xl border border-border bg-muted/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ice-400"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:bg-accent'
              )}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {isLoading ? 'Loading…' : `${filtered.length} assets`}
          </span>
        </div>
      </div>

      {/* Chain hint */}
      {chainId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Chain {chainId} • {hoursOpen ? 'B20 market open (Mon-Fri)' : 'B20 market closed — originations paused'}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="col-span-full py-10 text-center space-y-2 rounded-2xl border border-dashed p-6">
          <Warning className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No adapter-supported assets found</p>
          <p className="text-xs text-muted-foreground">Try a different search, check chain, or paste a custom address below.</p>
        </div>
      ) : (
        <div
          id="supported-asset-list"
          role="listbox"
          aria-label="Supported assets"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-[42vh] overflow-y-auto overscroll-contain pr-1"
        >
          {filtered.map(asset => {
            const isSelected = selectedAddress?.toLowerCase() === asset.address.toLowerCase();
            return (
              <button
                key={asset.address}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(asset)}
                className={cn(
                  'group relative flex min-w-0 flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ice-400 sm:p-4',
                  isSelected
                    ? 'border-ice-400 bg-ice-50 dark:bg-ice-500/10 ring-2 ring-ice-400/30 dark:ring-ice-400/20'
                    : 'bg-card dark:bg-card hover:border-ice-300/50 dark:hover:border-ice-400/30 hover:bg-accent/50'
                )}
              >
                {isSelected && <CheckCircle className="absolute right-2 top-2 h-4 w-4 text-ice-500" weight="fill" />}
                <div className="flex items-center gap-2 w-full">
                  <TokenIcon symbol={asset.symbol} logoUri={asset.logoUri || null} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground truncate">{asset.symbol}</span>
                      {asset.isB20 && <Badge className="h-4 px-1.5 text-[10px] bg-ice-500/10 text-ice-600 dark:text-ice-300 border-ice-500/20 dark:border-ice-400/20">B20</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
                  </div>
                </div>
                <div className="w-full space-y-1 text-xs">
                  <div className="font-mono text-muted-foreground truncate">{asset.address.slice(0, 10)}…{asset.address.slice(-4)}</div>
                  {asset.isB20 && asset.feed && (
                    <div className="text-[11px] text-muted-foreground truncate">Feed {asset.feed.slice(0, 6)}…{asset.feed.slice(-4)}</div>
                  )}
                  {asset.marketCount > 0 ? (
                    <Badge variant="secondary" className="text-[11px]">{asset.marketCount} markets • ${Number(asset.totalLiquidity) / 1e6}M TVL</Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No markets yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
