"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore, WIZARD_STEPS } from "@/store/useMarketStore";
import { useAccount, usePublicClient } from "wagmi";
import { parseUnits, type Address } from "viem";
import { AdapterSelector } from "@/components/adapters/AdapterSelector";
import { AdapterSelect } from "@/components/adapters/AdapterSelect";
import { TokenAddressInput } from "@/components/tokens/TokenAddressInput";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { ADAPTER_REGISTRY_ABI, ERC20_APPROVE_ABI } from "@/lib/contractAbis";
import { getContracts, type ChainContracts } from "@/lib/contracts";
import { getAdapterMeta } from "@/lib/adapterRegistry";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { cn } from "@/lib/utils";
import { Rocket, ArrowLeft, ArrowRight, CheckCircle, Warning, Wallet } from "@phosphor-icons/react";

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
  const chainId = chain?.id;
  const publicClient = usePublicClient();
  const { step, formData, setStep, setFormData, reset } = useMarketStore();
  const { createMarket, depositLiquidity, isLoading, error: hookError, clearError } = useContractInteraction();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onChainAdapters, setOnChainAdapters] = useState<Record<string, AdapterOption[]> | null>(null);
  const [loadingAdapters, setLoadingAdapters] = useState(true);

  const contracts = getContracts(chainId);

  const { data: collateralToken } = useTokenMetadata(
    formData.collateralAsset && formData.collateralAsset.startsWith('0x') && formData.collateralAsset.length === 42
      ? formData.collateralAsset : undefined,
    chainId,
  );
  const { data: lendingToken } = useTokenMetadata(
    formData.lendingAsset && formData.lendingAsset.startsWith('0x') && formData.lendingAsset.length === 42
      ? formData.lendingAsset : undefined,
    chainId,
  );

  // Always-available fallback adapters from contract addresses
  const fallbackAdapters = useMemo((): Record<string, AdapterOption[]> => {
    if (!contracts) return {};
    return {
      ASSET: [
        { address: contracts.erc20Adapter || "", name: "ERC20Adapter", type: 0, verified: true, deprecated: false },
        { address: contracts.erc721Adapter || "", name: "ERC721Adapter", type: 0, verified: true, deprecated: false },
      ].filter(a => a.address),
      ORACLE: [
        { address: contracts.chainlinkAdapter || "", name: "ChainlinkAdapter", type: 1, verified: true, deprecated: false },
        ...(contracts.uniswapV3TWAPAdapter ? [{ address: contracts.uniswapV3TWAPAdapter, name: "UniswapV3TWAPAdapter", type: 1, verified: true, deprecated: false }] : []),
      ].filter(a => a.address),
      LIQUIDATION: [
        { address: contracts.dexSwapLiquidationAdapter || "", name: "DEXSwapLiquidationAdapter", type: 3, verified: true, deprecated: false },
        { address: contracts.nftAuctionLiquidationAdapter || "", name: "NFTAuctionLiquidationAdapter", type: 3, verified: true, deprecated: false },
      ].filter(a => a.address),
      POSITION: [
        { address: contracts.standardPositionAdapter || "", name: "StandardPositionAdapter", type: 4, verified: true, deprecated: false },
        { address: contracts.soulboundPositionAdapter || "", name: "SoulboundPositionAdapter", type: 4, verified: true, deprecated: false },
        { address: contracts.transferablePositionAdapter || "", name: "TransferablePositionAdapter", type: 4, verified: true, deprecated: false },
      ].filter(a => a.address),
      COMPLIANCE: [],
    };
  }, [contracts]);

  // Merge on-chain data with fallbacks, deduplicate by address
  const adapters = useMemo(() => {
    const source = onChainAdapters || fallbackAdapters;
    const result: Record<string, AdapterOption[]> = {};
    for (const type of ADAPTER_TYPE_NAMES) {
      const items = source[type] || [];
      const seen = new Map<string, AdapterOption>();
      for (const adapter of items) {
        const key = adapter.address.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, adapter);
        }
      }
      result[type] = Array.from(seen.values());
    }
    return result;
  }, [onChainAdapters, fallbackAdapters]);

  // Load adapters from AdapterRegistry on-chain (enhances fallbacks with live data)
  useEffect(() => {
    async function loadAdapters() {
      if (!contracts?.adapterRegistry || !publicClient) {
        setLoadingAdapters(false);
        return;
      }
      try {
        const grouped: Record<string, AdapterOption[]> = {};
        for (const typeName of ADAPTER_TYPE_NAMES) {
          grouped[typeName] = [];
        }

        const adapterAddresses = await publicClient.readContract({
          address: contracts.adapterRegistry as Address,
          abi: ADAPTER_REGISTRY_ABI,
          functionName: "getAllAdapters",
        }) as string[];

        // Process each adapter individually — one failure should not kill the batch
        for (const addr of adapterAddresses) {
          try {
            const info = await publicClient.readContract({
              address: contracts.adapterRegistry as Address,
              abi: ADAPTER_REGISTRY_ABI,
              functionName: "getAdapterInfo",
              args: [addr as Address],
            }) as any[];

            const typeIndex = Number(info[1]);
            const typeName = ADAPTER_TYPE_NAMES[typeIndex] || "UNKNOWN";

            grouped[typeName] = grouped[typeName] || [];
            grouped[typeName].push({
              address: addr,
              name: `${typeName} Adapter ${addr.slice(0, 8)}`,
              type: typeIndex,
              verified: Boolean(info[3]),
              deprecated: Boolean(info[4]),
            });
          } catch (innerErr) {
            console.warn(`Failed to read adapter info for ${addr}:`, innerErr);
          }
        }

        setOnChainAdapters(grouped);
      } catch (err) {
        console.warn("Failed to load adapters from registry, using fallbacks:", err);
      } finally {
        setLoadingAdapters(false);
      }
    }
    loadAdapters();
  }, [contracts, publicClient]);

  const handleNext = () => setStep(Math.min(step + 1, 8));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  const handleDeploy = async () => {
    if (!userAddress) { setError("Please connect your wallet"); return; }
    if (!contracts?.marketFactory) { setError("Factory address not configured for this chain"); return; }

    setIsDeploying(true);
    setError(null);

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

      setTxHash("pending...");
      const result = await createMarket(config, contracts.marketFactory, initialLiquidity);
      setTxHash(result.txHash);
      setTimeout(() => {
        reset();
        router.push("/markets");
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Deployment failed");
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
                Select the collateral token and asset adapter for this market.
              </p>
              <TokenAddressInput
                label="Collateral Token Address"
                placeholder="0x... (ERC20 / ERC721 / ERC3643)"
                value={formData.collateralAsset}
                onChange={(addr) => setFormData({ collateralAsset: addr })}
                chainId={chainId}
                required
              />
              <AdapterSelector
                label="Asset Adapter"
                description="Handles collateral custody (escrow/release)"
                adapters={adapters["ASSET"] || []}
                selected={formData.assetAdapter}
                onSelect={(addr) => setFormData({ assetAdapter: addr })}
                required
                loading={loadingAdapters}
                chainId={chainId}
              />
              {loadingAdapters && (
                <p className="text-xs text-muted-foreground animate-pulse">Loading adapters from registry...</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Oracle</h2>
              <p className="text-sm text-muted-foreground">
                Select the price oracle for this market. TWAP recommended for crypto; Chainlink for RWA.
              </p>
              <AdapterSelect
                label="Oracle Adapter"
                description="Provides collateral price feeds with trust signal"
                adapters={adapters["ORACLE"] || []}
                selected={formData.oracleAdapter}
                onSelect={(addr) => setFormData({ oracleAdapter: addr })}
                required
                loading={loadingAdapters}
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
                loading={loadingAdapters}
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
                loading={loadingAdapters}
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
              <div className="rounded-2xl border border-border bg-muted/50 p-4 text-xs space-y-2.5">
                {[
                  ["Collateral", collateralToken?.isValid
                    ? `${collateralToken.name} (${collateralToken.symbol})`
                    : formData.collateralAsset.slice(0, 10) + "..."],
                  ["Oracle", getAdapterMeta(chainId, formData.oracleAdapter)?.name
                    || formData.oracleAdapter.slice(0, 10) + "..."],
                  ["Compliance", formData.enableCompliance ? "Enabled" : "Disabled"],
                  ["Liquidation", getAdapterMeta(chainId, formData.liquidationAdapter)?.name
                    || formData.liquidationAdapter.slice(0, 10) + "..."],
                  ["Position", getAdapterMeta(chainId, formData.positionAdapter)?.name
                    || formData.positionAdapter.slice(0, 10) + "..."],
                  ["LTV", `${formData.ltv}%`],
                  ["APR", `${formData.apr}%`],
                  ["Duration", `${formData.duration} days`],
                  ["Lending Asset", lendingToken?.isValid
                    ? `${lendingToken.name} (${lendingToken.symbol})`
                    : formData.lendingAsset.slice(0, 10) + "..."],
                  ["Liquidity", `${formData.liquidity} tokens`],
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

        {/* Error */}
        {(error || hookError) && (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <Warning className="h-4 w-4 mt-0.5 shrink-0" />
            {error || hookError?.message}
          </div>
        )}

        {/* TX Hash */}
        {txHash && (
          <div className="rounded-2xl border border-ice-300/30 bg-ice-50 dark:bg-ice-900/20 p-4 text-sm text-ice-600 dark:text-ice-300">
            {txHash === "pending..." ? "Transaction pending..." : `Deployed! Tx: ${txHash.slice(0, 16)}...`}
          </div>
        )}

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
      </main>
    </div>
  );
}
