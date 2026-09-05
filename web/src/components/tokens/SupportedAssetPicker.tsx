'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, MagnifyingGlass, Info } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SupportedAssetGrid } from './SupportedAssetGrid';
import { TokenPreview } from './TokenPreview';
import { TokenAddressInput } from './TokenAddressInput';
import { fetchSupportedAssetsForAdapter, getSuggestedAdaptersForB20 } from '@/lib/supportedAssets';
import { B20_RISK_DISCLOSURE, isWithinB20TradingWindow, b20MarketHoursLabel } from '@/lib/b20';
import type { SupportedAsset } from '@/lib/supportedAssets';
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
  const [showManual, setShowManual] = useState(false);

  const effectiveChainId = chainId || 84532;

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
      setShowManual(false);
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
          Preview all assets supported by this adapter on chain {effectiveChainId}. No need to paste addresses.
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

      {/* Advanced manual */}
      <div className="shrink-0 px-5 py-3 border-t border-border bg-muted/30 dark:bg-muted/20">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showManual ? 'Hide' : 'Advanced:'} Paste custom address
        </button>
        {showManual && onManualChange && (
          <div className="mt-3">
            <TokenAddressInput
              label="Custom collateral address"
              placeholder="0x…"
              value={manualValue || ''}
              onChange={onManualChange}
              chainId={effectiveChainId}
            />
            <p className="mt-1 text-xs text-muted-foreground">Will validate via `getBytecode` and `useTokenMetadata` before enabling Confirm.</p>
          </div>
        )}
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
