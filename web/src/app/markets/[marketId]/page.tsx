"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMarket } from "@/hooks/useMarkets";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useSession } from "@/context/SessionContext";
import { useChainOrchestrator } from "@/hooks/useChainOrchestrator";
import { useTxTrail } from "@/store/useTxTrail";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Warning, CheckCircle, ArrowsClockwise, Wallet, Info } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import { formatUnits, isAddress, parseUnits } from "viem";
import { IORACLE_ADAPTER_ABI, ERC20_ABI, ICOMPLIANCE_ADAPTER_ABI, MARKET_STATUS } from "@/lib/contractAbis";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { resolveAssetIdentity } from "@/lib/assetIdentity";
import { getChainLabel } from "@/lib/chainLabels";
import { createChainClient, DEFAULT_CHAIN_ID } from "@/lib/chains";
import { toast } from "sonner";
import { isWithinB20TradingWindow, b20MarketHoursLabel, isUSJurisdiction } from "@/lib/b20";

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

function formatLiquidity(val: string, decimals = 6) {
  try {
    return Number(formatUnits(BigInt(val || "0"), decimals)).toLocaleString(undefined, {
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
  const rawId = (params as { marketId?: string | string[] })?.marketId;
  const marketId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || "";
  const { address: userAddress, isAuthenticated } = useSession();
  const { data: market, isLoading, isFetching, error, refetch } = useMarket(marketId);
  const { requestLoan, isLoading: isTxLoading, error: txError } = useContractInteraction();
  const { nudgeChain, isOnChain } = useChainOrchestrator();
  const recordTx = useTxTrail((s) => s.record);
  // Hooks must remain unconditional: the market query starts empty, then populates
  // asynchronously. Keeping metadata queries here avoids a hook-order crash when
  // the details view transitions from loading to the loaded market.
  const { data: collateralToken } = useTokenMetadata(
    market && isAddress(market.collateralAsset) ? market.collateralAsset : undefined,
    market?.chainId,
  );
  const { data: loanToken } = useTokenMetadata(
    market && market.loanAsset && isAddress(market.loanAsset) ? market.loanAsset : undefined,
    market?.chainId,
  );
  // Standalone read-only client scoped to the market's chain. wagmi's lazy
  // per-chain client can throw synchronously during render when the wallet is on
  // a different chain (the "Connection failed until refresh" bug); the standalone
  // client never does. Write ops still use the wallet via useContractInteraction.
  const publicClient = useMemo(
    () => (market?.chainId ? createChainClient(market.chainId) : createChainClient(DEFAULT_CHAIN_ID)),
    [market?.chainId],
  );
  const queryClient = useQueryClient();
  const [oracleData, setOracleData] = useState<readonly [bigint, boolean, bigint] | undefined>();
  const [oracleFailed, setOracleFailed] = useState(false);

  // Oracle read: polled (60s) + refreshed when chain/market changes so a single
  // failed read never bricks the borrow flow. A manual retry is exposed in the UI.
  useEffect(() => {
    let active = true;
    const readOracle = () => {
      if (!publicClient || !market?.oracleAdapter || !isAddress(market.oracleAdapter) || !market.marketAddress) {
        setOracleData(undefined);
        return;
      }
      publicClient.readContract({
        address: market.oracleAdapter as `0x${string}`,
        abi: IORACLE_ADAPTER_ABI,
        functionName: "getPrice",
      }).then((result) => {
        if (active) {
          setOracleData(result as readonly [bigint, boolean, bigint]);
          setOracleFailed(false);
        }
      }).catch(() => {
        if (active) {
          setOracleData(undefined);
          setOracleFailed(true);
        }
      });
    };
    readOracle();
    const interval = setInterval(readOracle, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [publicClient, market?.oracleAdapter, market?.marketAddress]);

  // Anticipatory chain resolution: as soon as a market loads on a different
  // chain than the wallet, start switching (silent for embedded wallets,
  // one-click banner for external).
  const marketChainId = market?.chainId;
  const marketLabel = market?.collateralAsset?.slice(0, 6);
  useEffect(() => {
    if (!marketChainId || !market.marketAddress) return;
    nudgeChain(marketChainId, `This market lives on ${marketChainId === 4663 ? 'Robinhood Chain' : marketChainId === 8453 ? 'Base' : getChainLabel(marketChainId)}${marketLabel ? ` (${marketLabel}…)`: ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketChainId, market?.marketAddress]);

  const [collateralAmount, setCollateralAmount] = useState("");
  const [requestedBorrow, setRequestedBorrow] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Collateral balance + current allowance to the asset adapter (chain-scoped to
  // the market). Keeps the CTA honest before any wallet popup.
  const [collateralBalance, setCollateralBalance] = useState<bigint | null>(null);
  useEffect(() => {
    let active = true;
    setCollateralBalance(null);
    setAdapterAllowance(null);
    const readBalances = () => {
      if (!publicClient || !userAddress || !market?.collateralAsset || !isAddress(market.collateralAsset) || !market.marketAddress) return;
      const owner = userAddress as `0x${string}`;
      publicClient.readContract({
        address: market.collateralAsset as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [owner],
      }).then((bal) => {
        if (active) setCollateralBalance(bal as bigint);
      }).catch(() => {
        if (active) setCollateralBalance(null);
      });
      if (market.assetAdapter && isAddress(market.assetAdapter)) {
        publicClient.readContract({
          address: market.collateralAsset as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [owner, market.assetAdapter as `0x${string}`],
        }).then((allow) => {
          if (active) setAdapterAllowance(allow as bigint);
        }).catch(() => {
          if (active) setAdapterAllowance(null);
        });
      }
    };
    readBalances();
    const interval = setInterval(readBalances, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [publicClient, userAddress, market?.collateralAsset, market?.assetAdapter, market?.marketAddress]);

  // Compliance pre-check (soft): surface ineligibility before the wallet popup.
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setComplianceNotice(null);
    if (!publicClient || !userAddress || !market?.complianceAdapter || !isAddress(market.complianceAdapter) || !market.marketAddress) return;
    publicClient.readContract({
      address: market.complianceAdapter as `0x${string}`,
      abi: ICOMPLIANCE_ADAPTER_ABI,
      functionName: "isEligible",
      args: [userAddress as `0x${string}`],
    }).then((eligible) => {
      if (active) setComplianceNotice(eligible ? null : "Your address is not eligible under this market's compliance rules.");
    }).catch(() => {
      if (active) setComplianceNotice(null);
    });
    return () => { active = false; };
  }, [publicClient, userAddress, market?.complianceAdapter, market?.marketAddress]);

  // Metadata must be trustworthy before parsing amounts — a transient decimals()
  // failure must NOT silently default to 18 and inflate amounts.
  const metadataReliable = !!collateralToken?.isValid;

  const collateralDecimals = metadataReliable ? collateralToken.decimals : 18;
  const oraclePrice = oracleData?.[0] as bigint | undefined;
  const oracleTrusted = Boolean(oracleData?.[1]);

  const lendingDecimals = loanToken?.isValid ? loanToken.decimals : 6;

  /** Parses a user amount string into raw units; returns a human error on any
   *  malformed input (empty, non-numeric, negative, zero, over-precision). */
  const parseAmountInput = (value: string, decimals: number): { amount?: bigint; error?: string } => {
    const trimmed = value.trim();
    if (!trimmed) return { error: "Enter an amount." };
    if (!/^\d*\.?\d*$/.test(trimmed)) return { error: "Amount must be a positive number." };
    const [, fracPart = ""] = trimmed.split(".");
    if (fracPart.length > decimals) {
      return { error: `This asset supports up to ${decimals} decimals.` };
    }
    try {
      const amount = parseUnits(trimmed, decimals);
      if (amount === 0n) return { error: "Amount must be greater than zero." };
      return { amount };
    } catch {
      return { error: "Invalid amount." };
    }
  };

  // Max borrow is the lesser of oracle-derived LTV value and pool liquidity.
  const calculateOracleMaxBorrowRaw = (): bigint => {
    if (!market || !collateralAmount || !oraclePrice || !oracleTrusted || !metadataReliable) return 0n;
    const parsed = parseAmountInput(collateralAmount, collateralDecimals);
    if (!parsed.amount) return 0n;
    const collateralValue18 = (parsed.amount * oraclePrice) / 10n ** BigInt(collateralDecimals);
    const maxBorrow18 = (collateralValue18 * BigInt(market.ltvBps)) / 10000n;
    return (maxBorrow18 * 10n ** BigInt(lendingDecimals)) / 10n ** 18n;
  };

  const availableLiquidityRaw = useMemo(() => {
    if (!market) return 0n;
    try {
      return BigInt(market.liquidity.available || "0");
    } catch {
      return 0n;
    }
  }, [market]);

  const calculateMaxBorrowRaw = () => {
    const oracleMax = calculateOracleMaxBorrowRaw();
    return oracleMax > availableLiquidityRaw ? availableLiquidityRaw : oracleMax;
  };

  const calculateMaxBorrow = () => {
    return formatUnits(calculateMaxBorrowRaw(), lendingDecimals);
  };

  const calculateInterest = () => {
    if (!market || !collateralAmount) return "0";
    const maxRaw = calculateMaxBorrowRaw();
    const principalRaw = requestedBorrow.trim() ? (parseAmountInput(requestedBorrow, lendingDecimals).amount ?? maxRaw) : maxRaw;
    const principal = Number(formatUnits(principalRaw, lendingDecimals));
    const apr = market.aprBps / 10000;
    const days = Math.floor(market.durationSeconds / 86400);
    return ((principal * apr * days) / 365).toFixed(Math.min(lendingDecimals, 6));
  };

  const handleRequestLoan = async () => {
    if (!userAddress || !market) return;
    setLocalError(null);

    // Pre-flight validation — every failure path surfaces to the user.
    const collateralParsed = parseAmountInput(collateralAmount, collateralDecimals);
    if (collateralParsed.error) {
      setLocalError(collateralParsed.error);
      toast.error(collateralParsed.error);
      return;
    }
    if (!metadataReliable) {
      const msg = "Collateral metadata is unavailable — refresh to retry before borrowing.";
      setLocalError(msg);
      toast.error(msg);
      return;
    }
    const amount = collateralParsed.amount!;
    if (collateralBalance !== null && amount > collateralBalance) {
      const msg = `Insufficient ${identity.displaySymbol} balance — you hold ${formatUnits(collateralBalance, collateralDecimals)}.`;
      setLocalError(msg);
      toast.error(msg);
      return;
    }

    const maxBorrowRaw = calculateMaxBorrowRaw();
    let requestedPrincipal: bigint | undefined;
    if (requestedBorrow.trim()) {
      const principalParsed = parseAmountInput(requestedBorrow, lendingDecimals);
      if (principalParsed.error) {
        setLocalError(principalParsed.error);
        toast.error(principalParsed.error);
        return;
      }
      requestedPrincipal = principalParsed.amount!;
      if (requestedPrincipal > maxBorrowRaw) {
        const msg = `Requested borrow exceeds the maximum of ${calculateMaxBorrow()} ${loanToken?.symbol || "tokens"}.`;
        setLocalError(msg);
        toast.error(msg);
        return;
      }
    }
    if (maxBorrowRaw === 0n) {
      const msg = "No borrow capacity for this collateral amount (check pool liquidity).";
      setLocalError(msg);
      toast.error(msg);
      return;
    }

    const localIdentity = resolveAssetIdentity({
      market,
      tokenSymbol: collateralToken?.symbol || null,
      tokenName: collateralToken?.name || null,
      tokenLogoUri: collateralToken?.logoUri || null,
      loanAssetSymbol: loanToken?.symbol || null,
    });

    try {
      const result = await requestLoan(
        market.marketAddress,
        market.collateralAsset,
        amount.toString(),
        market.assetAdapter || "",
        requestedPrincipal,
        market.chainId,
      );
      setTxHash(result.txHash);
      recordTx({
        type: 'LOAN_REQUESTED',
        txHash: result.txHash,
        chainId: market.chainId ?? 0,
        address: userAddress,
        summary: `Loan on ${localIdentity.displaySymbol} market`,
        details: {
          market: market.marketAddress,
          txHash: result.txHash,
          message: `Loan on ${localIdentity.displaySymbol} market`,
        },
      });
      // Refresh loans/markets so the landing page reflects the new position.
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
      void queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      void queryClient.invalidateQueries({ queryKey: ["markets"] });
      toast.success("Loan requested — redirecting to your account");
      setTimeout(() => router.push("/account"), 1800);
    } catch (err) {
      // Hook errors (decodeContractError, ChainGuardError) always surface here.
      const msg = err instanceof Error ? err.message : "Loan request failed.";
      setLocalError(msg);
      toast.error(msg);
    }
  };

  // Reset an over-limit borrow input when collateral changes underneath it.
  const maxBorrowValue = calculateMaxBorrow();
  useEffect(() => {
    if (!requestedBorrow.trim()) return;
    if (!oracleTrusted || !collateralAmount) {
      setRequestedBorrow("");
      return;
    }
    const parsed = parseAmountInput(requestedBorrow, lendingDecimals);
    if (!parsed.error && parsed.amount) {
      const maxRaw = calculateMaxBorrowRaw();
      if (maxRaw > 0n && parsed.amount > maxRaw) setRequestedBorrow(maxBorrowValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collateralAmount, maxBorrowValue]);

  const isInitialLoading = (!marketId || isLoading || (isFetching && !market)) && !error;

  if (isInitialLoading) {
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
          <Warning className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold text-foreground text-balance">Market Not Found</h2>
          <p className="text-muted-foreground text-sm">
            The market you&apos;re looking for doesn&apos;t exist or isn&apos;t available.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={async () => {
                setLocalError(null);
                try {
                  await refetch();
                } catch {
                  setLocalError('Retry failed');
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-ice-300 dark:bg-ice-400 px-5 py-2 text-sm font-bold text-slate-900 transition-premium hover:bg-ice-400 dark:hover:bg-ice-300 active-press"
            >
              <ArrowsClockwise className="h-4 w-4" />
              Try again
            </button>
            <Link href="/markets" className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              ← Back to Markets
            </Link>
          </div>
          {localError && <p className="text-xs text-destructive">{localError}</p>}
        </div>
      </div>
    );
  }

  const marketStatus = market.status ?? (market.active ? 0 : 3);
  const statusLabel = MARKET_STATUS[marketStatus as keyof typeof MARKET_STATUS] || "Unknown";
  const isPaused = statusLabel !== "ACTIVE";
  const wrongChain = !isOnChain(market.chainId);

  // Brand-agnostic identity derived from adapter + collateral metadata (same as MarketCard)
  const identity = resolveAssetIdentity({
    market,
    tokenSymbol: collateralToken?.symbol || null,
    tokenName: collateralToken?.name || null,
    tokenLogoUri: collateralToken?.logoUri || null,
    loanAssetSymbol: loanToken?.symbol || null,
  });

  const isB20Collateral = identity.isB20 === true;
  const b20WindowOpen = isWithinB20TradingWindow();
  const b20Closed = isB20Collateral && !b20WindowOpen;
  const usNotice = isB20Collateral && isUSJurisdiction();

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
              Loan: <span className="font-mono">{loanToken?.symbol || (market.loanAsset ? `${market.loanAsset.slice(0, 10)}…` : "—")}</span> ·
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
              <h2 className="text-lg font-bold text-foreground">Borrow {loanToken?.symbol || "USDC"}</h2>

              {isPaused && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <Warning className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">
                    This market is currently paused ({statusLabel}). Borrowing is temporarily unavailable.
                  </span>
                </div>
              )}

              {b20Closed && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-ice-500/10 border border-ice-500/20 text-xs">
                  <Info className="h-4 w-4 text-ice-600 mt-0.5 shrink-0" />
                  <span className="text-ice-700 dark:text-ice-300">
                    {b20MarketHoursLabel()} — originations are paused off-hours; repayments and liquidations remain open.
                  </span>
                </div>
              )}

              {usNotice && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">
                    US persons are ineligible for B20 tokenized equity markets — origination attempts may be rejected by compliance checks.
                  </span>
                </div>
              )}

              {complianceNotice && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  {complianceNotice}
                </div>
              )}

              {!metadataReliable && market.collateralAsset && isAddress(market.collateralAsset) && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  Collateral metadata is unavailable — decimals could not be read. Borrowing is blocked until the token metadata loads. Try refreshing.
                </div>
              )}

              {(txError || localError) && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {(localError || txError?.message) as string}
                </div>
              )}

              {txHash && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
                  Loan requested! Tx: {txHash.slice(0, 10)}... Redirecting to your account...
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
                    {formatLiquidity(market.liquidity.available, lendingDecimals)} {loanToken?.symbol || "USDC"}
                  </span>
                </div>
              </div>

              {!oracleTrusted && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border text-xs">
                  <span className="text-muted-foreground">
                    {oracleFailed ? "Oracle read failed — price is unavailable." : "Oracle price is currently untrusted."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOracleFailed(false);
                      setOracleData(undefined);
                      if (!publicClient || !market.oracleAdapter || !isAddress(market.oracleAdapter)) return;
                      publicClient.readContract({
                        address: market.oracleAdapter as `0x${string}`,
                        abi: IORACLE_ADAPTER_ABI,
                        functionName: "getPrice",
                      }).then((result) => {
                        setOracleData(result as readonly [bigint, boolean, bigint]);
                        setOracleFailed(false);
                      }).catch(() => setOracleFailed(true));
                    }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold hover:bg-accent"
                  >
                    <ArrowsClockwise className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}

              {/* Collateral Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Deposit Collateral · {identity.displaySymbol}
                  </label>
                  {collateralBalance !== null && (
                    <span className="text-xs text-muted-foreground">
                      Balance: {formatUnits(collateralBalance, collateralDecimals)} {identity.displaySymbol}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50 border border-border">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={collateralAmount}
                    onChange={(e) => {
                      setLocalError(null);
                      setCollateralAmount(e.target.value);
                    }}
                    disabled={isPaused || !metadataReliable}
                    className="bg-transparent text-lg font-bold w-1/2 focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                    <TokenIcon symbol={identity.displaySymbol} logoUri={identity.logoUri} className="h-5 w-5" />
                    {identity.displaySymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {collateralAmount ? (
                    <p className="text-xs text-muted-foreground">
                      Max borrow: <span className="font-bold text-ice-600 dark:text-ice-300">{oracleTrusted ? `${calculateMaxBorrow()} ${loanToken?.symbol || "USDC"}` : "Unavailable"}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  {collateralBalance !== null && collateralBalance > 0n && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalError(null);
                        setCollateralAmount(formatUnits(collateralBalance, collateralDecimals));
                      }}
                      disabled={isPaused || !metadataReliable}
                      className="text-xs font-bold text-ice-600 dark:text-ice-300 hover:underline disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> MAX
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Receive Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Borrow {loanToken?.symbol || "USDC"} (optional; blank uses maximum)
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50 border border-border">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={collateralAmount && oracleTrusted ? calculateMaxBorrow() : "0"}
                    value={requestedBorrow}
                    onChange={(e) => {
                      setLocalError(null);
                      const v = e.target.value;
                      if (!v.trim()) {
                        setRequestedBorrow("");
                        return;
                      }
                      const parsed = parseAmountInput(v, lendingDecimals);
                      if (!parsed.error && parsed.amount) {
                        const maxRaw = calculateMaxBorrowRaw();
                        if (maxRaw > 0n && parsed.amount > maxRaw) {
                          setRequestedBorrow(calculateMaxBorrow());
                          return;
                        }
                      }
                      setRequestedBorrow(v);
                    }}
                    disabled={isPaused || !oracleTrusted || !metadataReliable}
                    className="bg-transparent text-lg font-bold w-1/2 focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-muted-foreground">{loanToken?.symbol || "USDC"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum available: <span className="font-bold text-ice-600 dark:text-ice-300">{collateralAmount && oracleTrusted ? `${calculateMaxBorrow()} ${loanToken?.symbol || "USDC"}` : "Unavailable"}</span>
                </p>
              </div>

              {/* Interest Preview */}
              {collateralAmount && oracleTrusted && (
                <div className="p-3 rounded-2xl bg-muted/30 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest ({formatDuration(market.durationSeconds)}):</span>
                    <span className="font-medium">{calculateInterest()} {loanToken?.symbol || "USDC"}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1">
                    <span className="text-muted-foreground">Total Repayment:</span>
                    <span>
                      {(() => {
                        const maxRaw = calculateMaxBorrowRaw();
                        const principalRaw = requestedBorrow.trim() ? (parseAmountInput(requestedBorrow, lendingDecimals).amount ?? maxRaw) : maxRaw;
                        return (Number(formatUnits(principalRaw, lendingDecimals)) + Number(calculateInterest())).toFixed(Math.min(lendingDecimals, 6));
                      })()} {loanToken?.symbol || "USDC"}
                    </span>
                  </div>
                </div>
              )}

              {/* CTA — state-driven: sign in → switch chain → borrow */}
              {(() => {
                const trimmed = collateralAmount.trim();
                const parsedForGate = trimmed ? parseAmountInput(trimmed, collateralDecimals) : null;
                const exceedsBalance = parsedForGate?.amount !== undefined && collateralBalance !== null && parsedForGate.amount > collateralBalance;
                const disabled =
                  isTxLoading ||
                  !isAuthenticated ||
                  !userAddress ||
                  !trimmed ||
                  !!parsedForGate?.error ||
                  exceedsBalance ||
                  isPaused ||
                  !oracleTrusted ||
                  !metadataReliable ||
                  wrongChain;
                return (
                  <button
                    onClick={handleRequestLoan}
                    disabled={disabled}
                    className={cn(
                      "w-full py-3.5 rounded-2xl font-bold text-sm transition-premium active-press",
                      disabled
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-ice-300 dark:bg-ice-400 text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 shadow-glow"
                    )}
                  >
                    {isTxLoading
                      ? "Processing..."
                      : !isAuthenticated || !userAddress
                      ? "Sign in to borrow"
                      : wrongChain
                      ? `Switch to ${getChainLabel(market.chainId)} first`
                      : isPaused
                      ? "Market Paused"
                      : !metadataReliable
                      ? "Metadata unavailable"
                      : !oracleTrusted
                      ? "Oracle Unavailable"
                      : !trimmed
                      ? "Enter collateral amount"
                      : parsedForGate?.error
                      ? parsedForGate.error
                      : exceedsBalance
                      ? "Insufficient balance"
                      : "Confirm & Borrow"}
                  </button>
                );
              })()}
              {wrongChain && (isAuthenticated || userAddress) && (
                <p className="text-xs text-muted-foreground text-center">
                  This market is on {getChainLabel(market.chainId)} — switch networks using the prompt below to borrow.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
