"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { type Address, formatUnits, parseUnits, isAddress, parseAbi } from "viem";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useMarket, type Market } from "@/hooks/useMarkets";
import { useLpPositions, type LpPosition } from "@/hooks/useLpPositions";
import { LENDING_MARKET_ABI, LP_TOKEN_ABI } from "@/lib/contractAbis";
import { createChainClient, DEFAULT_CHAIN_ID } from "@/lib/chains";
import { resolveAssetIdentity } from "@/lib/assetIdentity";
import { cn } from "@/lib/utils";
import { useTxTrail } from "@/store/useTxTrail";
import { useQueryClient } from "@tanstack/react-query";

export interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketAddress?: string;
  chainId?: number;
  lendingAsset?: string;
  lendingSymbol?: string;
  lendingDecimals?: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAmt(raw: bigint, decimals: number) {
  try {
    return Number(formatUnits(raw, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.min(decimals, 6),
    });
  } catch {
    return "0.00";
  }
}

function positionOptionLabel(pos: LpPosition, userAddress: string | undefined, decimals: number): string {
  const identity = resolveAssetIdentity({ market: pos.market });
  const claimableStr = formatAmt(pos.claimable, decimals);
  const mine =
    userAddress && pos.market.owner?.toLowerCase() === userAddress.toLowerCase();
  const star = mine ? "★ " : "";
  return `${star}${identity.displaySymbol} · ${shortAddr(pos.market.marketAddress)} · ${claimableStr} USDC`;
}

interface LpState {
  lpToken: Address | null;
  userShares: bigint;
  totalSupply: bigint;
  totalLiquidity: bigint;
  availableLiquidity: bigint;
  reservedSettling: bigint;
}

const emptyLp: LpState = {
  lpToken: null,
  userShares: 0n,
  totalSupply: 0n,
  totalLiquidity: 0n,
  availableLiquidity: 0n,
  reservedSettling: 0n,
};

export function WithdrawModal({
  open,
  onOpenChange,
  marketAddress: marketAddressProp,
  chainId: chainIdProp,
  lendingAsset: _lendingAssetProp,
  lendingSymbol: lendingSymbolProp,
  lendingDecimals: lendingDecimalsProp,
}: WithdrawModalProps) {
  const params = useParams();
  const routeMarketId = (params?.marketId as string) || "";
  const { address: userAddress } = useAccount();
  const { withdrawLiquidity, isLoading } = useContractInteraction();
  const recordTx = useTxTrail((s) => s.record);
  const queryClient = useQueryClient();

  const needsPicker = !marketAddressProp && !routeMarketId;
  const {
    positions: lpPositions,
    isLoading: positionsLoading,
  } = useLpPositions(needsPicker ? userAddress : undefined);

  const [pickedAddress, setPickedAddress] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [lpState, setLpState] = useState<LpState>(emptyLp);
  const [lpLoading, setLpLoading] = useState(false);

  const resolvedAddress = (marketAddressProp || routeMarketId || pickedAddress || "").toLowerCase();

  const { data: marketFromHook } = useMarket(
    resolvedAddress && isAddress(resolvedAddress) ? resolvedAddress : "",
  );

  const marketFromPosition = useMemo(
    () =>
      lpPositions.find((p) => p.market.marketAddress.toLowerCase() === resolvedAddress)?.market,
    [lpPositions, resolvedAddress],
  );

  const market: Market | undefined = marketFromHook || marketFromPosition;

  const lendingSymbol = lendingSymbolProp || "USDC";
  const decimals = lendingDecimalsProp ?? 6;
  const chainId = chainIdProp ?? market?.chainId ?? DEFAULT_CHAIN_ID;
  const marketAddress = market?.marketAddress || (isAddress(resolvedAddress) ? resolvedAddress : "");

  // Auto-select when exactly one LP position and picker is needed
  useEffect(() => {
    if (!open || !needsPicker) return;
    if (positionsLoading) return;
    if (lpPositions.length === 1) {
      const only = lpPositions[0].market.marketAddress;
      setPickedAddress((prev) => (prev === only ? prev : only));
    }
  }, [open, needsPicker, positionsLoading, lpPositions]);

  const refreshLp = useCallback(async () => {
    if (!marketAddress || !isAddress(marketAddress)) {
      setLpState(emptyLp);
      return;
    }
    const client = createChainClient(chainId);
    if (!client) {
      setLpState(emptyLp);
      return;
    }
    setLpLoading(true);
    try {
      const marketAbi = parseAbi(LENDING_MARKET_ABI);
      const [lpToken, totalLiquidity, availableLiquidity, reservedSettling] = await Promise.all([
        client.readContract({
          address: marketAddress as Address,
          abi: marketAbi,
          functionName: "lpToken",
        }) as Promise<Address>,
        client.readContract({
          address: marketAddress as Address,
          abi: marketAbi,
          functionName: "totalLiquidity",
        }) as Promise<bigint>,
        client.readContract({
          address: marketAddress as Address,
          abi: marketAbi,
          functionName: "availableLiquidity",
        }) as Promise<bigint>,
        client
          .readContract({
            address: marketAddress as Address,
            abi: marketAbi,
            functionName: "reservedSettling",
          })
          .catch(() => 0n) as Promise<bigint>,
      ]);

      let userShares = 0n;
      let totalSupply = 0n;
      if (lpToken && isAddress(lpToken)) {
        const lpAbi = parseAbi(LP_TOKEN_ABI);
        const reads: Promise<bigint>[] = [
          client.readContract({
            address: lpToken,
            abi: lpAbi,
            functionName: "totalSupply",
          }) as Promise<bigint>,
        ];
        if (userAddress) {
          reads.push(
            client.readContract({
              address: lpToken,
              abi: lpAbi,
              functionName: "balanceOf",
              args: [userAddress as Address],
            }) as Promise<bigint>,
          );
        }
        const results = await Promise.all(reads);
        totalSupply = results[0] ?? 0n;
        userShares = results[1] ?? 0n;
      }

      setLpState({
        lpToken,
        userShares,
        totalSupply,
        totalLiquidity,
        availableLiquidity,
        reservedSettling: reservedSettling ?? 0n,
      });
    } catch {
      setLpState(emptyLp);
    } finally {
      setLpLoading(false);
    }
  }, [marketAddress, chainId, userAddress]);

  useEffect(() => {
    if (!open) {
      setAmount("");
      if (!marketAddressProp && !routeMarketId) setPickedAddress("");
      return;
    }
    void refreshLp();
    const id = setInterval(() => void refreshLp(), 20_000);
    return () => clearInterval(id);
  }, [open, refreshLp, marketAddressProp, routeMarketId]);

  const {
    userShares,
    totalSupply,
    totalLiquidity,
    availableLiquidity,
    reservedSettling,
  } = lpState;

  const claimable =
    totalSupply > 0n && totalLiquidity > 0n
      ? (userShares * totalLiquidity) / totalSupply
      : 0n;

  const freeLiquidity =
    availableLiquidity > reservedSettling ? availableLiquidity - reservedSettling : 0n;

  const withdrawableNow = claimable < freeLiquidity ? claimable : freeLiquidity;

  const isIdle = totalLiquidity === 0n || availableLiquidity >= totalLiquidity;

  const amountToShares = (rawAmount: bigint): bigint => {
    if (rawAmount <= 0n || totalLiquidity === 0n || totalSupply === 0n) return 0n;
    return (rawAmount * totalSupply) / totalLiquidity;
  };

  const maxSharesForFree =
    totalLiquidity > 0n && totalSupply > 0n
      ? (freeLiquidity * totalSupply) / totalLiquidity
      : 0n;
  const maxWithdrawableShares =
    userShares < maxSharesForFree ? userShares : maxSharesForFree;

  const handleMax = () => {
    setAmount(formatUnits(withdrawableNow, decimals));
  };

  const handleWithdraw = async () => {
    if (!amount || !marketAddress) return;
    const toastId = toast.loading("Withdrawing liquidity...");
    try {
      const parsed = parseUnits(amount, decimals);
      if (parsed <= 0n) throw new Error("Amount must be greater than zero.");
      if (parsed > withdrawableNow) {
        throw new Error(
          `Only ${formatAmt(withdrawableNow, decimals)} ${lendingSymbol} can be withdrawn right now.`,
        );
      }
      let shares = amountToShares(parsed);
      if (shares > maxWithdrawableShares) shares = maxWithdrawableShares;
      // Round-up dust: if user asked for (nearly) full withdrawable, burn max shares
      if (parsed >= withdrawableNow && maxWithdrawableShares > 0n) {
        shares = maxWithdrawableShares;
      }
      if (shares <= 0n) throw new Error("Share amount is zero — check pool liquidity.");

      const result = await withdrawLiquidity(marketAddress, shares, chainId);
      if (userAddress) {
        recordTx({
          type: "LIQUIDITY_WITHDRAWN",
          txHash: result.txHash,
          chainId: chainId ?? 0,
          address: userAddress,
          summary: `Withdrew ${amount} ${lendingSymbol}`,
          details: {
            market: marketAddress,
            amount,
            txHash: result.txHash,
            message: `Withdrew ${amount} ${lendingSymbol}`,
          },
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["lpPositions"] });
      void queryClient.invalidateQueries({ queryKey: ["markets"] });
      toast.success("Withdrawal confirmed!", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...`,
      });
      setTimeout(() => {
        setAmount("");
        onOpenChange(false);
      }, 2000);
      void refreshLp();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed. Please try again.", {
        id: toastId,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Withdraw Liquidity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Burn LP shares to exit. Withdrawals are capped by unlent (available) liquidity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {needsPicker && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Select market</label>
              {positionsLoading ? (
                <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  Loading your LP positions…
                </div>
              ) : lpPositions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-3">
                  <p>
                    No liquidity to withdraw — supply on Earn or open a position in Portfolio.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href="/earn"
                      onClick={() => onOpenChange(false)}
                      className="rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 px-3 py-2 text-xs font-bold hover:bg-ice-400 dark:hover:bg-ice-300"
                    >
                      Earn
                    </Link>
                    <Link
                      href="/portfolio"
                      onClick={() => onOpenChange(false)}
                      className="rounded-2xl border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                    >
                      Portfolio
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
                  {lpPositions.map((pos) => (
                    <option key={pos.market.marketAddress} value={pos.market.marketAddress}>
                      {positionOptionLabel(pos, userAddress, decimals)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {marketAddress && (
            <>
              <div className="grid grid-cols-1 gap-2 p-3 rounded-2xl bg-muted/50 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Your LP shares</span>
                  <span className="font-bold font-mono text-foreground">
                    {lpLoading ? "…" : formatAmt(userShares, decimals)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Your claimable value</span>
                  <span className="font-bold text-foreground">
                    {lpLoading ? "…" : `${formatAmt(claimable, decimals)} ${lendingSymbol}`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Available to withdraw now</span>
                  <span className="font-bold text-ice-600 dark:text-ice-300">
                    {lpLoading ? "…" : `${formatAmt(withdrawableNow, decimals)} ${lendingSymbol}`}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {isIdle
                  ? "No active borrows — you can exit your full position (subject to available liquidity)."
                  : "Only unlent liquidity can be withdrawn."}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Amount ({lendingSymbol})
                  </label>
                  <button
                    type="button"
                    onClick={handleMax}
                    disabled={withdrawableNow <= 0n}
                    className="text-xs font-bold text-ice-600 dark:text-ice-300 hover:underline disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>

              <button
                type="button"
                onClick={handleWithdraw}
                disabled={!amount || isLoading || withdrawableNow <= 0n || userShares <= 0n}
                className={cn(
                  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isLoading ? "Withdrawing..." : "Confirm Withdrawal"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
