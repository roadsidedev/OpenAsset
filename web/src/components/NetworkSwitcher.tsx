"use client";

import { Check, Spinner, Globe } from "@phosphor-icons/react";
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { cn } from "@/lib/utils";

interface NetworkSwitcherProps {
  compact?: boolean;
}

const SUPPORTED_NETWORKS = [
  { id: 1, name: "Ethereum", shortName: "Ethereum", color: "bg-blue-500", logo: "eth" },
  { id: 137, name: "Polygon", shortName: "Polygon", color: "bg-purple-500" },
  { id: 10, name: "Optimism", shortName: "Optimism", color: "bg-red-500" },
  { id: 42161, name: "Arbitrum", shortName: "Arbitrum", color: "bg-cyan-500", logo: "arb" },
  { id: 8453, name: "Base", shortName: "Base", color: "bg-blue-700" },
  { id: 11155111, name: "Sepolia", shortName: "Sepolia", color: "bg-slate-500" },
  { id: 84532, name: "Base Sepolia", shortName: "Base Sepolia", color: "bg-blue-400" },
] as const;

function NetworkLogo({ network, compact = false }: { network: (typeof SUPPORTED_NETWORKS)[number] | { name: string; color: string }; compact?: boolean }) {
  if ("logo" in network && network.logo === "eth") {
    return (
      <span className={cn("flex items-center justify-center rounded-full bg-[#627EEA] text-white", compact ? "size-6" : "size-5")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={compact ? "size-4" : "size-3.5"} fill="none">
          <path d="m12 3.5-.14.48v11.02l.14.14 5.9-3.49L12 3.5Z" fill="currentColor" opacity=".9" />
          <path d="m12 3.5-5.9 8.15 5.9 3.49V3.5Z" fill="currentColor" />
          <path d="m12 16.27-.07.08v4.52l.07.2 5.91-8.33-5.91 3.53Z" fill="currentColor" opacity=".75" />
          <path d="M12 21.07v-4.8l-5.9-3.53 5.9 8.33Z" fill="currentColor" opacity=".9" />
        </svg>
      </span>
    );
  }

  if ("logo" in network && network.logo === "arb") {
    return (
      <span className={cn("flex items-center justify-center rounded-full bg-[#28A0F0] text-white", compact ? "size-6" : "size-5")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={compact ? "size-4" : "size-3.5"} fill="currentColor">
          <path d="M7.8 5.05c.48-.28 1.08-.11 1.35.37l2.88 5.03 1.5-.87-2.18-3.8a1 1 0 0 1 1.73-.99l2.18 3.8 1.5-.87-2.18-3.8a1 1 0 1 1 1.73-.99l2.18 3.8c.28.49.11 1.1-.37 1.38l-1.5.87 1.28 2.24a1 1 0 0 1-1.73.99l-1.28-2.24-1.5.87 2.18 3.8a1 1 0 0 1-1.73.99l-2.18-3.8-1.5.87 2.18 3.8a1 1 0 1 1-1.73.99l-2.18-3.8c-.28-.49-.11-1.1.37-1.38l1.5-.87-2.88-5.03a1 1 0 0 1 .36-1.36Z" />
        </svg>
      </span>
    );
  }

  return <span className={cn("rounded-full", network.color, compact ? "size-2.5" : "size-2")} aria-hidden="true" />;
}

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
          "inline-flex items-center justify-center rounded-full border border-border bg-background/70 font-medium text-foreground transition-colors hover:bg-accent",
          compact ? "size-8" : "size-9"
        )}
      >
        <NetworkLogo network={displayNetwork} compact={compact} />
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
                <NetworkLogo network={network} />
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
