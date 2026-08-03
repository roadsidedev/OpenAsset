"use client";

import { CaretDown, Check, Spinner, Globe } from "@phosphor-icons/react";
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { cn } from "@/lib/utils";

interface NetworkSwitcherProps {
  compact?: boolean;
}

const SUPPORTED_NETWORKS = [
  { id: 1, name: "Ethereum", shortName: "Ethereum", color: "bg-blue-500" },
  { id: 137, name: "Polygon", shortName: "Polygon", color: "bg-purple-500" },
  { id: 10, name: "Optimism", shortName: "Optimism", color: "bg-red-500" },
  { id: 42161, name: "Arbitrum", shortName: "Arbitrum", color: "bg-cyan-500" },
  { id: 8453, name: "Base", shortName: "Base", color: "bg-blue-700" },
  { id: 11155111, name: "Sepolia", shortName: "Sepolia", color: "bg-slate-500" },
  { id: 84532, name: "Base Sepolia", shortName: "Base Sepolia", color: "bg-blue-400" },
] as const;

export function NetworkSwitcher({ compact = false }: NetworkSwitcherProps) {
  const [open, setOpen] = useState(false);
  const { chain, isConnected } = useAccount();
  const chainId = chain?.id ?? 0;
  const { switchChain, isPending, error } = useSwitchChain();
  const activeNetwork = SUPPORTED_NETWORKS.find((network) => network.id === chainId);
  const displayNetwork = activeNetwork ?? {
    name: "Unsupported network",
    shortName: "Unsupported",
    color: "bg-amber-500",
  };

  const handleSwitch = (networkId: number): void => {
    if (networkId === chainId) {
      setOpen(false);
      return;
    }

    if (!isConnected) {
      setOpen(false);
      return;
    }

    switchChain({ chainId: networkId });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Selected network: ${displayNetwork.name}`}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/70 font-medium text-foreground transition-colors hover:bg-accent",
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", displayNetwork.color)} aria-hidden="true" />
        <span>{compact ? displayNetwork.shortName : displayNetwork.name}</span>
        <CaretDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Supported networks"
          className={cn(
            "absolute right-0 z-50 mt-2 min-w-52 rounded-2xl border border-border bg-popover p-1.5 shadow-xl",
            compact ? "top-full" : "top-full"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            EVM networks
          </div>
          {SUPPORTED_NETWORKS.map((network) => {
            const selected = network.id === chainId;
            return (
              <button
                key={network.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleSwitch(network.id)}
                disabled={isPending || !isConnected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  (!isConnected || isPending) && "cursor-not-allowed opacity-60"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", network.color)} aria-hidden="true" />
                <span className="flex-1">{network.name}</span>
                {selected && <Check className="h-4 w-4 text-primary" weight="bold" />}
              </button>
            );
          })}
          {!isConnected && <p className="px-3 py-2 text-xs text-muted-foreground">Connect your wallet to switch networks.</p>}
          {isPending && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5 animate-spin" />
              Switching network...
            </div>
          )}
          {error && <p className="px-3 py-2 text-xs text-destructive">Could not switch networks. Try again.</p>}
        </div>
      )}
    </div>
  );
}
