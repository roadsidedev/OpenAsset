"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits, isAddress } from "viem";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useMarket, useMarkets, type Market } from "@/hooks/useMarkets";
import { MARKET_STATUS } from "@/lib/contractAbis";
import { cn } from "@/lib/utils";

export interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketAddress?: string;
  chainId?: number;
  lendingAsset?: string;
  lendingSymbol?: string;
  lendingDecimals?: number;
  /** Prefill amount when opened from a parent form */
  initialAmount?: string;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatLiq(val: string, decimals: number) {
  try {
    return Number(formatUnits(BigInt(val || "0"), decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}

export function DepositModal({
  open,
  onOpenChange,
  marketAddress: marketAddressProp,
  chainId: chainIdProp,
  lendingAsset: lendingAssetProp,
  lendingSymbol: lendingSymbolProp,
  lendingDecimals: lendingDecimalsProp,
  initialAmount,
}: DepositModalProps) {
  const params = useParams();
  const routeMarketId = (params?.marketId as string) || "";
  const { address: userAddress } = useAccount();
  const { depositLiquidity, isLoading } = useContractInteraction();
  const { data: marketsData } = useMarkets(0, 100);
  const allMarkets: Market[] = marketsData?.markets || [];

  const [pickedAddress, setPickedAddress] = useState<string>("");
  const [amount, setAmount] = useState("");

  // Prefer explicit prop → route param → user pick
  const resolvedAddress = (marketAddressProp || routeMarketId || pickedAddress || "").toLowerCase();
  const needsPicker = !marketAddressProp && !routeMarketId;

  const { data: marketFromHook } = useMarket(
    resolvedAddress && isAddress(resolvedAddress) ? resolvedAddress : "",
  );

  const marketFromList = useMemo(
    () => allMarkets.find((m) => m.marketAddress.toLowerCase() === resolvedAddress),
    [allMarkets, resolvedAddress],
  );

  const market = marketFromHook || marketFromList;

  const sortedMarkets = useMemo(() => {
    if (!userAddress) return allMarkets;
    const mine: Market[] = [];
    const others: Market[] = [];
    for (const m of allMarkets) {
      if (m.owner?.toLowerCase() === userAddress.toLowerCase()) mine.push(m);
      else others.push(m);
    }
    return [...mine, ...others];
  }, [allMarkets, userAddress]);

  const lendingAsset = lendingAssetProp || market?.loanAsset || "";
  const lendingSymbol = lendingSymbolProp || "USDC";
  const decimals = lendingDecimalsProp ?? 6;
  const chainId = chainIdProp ?? market?.chainId;
  const marketAddress = market?.marketAddress || (isAddress(resolvedAddress) ? resolvedAddress : "");

  const statusLabel = MARKET_STATUS[(market?.status ?? 0) as keyof typeof MARKET_STATUS] || "Unknown";
  const isPaused = statusLabel !== "ACTIVE";
  const available = market?.liquidity?.available || "0";

  useEffect(() => {
    if (!open) {
      setAmount("");
      if (!marketAddressProp && !routeMarketId) setPickedAddress("");
      return;
    }
    if (initialAmount) setAmount(initialAmount);
  }, [open, marketAddressProp, routeMarketId, initialAmount]);

  const handleDeposit = async () => {
    if (!amount || !marketAddress || !lendingAsset) return;
    if (isPaused) {
      toast.error("This market is paused — deposits are disabled.");
      return;
    }
    const toastId = toast.loading("Depositing liquidity...");
    try {
      const parsed = parseUnits(amount, decimals);
      if (parsed <= 0n) throw new Error("Amount must be greater than zero.");
      const result = await depositLiquidity(marketAddress, lendingAsset, parsed, chainId);
      toast.success("Deposit confirmed!", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...`,
      });
      setTimeout(() => {
        setAmount("");
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed. Please try again.", {
        id: toastId,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Supply Liquidity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Anyone can supply {lendingSymbol} to an isolated market and earn borrower interest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {needsPicker && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Select market</label>
              {sortedMarkets.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-3">
                  <p>No markets found yet. Browse the marketplace or create one to supply liquidity.</p>
                  <div className="flex gap-2">
                    <Link
                      href="/markets"
                      onClick={() => onOpenChange(false)}
                      className="rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 px-3 py-2 text-xs font-bold hover:bg-ice-400 dark:hover:bg-ice-300"
                    >
                      Browse markets
                    </Link>
                    <Link
                      href="/create-market"
                      onClick={() => onOpenChange(false)}
                      className="rounded-2xl border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                    >
                      Create market
                    </Link>
                  </div>
                </div>
              ) : (
                <select
                  value={pickedAddress}
                  onChange={(e) => setPickedAddress(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                >
                  <option value="">Choose a market…</option>
                  {sortedMarkets.map((m) => {
                    const mine = userAddress && m.owner?.toLowerCase() === userAddress.toLowerCase();
                    return (
                      <option key={m.marketAddress} value={m.marketAddress}>
                        {mine ? "★ " : ""}
                        {shortAddr(m.marketAddress)} · avail {formatLiq(m.liquidity?.available || "0", decimals)}{" "}
                        {lendingSymbol}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {marketAddress && (
            <>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/50 text-xs">
                <div>
                  <span className="text-muted-foreground block">Market</span>
                  <span className="font-mono font-bold text-foreground">{shortAddr(marketAddress)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Available liquidity</span>
                  <span className="font-bold text-foreground">
                    {formatLiq(available, decimals)} {lendingSymbol}
                  </span>
                </div>
              </div>

              {isPaused && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  This market is paused ({statusLabel}). Deposits are temporarily disabled.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Amount ({lendingSymbol})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isPaused}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                onClick={handleDeposit}
                disabled={!amount || isLoading || isPaused || !lendingAsset}
                className={cn(
                  "w-full rounded-2xl font-bold text-sm py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isPaused
                    ? "bg-muted text-muted-foreground"
                    : "bg-ice-300 dark:bg-ice-400 text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300",
                )}
              >
                {isLoading ? "Approving & Depositing..." : isPaused ? "Market Paused" : "Confirm Deposit"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
