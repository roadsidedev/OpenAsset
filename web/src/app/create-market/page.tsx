"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore, WIZARD_STEPS } from "@/store/useMarketStore";
import { usePublicClient } from "wagmi";
import { parseUnits, formatUnits, isAddress, encodeAbiParameters, type Address } from "viem";
import { toast } from "sonner";
import { AdapterSelect } from "@/components/adapters/AdapterSelect";
import { TokenAddressInput } from "@/components/tokens/TokenAddressInput";
import { AssetSourceStep } from "@/components/create-market/AssetSourceStep";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useSession } from "@/context/SessionContext";
import { useChainOrchestrator } from "@/hooks/useChainOrchestrator";
import { useTxTrail } from "@/store/useTxTrail";
import { Confetti } from "@/components/Confetti";
import { getContracts } from "@/lib/contracts";
import { buildAssetCatalog, findCatalogAsset } from "@/lib/assetCatalog";
import { getChainLabel } from "@/lib/chainLabels";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { decodeContractError } from "@/lib/contractErrors";
import { validateInitialLiquidityUSD, MIN_INITIAL_LIQUIDITY_USD } from "@/lib/minDeposit";
import { cn } from "@/lib/utils";
import { Rocket, ArrowLeft, ArrowRight, CheckCircle, Warning, Wallet, X } from "@phosphor-icons/react";
import { isB20Token, getB20Info, B20_RISK_DISCLOSURE, b20MarketHoursLabel, BASE_SEQUENCER_FEED } from "@/lib/b20";
import { getProviderAsset, getProviderAssetByAddress, getProviderSequencerFeed, PROVIDER_IDS } from "@/lib/providerBundles";

const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const STEP_ICONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function CreateMarketPage() {
  const router = useRouter();
  const session = useSession();
  const { address: userAddress } = session;
  const publicClient = usePublicClient();
  const walletChainId = session.chainId ?? undefined;
  const { step, formData, setStep, setFormData, reset } = useMarketStore();
  const { createMarket, clearError } = useContractInteraction();
  const { nudgeChain } = useChainOrchestrator();

  // The selected asset's NATIVE chain is the source of truth — not the
  // wallet's current chain. The wallet may still be mid-switch (or on a
  // different network entirely); resolving contracts/adapters/metadata against
  // the wallet chain retains wrong-chain addresses after a switch. Until the
  // wallet converges, the wizard already targets the asset's chain.
  const catalog = useMemo(() => buildAssetCatalog(), []);
  const selectedCatalogAsset = useMemo(
    () => findCatalogAsset(catalog, formData.collateralAsset),
    [catalog, formData.collateralAsset],
  );
  const chainId = selectedCatalogAsset?.chainId ?? walletChainId;
  const recordTx = useTxTrail((s) => s.record);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const contracts = useMemo(() => (chainId ? getContracts(chainId) : undefined), [chainId]);

  const { data: collateralToken } = useTokenMetadata(
    isAddress(formData.collateralAsset) ? formData.collateralAsset : undefined,
    chainId,
  );
  const { data: lendingToken } = useTokenMetadata(
    isAddress(formData.lendingAsset) ? formData.lendingAsset : undefined,
    chainId,
  );
  const b20Info = isB20Token(formData.collateralAsset, chainId) ? getB20Info(formData.collateralAsset, chainId) : undefined;
  const providerAsset = getProviderAsset(chainId, formData.collateralAsset);
  const knownProviderAsset = getProviderAssetByAddress(formData.collateralAsset);
  const isB20Selected = !!b20Info;
  const isRobinhoodSelected = providerAsset?.provider === 'robinhood';

  const isB20Chain = chainId === 8453;
  const isRobinhoodChain = chainId === 4663;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeploying) {
        reset();
        router.push("/markets");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDeploying, reset, router]);

  // Registry verification map — queried on-chain, fallback to hardcoded if registry not deployed
  const [registryVerification, setRegistryVerification] = useState<Record<string, { verified: boolean; deprecated: boolean }>>({});

  useEffect(() => {
    if (!contracts?.adapterRegistry || !publicClient || contracts.adapterRegistry === "0x0000000000000000000000000000000000000000") return;
    const registry = contracts.adapterRegistry as Address;
    const allAddrs = [
      contracts.erc20Adapter, contracts.erc721Adapter, contracts.b20AssetAdapter,
      contracts.chainlinkAdapter, contracts.uniswapV3TWAPAdapter, contracts.chainlinkEquityFeedAdapter,
      contracts.dexSwapLiquidationAdapter, contracts.nftAuctionLiquidationAdapter,
      contracts.standardPositionAdapter, contracts.soulboundPositionAdapter, contracts.transferablePositionAdapter,
      contracts.b20PolicyComplianceAdapter, contracts.robinhoodComplianceAdapter,
    ].filter((a): a is string => !!a && a !== "0x0000000000000000000000000000000000000000");
    if (allAddrs.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(allAddrs.map(async (addr) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const info: any = await publicClient.readContract({
            address: registry,
            abi: [{ name: 'getAdapterInfo', type: 'function', stateMutability: 'view', inputs: [{ name: 'adapter', type: 'address' }], outputs: [{ name: 'adapterAddress', type: 'address' }, { name: 'adapterType', type: 'uint8' }, { name: 'registeredBy', type: 'address' }, { name: 'verified', type: 'bool' }, { name: 'deprecated', type: 'bool' }, { name: 'auditReference', type: 'string' }, { name: 'registeredAt', type: 'uint256' }, { name: 'totalValueSecured', type: 'uint256' }] }],
            functionName: 'getAdapterInfo',
            args: [addr as Address],
          });
          return { addr: addr.toLowerCase(), verified: Boolean(info.verified), deprecated: Boolean(info.deprecated) };
        } catch {
          // Not registered — treat as unverified but selectable if hardcoded; surface warning via deprecated=false
          return { addr: addr.toLowerCase(), verified: false, deprecated: false };
        }
      }));
      if (cancelled) return;
      const next: Record<string, { verified: boolean; deprecated: boolean }> = {};
      for (const r of results) if (r.status === 'fulfilled') next[r.value.addr] = { verified: r.value.verified, deprecated: r.value.deprecated };
      setRegistryVerification(next);
    })();
    return () => { cancelled = true; };
  }, [contracts?.adapterRegistry, publicClient, contracts]);

  const getVerification = (addr: string): { verified: boolean; deprecated: boolean } => {
    const key = addr.toLowerCase();
    return registryVerification[key] ?? { verified: false, deprecated: false };
  };

  // All adapters from contract addresses — verification/deprecation now from on-chain registry
  const adapters = useMemo((): Record<string, import("@/components/create-market/types").AdapterOption[]> => {
    if (!contracts) return {};
    const isB20 = isB20Chain && contracts.b20AssetAdapter && contracts.b20AssetAdapter !== "0x0000000000000000000000000000000000000000";
    const isRobinhood = isRobinhoodChain && contracts.robinhoodComplianceAdapter && contracts.robinhoodComplianceAdapter !== "0x0000000000000000000000000000000000000000";
    const mk = (address: string, name: string, type: number): import("@/components/create-market/types").AdapterOption => {
      const v = getVerification(address);
      return { address, name, type, verified: v.verified, deprecated: v.deprecated };
    };
    return {
      ASSET: [
        mk(contracts.erc20Adapter || "", "ERC20Adapter", 0),
        mk(contracts.erc721Adapter || "", "ERC721Adapter", 0),
        ...(isB20 ? [mk(contracts.b20AssetAdapter, "B20AssetAdapter (Base Tokenized Stocks)", 0)] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      ORACLE: [
        mk(contracts.chainlinkAdapter || "", "ChainlinkAdapter", 1),
        ...(contracts.uniswapV3TWAPAdapter && contracts.uniswapV3TWAPAdapter !== "0x0000000000000000000000000000000000000000" ? [mk(contracts.uniswapV3TWAPAdapter, "UniswapV3TWAPAdapter", 1)] : []),
        ...((isB20 || isRobinhood) && contracts.chainlinkEquityFeedAdapter && contracts.chainlinkEquityFeedAdapter !== "0x0000000000000000000000000000000000000000" ? [mk(contracts.chainlinkEquityFeedAdapter, isRobinhood ? "ChainlinkEquityFeedAdapter (Robinhood Stock Token)": "ChainlinkEquityFeedAdapter (B20 TRV 24/5, 90000s)", 1)] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      LIQUIDATION: [
        mk(contracts.dexSwapLiquidationAdapter || "", "DEXSwapLiquidationAdapter (default for B20 — 24/7 DEX)", 3),
        mk(contracts.nftAuctionLiquidationAdapter || "", "NFTAuctionLiquidationAdapter", 3),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      POSITION: [
        mk(contracts.standardPositionAdapter || "", "StandardPositionAdapter", 4),
        mk(contracts.soulboundPositionAdapter || "", "SoulboundPositionAdapter (recommended for B20 compliance)", 4),
        mk(contracts.transferablePositionAdapter || "", "TransferablePositionAdapter", 4),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      COMPLIANCE: [
        ...(isB20 && contracts.b20PolicyComplianceAdapter && contracts.b20PolicyComplianceAdapter !== "0x0000000000000000000000000000000000000000" ? [mk(contracts.b20PolicyComplianceAdapter, "B20PolicyComplianceAdapter", 2)] : []),
        ...(isRobinhood && contracts.robinhoodComplianceAdapter && contracts.robinhoodComplianceAdapter !== "0x0000000000000000000000000000000000000000" ? [mk(contracts.robinhoodComplianceAdapter, "ManagedAllowlistComplianceAdapter (Robinhood)", 2)] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
    };
  }, [contracts, isB20Chain, isRobinhoodChain, registryVerification]);

  const handleNext = () => setStep(Math.min(step + 1, 8));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  const findAdapterName = (category: string, addr: string): string => {
    if (!addr) return "Not selected";
    const match = adapters[category]?.find((a) => a.address.toLowerCase() === addr.toLowerCase());
    return match?.name || addr.slice(0, 10) + "...";
  };


  const validateConfig = async (): Promise<string | null> => {
    if (!formData.collateralAsset) return "Collateral asset is required.";
    if (!isAddress(formData.collateralAsset)) return "Collateral asset is not a valid address.";
    if (!formData.lendingAsset) return "Lending asset is required.";
    if (knownProviderAsset && knownProviderAsset.chainId !== chainId) {
      return `${knownProviderAsset.symbol} is a ${knownProviderAsset.provider === 'b20' ? 'Base' : 'Robinhood Chain'} provider asset and cannot be created on this network.`;
    }
    if (isRobinhoodChain && !providerAsset) {
      return "Robinhood Chain markets must use an approved provider-catalog asset; manual generic ERC-20 creation is disabled.";
    }
    if (isRobinhoodSelected) {
      const sequencerFeed = getProviderSequencerFeed(chainId ?? 0, 'robinhood');
      if (!sequencerFeed || !isAddress(sequencerFeed) || sequencerFeed === "0x0000000000000000000000000000000000000000") {
        return "Robinhood Chain sequencer feed is not configured; market creation is blocked fail-closed.";
      }
    }
    if (!isAddress(formData.lendingAsset)) return "Lending asset is not a valid address.";
    if (!formData.assetAdapter) return "Asset adapter is required.";
    if (!formData.oracleAdapter) return "Oracle adapter is required.";
    if (!formData.liquidationAdapter) return "Liquidation adapter is required.";
    if (!formData.positionAdapter) return "Position adapter is required.";

    if (formData.ltv <= 0 || formData.ltv > 95) return "LTV must be between 1% and 95%.";
    if (formData.apr < 0 || formData.apr > 100) return "APR must be between 0% and 100%.";
    if (formData.duration <= 0 || formData.duration > 365) return "Duration must be between 1 and 365 days.";
    if (formData.gracePeriod <= 0) return "Grace period must be greater than zero.";

    const liquidityCheck = validateInitialLiquidityUSD(formData.liquidity);
    if (!liquidityCheck.ok) return liquidityCheck.error ?? "Invalid liquidity.";

    if (!publicClient) return "Network client not available. Connect your wallet.";
    if (!contracts?.marketFactory) return "Factory not configured for this chain.";

    // Validate collateral is a deployed contract on this chain
    const collateralCode = await publicClient.getBytecode({
      address: formData.collateralAsset as Address,
    });
    if (!collateralCode || collateralCode === "0x") {
      return "Collateral asset is not a smart contract on this network. Check you are using the correct token address for this chain.";
    }

    // Validate lending asset is allowlisted by the factory
    const allowed = await publicClient.readContract({
      address: contracts.marketFactory as Address,
      abi: [{ name: 'isAllowedLendingAsset', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }],
      functionName: 'isAllowedLendingAsset',
      args: [formData.lendingAsset as Address],
    }).catch(() => false);
    if (!allowed) {
      return "The lending asset is not allowlisted by the factory. Use USDC on this network.";
    }

    return null;
  };

  const handleDeploy = async () => {
    if (!session.ready) return;
    if (!session.isAuthenticated || !userAddress) {
      toast.error("Please sign in to deploy a market.");
      return;
    }
    if (!contracts?.marketFactory) {
      toast.error("Factory address not configured for this chain.");
      return;
    }

    const validationError = await validateConfig();
    if (validationError) {
      toast.error(validationError);
      setStep(1);
      return;
    }

    setIsDeploying(true);
    clearError();

    const toastId = toast.loading("Waiting for wallet confirmation...");

    try {
      const durationSeconds = formData.duration * 86400;
      const config = {
        lpAddress: userAddress,
        collateralAsset: formData.collateralAsset,
        assetAdapter: formData.assetAdapter,
        oracleAdapter: formData.oracleAdapter,
        complianceAdapter: formData.enableCompliance ? formData.complianceAdapter : "0x0000000000000000000000000000000000000000" as Address,
        liquidationAdapter: formData.liquidationAdapter,
        positionAdapter: formData.positionAdapter,
        lendingAsset: formData.lendingAsset,
        ltvBasisPoints: BigInt(Math.round(formData.ltv * 100)),
        aprBasisPoints: BigInt(Math.round(formData.apr * 100)),
        durationSeconds: BigInt(durationSeconds),
        gracePeriodHours: BigInt(formData.gracePeriod),
        enableHealthFactor: formData.enableHealthFactor,
        healthFactorThreshold: BigInt(Math.round(formData.healthFactorThreshold * 100)),
        enableCircuitBreaker: formData.enableCircuitBreaker,
        pauseThresholdBps: BigInt(formData.pauseThresholdBps),
        lookbackPeriodSeconds: BigInt(formData.lookbackPeriodSeconds),
        resumeThresholdBps: BigInt(formData.resumeThresholdBps),
        cooldownSeconds: BigInt(formData.cooldownSeconds),
      };

      const initialLiquidity = formData.liquidity
        ? parseUnits(formData.liquidity, 6)
        : BigInt(0);

      const b20Config = isB20Selected && b20Info
        ? {
            feed: b20Info.feed,
            maxStaleness: BigInt(90000),
            l2Sequencer: chainId === 8453
              ? BASE_SEQUENCER_FEED
              : "0x0000000000000000000000000000000000000000",
          }
        : undefined;

      const robinhoodSequencer = getProviderSequencerFeed(chainId ?? 0, 'robinhood');
      const robinhoodProviderConfig = isRobinhoodSelected && providerAsset?.feed && robinhoodSequencer
        ? {
            providerId: PROVIDER_IDS.ROBINHOOD,
            providerData: encodeAbiParameters(
              [{ type: 'address' }, { type: 'uint256' }, { type: 'address' }],
              [providerAsset.feed as Address, BigInt(86400), robinhoodSequencer as Address],
            ),
          }
        : undefined;

      const result = await createMarket(
        config,
        contracts.marketFactory,
        initialLiquidity,
        b20Config,
        robinhoodProviderConfig,
        chainId,
      );
      toast.success("Market deployed successfully!", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`,
      });
      recordTx({
        type: 'MARKET_CREATED',
        txHash: result.txHash,
        chainId: chainId ?? 0,
        address: userAddress,
        summary: `${collateralToken?.symbol || formData.collateralAsset.slice(0, 6) + '…'} market · ${formData.liquidity || '?'} ${lendingToken?.symbol || 'USDC'} liquidity`,
        details: {
          market: result.receipt?.logs?.[0]?.address ?? '',
          txHash: result.txHash,
          collateral: formData.collateralAsset,
          message: `${collateralToken?.symbol || 'Market'} market created with ${formData.liquidity || '?'} ${lendingToken?.symbol || 'USDC'} liquidity`,
        },
      });
      setShowConfetti(true);
      setTimeout(() => {
        reset();
        router.push("/markets");
      }, 5000);
    } catch (err) {
      toast.error(decodeContractError(err), { id: toastId });
    } finally {
      setIsDeploying(false);
    }
  };

  const progress = (step / 8) * 100;

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <main className="mx-auto min-w-0 max-w-2xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 space-y-5 sm:space-y-6 md:space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg md:text-xl font-bold text-foreground text-balance">Create Market</h1>
            <button
              type="button"
              onClick={() => {
                reset();
                router.push("/markets");
              }}
              className="inline-flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Cancel and exit"
              title="Cancel (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure flat parameters and deploy an isolated lending market
          </p>
        </div>

        {/* Chain indicator — asset-native target, actionable when wallet lags */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-2xl px-4 py-2 flex-wrap">
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {session.walletType === 'embedded' ? 'Embedded wallet' : session.walletType === 'external' ? 'External wallet' : 'No wallet'} ·{' '}
            {selectedCatalogAsset
              ? `Target: ${getChainLabel(selectedCatalogAsset.chainId)}`
              : getChainLabel(chainId)}
            {walletChainId !== undefined &&
              selectedCatalogAsset &&
              walletChainId !== selectedCatalogAsset.chainId && (
                <span className="text-amber-600 dark:text-amber-400"> (wallet on {getChainLabel(walletChainId)} — switching…)</span>
              )}
          </span>
          {!contracts ? (
            <>
              <span className="text-amber-500 font-medium truncate">(unsupported)</span>
              <button
                type="button"
                onClick={() => nudgeChain(chainId ?? 84532, `Market creation targets ${getChainLabel(chainId ?? 84532)}`)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ice-300 dark:bg-ice-400 px-3 py-1 text-[11px] font-bold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors shrink-0"
              >
                Switch to {getChainLabel(chainId ?? 84532)}
              </button>
            </>
          ) : walletChainId !== undefined && chainId !== undefined && walletChainId !== chainId ? (
            <button
              type="button"
              onClick={() => nudgeChain(chainId, `${selectedCatalogAsset?.symbol ?? 'Asset'} lives on ${getChainLabel(chainId)}`)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ice-300 dark:bg-ice-400 px-3 py-1 text-[11px] font-bold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors shrink-0"
            >
              Switch to {getChainLabel(chainId)}
            </button>
          ) : null}
        </div>

        {/* Step Indicator */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STEP_ICONS.map((s) => (
              <div
                key={s}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  s < step
                    ? "bg-ice-300 dark:bg-ice-400 text-slate-900"
                    : s === step
                    ? "bg-primary text-primary-foreground ring-2 ring-ice-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                    {s < step ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-ice-300 dark:bg-ice-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Step {step} of 8: <span className="font-medium text-foreground">{WIZARD_STEPS[step - 1].label}</span>
          </p>
        </div>

        {/* Step Content Card */}
        <div className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-5 md:p-8 space-y-5 sm:space-y-6 shadow-soft">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Collateral Asset</h2>
              <p className="text-sm text-muted-foreground">
                Search what you want to lend against — tokenized stocks, Robinhood equities or tokens. The right adapter, provider bundle and network are applied automatically.
              </p>
              <AssetSourceStep
                formData={formData}
                setFormData={setFormData}
                chainId={chainId}
                assetAdapters={adapters["ASSET"] || []}
                collateralPreview={
                  collateralToken?.isValid
                    ? { symbol: collateralToken.symbol, name: collateralToken.name, logoUri: collateralToken.logoUri ?? null }
                    : null
                }
              />
              {isB20Selected && b20Info && (
                <div className="rounded-2xl border border-ice-300/30 dark:border-ice-400/20 bg-ice-50 dark:bg-ice-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> B20 Tokenized Stock detected — {b20Info.symbol} ({b20Info.name})
                  </div>
                  <p className="text-xs text-muted-foreground">Feed: {b20Info.feed} · TRV 24/5 · 8 decimals · heartbeat 24h/0.5% · PolicyRegistry 0x3f3E…5CaD · Multiplier WAD 1e18</p>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{b20MarketHoursLabel()}</p>
                  <p className="text-xs text-muted-foreground">B20 stack auto-suggested: <strong>ChainlinkEquityFeedAdapter (90000s)</strong> + <strong>B20PolicyComplianceAdapter</strong> + Soulbound. DEXSwap is the only valid liquidation for B20 (IssuerRedemption is AP-only).</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Oracle</h2>
              <p className="text-sm text-muted-foreground">
                Select the price oracle for this market. TWAP recommended for crypto; <strong>ChainlinkEquityFeedAdapter</strong> required for B20/RWA.
              </p>
              {isB20Selected && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  B20 requires <strong>ChainlinkEquityFeedAdapter</strong> (not TWAP). TWAP has no B20 pools. Feed is total-return: <code>price = underlying × multiplier</code> (8→18 dec, 90000s staleness, sequencer 0xBCF8…6433). Weekend/holiday → <code>isTrusted=false</code> → circuit breaker <code>PAUSED_STALE_ORACLE</code>.
                </div>
              )}
              <AdapterSelect
                label="Oracle Adapter"
                description="Provides collateral price feeds with trust signal (isTrusted covers staleness, sequencer, 24/5 window)"
                adapters={adapters["ORACLE"] || []}
                selected={formData.oracleAdapter}
                onSelect={(addr) => setFormData({ oracleAdapter: addr })}
                required
                chainId={chainId}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Compliance</h2>
              <p className="text-sm text-muted-foreground">
                Optional — enable compliance checks for borrower eligibility.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFormData({ enableCompliance: !formData.enableCompliance })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    formData.enableCompliance ? "bg-ice-400" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.enableCompliance ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span className="text-sm text-foreground">Enable Compliance Adapter</span>
              </div>
              {formData.enableCompliance ? (
                adapters["COMPLIANCE"] && adapters["COMPLIANCE"].length > 0 ? (
                  <AdapterSelect
                    label="Compliance Adapter"
                    description="Fail-closed eligibility. Verified = audited; unverified = permissionless but not audited."
                    adapters={adapters["COMPLIANCE"] || []}
                    selected={formData.complianceAdapter}
                    onSelect={(addr) => setFormData({ complianceAdapter: addr })}
                    required
                    chainId={chainId}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                      <Warning className="h-4 w-4 mt-0.5 shrink-0" />
                      No verified compliance adapter for this chain/provider. You can paste a custom adapter address or disable compliance for permissionless markets.
                    </div>
                    <TokenAddressInput
                      label="Custom Compliance Adapter (advanced)"
                      placeholder="0x... (must implement IComplianceAdapter)"
                      value={formData.complianceAdapter}
                      onChange={(addr) => setFormData({ complianceAdapter: addr })}
                      chainId={chainId}
                      required
                    />
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Disabled — any address can borrow. Recommended for long-tail tokens. For B20/Robinhood equities, compliance is <strong>required</strong> (enable above).</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Liquidation</h2>
              <p className="text-sm text-muted-foreground">
                How defaults are resolved. Async adapters (issuer redemption) require compliance.
              </p>
              <AdapterSelect
                label="Liquidation Adapter"
                description="How defaults are resolved"
                adapters={adapters["LIQUIDATION"] || []}
                selected={formData.liquidationAdapter}
                onSelect={(addr) => setFormData({ liquidationAdapter: addr })}
                required
                chainId={chainId}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Position</h2>
              <p className="text-sm text-muted-foreground">
                How loan positions are represented and tracked.
              </p>
              <AdapterSelect
                label="Position Adapter"
                description="Standard: cheapest gas. Soulbound: non-transferable NFT. Transferable: sellable position."
                adapters={adapters["POSITION"] || []}
                selected={formData.positionAdapter}
                onSelect={(addr) => setFormData({ positionAdapter: addr })}
                required
                chainId={chainId}
              />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Risk Parameters</h2>
                <p className="text-xs text-muted-foreground">Choose a preset or tune parameters manually. All values are immutable after deployment.</p>
              </div>

              {/* Preset quick selector */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { key: 'conservative', label: 'Conservative', ltv: 35, apr: 8.0, duration: 14, grace: 12, health: 125 },
                  { key: 'moderate', label: 'Balanced', ltv: 50, apr: 12.0, duration: 30, grace: 1, health: 120 },
                  { key: 'aggressive', label: 'High Yield', ltv: 75, apr: 18.5, duration: 60, grace: 24, health: 115 },
                ].map((preset) => {
                  const active =
                    formData.ltv === preset.ltv &&
                    formData.apr === preset.apr &&
                    formData.duration === preset.duration &&
                    formData.gracePeriod === preset.grace &&
                    formData.healthFactorThreshold === preset.health;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ltv: preset.ltv,
                          apr: preset.apr,
                          duration: preset.duration,
                          gracePeriod: preset.grace,
                          healthFactorThreshold: preset.health,
                        })
                      }
                      className={cn(
                        'shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors',
                        active
                          ? 'border-ice-400 bg-ice-500/10 text-ice-700 dark:text-ice-300'
                          : 'border-border bg-card hover:bg-accent'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Live computed banner */}
              <div className="rounded-2xl border border-border bg-card p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Live Market Profile
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/60 p-2">
                    <div className="text-[10px] text-muted-foreground">Over-collateral</div>
                    <div className="text-sm font-bold text-foreground">{formData.ltv > 0 ? (100 / formData.ltv).toFixed(2) : '—'}x</div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-2">
                    <div className="text-[10px] text-muted-foreground">Est. 30d return</div>
                    <div className="text-sm font-bold text-foreground">
                      {((1000 * (formData.apr / 100) * (formData.duration / 365))).toFixed(2)} USDC
                    </div>
                    <div className="text-[10px] text-muted-foreground">per 1,000 borrowed</div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-2">
                    <div className="text-[10px] text-muted-foreground">Liquidation buffer</div>
                    <div className="text-sm font-bold text-foreground">+{100 - formData.ltv}%</div>
                  </div>
                </div>
              </div>

              {/* Parameter cards */}
              <div className="space-y-4">
                {/* LTV */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">Loan-to-Value (LTV)</div>
                      <div className="text-[11px] text-muted-foreground">Max loan value as % of collateral.</div>
                    </div>
                    <span className={cn('text-xs font-semibold px-2 py-1 rounded-full border shrink-0',
                      formData.ltv <= 50 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' :
                      formData.ltv <= 75 ? 'bg-ice-500/10 text-ice-600 border-ice-500/20 dark:text-ice-300' :
                      formData.ltv <= 85 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' :
                      'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400')}>
                      {formData.ltv <= 50 ? 'Conservative' : formData.ltv <= 75 ? 'Balanced' : formData.ltv <= 85 ? 'Aggressive' : 'High Risk'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="95"
                    value={formData.ltv}
                    onChange={(e) => setFormData({ ltv: Number(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-ice-500"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1%</span>
                    <span className="font-medium text-foreground">{formData.ltv}%</span>
                    <span>95%</span>
                  </div>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium hover:text-foreground">What does LTV mean?</summary>
                    <p className="mt-2 space-y-1">
                      <strong className="text-foreground">Lower LTV = safer.</strong> 50% means borrowers must deposit 2x the loan value.
                      Higher LTV attracts more borrowers, but a smaller price drop triggers liquidation.
                      For volatile collateral, use ≤75%; for stablecoins/B20 with TRV, ≤85–95% may be acceptable.
                    </p>
                  </details>
                </div>

                {/* APR + simulation */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">APR</div>
                      <div className="text-[11px] text-muted-foreground">Yearly interest charged to borrowers.</div>
                    </div>
                    <span className="text-xs font-bold text-foreground shrink-0">{formData.apr}%</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <input
                      type="number"
                      value={formData.apr}
                      onChange={(e) => setFormData({ apr: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                      placeholder="8"
                    />
                    <div className="rounded-2xl border border-border bg-muted/30 px-3 py-2 text-xs">
                      <div className="text-muted-foreground">30d on 1,000</div>
                      <div className="font-semibold text-foreground">
                        {(1000 * (formData.apr / 100) * (formData.duration / 365)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={formData.apr}
                    onChange={(e) => setFormData({ apr: Number(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-ice-500"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1%</span>
                    <span>{formData.apr}%</span>
                    <span>40%</span>
                  </div>
                </div>

                {/* Duration + Grace */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground">Term</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Duration</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ duration: Math.max(1, formData.duration - 1) })}
                          className="h-9 w-9 shrink-0 rounded-xl border border-border bg-muted/50 text-sm font-semibold hover:bg-accent"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={formData.duration}
                          onChange={(e) => setFormData({ duration: Number(e.target.value) })}
                          className="flex-1 rounded-2xl border border-border bg-muted/50 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ice-400"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ duration: Math.min(365, formData.duration + 1) })}
                          className="h-9 w-9 shrink-0 rounded-xl border border-border bg-muted/50 text-sm font-semibold hover:bg-accent"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-[11px] text-muted-foreground">days</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Grace Period</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ gracePeriod: Math.max(0, formData.gracePeriod - 1) })}
                          className="h-9 w-9 shrink-0 rounded-xl border border-border bg-muted/50 text-sm font-semibold hover:bg-accent"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={formData.gracePeriod}
                          onChange={(e) => setFormData({ gracePeriod: Number(e.target.value) })}
                          className="flex-1 rounded-2xl border border-border bg-muted/50 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ice-400"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ gracePeriod: Math.min(72, formData.gracePeriod + 1) })}
                          className="h-9 w-9 shrink-0 rounded-xl border border-border bg-muted/50 text-sm font-semibold hover:bg-accent"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-[11px] text-muted-foreground">hours</div>
                    </div>
                  </div>
                  {formData.gracePeriod < 6 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl p-2">
                      Short grace window: {formData.gracePeriod}h gives borrowers little time to repay after expiry.
                    </div>
                  )}
                  {formData.duration > 90 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl p-2">
                      Long duration locks liquidity for {formData.duration} days. Consider shorter terms for volatile assets.
                    </div>
                  )}
                </div>

                {/* Health Factor */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">Health Factor</div>
                      <div className="text-[11px] text-muted-foreground">Auto-liquidate before expiry when collateral weakens.</div>
                    </div>
                    <button
                      onClick={() => setFormData({ enableHealthFactor: !formData.enableHealthFactor })}
                      className={cn('shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors', formData.enableHealthFactor ? 'bg-ice-400' : 'bg-muted')}
                      aria-label="Toggle health factor"
                    >
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', formData.enableHealthFactor ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                  {formData.enableHealthFactor ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Threshold</span>
                        <span className="font-semibold text-foreground">{formData.healthFactorThreshold}%</span>
                      </div>
                      <input
                        type="range"
                        min="110"
                        max="200"
                        value={formData.healthFactorThreshold}
                        onChange={(e) => setFormData({ healthFactorThreshold: Number(e.target.value) })}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-ice-500"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Triggers when <code className="bg-muted px-1 py-0.5 rounded">health = collateral / debt &lt; {formData.healthFactorThreshold / 100}x</code>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-xl p-2">
                      Expiry-only: loans liquidate only after {formData.duration} days + {formData.gracePeriod}h grace. Enable for volatile collateral.
                    </p>
                  )}
                </div>

                {/* Circuit Breaker */}
                <details className="rounded-2xl border border-border bg-card overflow-hidden">
                  <summary className="px-4 py-3 text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 flex items-center justify-between">
                    <span>Circuit Breaker</span>
                    <span className={cn('text-xs font-medium', formData.enableCircuitBreaker ? 'text-emerald-600' : 'text-muted-foreground')}>
                      {formData.enableCircuitBreaker ? 'Enabled' : 'Disabled'}
                    </span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">Auto-pauses new loans on oracle failure or large price swings.</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setFormData({ enableCircuitBreaker: !formData.enableCircuitBreaker })}
                        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', formData.enableCircuitBreaker ? 'bg-ice-400' : 'bg-muted')}
                        aria-label="Toggle circuit breaker"
                      >
                        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', formData.enableCircuitBreaker ? 'translate-x-6' : 'translate-x-1')} />
                      </button>
                      <span className="text-sm text-foreground">Enable Circuit Breaker</span>
                    </div>
                    {formData.enableCircuitBreaker && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-muted/60 p-2">
                          <div className="text-muted-foreground">Pause threshold</div>
                          <div className="font-semibold text-foreground">{formData.pauseThresholdBps / 100}% swing</div>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-2">
                          <div className="text-muted-foreground">Resume / cooldown</div>
                          <div className="font-semibold text-foreground">{formData.resumeThresholdBps / 100}% + {formData.cooldownSeconds / 3600}h</div>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Lending Asset & Liquidity</h2>
              <p className="text-sm text-muted-foreground">
                Select the stablecoin for lending and provide initial liquidity.
              </p>
              <TokenAddressInput
                label="Lending Asset (Stablecoin)"
                placeholder={contracts?.usdc || DEFAULT_USDC}
                value={formData.lendingAsset}
                onChange={(addr) => setFormData({ lendingAsset: addr })}
                chainId={chainId}
                required
              />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Initial Liquidity (tokens, 6 decimals for USDC) — minimum ${MIN_INITIAL_LIQUIDITY_USD.toLocaleString()}
                </label>
                <input
                  type="text"
                  placeholder="1000"
                  value={formData.liquidity}
                  onChange={(e) => setFormData({ liquidity: e.target.value })}
                  className={cn(
                    "w-full rounded-2xl border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground",
                    formData.liquidity && !validateInitialLiquidityUSD(formData.liquidity).ok
                      ? "border-destructive/50"
                      : "border-border",
                  )}
                />
                {formData.liquidity && !validateInitialLiquidityUSD(formData.liquidity).ok && (
                  <p className="text-xs text-destructive">{validateInitialLiquidityUSD(formData.liquidity).error}</p>
                )}
                {formData.liquidity && (() => {
                  try {
                    const raw = parseUnits(formData.liquidity, 6);
                    const fee = raw * BigInt(50) / BigInt(10000);
                    const net = raw - fee;
                    const fmt = (v: bigint) => formatUnits(v, 6);
                    return (
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Creation fee (0.5%)</span><span className="font-medium font-mono">{fmt(fee)} {lendingToken?.symbol || 'USDC'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Net liquidity to market</span><span className="font-semibold font-mono">{fmt(net)} {lendingToken?.symbol || 'USDC'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total approval needed</span><span className="font-mono">{fmt(raw)} {lendingToken?.symbol || 'USDC'}</span></div>
                        <p className="text-[11px] text-muted-foreground pt-1">Fee sent to protocol treasury; net liquidity seeds the pool and mints LP shares.</p>
                      </div>
                    );
                  } catch { return null; }
                })()}
                {/* Dry-run simulation */}
                {contracts?.marketFactory && formData.liquidity && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const raw = parseUnits(formData.liquidity, 6);
                        if (userAddress && formData.lendingAsset && publicClient && contracts.marketFactory) {
                          const allowance = await publicClient.readContract({
                            address: formData.lendingAsset as Address,
                            abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
                            functionName: 'allowance',
                            args: [userAddress as Address, contracts.marketFactory as Address],
                          }) as bigint;
                          if (allowance < raw) {
                            toast.info("Dry-run skipped: token approval is still needed", {
                              description: `Deploy will ask your wallet to approve ${formatUnits(raw, 6)} ${lendingToken?.symbol || 'USDC'} to the factory, then create the market.`,
                            });
                            return;
                          }
                        }
                        // MarketConfig tuple for simulateContract — mirrors MarketFactoryV2.MarketConfig
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const cfg: any = {
                          lpAddress: userAddress || "0x0000000000000000000000000000000000000000",
                          collateralAsset: formData.collateralAsset,
                          assetAdapter: formData.assetAdapter,
                          oracleAdapter: formData.oracleAdapter,
                          complianceAdapter: formData.enableCompliance ? formData.complianceAdapter : "0x0000000000000000000000000000000000000000",
                          liquidationAdapter: formData.liquidationAdapter,
                          positionAdapter: formData.positionAdapter,
                          lendingAsset: formData.lendingAsset,
                          ltvBasisPoints: BigInt(Math.round(formData.ltv * 100)),
                          aprBasisPoints: BigInt(Math.round(formData.apr * 100)),
                          durationSeconds: BigInt(formData.duration * 86400),
                          gracePeriodHours: BigInt(formData.gracePeriod),
                          enableHealthFactor: formData.enableHealthFactor,
                          healthFactorThreshold: BigInt(Math.round(formData.healthFactorThreshold * 100)),
                          enableCircuitBreaker: formData.enableCircuitBreaker,
                          pauseThresholdBps: BigInt(formData.pauseThresholdBps),
                          lookbackPeriodSeconds: BigInt(formData.lookbackPeriodSeconds),
                          resumeThresholdBps: BigInt(formData.resumeThresholdBps),
                          cooldownSeconds: BigInt(formData.cooldownSeconds),
                        };
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (publicClient as any).simulateContract({
                          address: contracts.marketFactory as Address,
                          abi: [{ name: 'createMarket', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'config', type: 'tuple', components: [{ name: 'lpAddress', type: 'address' }, { name: 'collateralAsset', type: 'address' }, { name: 'assetAdapter', type: 'address' }, { name: 'oracleAdapter', type: 'address' }, { name: 'complianceAdapter', type: 'address' }, { name: 'liquidationAdapter', type: 'address' }, { name: 'positionAdapter', type: 'address' }, { name: 'lendingAsset', type: 'address' }, { name: 'ltvBasisPoints', type: 'uint256' }, { name: 'aprBasisPoints', type: 'uint256' }, { name: 'durationSeconds', type: 'uint256' }, { name: 'gracePeriodHours', type: 'uint256' }, { name: 'enableHealthFactor', type: 'bool' }, { name: 'healthFactorThreshold', type: 'uint256' }, { name: 'enableCircuitBreaker', type: 'bool' }, { name: 'pauseThresholdBps', type: 'uint256' }, { name: 'lookbackPeriodSeconds', type: 'uint256' }, { name: 'resumeThresholdBps', type: 'uint256' }, { name: 'cooldownSeconds', type: 'uint256' }] }, { name: 'initialLiquidity', type: 'uint256' }], outputs: [{ name: 'marketAddress', type: 'address' }] }],
                          functionName: 'createMarket',
                          args: [cfg, raw],
                          account: userAddress as Address,
                        });
                        toast.success("Dry-run passed — market creation will succeed");
                      } catch (e) {
                        toast.error(decodeContractError(e), { description: "Fix the highlighted field and try again" });
                      }
                    }}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold hover:bg-accent"
                  >
                    Simulate deployment (dry-run)
                  </button>
                )}
                {/* Risk disclosure for high LTV / long-tail */}
                {!isB20Selected && (formData.ltv > 85 || formData.apr > 50) && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <strong>Risk note:</strong> {formData.ltv > 85 ? `High LTV ${formData.ltv}% leaves little buffer. ` : ''}{formData.apr > 50 ? `High APR ${formData.apr}% may be unattractive to borrowers. ` : ''}For volatile long-tail assets, consider LTV ≤75% and TWAP oracle.
                  </div>
                )}
                {formData.collateralAsset && !isB20Selected && !isRobinhoodSelected && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Generic ERC20 market: ensure the token has sufficient DEX liquidity for TWAP and no fee-on-transfer mechanics (see <code>isTransferable</code> check).
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Review & Confirm</h2>
                <p className="text-sm text-muted-foreground">Double-check everything. This will deploy a new isolated market on-chain — parameters are <strong>immutable</strong> after deployment.</p>
              </div>

              {isB20Selected && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-red-600 dark:text-red-400">{B20_RISK_DISCLOSURE.title}</h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-600/90 dark:text-red-300/90">
                    {B20_RISK_DISCLOSURE.bullets.map((b) => (<li key={b}>{b}</li>))}
                  </ul>
                  <label className="flex items-start gap-2 pt-2 text-xs">
                    <input type="checkbox" required className="h-3.5 w-3.5 rounded border-border mt-0.5" />
                    <span className="text-foreground">I understand US persons are ineligible and escrow dividends accrue to the market contract until repay.</span>
                  </label>
                </div>
              )}

              {/* Full market summary */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Market Summary</span>
                  <span className="text-xs text-muted-foreground">Chain {chainId === 84532 ? "Base Sepolia" : chainId === 11155111 ? "Sepolia" : chainId}</span>
                </div>
                <div className="p-4 space-y-4">
                  {/* Adapters with verification */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adapters</h4>
                    {[
                      ["Asset", findAdapterName("ASSET", formData.assetAdapter), formData.assetAdapter],
                      ["Oracle", findAdapterName("ORACLE", formData.oracleAdapter), formData.oracleAdapter],
                      ["Compliance", formData.enableCompliance ? findAdapterName("COMPLIANCE", formData.complianceAdapter) : "Disabled", formData.complianceAdapter],
                      ["Liquidation", findAdapterName("LIQUIDATION", formData.liquidationAdapter), formData.liquidationAdapter],
                      ["Position", findAdapterName("POSITION", formData.positionAdapter), formData.positionAdapter],
                    ].map(([label, name, addr]) => {
                      const v = addr ? getVerification(addr as string) : { verified: false, deprecated: false };
                      return (
                        <div key={label as string} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-sm text-muted-foreground">{label as string}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{name as string}</span>
                            {addr && (label as string) !== "Compliance" || (label as string) === "Compliance" && formData.enableCompliance ? (
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", v.verified ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : v.deprecated ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                                {v.deprecated ? "Deprecated" : v.verified ? "Verified" : "Unverified"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Risk & Terms */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk & Terms</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">LTV</div>
                        <div className="font-bold text-foreground">{formData.ltv}% <span className={cn("text-xs font-medium ml-1", formData.ltv > 85 ? "text-red-500" : formData.ltv > 75 ? "text-amber-500" : "text-emerald-500")}>({formData.ltv <= 50 ? "Conservative" : formData.ltv <= 75 ? "Balanced" : formData.ltv <= 85 ? "Aggressive" : "High Risk"})</span></div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">APR</div>
                        <div className="font-bold text-foreground">{formData.apr}% <span className="text-xs text-muted-foreground">→ {((formData.apr / 100) * (formData.duration / 365) * 100).toFixed(2)}% per loan</span></div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Duration</div>
                        <div className="font-bold text-foreground">{formData.duration} days + {formData.gracePeriod}h grace</div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Health Factor</div>
                        <div className="font-bold text-foreground">{formData.enableHealthFactor ? `${formData.healthFactorThreshold}% threshold` : "Disabled (expiry only)"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
                      <span>Circuit Breaker:</span>
                      <span className="font-medium text-foreground">{formData.enableCircuitBreaker ? `Enabled (${formData.pauseThresholdBps/100}% pause / ${formData.cooldownSeconds/3600}h cooldown)` : "Disabled"}</span>
                    </div>
                  </div>

                  {/* Assets */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assets & Liquidity</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Collateral</span><span className="font-medium text-foreground">{collateralToken?.isValid ? `${collateralToken.name} (${collateralToken.symbol})` : formData.collateralAsset.slice(0,10)+"..."}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Lending Asset</span><span className="font-medium text-foreground">{lendingToken?.isValid ? `${lendingToken.name} (${lendingToken.symbol})` : formData.lendingAsset.slice(0,10)+"..."}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Initial Liquidity</span><span className="font-medium text-foreground">{formData.liquidity} {lendingToken?.symbol || "tokens"}</span></div>
                      {formData.liquidity && (() => { try { const raw = parseUnits(formData.liquidity, 6); const fee = raw * BigInt(50) / BigInt(10000); const net = raw - fee; return <><div className="flex justify-between text-xs"><span className="text-muted-foreground">Protocol fee (0.5%)</span><span className="font-mono text-foreground">{formatUnits(fee, 6)} {lendingToken?.symbol || "USDC"}</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Net to market</span><span className="font-mono font-bold text-foreground">{formatUnits(net, 6)} {lendingToken?.symbol || "USDC"}</span></div></>; } catch { return null; }})()}
                      {isB20Selected && b20Info && <><div className="flex justify-between text-xs"><span className="text-muted-foreground">B20 Feed</span><span className="font-mono text-foreground">{b20Info.feed.slice(0,10)}...</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Staleness / Sequencer</span><span className="font-medium text-foreground">90000s / 0xBCF8…6433</span></div></>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Final confirmation */}
              <div className="rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Warning className="h-4 w-4 text-amber-500" />
                  Confirm Deployment
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Market will be <strong>isolated</strong> — insolvency in this market does not affect others.</li>
                  <li>Parameters above are <strong>immutable</strong> after deployment. Double-check LTV, APR, and adapters.</li>
                  <li>Deployment costs gas + 0.5% protocol fee on initial liquidity.</li>
                  <li>New markets are <strong>permissionless</strong> — anyone can supply/borrow per your terms.</li>
                </ul>
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input type="checkbox" id="deploy-confirm" className="h-4 w-4 rounded border-border mt-0.5 shrink-0" required />
                  <span className="text-sm text-foreground">I have reviewed the summary above and confirm deployment on <strong>{chainId === 84532 ? "Base Sepolia" : chainId === 11155111 ? "Sepolia" : `Chain ${chainId}`}</strong>. I understand parameters cannot be changed after deployment.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-premium active-press"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                reset();
                router.push("/markets");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-premium active-press"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
          {step < 8 ? (
            <button
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ice-300 dark:bg-ice-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-premium active-press shadow-glow"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !contracts?.marketFactory}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all w-full sm:w-auto",
                isDeploying || !contracts?.marketFactory
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-glow active-press"
              )}
            >
              <Rocket className="h-4 w-4" />
              {isDeploying ? "Deploying..." : "Deploy Market"}
            </button>
          )}
        </div>
      </main>
      {showConfetti && <Confetti />}
    </div>
  );
}
