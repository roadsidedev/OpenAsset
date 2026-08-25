"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore, WIZARD_STEPS } from "@/store/useMarketStore";
import { useAccount, usePublicClient } from "wagmi";
import { parseUnits, isAddress, type Address } from "viem";
import { toast } from "sonner";
import { AdapterSelector } from "@/components/adapters/AdapterSelector";
import { AdapterSelect } from "@/components/adapters/AdapterSelect";
import { TokenAddressInput } from "@/components/tokens/TokenAddressInput";
import { SupportedAssetPicker } from "@/components/tokens/SupportedAssetPicker";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { getContracts } from "@/lib/contracts";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { decodeContractError } from "@/lib/contractErrors";
import { cn } from "@/lib/utils";
import { Rocket, ArrowLeft, ArrowRight, CheckCircle, Warning, Wallet, MagnifyingGlass } from "@phosphor-icons/react";
import { isB20Token, getB20Info, B20_RISK_DISCLOSURE, isWithinB20TradingWindow, b20MarketHoursLabel } from "@/lib/b20";
import { adapterSupportsPicker, getSuggestedAdaptersForB20 } from "@/lib/supportedAssets";

interface AdapterOption {
  address: string;
  name: string;
  type: number;
  verified: boolean;
  deprecated: boolean;
}

const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ADAPTER_TYPE_NAMES = ["ASSET", "ORACLE", "COMPLIANCE", "LIQUIDATION", "POSITION"];

const STEP_ICONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function CreateMarketPage() {
  const router = useRouter();
  const { address: userAddress, chain } = useAccount();
  const publicClient = usePublicClient();
  const chainId = chain?.id;
  const { step, formData, setStep, setFormData, reset } = useMarketStore();
  const { createMarket, clearError } = useContractInteraction();
  const [isDeploying, setIsDeploying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const contracts = useMemo(() => getContracts(chainId), [chainId]);

  const { data: collateralToken } = useTokenMetadata(
    isAddress(formData.collateralAsset) ? formData.collateralAsset : undefined,
    chainId,
  );
  const { data: lendingToken } = useTokenMetadata(
    isAddress(formData.lendingAsset) ? formData.lendingAsset : undefined,
    chainId,
  );
  const b20Info = isB20Token(formData.collateralAsset) ? getB20Info(formData.collateralAsset) : undefined;
  const isB20Selected = !!b20Info;
  const b20HoursLabel = isWithinB20TradingWindow() ? b20MarketHoursLabel() : b20MarketHoursLabel();

  const isB20Chain = chainId === 8453 || chainId === 84532;
  // All adapters from hardcoded contract addresses — always available, no on-chain reads
  const adapters = useMemo((): Record<string, AdapterOption[]> => {
    if (!contracts) return {};
    const isB20 = isB20Chain && contracts.b20AssetAdapter && contracts.b20AssetAdapter !== "0x0000000000000000000000000000000000000000";
    return {
      ASSET: [
        { address: contracts.erc20Adapter || "", name: "ERC20Adapter", type: 0, verified: true, deprecated: false },
        { address: contracts.erc721Adapter || "", name: "ERC721Adapter", type: 0, verified: true, deprecated: false },
        ...(isB20 ? [{ address: contracts.b20AssetAdapter, name: "B20AssetAdapter (Base Tokenized Stocks)", type: 0, verified: true, deprecated: false }] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      ORACLE: [
        { address: contracts.chainlinkAdapter || "", name: "ChainlinkAdapter", type: 1, verified: true, deprecated: false },
        ...(contracts.uniswapV3TWAPAdapter && contracts.uniswapV3TWAPAdapter !== "0x0000000000000000000000000000000000000000" ? [{ address: contracts.uniswapV3TWAPAdapter, name: "UniswapV3TWAPAdapter", type: 1, verified: true, deprecated: false }] : []),
        ...(isB20 && contracts.chainlinkEquityFeedAdapter && contracts.chainlinkEquityFeedAdapter !== "0x0000000000000000000000000000000000000000" ? [{ address: contracts.chainlinkEquityFeedAdapter, name: "ChainlinkEquityFeedAdapter (B20 TRV 24/5, 90000s)", type: 1, verified: true, deprecated: false }] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      LIQUIDATION: [
        { address: contracts.dexSwapLiquidationAdapter || "", name: "DEXSwapLiquidationAdapter (default for B20 — 24/7 DEX)", type: 3, verified: true, deprecated: false },
        { address: contracts.nftAuctionLiquidationAdapter || "", name: "NFTAuctionLiquidationAdapter", type: 3, verified: true, deprecated: false },
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      POSITION: [
        { address: contracts.standardPositionAdapter || "", name: "StandardPositionAdapter", type: 4, verified: true, deprecated: false },
        { address: contracts.soulboundPositionAdapter || "", name: "SoulboundPositionAdapter (recommended for B20 compliance)", type: 4, verified: true, deprecated: false },
        { address: contracts.transferablePositionAdapter || "", name: "TransferablePositionAdapter", type: 4, verified: true, deprecated: false },
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
      COMPLIANCE: [
        ...(isB20 && contracts.b20PolicyComplianceAdapter && contracts.b20PolicyComplianceAdapter !== "0x0000000000000000000000000000000000000000" ? [{ address: contracts.b20PolicyComplianceAdapter, name: "B20PolicyComplianceAdapter", type: 2, verified: true, deprecated: false }] : []),
      ].filter(a => a.address && a.address !== "0x0000000000000000000000000000000000000000"),
    };
  }, [contracts, isB20Chain]);

  const handleNext = () => setStep(Math.min(step + 1, 8));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  const findAdapterName = (category: string, addr: string): string => {
    if (!addr) return "Not selected";
    const match = adapters[category]?.find((a) => a.address.toLowerCase() === addr.toLowerCase());
    return match?.name || addr.slice(0, 10) + "...";
  };

  const canShowPicker = adapterSupportsPicker(formData.assetAdapter, chainId);
  const handlePickerSelect = (asset: { address: string; symbol: string; isB20?: boolean }) => {
    const isB20Asset = !!asset.isB20 || isB20Token(asset.address);
    if (isB20Asset && chainId && contracts) {
      const suggested = getSuggestedAdaptersForB20(chainId);
      if (suggested) {
        // Interceptive auto-select: fill collateral + suggest full B20 stack (user can still override)
        setFormData({
          collateralAsset: asset.address,
          assetAdapter: suggested.assetAdapter || formData.assetAdapter,
          oracleAdapter: suggested.oracleAdapter || formData.oracleAdapter,
          complianceAdapter: suggested.complianceAdapter || formData.complianceAdapter,
          liquidationAdapter: suggested.liquidationAdapter || formData.liquidationAdapter,
          positionAdapter: suggested.positionAdapter || formData.positionAdapter,
          enableCompliance: true,
        });
        toast.success(`${asset.symbol} selected — B20 stack auto-applied (you can override)`);
        return;
      }
    }
    setFormData({ collateralAsset: asset.address });
    toast.success(`${asset.symbol} selected`);
  };

  const validateConfig = async (): Promise<string | null> => {
    if (!formData.collateralAsset) return "Collateral asset is required.";
    if (!isAddress(formData.collateralAsset)) return "Collateral asset is not a valid address.";
    if (!formData.lendingAsset) return "Lending asset is required.";
    if (!isAddress(formData.lendingAsset)) return "Lending asset is not a valid address.";
    if (!formData.assetAdapter) return "Asset adapter is required.";
    if (!formData.oracleAdapter) return "Oracle adapter is required.";
    if (!formData.liquidationAdapter) return "Liquidation adapter is required.";
    if (!formData.positionAdapter) return "Position adapter is required.";

    if (formData.ltv <= 0 || formData.ltv > 95) return "LTV must be between 1% and 95%.";
    if (formData.apr < 0 || formData.apr > 100) return "APR must be between 0% and 100%.";
    if (formData.duration <= 0 || formData.duration > 365) return "Duration must be between 1 and 365 days.";
    if (formData.gracePeriod <= 0) return "Grace period must be greater than zero.";

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
    if (!userAddress) { toast.error("Please connect your wallet."); return; }
    if (!contracts?.marketFactory) { toast.error("Factory address not configured for this chain."); return; }

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

      const result = await createMarket(config, contracts.marketFactory, initialLiquidity);
      toast.success("Market deployed successfully!", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`,
      });
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
    <div className="min-h-dvh">
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Rocket className="h-6 w-6 text-ice-500" />
            <h1 className="text-2xl font-bold text-foreground text-balance">Launch a Market</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure flat parameters and deploy an isolated lending market
          </p>
        </div>

        {/* Chain indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-2xl px-4 py-2">
          <Wallet className="h-3.5 w-3.5" />
          <span>Chain: {chainId === 84532 ? "Base Sepolia" : chainId === 11155111 ? "Sepolia" : `Chain ${chainId}`}</span>
          {!contracts && <span className="text-amber-500 font-medium">(unsupported)</span>}
        </div>

        {/* Step Indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {STEP_ICONS.map((s) => (
              <div
                key={s}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
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
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-soft">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Collateral Asset</h2>
              <p className="text-sm text-muted-foreground">
                Pick the adapter first — supported assets will appear automatically. No pasting needed.
              </p>
              <AdapterSelector
                label="Asset Adapter"
                description="Handles collateral custody (escrow/release)"
                adapters={adapters["ASSET"] || []}
                selected={formData.assetAdapter}
                onSelect={(addr) => {
                  setFormData({ assetAdapter: addr });
                  // Interceptive: auto-open picker when adapter supports curated assets
                  if (adapterSupportsPicker(addr, chainId)) {
                    setTimeout(() => setPickerOpen(true), 150);
                  }
                }}
                required
                chainId={chainId}
              />
              {canShowPicker ? (
                <div className="space-y-3 rounded-2xl border border-ice-300/30 dark:border-ice-400/20 bg-ice-50/50 dark:bg-ice-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MagnifyingGlass className="h-4 w-4 text-ice-500" />
                      Supported assets for {findAdapterName("ASSET", formData.assetAdapter)}
                    </h3>
                    <span className="text-xs text-muted-foreground hidden sm:inline">Intercepts manual paste</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.assetAdapter.toLowerCase() === contracts?.b20AssetAdapter?.toLowerCase()
                      ? "13 B20 tokenized stocks (AAPLc…TSLAc) — TRV feeds, 90000s staleness, PolicyRegistry 0x3f3E…5CaD. Tap to auto-fill collateral + suggest B20 stack."
                      : "Curated ERC20s (USDC, WETH) + recent market assets on this chain. Tap to fill."}
                  </p>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ice-300 dark:bg-ice-400 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors"
                  >
                    <MagnifyingGlass className="h-4 w-4" />
                    {formData.collateralAsset ? `Selected: ${formData.collateralAsset.slice(0,10)}… — Browse again` : "Browse supported assets"}
                  </button>
                  {formData.collateralAsset && (
                    <div className="text-xs text-muted-foreground">
                      Or edit manually below — picker and manual stay in sync.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  Select an asset adapter above to see its supported assets.
                </div>
              )}
              <TokenAddressInput
                label={canShowPicker ? "Or paste custom address (advanced)" : "Collateral Token Address"}
                placeholder="0x... (ERC20 / B20 / ERC721)"
                value={formData.collateralAsset}
                onChange={(addr) => setFormData({ collateralAsset: addr })}
                chainId={chainId}
                required
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
              {formData.enableCompliance && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                  <Warning className="h-4 w-4 mt-0.5 shrink-0" />
                  No compliance adapter deployed yet. Disable compliance or deploy one first.
                </div>
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
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Risk Parameters</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">LTV (%)</label>
                  <input
                    type="number"
                    value={formData.ltv}
                    onChange={(e) => setFormData({ ltv: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">APR (%)</label>
                  <input
                    type="number"
                    value={formData.apr}
                    onChange={(e) => setFormData({ apr: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Duration (days)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ duration: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Grace Period (hours)</label>
                  <input
                    type="number"
                    value={formData.gracePeriod}
                    onChange={(e) => setFormData({ gracePeriod: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setFormData({ enableHealthFactor: !formData.enableHealthFactor })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    formData.enableHealthFactor ? "bg-ice-400" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.enableHealthFactor ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span className="text-sm text-foreground">
                  Enable Health Factor ({formData.healthFactorThreshold}%)
                </span>
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
                <label className="text-xs font-semibold text-muted-foreground">Initial Liquidity (tokens)</label>
                <input
                  type="text"
                  placeholder="1000"
                  value={formData.liquidity}
                  onChange={(e) => setFormData({ liquidity: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Deploy</h2>
              <p className="text-sm text-muted-foreground">
                Review your configuration and deploy the market.
              </p>
              {isB20Selected && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-red-600 dark:text-red-400">{B20_RISK_DISCLOSURE.title}</h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-600/90 dark:text-red-300/90">
                    {B20_RISK_DISCLOSURE.bullets.map((b) => (<li key={b}>{b}</li>))}
                  </ul>
                  <label className="flex items-center gap-2 pt-2 text-xs">
                    <input type="checkbox" required className="h-3.5 w-3.5 rounded border-border" />
                    <span className="text-foreground">I understand US persons are ineligible and escrow dividends accrue to the market contract until repay.</span>
                  </label>
                </div>
              )}
              <div className="rounded-2xl border border-border bg-muted/50 p-4 text-xs space-y-2.5">
                {[
                  ["Collateral", collateralToken?.isValid
                    ? `${collateralToken.name} (${collateralToken.symbol})`
                    : formData.collateralAsset ? formData.collateralAsset.slice(0, 10) + "..." : "Not set"],
                  ["Asset Adapter", findAdapterName("ASSET", formData.assetAdapter)],
                  ["Oracle", findAdapterName("ORACLE", formData.oracleAdapter)],
                  ["Compliance", formData.enableCompliance ? "Enabled" : "Disabled"],
                  ["Liquidation", findAdapterName("LIQUIDATION", formData.liquidationAdapter)],
                  ["Position", findAdapterName("POSITION", formData.positionAdapter)],
                  ["LTV", `${formData.ltv}%`],
                  ["APR", `${formData.apr}%`],
                  ["Duration", `${formData.duration} days`],
                  ["Lending Asset", lendingToken?.isValid
                    ? `${lendingToken.name} (${lendingToken.symbol})`
                    : formData.lendingAsset ? formData.lendingAsset.slice(0, 10) + "..." : "Not set"],
                  ["Liquidity", `${formData.liquidity} tokens`],
                  ...(isB20Selected ? [["B20 Feed", b20Info?.feed.slice(0,10)+"..."], ["B20 Staleness", "90000s (25h)"], ["Sequencer", "0xBCF8…6433"]] as [string,string][] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-premium active-press"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 8 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-2xl bg-ice-300 dark:bg-ice-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-premium active-press shadow-glow"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !contracts?.marketFactory}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all",
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
        {/* Interceptive Supported Asset Picker — appears after adapter selection */}
        <SupportedAssetPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          adapterAddress={formData.assetAdapter}
          chainId={chainId}
          selectedAddress={formData.collateralAsset}
          onSelect={handlePickerSelect}
          manualValue={formData.collateralAsset}
          onManualChange={(addr) => setFormData({ collateralAsset: addr })}
        />
      </main>
    </div>
  );
}
