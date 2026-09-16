'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, MagnifyingGlass, Info, CheckCircle } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SupportedAssetGrid } from './SupportedAssetGrid';
import { TokenPreview } from './TokenPreview';
import { useAssetDiscovery, type DiscoveredAsset } from '@/lib/tokenMetadata';
import {
  fetchSupportedAssetsForAdapter,
  getSuggestedAdaptersForB20,
  adapterAssetType,
  type SupportedAsset,
} from '@/lib/supportedAssets';
import { getProviderAsset } from '@/lib/providerBundles';
import { B20_RISK_DISCLOSURE, isWithinB20TradingWindow, b20MarketHoursLabel } from '@/lib/b20';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface SupportedAssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adapterAddress: string;
  chainId?: number;
  selectedAddress?: string;
  onSelect: (asset: SupportedAsset) => void;
  // For manual fallback
  manualValue?: string;
  onManualChange?: (addr: string) => void;
}

export function SupportedAssetPicker({
  open,
  onOpenChange,
  adapterAddress,
  chainId,
  selectedAddress,
  onSelect,
  manualValue,
  onManualChange,
}: SupportedAssetPickerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<SupportedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<SupportedAsset | null>(null);
  const [caInput, setCaInput] = useState('');

  const effectiveChainId = chainId || 84532;
  const acceptedType = adapterAssetType(adapterAddress, effectiveChainId);

  const caIsValid = /^0x[a-fA-F0-9]{40}$/.test(caInput.trim());
  const { data: discovered, isFetching: discoveryLoading } = useAssetDiscovery(
    caIsValid ? caInput.trim() : undefined,
    effectiveChainId,
  );

  // Adapter compatibility of a discovered asset with THIS picker's adapter
  const discoveryCompat = useMemo(() => {
    if (!discovered || discovered.kind === 'unknown') return null;
    if (acceptedType === 'unknown') return { ok: true, message: 'Adapter accepts both ERC20 and ERC721 collateral' };
    if (acceptedType === discovered.kind) return { ok: true, message: `Compatible — accepts ${acceptedType.toUpperCase()} collateral` };
    return { ok: false, message: `This adapter accepts ${acceptedType.toUpperCase()} collateral; pasted asset is ${discovered.kind.toUpperCase()}` };
  }, [discovered, acceptedType]);

  // Build a selectable SupportedAsset from a discovered result
  const discoveryAsset: SupportedAsset | null = useMemo(() => {
    if (!discovered || discovered.kind === 'unknown' || discovered.error) return null;
    const providerAsset = getProviderAsset(effectiveChainId, discovered.address);
    return {
      address: discovered.address,
      symbol: discovered.symbol,
      name: discovered.name,
      decimals: discovered.decimals ?? 0,
      logoUri: discovered.logoUri,
      marketCount: 0,
      totalLiquidity: '0',
      isB20: providerAsset?.provider === 'b20',
      provider: providerAsset?.provider,
      requiresAllowlist: providerAsset?.requiresAllowlist,
      assetType: discovered.kind,
    };
  }, [discovered, effectiveChainId]);

  useEffect(() => {
    if (!open || !adapterAddress) return;
    let cancelled = false;
    setIsLoading(true);
    const q = query.trim();
    fetchSupportedAssetsForAdapter(adapterAddress, effectiveChainId, q || undefined)
      .then(list => {
        if (!cancelled) {
          setAssets(list);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, adapterAddress, effectiveChainId, query]);

  // Reset selection when adapter changes
  useEffect(() => {
    if (open) {
      setSelected(null);
      setQuery('');
      setCaInput('');
    }
  }, [open, adapterAddress]);

  const handleSelect = (asset: SupportedAsset) => {
    setSelected(asset);
  };

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  const hoursOpen = isWithinB20TradingWindow();
  const suggested = useMemo(() => getSuggestedAdaptersForB20(effectiveChainId), [effectiveChainId]);
  const isB20Selected = selected?.isB20;

  const handleDiscoveryConfirm = () => {
    if (!discoveryAsset) return;
    setSelected(discoveryAsset);
    onManualChange?.(discoveryAsset.address);
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-5 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Select supported asset</h2>
          {!isMobile && (
            <Badge variant="secondary" className="text-xs">
              {assets.length} available
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick from the supported list, or paste any contract address to find and verify an asset.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
        <SupportedAssetGrid
          assets={assets}
          selectedAddress={selected?.address || selectedAddress}
          onSelect={handleSelect}
          isLoading={isLoading}
          query={query}
          onQueryChange={setQuery}
          chainId={effectiveChainId}
        />
        {selected && (
          <div className="mt-4 space-y-3 rounded-2xl border border-ice-300/30 dark:border-ice-400/20 bg-ice-50 dark:bg-ice-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{selected.symbol}</span>
                  {selected.isB20 && <Badge className="bg-ice-500/10 text-ice-600 dark:text-ice-300 border-ice-500/20 dark:border-ice-400/20 text-[11px]">B20 • {selected.feed?.slice(0,6)}…</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{selected.name} • {selected.address.slice(0,10)}…</div>
                <div className={cn("text-xs mt-1", hoursOpen ? "text-emerald-600" : "text-amber-600")}>
                  {b20MarketHoursLabel()}
                </div>
              </div>
              <TokenPreview name={selected.name} symbol={selected.symbol} decimals={selected.decimals} logoUri={selected.logoUri || null} compact />
            </div>
            {isB20Selected && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Info className="h-3.5 w-3.5" /> Auto-suggested B20 stack
                </div>
                <ul className="text-xs text-amber-700/90 dark:text-amber-300/90 list-disc list-inside space-y-0.5">
                  <li>Oracle: Chainlink Equity Feed (90000s, sequencer 0xBCF8…6433) — not TWAP</li>
                  <li>Compliance: B20 Policy • Liquidation: DEXSwap (24/7) • Position: Soulbound</li>
                  <li>Dividends accrue to escrow until repay</li>
                </ul>
              </div>
            )}
            {isB20Selected && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Risk disclosure</summary>
                <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
                  {B20_RISK_DISCLOSURE.bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Find asset by contract address */}
      <div className="shrink-0 px-5 py-3 border-t border-border bg-muted/30 dark:bg-muted/20 space-y-2">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <MagnifyingGlass className="h-3.5 w-3.5" /> Find asset by contract address
        </label>
        <input
          type="text"
          value={caInput}
          onChange={(e) => setCaInput(e.target.value)}
          placeholder="Paste 0x contract address…"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full rounded-2xl border bg-muted/50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 transition-colors placeholder:text-muted-foreground',
            caInput && !caIsValid ? 'border-destructive/50' : caIsValid && discoveryCompat?.ok ? 'border-emerald-500/30' : 'border-border focus:ring-ice-400',
          )}
        />
        {caInput && !caIsValid && (
          <p className="text-xs text-destructive">Invalid address format — must be a 0x address.</p>
        )}
        {caIsValid && (discoveryLoading ? (
          <p className="text-xs text-muted-foreground animate-pulse">Resolving asset on-chain…</p>
        ) : discovered?.error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {discovered.error}
          </div>
        ) : discoveryAsset && discoveryCompat ? (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{discovered.symbol}</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {discovered.kind === 'erc721' ? 'ERC721 collection' : 'ERC20 token'}
                  </Badge>
                  {discovered.curatedMatch && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20 text-[11px]">
                      <CheckCircle className="h-3 w-3 mr-0.5" /> Known asset
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{discovered.name} · {discovered.address.slice(0, 12)}…</p>
              </div>
              <TokenPreview name={discovered.name} symbol={discovered.symbol} decimals={discovered.decimals ?? 0} logoUri={discovered.logoUri} compact />
            </div>
            <div className={cn('text-xs flex items-start gap-1.5', discoveryCompat.ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300')}>
              {discoveryCompat.ok ? <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
              <span>{discoveryCompat.message}</span>
            </div>
            <button
              onClick={handleDiscoveryConfirm}
              disabled={!discoveryCompat.ok}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {discoveryCompat.ok ? 'Use this asset' : 'Not compatible with this adapter'}
            </button>
          </div>
        ) : null)}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 p-5 pt-3 border-t border-border bg-card dark:bg-card">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selected}
          className="rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-semibold disabled:opacity-50"
        >
          Confirm {selected ? selected.symbol : 'asset'}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col border-t border-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Select supported asset</SheetTitle>
            <SheetDescription>Preview assets for this adapter</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl gap-0 p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Select supported asset</DialogTitle>
          <DialogDescription>Preview assets for this adapter</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
