"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { useMarket } from "@/hooks/useMarkets";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import { formatUnits, isAddress, parseUnits } from "viem";
import { IORACLE_ADAPTER_ABI, MARKET_STATUS } from "@/lib/contractAbis";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { resolveAssetIdentity } from "@/lib/assetIdentity";
import { ArrowLeft, Warning, CheckCircle } from "@phosphor-icons/react";

function formatLtv(ltvBps: number) {
  return `${(ltvBps / 100).toFixed(1)}%`;
}

function formatApr(aprBps: number) {
  return `${(aprBps / 100).toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  return `${days} days`;
}

function formatLiquidity(val: string) {
  try {
    return Number(formatUnits(BigInt(val || "0"), 6)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0";
  }
}

export default function MarketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const marketId = params.marketId as string;
  const { address: userAddress } = useAccount();

  const { data: market, isLoading, error } = useMarket(marketId);
  const { requestLoan, isLoading: isTxLoading, error: txError } = useContractInteraction();
  const { data: collateralToken } = useTokenMetadata(
    market && isAddress(market.collateralAsset) ? market.collateralAsset : undefined,
    market?.chainId,
  );
  const publicClient = usePublicClient({ chainId: market?.chainId });
  const [oracleData, setOracleData] = useState<readonly [bigint, boolean, bigint] | undefined>();

  useEffect(() => {
    let active = true;
    if (!publicClient || !market?.oracleAdapter || !isAddress(market.oracleAdapter) || !market.marketAddress) {
      setOracleData(undefined);
      return () => { active = false; };
    }
    publicClient.readContract({
      address: market.oracleAdapter as `0x${string}`,
      account: market.marketAddress as `0x${string}`,
      abi: IORACLE_ADAPTER_ABI,
      functionName: "getPrice",
    }).then((result) => {
      if (active) setOracleData(result as readonly [bigint, boolean, bigint]);
    }).catch(() => {
      if (active) setOracleData(undefined);
    });
    return () => { active = false; };
  }, [publicClient, market?.oracleAdapter, market?.marketAddress]);

  const [collateralAmount, setCollateralAmount] = useState("");
  const [requestedBorrow, setRequestedBorrow] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const collateralDecimals = collateralToken?.isValid ? collateralToken.decimals : 18;
  const oraclePrice = oracleData?.[0] as bigint | undefined;
  const oracleTrusted = Boolean(oracleData?.[1]);

  const calculateMaxBorrowRaw = () => {
    if (!market || !collateralAmount || !oraclePrice || !oracleTrusted) return 0n;
    const collateralRaw = parseUnits(collateralAmount, collateralDecimals);
    const collateralValue18 = (collateralRaw * oraclePrice) / 10n ** BigInt(collateralDecimals);
    const maxBorrow18 = (collateralValue18 * BigInt(market.ltvBps)) / 10000n;
    return (maxBorrow18 * 10n ** 6n) / 10n ** 18n;
  };

  const calculateMaxBorrow = () => {
    const maxBorrowRaw = calculateMaxBorrowRaw();
    return formatUnits(maxBorrowRaw, 6);
  };

  const calculateInterest = () => {
    if (!market || !collateralAmount) return "0";
    const principal = requestedBorrow ? Number(requestedBorrow) : Number(calculateMaxBorrow());
    const apr = market.aprBps / 10000;
    const days = Math.floor(market.durationSeconds / 86400);
    return ((principal * apr * days) / 365).toFixed(6);
  };

  const handleRequestLoan = async () => {
    if (!userAddress || !market || !collateralAmount) return;
    try {
      const amount = parseUnits(collateralAmount, collateralDecimals);
      const maxBorrowRaw = calculateMaxBorrowRaw();
      const requestedPrincipal = requestedBorrow ? parseUnits(requestedBorrow, 6) : undefined;
      if (requestedPrincipal !== undefined && (requestedPrincipal === 0n || requestedPrincipal > maxBorrowRaw)) {
        throw new Error("Requested USDC exceeds the oracle-valued maximum.");
      }
      const result = await requestLoan(
        market.marketAddress,
        market.collateralAsset,
        amount.toString(),
        market.assetAdapter || "",
        requestedPrincipal,
      );
      setTxHash(result.txHash);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      console.error("Loan request failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-6">
          <Skeleton className="h-6 w-32 bg-muted" />
          <Skeleton className="h-40 w-full rounded-3xl bg-muted" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <Skeleton className="h-80 rounded-3xl bg-muted" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-96 rounded-3xl bg-muted" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <Warning className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground text-balance">Market Not Found</h2>
          <p className="text-muted-foreground text-sm">
            The market you&apos;re looking for doesn&apos;t exist or isn&apos;t available.
          </p>
          <Link href="/markets" className="inline-block text-ice-500 hover:text-ice-600 text-sm font-medium">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const marketStatus = market.status ?? (market.active ? 0 : 3);
  const statusLabel = MARKET_STATUS[marketStatus as keyof typeof MARKET_STATUS] || "Unknown";
  const isPaused = statusLabel !== "ACTIVE";

  // Brand-agnostic identity derived from adapter + collateral metadata (same as MarketCard)
  const isAddr = isAddress(market.collateralAsset as `0x${string}`);
  const { data: collateralMeta } = useTokenMetadata(isAddr ? market.collateralAsset : undefined, market.chainId);
  const { data: loanMeta } = useTokenMetadata(
    market.loanAsset && isAddress(market.loanAsset as `0x${string}`) ? market.loanAsset : undefined,
    market.chainId
  );
  const identity = resolveAssetIdentity({
    market,
    tokenSymbol: collateralMeta?.symbol || collateralToken?.symbol || null,
    tokenName: collateralMeta?.name || collateralToken?.name || null,
    tokenLogoUri: collateralMeta?.logoUri || collateralToken?.logoUri || null,
    loanAssetSymbol: loanMeta?.symbol || null,
  });

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Back Navigation */}
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </Link>

        {/* Market Header — brand-agnostic, mirrors MarketCard */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6 rounded-3xl border border-border bg-card">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <TokenIcon symbol={identity.displaySymbol} logoUri={identity.logoUri} className="h-10 w-10" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground text-balance">
                    {identity.displaySymbol}
                  </h1>
                  <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted font-medium text-muted-foreground">
                    {identity.categoryLabel}
                  </span>
                  {identity.isB20 && (
                    <span className="text-xs px-3 py-1 rounded-full bg-ice-50 dark:bg-ice-500/15 text-ice-700 dark:text-ice-300 font-semibold border border-ice-200/50 dark:border-ice-400/20">
                      Tokenized
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {identity.name}
                  {identity.issuer && identity.issuer.toLowerCase() !== identity.name.toLowerCase() ? (
                    <span className="font-normal text-muted-foreground"> · {identity.issuer}</span>
                  ) : null}
                </div>
              </div>
              {isPaused ? (
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {statusLabel.replace("PAUSED_", "Paused: ")}
                </span>
              ) : (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Collateral: <span className="font-mono">{market.collateralAsset ? `${market.collateralAsset.slice(0, 10)}…` : "—"}</span> · 
              Loan: <span className="font-mono">{loanMeta?.symbol || (market.loanAsset ? `${market.loanAsset.slice(0, 10)}…` : "—")}</span> · 
              Owner: <span className="font-mono">{market.owner ? `${market.owner.slice(0, 10)}…` : "—"}</span>
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Chart + Adapter Blueprint */}
          <div className="lg:col-span-7 space-y-6">
            {/* TVL Chart Card */}
            <div className="p-6 rounded-3xl border border-border bg-card space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="text-sm font-bold text-foreground">Pool TVL Dynamics</span>
                <span className="text-xs font-mono text-muted-foreground">
                  Available: {formatLiquidity(market.liquidity.available)} USDC
                </span>
              </div>

              {/* SVG Line Chart */}
              <div className="h-64 relative">
                <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={i}
                      x1="0"
                      y1={i * 50}
                      x2="600"
                      y2={i * 50}
                      className="stroke-border"
                      strokeWidth="0.5"
                    />
                  ))}
                  {/* Gradient fill */}
                  <defs>
                    <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A8D8FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#A8D8FF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,160 C50,140 100,120 150,100 C200,80 250,90 300,70 C350,50 400,60 450,40 C500,30 550,35 600,20 L600,200 L0,200 Z"
                    fill="url(#tvlGradient)"
                  />
                  <path
                    d="M0,160 C50,140 100,120 150,100 C200,80 250,90 300,70 C350,50 400,60 450,40 C500,30 550,35 600,20"
                    fill="none"
                    stroke="#A8D8FF"
                    strokeWidth="2"
                  />
                  {/* Data point */}
                  <circle cx="600" cy="20" r="4" fill="#A8D8FF" />
                </svg>
                {/* Labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2 pb-1">
                  <span>30d ago</span>
                  <span>20d</span>
                  <span>10d</span>
                  <span>Now</span>
                </div>
              </div>
            </div>

            {/* Adapter Blueprint Card */}
            <div className="p-6 rounded-3xl border border-border bg-card space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Adapter Blueprint
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-muted/50">
                  <span className="text-muted-foreground block text-xs mb-1">Asset Type</span>
                  <span className="font-bold text-foreground">
                    {market.assetType === 0 ? "ERC20" : market.assetType === 1 ? "ERC721" : "ERC1155"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/50">
                  <span className="text-muted-foreground block text-xs mb-1">Oracle</span>
                  <span className="font-bold text-foreground">
                    {market.oracleType === 0 ? "TWAP" : market.oracleType === 1 ? "Chainlink" : "Manual"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/50">
                  <span className="text-muted-foreground block text-xs mb-1">Duration</span>
                  <span className="font-bold text-foreground">{formatDuration(market.durationSeconds)}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/50">
                  <span className="text-muted-foreground block text-xs mb-1">Status</span>
                  <span className={cn(
                    "font-bold",
                    isPaused ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {statusLabel.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Borrow Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-3xl border border-border bg-card space-y-6 shadow-soft">
              <h2 className="text-lg font-bold text-foreground">Borrow USDC</h2>

              {isPaused && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <Warning className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">
                    This market is currently paused ({statusLabel}). Borrowing is temporarily unavailable.
                  </span>
                </div>
              )}

              {txError && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {txError.message}
                </div>
              )}

              {txHash && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
                  Loan requested! Tx: {txHash.slice(0, 10)}... Redirecting to dashboard...
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/50 text-xs">
                <div>
                  <span className="text-muted-foreground block text-xs">LTV</span>
                  <span className="font-bold text-foreground">{formatLtv(market.ltvBps)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">APR</span>
                  <span className="font-bold text-ice-600 dark:text-ice-300">{formatApr(market.aprBps)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Duration</span>
                  <span className="font-bold text-foreground">{formatDuration(market.durationSeconds)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Available</span>
                  <span className="font-bold text-foreground">
                    {formatLiquidity(market.liquidity.available)} USDC
                  </span>
                </div>
              </div>

              {/* Collateral Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Deposit Collateral · {identity.displaySymbol}
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50 border border-border">
                  <input
                    type="number"
                    placeholder="0"
                    value={collateralAmount}
                    onChange={(e) => setCollateralAmount(e.target.value)}
                    disabled={isPaused}
                    className="bg-transparent text-lg font-bold w-1/2 focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                    <TokenIcon symbol={identity.displaySymbol} logoUri={identity.logoUri} className="h-5 w-5" />
                    {identity.displaySymbol}
                  </span>
                </div>
                {collateralAmount && (
                  <p className="text-xs text-muted-foreground">
                    Max borrow: <span className="font-bold text-ice-600 dark:text-ice-300">{calculateMaxBorrow()} USDC</span>
                  </p>
                )}
              </div>

              {/* Receive Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Borrow USDC (optional; blank uses maximum)
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50 border border-border">
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    placeholder={collateralAmount ? calculateMaxBorrow() : "0"}
                    value={requestedBorrow}
                    onChange={(e) => setRequestedBorrow(e.target.value)}
                    disabled={isPaused || !oracleTrusted}
                    className="bg-transparent text-lg font-bold w-1/2 focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-muted-foreground">USDC</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum available: <span className="font-bold text-ice-600 dark:text-ice-300">{collateralAmount && oracleTrusted ? calculateMaxBorrow() : "Unavailable"} USDC</span>
                </p>
              </div>

              {/* Interest Preview */}
              {collateralAmount && (
                <div className="p-3 rounded-2xl bg-muted/30 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest ({formatDuration(market.durationSeconds)}):</span>
                    <span className="font-medium">{calculateInterest()} USDC</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1">
                    <span className="text-muted-foreground">Total Repayment:</span>
                    <span>
                      {((requestedBorrow ? Number(requestedBorrow) : Number(calculateMaxBorrow())) + Number(calculateInterest())).toFixed(6)} USDC
                    </span>
                  </div>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleRequestLoan}
                disabled={isTxLoading || !collateralAmount || !userAddress || isPaused || !oracleTrusted}
                className={cn(
                  "w-full py-3.5 rounded-2xl font-bold text-sm transition-premium active-press",
                  isTxLoading || !collateralAmount || !userAddress || isPaused || !oracleTrusted
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-ice-300 dark:bg-ice-400 text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 shadow-glow"
                )}
              >
                {isTxLoading
                  ? "Processing..."
                  : !userAddress
                  ? "Connect Wallet"
                  : isPaused
                  ? "Market Paused"
                  : !oracleTrusted
                  ? "Oracle Unavailable"
                  : "Confirm & Borrow"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
