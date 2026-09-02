'use client';

/**
 * @file AssetSourceStep.tsx
 * @description Asset-first collateral step for market creation.
 *
 * Users search "what to lend against" (tokenized stocks, Robinhood stocks,
 * tokens, NFTs). The correct adapter, provider bundle and network resolve
 * automatically — embedded wallets switch chains silently, external wallets
 * get a one-click banner. Advanced mode exposes manual adapter selection with
 * supported-asset previews per card.
 */

import { useMemo, useState } from 'react';
import {
  MagnifyingGlass,
  Coins,
  Image as ImageIcon,
  ChartLine,
  Swap,
  CaretDown,
  CheckCircle,
  X,
  ListMagnifyingGlass,
  GlobeHemisphereWest,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { TokenAddressInput } from '@/components/tokens/TokenAddressInput';
import { SupportedAssetPicker } from '@/components/tokens/SupportedAssetPicker';
import {
  AssetSearchResults,
  AssetSearchPicker,
  type AssetSelection,
} from '@/components/tokens/AssetSearchPicker';
import { TokenIcon } from '@/components/tokens/TokenPreview';
import { useChainOrchestrator } from '@/hooks/useChainOrchestrator';
import { getContracts, type ChainContracts } from '@/lib/contracts';
import { getChainLabel } from '@/lib/chainLabels';
import {
  buildAssetCatalog,
  searchAssetCatalog,
  getAdapterPreviewAssets,
  type CatalogAsset,
} from '@/lib/assetCatalog';
import {
  adapterSupportsPicker,
  getSuggestedAdaptersForB20,
  getSuggestedAdaptersForRobinhood,
} from '@/lib/supportedAssets';
import type { MarketFormData } from '@/store/useMarketStore';
import type { AdapterOption } from './types';
import { cn } from '@/lib/utils';

const ZERO = '0x0000000000000000000000000000000000000000';

interface AssetSourceStepProps {
  formData: MarketFormData;
  setFormData: (data: Partial<MarketFormData>) => void;
  chainId?: number;
  assetAdapters: AdapterOption[];
  collateralPreview?: { symbol?: string; name?: string; logoUri?: string | null } | null;
}

interface AssetAdapterCardDef {
  key: 'erc20' | 'erc721' | 'b20' | 'robinhood';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Address on the CURRENT chain (may be 0x0). */
  address: string;
  /** Chains where this adapter family is available. */
  chains: number[];
}

function buildAdapterCards(contracts: ChainContracts | undefined): AssetAdapterCardDef[] {
  const available = (addr?: string) => !!addr && addr !== ZERO;
  const erc20Chains = [8453, 84532, 11155111, 46630].filter((c) => available(getContracts(c)?.erc20Adapter));
  const erc721Chains = [8453, 84532, 11155111, 46630].filter((c) => available(getContracts(c)?.erc721Adapter));
  const b20Chains = [8453, 84532].filter((c) => available(getContracts(c)?.b20AssetAdapter));
  const robinhoodChains = [4663, 46630].filter(
    (c) => available(getContracts(c)?.robinhoodProviderConfigurator) || available(getContracts(c)?.robinhoodComplianceAdapter),
  );
  return [
    {
      key: 'erc20',
      name: 'ERC-20 Tokens',
      description: 'Fungible tokens — stablecoins, wrapped assets and more. Collateral held in escrow; DEX-swap liquidation.',
      icon: Coins,
      address: contracts?.erc20Adapter ?? ZERO,
      chains: erc20Chains,
    },
    {
      key: 'erc721',
      name: 'ERC-721 Collections',
      description: 'NFT collections. Auction-based liquidation with oracle-assisted pricing.',
      icon: ImageIcon,
      address: contracts?.erc721Adapter ?? ZERO,
      chains: erc721Chains,
    },
    {
      key: 'b20',
      name: 'B20 Tokenized Stocks',
      description: 'Coinbase B20 tokenized equities (AAPLc, TSLAc…). 24/5 Chainlink equity pricing, policy compliance, 24/7 DEX liquidation.',
      icon: ChartLine,
      address: contracts?.b20AssetAdapter ?? ZERO,
      chains: b20Chains,
    },
    {
      key: 'robinhood',
      name: 'Robinhood Stocks',
      description: 'Robinhood tokenized equities with managed-allowlist compliance and equity-feed pricing.',
      icon: Swap,
      address: contracts?.erc20Adapter ?? ZERO,
      chains: robinhoodChains,
    },
  ];
}

export function AssetSourceStep({
  formData,
  setFormData,
  chainId,
  assetAdapters,
  collateralPreview,
}: AssetSourceStepProps) {
  const { nudgeChain } = useChainOrchestrator();
  const contracts = useMemo(() => (chainId ? getContracts(chainId) : undefined), [chainId]);
  const catalog = useMemo(() => buildAssetCatalog(), []);

  const [query, setQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseAdapter, setBrowseAdapter] = useState<string | undefined>(undefined);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const results = useMemo(() => searchAssetCatalog(catalog, query).slice(0, 5), [catalog, query]);
  const totalMatches = useMemo(() => searchAssetCatalog(catalog, query).length, [catalog, query]);
  const adapterCards = useMemo(() => buildAdapterCards(contracts), [contracts]);

  const selectedInfo = useMemo<CatalogAsset & { curated?: boolean } | null>(() => {
    if (!formData.collateralAsset) return null;
    const curated = catalog.find(
      (a) => a.address.toLowerCase() === formData.collateralAsset.toLowerCase(),
    );
    return (
      curated ?? {
        address: formData.collateralAsset,
        symbol: collateralPreview?.symbol ?? 'Custom',
        name: collateralPreview?.name ?? 'Custom token',
        chainId: chainId ?? 0,
        decimals: 18,
        source: 'custom' as const,
        logoUri: collateralPreview?.logoUri ?? null,
        curated: false,
      }
    );
  }, [formData.collateralAsset, catalog, collateralPreview, chainId]);

  const resolveProviderStack = (asset: CatalogAsset): boolean => {
    if (!chainId) return false;
    if (asset.source === 'b20') {
      const suggested = getSuggestedAdaptersForB20(chainId);
      if (suggested) {
        setFormData({
          collateralAsset: asset.address,
          assetAdapter: suggested.assetAdapter || formData.assetAdapter,
          oracleAdapter: suggested.oracleAdapter || formData.oracleAdapter,
          complianceAdapter: suggested.complianceAdapter || formData.complianceAdapter,
          liquidationAdapter: suggested.liquidationAdapter || formData.liquidationAdapter,
          positionAdapter: suggested.positionAdapter || formData.positionAdapter,
          enableCompliance: true,
        });
        toast.success(`${asset.symbol} selected — B20 provider bundle applied`);
        return true;
      }
    }
    if (asset.source === 'robinhood') {
      const suggested = getSuggestedAdaptersForRobinhood(chainId);
      if (suggested) {
        setFormData({
          collateralAsset: asset.address,
          assetAdapter: suggested.assetAdapter || formData.assetAdapter,
          oracleAdapter: suggested.oracleAdapter || formData.oracleAdapter,
          complianceAdapter: suggested.complianceAdapter || formData.complianceAdapter,
          liquidationAdapter: suggested.liquidationAdapter || formData.liquidationAdapter,
          positionAdapter: suggested.positionAdapter || formData.positionAdapter,
          enableCompliance: true,
        });
        toast.success(`${asset.symbol} selected — Robinhood provider bundle applied`);
        return true;
      }
    }
    return false;
  };

  const handleAssetSelected = (asset: AssetSelection) => {
    const chainLabel = getChainLabel(asset.chainId);

    if (asset.source === 'custom') {
      setFormData({ collateralAsset: asset.address });
      setManualValue('');
      nudgeChain(asset.chainId, `Custom asset resolves on ${chainLabel}`);
      return;
    }

    if (!resolveProviderStack(asset)) {
      const erc20 = contracts?.erc20Adapter;
      setFormData({
        collateralAsset: asset.address,
        assetAdapter:
          asset.source === 'nft'
            ? contracts?.erc721Adapter || formData.assetAdapter
            : erc20 && erc20 !== ZERO
              ? erc20
              : formData.assetAdapter,
      });
      toast.success(`${asset.symbol} selected`);
    }

    nudgeChain(asset.chainId, `${asset.symbol} lives on ${chainLabel}`);
  };

  const handleAdapterCardSelect = (card: AssetAdapterCardDef) => {
    if (!card.chains.length) {
      toast.error('This adapter family is not deployed on any supported network yet.');
      return;
    }
    if (chainId && !card.chains.includes(chainId)) {
      const target = card.chains[0];
      nudgeChain(target, `${card.name} is available on ${getChainLabel(target)}`);
      toast.info(`${card.name} is available on ${getChainLabel(target)} — switching…`);
      return;
    }
    if (card.key === 'robinhood') {
      const suggested = getSuggestedAdaptersForRobinhood(chainId ?? 0);
      if (suggested) {
        setFormData({
          assetAdapter: suggested.assetAdapter || card.address,
          oracleAdapter: suggested.oracleAdapter || formData.oracleAdapter,
          complianceAdapter: suggested.complianceAdapter || formData.complianceAdapter,
          liquidationAdapter: suggested.liquidationAdapter || formData.liquidationAdapter,
          positionAdapter: suggested.positionAdapter || formData.positionAdapter,
          enableCompliance: true,
        });
        toast.success('Robinhood provider bundle applied');
        return;
      }
    }
    setFormData({ assetAdapter: card.address });
    toast.success(`${card.name} selected`);
  };

  const verificationFor = (address: string) =>
    assetAdapters.find((a) => a.address.toLowerCase() === address?.toLowerCase());

  const clearSelection = () => {
    setFormData({ collateralAsset: '' });
    setQuery('');
  };

  return (
    <div className="space-y-6" data-testid="asset-source-step">
      {/* Selected asset summary */}
      {selectedInfo ? (
        <div className="rounded-2xl border border-ice-300/40 dark:border-ice-400/25 bg-ice-50 dark:bg-ice-500/10 p-4">
          <div className="flex items-start gap-3">
            <TokenIcon symbol={selectedInfo.symbol} logoUri={selectedInfo.logoUri} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-foreground">{selectedInfo.symbol}</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" weight="fill" />
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground font-medium inline-flex items-center gap-1">
                  <GlobeHemisphereWest className="h-3 w-3" />
                  {getChainLabel(selectedInfo.chainId)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{selectedInfo.name}</div>
              {formData.assetAdapter && (
                <div className="text-xs text-muted-foreground mt-1">
                  Handled by{' '}
                  <span className="font-semibold text-foreground">
                    {verificationFor(formData.assetAdapter)?.name ?? 'asset adapter'}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Clear selected asset"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search-first entry */}
          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='What are you lending against? Try "TSLA", "AAPL" or "USDC"'
                aria-label="Search collateral assets"
                className="w-full rounded-2xl border border-border bg-muted/40 pl-12 pr-4 py-4 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ice-400/40 focus:border-ice-300 transition-all"
              />
            </div>

            {query.trim() && (
              <div className="space-y-3">
                <AssetSearchResults
                  assets={results}
                  selectedAddress={formData.collateralAsset}
                  onSelect={(asset) => handleAssetSelected({ ...asset, curated: true })}
                  emptyHint='No assets match. Try "AAPL", "TSLA" or "USDC" — or switch to advanced mode and paste a custom token address.'
                />
                {totalMatches > results.length && (
                  <button
                    type="button"
                    onClick={() => setBrowseOpen(true)}
                    className="text-xs font-semibold text-ice-600 dark:text-ice-300 hover:underline"
                  >
                    Show all {totalMatches} matches →
                  </button>
                )}
              </div>
            )}

            {!query.trim() && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Popular:</span>
                {['TSLAc', 'AAPLc', 'NVDAc', 'USDC'].map((sym) => {
                  const hit = catalog.find((a) => a.symbol.toLowerCase() === sym.toLowerCase());
                  if (!hit) return null;
                  return (
                    <button
                      key={`${hit.chainId}-${sym}`}
                      type="button"
                      onClick={() => handleAssetSelected({ ...hit, curated: true })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-ice-300/60 hover:bg-accent/50 transition-all"
                    >
                      <TokenIcon symbol={hit.symbol} logoUri={hit.logoUri} className="h-4 w-4" />
                      {hit.symbol}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setBrowseOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ice-300/40 dark:border-ice-400/25 bg-ice-50 dark:bg-ice-500/10 px-3 py-1.5 text-xs font-semibold text-ice-700 dark:text-ice-300 hover:bg-ice-100 dark:hover:bg-ice-500/20 transition-all"
                >
                  <ListMagnifyingGlass className="h-3.5 w-3.5" />
                  Browse all assets
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Advanced: manual adapter selection with previews */}
      <div className="rounded-2xl border border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between p-4 text-left"
          aria-expanded={advancedOpen}
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              Advanced: choose the asset adapter manually
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adapter cards show every supported asset and network. Recommended for power users.
            </p>
          </div>
          <CaretDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', advancedOpen && 'rotate-180')}
          />
        </button>

        {advancedOpen && (
          <div className="p-4 pt-0 space-y-3">
            {adapterCards.map((card) => {
              const Icon = card.icon;
              const onCurrentChain = !!(chainId && card.chains.includes(chainId));
              const selected = !!formData.assetAdapter && formData.assetAdapter.toLowerCase() === card.address.toLowerCase() && card.address !== ZERO;
              const verification = verificationFor(card.address);
              const preview = getAdapterPreviewAssets(onCurrentChain ? card.address : undefined, chainId ?? 0);
              const canBrowse = onCurrentChain && adapterSupportsPicker(card.address, chainId);

              return (
                <div
                  key={card.key}
                  className={cn(
                    'rounded-xl border p-4 space-y-3 transition-all',
                    selected
                      ? 'border-ice-400 bg-ice-50 dark:bg-ice-500/10 ring-2 ring-ice-400/30'
                      : 'border-border bg-card hover:border-ice-300/50 dark:hover:border-ice-400/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        selected
                          ? 'bg-ice-400/20 text-ice-600 dark:text-ice-300'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{card.name}</span>
                        {verification && (
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                              verification.verified
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {verification.verified ? 'Verified' : 'Unverified'}
                          </span>
                        )}
                        {!onCurrentChain && card.chains.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                            on {card.chains.map((c) => getChainLabel(c)).join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                    </div>
                    {selected && <CheckCircle className="h-5 w-5 shrink-0 text-ice-500" weight="fill" />}
                  </div>

                  {/* Supported asset preview strip */}
                  {onCurrentChain && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {preview.length > 0 ? (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Supported:
                          </span>
                          {preview.map((p) => (
                            <span
                              key={`${p.chainId}-${p.address}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-1 pr-2 py-0.5"
                              title={p.name}
                            >
                              <TokenIcon symbol={p.symbol} logoUri={p.logoUri} className="h-4 w-4" />
                              <span className="text-[10px] font-semibold text-foreground">{p.symbol}</span>
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          Any {card.key === 'erc721' ? 'ERC-721 collection' : 'supported asset on this network'} — browse or paste an address.
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAdapterCardSelect(card)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-premium active-press',
                        selected
                          ? 'bg-ice-300 dark:bg-ice-400 text-slate-900'
                          : 'border border-border bg-card text-foreground hover:border-ice-300/60 hover:bg-accent/50',
                      )}
                    >
                      {selected ? 'Selected' : onCurrentChain ? 'Use this adapter' : `Switch to ${getChainLabel(card.chains[0])}`}
                    </button>
                    {canBrowse && (
                      <button
                        type="button"
                        onClick={() => {
                          setBrowseAdapter(card.address);
                          setBrowseOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <ListMagnifyingGlass className="h-3.5 w-3.5" />
                        Browse supported assets
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <TokenAddressInput
                label="Or paste a custom collateral address"
                placeholder="0x…"
                value={manualValue}
                onChange={(addr) => {
                  setManualValue(addr);
                  if (addr) {
                    setFormData({ collateralAsset: addr });
                    const erc20 = contracts?.erc20Adapter;
                    if (erc20 && erc20 !== ZERO && !formData.assetAdapter) {
                      setFormData({ assetAdapter: erc20 });
                    }
                  }
                }}
                chainId={chainId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Browse-all picker (full catalog) */}
      <AssetSearchPicker
        open={browseOpen && !browseAdapter}
        onOpenChange={(open) => {
          setBrowseOpen(open);
          if (!open) setBrowseAdapter(undefined);
        }}
        query={query}
        onQueryChange={setQuery}
        selectedAddress={formData.collateralAsset}
        onSelect={handleAssetSelected}
        manualValue={manualValue}
        onManualChange={(addr) => {
          setManualValue(addr);
          if (addr) {
            handleAssetSelected({
              address: addr,
              symbol: 'Custom',
              name: 'Custom token',
              chainId: chainId ?? 0,
              decimals: 18,
              source: 'custom',
              curated: false,
            });
          }
        }}
        manualChainId={chainId}
      />

      {/* Per-adapter browse modal (existing supported-assets experience) */}
      <SupportedAssetPicker
        open={browseOpen && !!browseAdapter}
        onOpenChange={(open) => {
          if (!open) setBrowseAdapter(undefined);
        }}
        adapterAddress={browseAdapter ?? ZERO}
        chainId={chainId}
        selectedAddress={formData.collateralAsset}
        onSelect={(asset) => {
          handleAssetSelected({
            address: asset.address,
            symbol: asset.symbol,
            name: asset.name,
            chainId: chainId ?? 0,
            decimals: asset.decimals,
            source: asset.isB20 ? 'b20' : asset.provider === 'robinhood' ? 'robinhood' : 'erc20',
            logoUri: asset.logoUri,
            feed: asset.feed,
            requiresAllowlist: asset.requiresAllowlist,
            curated: true,
          });
        }}
        manualValue={manualValue}
        onManualChange={(addr) => {
          setManualValue(addr);
          if (addr) setFormData({ collateralAsset: addr });
        }}
      />
    </div>
  );
}
