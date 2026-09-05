'use client';

/**
 * @file AssetSearchPicker.tsx
 * @description Asset-first collateral search for market creation. Renders the
 * merged cross-chain catalog (B20 stocks, Robinhood stocks, curated ERC20s)
 * with instant search; usable inline (embedded on the page) or as a modal for
 * "browse all". Selection carries the resolved adapter + native chain so the
 * flow can auto-switch networks.
 */

import { useMemo, useState } from 'react';
import { MagnifyingGlass, GlobeHemisphereWest, Lock, Info } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TokenIcon } from './TokenPreview';
import { TokenAddressInput } from './TokenAddressInput';
import {
  buildAssetCatalog,
  searchAssetCatalog,
  type CatalogAsset,
  type AssetSource,
} from '@/lib/assetCatalog';
import { getChainLabel } from '@/lib/chainLabels';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export interface AssetSelection extends CatalogAsset {
  /** True when resolved through a curated catalog row (vs manual paste). */
  curated: boolean;
}

interface AssetRowProps {
  asset: CatalogAsset;
  selected: boolean;
  onSelect: (asset: CatalogAsset) => void;
}

function SourceBadge({ source }: { source: AssetSource }) {
  if (source === 'b20') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-ice-500/10 text-ice-700 dark:text-ice-300 border border-ice-200/50 dark:border-ice-400/20 font-semibold">
        Tokenized Stock
      </span>
    );
  }
  if (source === 'robinhood') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 font-semibold">
        Robinhood Stock
      </span>
    );
  }
  if (source === 'nft') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold">
        NFT
      </span>
    );
  }
  return null;
}

function AssetRow({ asset, selected, onSelect }: AssetRowProps) {
  const unavailable = !asset.assetAdapter;
  const onDifferentChain = asset.chainId !== undefined;

  return (
    <button
      type="button"
      onClick={() => !unavailable && onSelect(asset)}
      disabled={unavailable}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all',
        selected
          ? 'border-ice-400 bg-ice-50 dark:bg-ice-500/10 ring-2 ring-ice-400/30'
          : 'border-border bg-card hover:border-ice-300/50 hover:bg-accent/50 dark:hover:bg-muted/40',
        unavailable && 'opacity-50 cursor-not-allowed',
      )}
      title={unavailable ? 'Collateral adapter is not deployed on this chain yet' : undefined}
    >
      <TokenIcon symbol={asset.symbol} logoUri={asset.logoUri} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-foreground">{asset.symbol}</span>
          <SourceBadge source={asset.source} />
          {asset.requiresAllowlist && (
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Allowlist required" />
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
      </div>
      <div className="shrink-0 text-right min-w-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium max-w-full',
            selected
              ? 'border-ice-400/40 bg-ice-500/10 text-ice-700 dark:text-ice-300'
              : 'border-border bg-muted/60 text-muted-foreground',
          )}
        >
          <span className="truncate">{getChainLabel(asset.chainId)}</span>
        </span>
        {onDifferentChain && unavailable && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Unavailable on this chain</div>
        )}
      </div>
    </button>
  );
}

interface AssetSearchResultsProps {
  assets: CatalogAsset[];
  selectedAddress?: string;
  onSelect: (asset: CatalogAsset) => void;
  emptyHint?: string;
}

export function AssetSearchResults({ assets, selectedAddress, onSelect, emptyHint }: AssetSearchResultsProps) {
  const grouped = useMemo(() => {
    const groups = new Map<number, CatalogAsset[]>();
    for (const a of assets) {
      const list = groups.get(a.chainId) ?? [];
      list.push(a);
      groups.set(a.chainId, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [assets]);

  if (assets.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-border bg-muted/30 text-center space-y-2">
        <MagnifyingGlass className="h-5 w-5 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          {emptyHint || 'No assets match your search. Try a symbol like "AAPL", "TSLA" or "USDC", or paste a token address below.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="listbox" aria-label="Collateral assets">
      {grouped.map(([chainId, list]) => (
        <div key={chainId} className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GlobeHemisphereWest className="h-3.5 w-3.5" />
            On {getChainLabel(chainId)}
            <span className="font-normal normal-case">({list.length})</span>
          </p>
          <div className="space-y-2">
            {list.map((asset) => (
              <AssetRow
                key={`${asset.chainId}-${asset.address}`}
                asset={asset}
                selected={!!selectedAddress && selectedAddress.toLowerCase() === asset.address.toLowerCase()}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface AssetSearchPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  selectedAddress?: string;
  onSelect: (asset: AssetSelection) => void;
  /** Paste-custom-address handler; omitted hides the manual section. */
  manualValue?: string;
  onManualChange?: (addr: string) => void;
  manualChainId?: number;
  title?: string;
}

export function AssetSearchPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  selectedAddress,
  onSelect,
  manualValue,
  onManualChange,
  manualChainId,
  title = 'Choose what to lend against',
}: AssetSearchPickerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [showManual, setShowManual] = useState(false);
  const catalog = useMemo(() => buildAssetCatalog(), []);
  const results = useMemo(() => searchAssetCatalog(catalog, query), [catalog, query]);

  const content = (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-5 pb-3 space-y-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Tokenized stocks, Robinhood stock tokens and supported stablecoins across all networks. The right adapter and network are applied automatically.
          </p>
        </div>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder='Search assets — "AAPL", "TSLA", "USDC"…'
            aria-label="Search collateral assets"
            className="w-full rounded-2xl border border-border bg-muted/40 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ice-400/40 focus:border-ice-300"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
        <AssetSearchResults
          assets={results}
          selectedAddress={selectedAddress}
          onSelect={(asset) => {
            onSelect({ ...asset, curated: true });
            onOpenChange(false);
          }}
        />
      </div>

      {onManualChange && (
        <div className="shrink-0 px-5 py-3 border-t border-border bg-muted/30 dark:bg-muted/20">
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showManual ? 'Hide' : 'Advanced:'} paste a custom token address
          </button>
          {showManual && (
            <div className="mt-3">
              <TokenAddressInput
                label="Custom collateral address"
                placeholder="0x…"
                value={manualValue || ''}
                onChange={onManualChange}
                chainId={manualChainId}
              />
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 flex flex-col gap-3 p-5 pt-3 border-t border-border bg-card">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Selecting an asset on another network switches you automatically (embedded wallets) or with one click.
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
          Close
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col border-t border-border">
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>Search collateral assets across all networks</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl gap-0 p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Search collateral assets across all networks</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
