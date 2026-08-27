"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseAbi, parseUnits, type Address } from "viem";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useWalletSession } from "@/hooks/useWalletSession";
import { LENDING_MARKET_ABI, LP_TOKEN_ABI } from "@/lib/contractAbis";
import { createChainClient, DEFAULT_CHAIN_ID } from "@/lib/chains";
import type { Market } from "@/hooks/useMarkets";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markets: Market[];
}

interface Position {
  market: Market;
  shares: bigint;
  value: bigint;
  available: bigint;
}

export function WithdrawModal({ open, onOpenChange, markets }: WithdrawModalProps) {
  const queryClient = useQueryClient();
  const { address, ensureWallet } = useWalletSession();
  const { withdrawLiquidity, isLoading } = useContractInteraction();
  const [amount, setAmount] = useState("");
  const [marketAddress, setMarketAddress] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);

  const loadPositions = useCallback(async () => {
    if (!address || markets.length === 0) {
      setPositions([]);
      return;
    }
    setLoadingPositions(true);
    const next: Position[] = [];
    for (const market of markets) {
      const client = createChainClient(market.chainId || DEFAULT_CHAIN_ID);
      if (!client) continue;
      try {
        const lpToken = await client.readContract({
          address: market.marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: "lpToken",
        }) as Address;
        const [shares, supply, totalLiq, availLiq] = await Promise.all([
          client.readContract({
            address: lpToken,
            abi: parseAbi(LP_TOKEN_ABI),
            functionName: "balanceOf",
            args: [address as Address],
          }) as Promise<bigint>,
          client.readContract({
            address: lpToken,
            abi: parseAbi(LP_TOKEN_ABI),
            functionName: "totalSupply",
          }) as Promise<bigint>,
          client.readContract({
            address: market.marketAddress as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: "totalLiquidity",
          }) as Promise<bigint>,
          client.readContract({
            address: market.marketAddress as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: "availableLiquidity",
          }) as Promise<bigint>,
        ]);
        if (shares === 0n || supply === 0n) continue;
        const value = (shares * totalLiq) / supply;
        next.push({ market, shares, value, available: availLiq });
      } catch {
        /* skip markets that cannot be read */
      }
    }
    setPositions(next);
    setMarketAddress((current) => {
      if (current && next.some((p) => p.market.marketAddress.toLowerCase() === current.toLowerCase())) return current;
      return next[0]?.market.marketAddress || "";
    });
    setLoadingPositions(false);
  }, [address, markets]);

  useEffect(() => {
    if (open) loadPositions();
  }, [open, loadPositions]);

  const selected = positions.find((p) => p.market.marketAddress.toLowerCase() === marketAddress.toLowerCase());
  const maxWithdraw = selected
    ? selected.value < selected.available ? selected.value : selected.available
    : 0n;

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) return;
    if (!address) {
      await ensureWallet();
      return;
    }
    if (!selected) {
      toast.error("No LP position selected.");
      return;
    }
    const parsed = parseUnits(amount, 6);
    if (parsed > maxWithdraw) {
      toast.error("Amount exceeds your withdrawable balance.");
      return;
    }
    const toastId = toast.loading("Confirm withdrawal in your wallet...");
    try {
      const result = await withdrawLiquidity(
        selected.market.marketAddress,
        parsed,
        selected.market.chainId,
      );
      toast.success("Withdrawal confirmed", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      setAmount("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed. Please try again.", { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Withdraw liquidity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Burns your LP shares and sends USDC back to your wallet on-chain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Market</label>
            <select
              value={marketAddress}
              onChange={(e) => setMarketAddress(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
            >
              {loadingPositions && <option value="">Loading positions...</option>}
              {!loadingPositions && positions.length === 0 && <option value="">No LP positions found</option>}
              {positions.map((position) => (
                <option key={position.market.marketAddress} value={position.market.marketAddress}>
                  {position.market.marketAddress.slice(0, 8)}…{position.market.marketAddress.slice(-4)} · {formatUnits(position.value, 6)} USDC
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <p className="text-[11px] text-muted-foreground">
              Withdrawable: {formatUnits(maxWithdraw, 6)} USDC
            </p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Amount (USDC)</label>
              {selected && maxWithdraw > 0n && (
                <button
                  type="button"
                  onClick={() => setAmount(formatUnits(maxWithdraw, 6))}
                  className="text-[11px] font-semibold text-ice-600 dark:text-ice-300"
                >
                  Max
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!amount || Number(amount) <= 0 || isLoading || !selected}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!address ? "Connect wallet" : isLoading ? "Confirm in wallet..." : "Confirm withdrawal"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
