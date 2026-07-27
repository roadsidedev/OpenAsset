"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore, WIZARD_STEPS } from "@/store/useMarketStore";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { AdapterSelector } from "@/components/adapters/AdapterSelector";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { cn } from "@/lib/utils";
import { Rocket, ArrowLeft, ArrowRight, CheckCircle, Warning } from "@phosphor-icons/react";

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_FACTORY_V2_ADDRESS || "";

const ADAPTERS = {
  asset: [
    { address: process.env.NEXT_PUBLIC_ERC20_ADAPTER_WETH || "0xBc09566675D50d7622545CBA2eD5D135Ae52e578", name: "ERC20Adapter (WETH)", type: 0, verified: true, deprecated: false },
    { address: process.env.NEXT_PUBLIC_ERC20_ADAPTER_USDC || "0xd0448DE8c5bCA1B8f17359F28F301EADC4F4CBc3", name: "ERC20Adapter (USDC)", type: 0, verified: true, deprecated: false },
  ],
  oracle: [
    { address: process.env.NEXT_PUBLIC_CHAINLINK_ADAPTER || "", name: "ChainlinkAdapter", type: 1, verified: true, deprecated: false },
  ],
  liquidation: [
    { address: process.env.NEXT_PUBLIC_DEX_SWAP_LIQUIDATION_ADAPTER || "0x0615642340e70f0a48BC1BCB8bfb5551Ec055Fec", name: "DEXSwapLiquidationAdapter", type: 3, verified: true, deprecated: false },
    { address: process.env.NEXT_PUBLIC_NFT_AUCTION_LIQUIDATION_ADAPTER || "0x2910b2f6851A210453CB43ED4E3A9fF7E138d881", name: "NFTAuctionLiquidationAdapter", type: 3, verified: true, deprecated: false },
  ],
  position: [
    { address: process.env.NEXT_PUBLIC_STANDARD_POSITION_ADAPTER || "0x3D1F31C4AA2419184d6A56367816cE892167AFfE", name: "StandardPositionAdapter", type: 4, verified: true, deprecated: false, auditReference: "Internal audit #1" },
    { address: process.env.NEXT_PUBLIC_SOULBOUND_POSITION_ADAPTER || "0xE24E121F044aDeaE9a5224c0b1Ea4aD79BF0F1Ce", name: "SoulboundPositionAdapter", type: 4, verified: true, deprecated: false, auditReference: "Internal audit #1" },
    { address: process.env.NEXT_PUBLIC_TRANSFERABLE_POSITION_ADAPTER || "0xF1a56c7D0485476AF12B93AEbc6d769D449ebb66", name: "TransferablePositionAdapter", type: 4, verified: true, deprecated: false, auditReference: "Internal audit #1" },
  ],
};

const STEP_ICONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function CreateMarketPage() {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const { step, formData, setStep, setFormData, reset } = useMarketStore();
  const { createMarket, isLoading, error: hookError, clearError } = useContractInteraction();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => setStep(Math.min(step + 1, 8));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  const handleDeploy = async () => {
    if (!userAddress) { setError("Please connect your wallet"); return; }
    if (!FACTORY_ADDRESS) { setError("Factory address not configured"); return; }

    setIsDeploying(true);
    setError(null);

    try {
      const durationSeconds = formData.duration * 86400;
      const config = {
        lpAddress: userAddress,
        collateralAsset: formData.collateralAsset,
        assetAdapter: formData.assetAdapter,
        oracleAdapter: formData.oracleAdapter,
        complianceAdapter: formData.enableCompliance ? formData.complianceAdapter : "0x0000000000000000000000000000000000000000",
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
      const result = await createMarket(config, FACTORY_ADDRESS, initialLiquidity);
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
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Collateral Token Address</label>
                <input
                  type="text"
                  placeholder="0x... (ERC20 / ERC721 / ERC3643)"
                  value={formData.collateralAsset}
                  onChange={(e) => setFormData({ collateralAsset: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              <AdapterSelector
                label="Asset Adapter"
                description="Handles collateral custody (escrow/release)"
                adapters={ADAPTERS.asset}
                selected={formData.assetAdapter}
                onSelect={(addr) => setFormData({ assetAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Oracle</h2>
              <p className="text-sm text-muted-foreground">
                Select the price oracle for this market. TWAP recommended for crypto; Chainlink for RWA.
              </p>
              <AdapterSelector
                label="Oracle Adapter"
                description="Provides collateral price feeds with trust signal"
                adapters={ADAPTERS.oracle}
                selected={formData.oracleAdapter}
                onSelect={(addr) => setFormData({ oracleAdapter: addr })}
                required
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
              <AdapterSelector
                label="Liquidation Adapter"
                description="How defaults are resolved"
                adapters={ADAPTERS.liquidation}
                selected={formData.liquidationAdapter}
                onSelect={(addr) => setFormData({ liquidationAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Position</h2>
              <p className="text-sm text-muted-foreground">
                How loan positions are represented and tracked.
              </p>
              <AdapterSelector
                label="Position Adapter"
                description="Standard: cheapest gas. Soulbound: non-transferable NFT. Transferable: sellable position."
                adapters={ADAPTERS.position}
                selected={formData.positionAdapter}
                onSelect={(addr) => setFormData({ positionAdapter: addr })}
                required
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
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Lending Asset (Stablecoin)</label>
                <input
                  type="text"
                  value={formData.lendingAsset}
                  onChange={(e) => setFormData({ lendingAsset: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                />
              </div>
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
                  ["Collateral", formData.collateralAsset.slice(0, 10) + "..."],
                  ["Oracle", formData.oracleAdapter.slice(0, 10) + "..."],
                  ["Compliance", formData.enableCompliance ? "Enabled" : "Disabled"],
                  ["Liquidation", formData.liquidationAdapter.slice(0, 10) + "..."],
                  ["Position", formData.positionAdapter.slice(0, 10) + "..."],
                  ["LTV", `${formData.ltv}%`],
                  ["APR", `${formData.apr}%`],
                  ["Duration", `${formData.duration} days`],
                  ["Lending Asset", formData.lendingAsset.slice(0, 10) + "..."],
                  ["Liquidity", `${formData.liquidity} tokens`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-medium text-foreground">{value}</span>
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
              disabled={isDeploying || !FACTORY_ADDRESS}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all",
                isDeploying || !FACTORY_ADDRESS
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
