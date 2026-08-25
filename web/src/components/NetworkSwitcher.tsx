"use client";

import { Check, Spinner, Globe } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NetworkSwitcherProps {
  compact?: boolean;
}

interface NetworkMenuProps extends NetworkSwitcherProps {
  chainId: number;
  canSwitch: boolean;
  isPending: boolean;
  error?: unknown;
  onSwitch: (networkId: number) => Promise<void> | void;
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

function NetworkLogo({
  network,
  compact = false,
}: {
  network: (typeof SUPPORTED_NETWORKS)[number] | { name: string; color: string };
  compact?: boolean;
}) {
  if ("logo" in network && network.logo === "eth") {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-[#627EEA] text-white",
          compact ? "size-6" : "size-5"
        )}
        aria-hidden="true"
      >
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
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-[#28A0F0] text-white",
          compact ? "size-6" : "size-5"
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className={compact ? "size-4" : "size-3.5"} fill="currentColor">
          <path d="M7.8 5.05c.48-.28 1.08-.11 1.35.37l2.88 5.03 1.5-.87-2.18-3.8a1 1 0 0 1 1.73-.99l2.18 3.8 1.5-.87-2.18-3.8a1 1 0 1 1 1.73-.99l2.18 3.8c.28.49.11 1.1-.37 1.38l-1.5.87 1.28 2.24a1 1 0 0 1-1.73.99l-1.28-2.24-1.5.87 2.18 3.8a1 1 0 0 1-1.73.99l-2.18-3.8-1.5.87 2.18 3.8a1 1 0 1 1-1.73.99l-2.18-3.8c-.28-.49-.11-1.1.37-1.38l1.5-.87-2.88-5.03a1 1 0 0 1 .36-1.36Z" />
        </svg>
      </span>
    );
  }

  return <span className={cn("rounded-full", network.color, compact ? "size-2.5" : "size-2")} aria-hidden="true" />;
}

function NetworkMenu({ compact = false, chainId, canSwitch, isPending, error, onSwitch }: NetworkMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeNetwork = SUPPORTED_NETWORKS.find((network) => network.id === chainId);
  const displayNetwork = activeNetwork ?? {
    name: "Unsupported network",
    shortName: "Unsupported",
    color: "bg-amber-500",
  };
  const errorMessage = typeof error === "string" ? error : error ? "Could not switch networks. Try again." : null;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
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
          className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
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
                onClick={() => onSwitch(network.id)}
                disabled={isPending}
                title={!canSwitch ? "Connect your wallet to switch networks" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  isPending && "cursor-not-allowed opacity-60",
                  !canSwitch && "opacity-60"
                )}
              >
                <NetworkLogo network={network} />
                <span className="flex-1">{network.name}</span>
                {selected && <Check className="h-4 w-4 text-primary" weight="bold" />}
              </button>
            );
          })}
          {!canSwitch && <p className="px-3 py-2 text-xs text-muted-foreground">Connect your wallet to switch networks.</p>}
          {isPending && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5 animate-spin" />
              Switching network...
            </div>
          )}
          {errorMessage && <p className="px-3 py-2 text-xs text-destructive">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}

function parsePrivyChainId(chainId: string | undefined): number | undefined {
  if (!chainId) return undefined;
  // Privy CAIP-2 e.g. "eip155:84532" or hex "eip155:0x14a34" or plain number
  const raw = chainId.split(":").pop() ?? chainId;
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    const parsed = Number.parseInt(raw, 16);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  const parsedChainId = Number(raw);
  return Number.isNaN(parsedChainId) ? undefined : parsedChainId;
}

function PrivyAwareNetworkSwitcher({ compact = false }: NetworkSwitcherProps) {
  const [isPrivySwitching, setIsPrivySwitching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { wallets } = useWallets();
  const { address, chain: wagmiChain, isConnected } = useAccount();
  const { switchChainAsync, isPending: isWagmiPending, error: wagmiError } = useSwitchChain();

  // Detect active Privy wallet: prefer address-match, fallback to embedded
  const activePrivyWallet =
    wallets.find(
      (wallet: any) =>
        wallet.type === "ethereum" &&
        address &&
        wallet.address?.toLowerCase() === address.toLowerCase()
    ) ??
    wallets.find(
      (wallet: any) =>
        wallet.type === "ethereum" &&
        (wallet.walletClientType === "privy" || wallet.walletClientType === "privy-v2")
    ) ??
    wallets.find((wallet: any) => wallet.type === "ethereum");

  const privyChainId = parsePrivyChainId((activePrivyWallet as any)?.chainId);
  const wagmiChainId = wagmiChain?.id;
  // Prefer Privy chain if we have an active Privy wallet (covers embedded), otherwise wagmi
  const chainId = privyChainId ?? wagmiChainId ?? 0;

  // Consistent across auth contexts: allow switching if either Privy wallet exists OR wagmi connected
  const canSwitch = Boolean(activePrivyWallet) || isConnected;
  const isPending = isPrivySwitching || isWagmiPending;
  const combinedError = localError ?? (wagmiError as unknown as string | null);

  const handleSwitch = async (networkId: number): Promise<void> => {
    const target = SUPPORTED_NETWORKS.find((n) => n.id === networkId);
    if (networkId === chainId) return;
    setLocalError(null);

    // Always attempt Privy wallet switch first when available (works for both embedded and external via Privy)
    // Then fallback to wagmi's switchChainAsync for robustness (handles wallet_addEthereumChain, etc.)
    if (activePrivyWallet) {
      setIsPrivySwitching(true);
      try {
        await (activePrivyWallet as any).switchChain(networkId);
        toast.success(`Switched to ${target?.name ?? networkId}`);
        return;
      } catch (privyErr: any) {
        const msg = privyErr?.message ?? String(privyErr);
        // If Privy reports unsupported, try wagmi as fallback before surfacing error
        const isUnsupported =
          msg.toLowerCase().includes("unsupported") ||
          msg.toLowerCase().includes("not supported") ||
          msg.toLowerCase().includes("unrecognized");
        if (!isUnsupported) {
          console.warn("Privy switchChain failed, trying wagmi fallback:", privyErr);
        }
        // fall through to wagmi
      } finally {
        setIsPrivySwitching(false);
      }
    }

    // Wagmi fallback (works for external wallets and also for Privy-bridged embedded via @privy-io/wagmi)
    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: networkId });
        toast.success(`Switched to ${target?.name ?? networkId}`);
        return;
      }
      // Last resort: try Privy wallet again with hex
      if (activePrivyWallet) {
        await (activePrivyWallet as any).switchChain(`0x${networkId.toString(16)}`);
        toast.success(`Switched to ${target?.name ?? networkId}`);
        return;
      }
      throw new Error("No wallet available");
    } catch (wagmiErr: any) {
      console.error("Network switch failed:", wagmiErr);
      const message =
        wagmiErr?.message?.includes("User rejected") || wagmiErr?.code === 4001
          ? "Network switch was rejected."
          : wagmiErr?.message?.toLowerCase().includes("unsupported")
            ? "Network not supported by wallet."
            : "Could not switch networks. Try again.";
      setLocalError(message);
      toast.error(message);
    }
  };

  return (
    <NetworkMenu
      compact={compact}
      chainId={chainId}
      canSwitch={canSwitch}
      isPending={isPending}
      error={combinedError}
      onSwitch={handleSwitch}
    />
  );
}

function WagmiNetworkSwitcher({ compact = false }: NetworkSwitcherProps) {
  const { chain, isConnected } = useAccount();
  const { switchChainAsync, isPending, error } = useSwitchChain();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSwitch = async (networkId: number): Promise<void> => {
    const target = SUPPORTED_NETWORKS.find((n) => n.id === networkId);
    if (networkId === (chain?.id ?? 0)) return;
    setLocalError(null);
    try {
      await switchChainAsync({ chainId: networkId });
      toast.success(`Switched to ${target?.name ?? networkId}`);
    } catch (err: any) {
      const message =
        err?.message?.includes("User rejected") || err?.code === 4001
          ? "Network switch was rejected."
          : "Could not switch networks. Try again.";
      setLocalError(message);
      toast.error(message);
    }
  };

  return (
    <NetworkMenu
      compact={compact}
      chainId={chain?.id ?? 0}
      canSwitch={isConnected}
      isPending={isPending}
      error={localError ?? (error as unknown as string)}
      onSwitch={handleSwitch}
    />
  );
}

const hasPrivyProvider = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
    process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "test-app-id" &&
    !process.env.NEXT_PUBLIC_PRIVY_APP_ID.startsWith("clp000")
);

export function NetworkSwitcher(props: NetworkSwitcherProps) {
  return hasPrivyProvider ? <PrivyAwareNetworkSwitcher {...props} /> : <WagmiNetworkSwitcher {...props} />;
}
