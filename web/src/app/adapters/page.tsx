"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { type Address, parseAbi } from "viem";
import { AdapterBadge } from "@/components/adapters/AdapterBadge";
import { ADAPTER_REGISTRY_ABI_TYPED, ADAPTER_TYPES } from "@/lib/contractAbis";
import { getContract } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { PuzzlePiece } from "@phosphor-icons/react";

interface AdapterInfo {
  adapterAddress: string;
  adapterType: number;
  verified: boolean;
  deprecated: boolean;
  auditReference: string;
  registeredAt: number;
}

const TYPE_FILTERS = ["All", "ASSET", "ORACLE", "COMPLIANCE", "LIQUIDATION", "POSITION"] as const;

export default function AdaptersPage() {
  const { chain } = useAccount();
  const chainId = chain?.id;
  const publicClient = usePublicClient();
  const [filter, setFilter] = useState<string>("All");
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdapters() {
      const registryAddress = getContract(chainId, "adapterRegistry");
      if (!registryAddress || !publicClient) {
        setError("No AdapterRegistry found for this chain");
        setLoading(false);
        return;
      }

      try {
        const addresses = await publicClient.readContract({
          address: registryAddress as Address,
          abi: ADAPTER_REGISTRY_ABI_TYPED,
          functionName: "getAllAdapters",
        }) as string[];

        const results: AdapterInfo[] = [];
        for (const addr of addresses) {
          const info = await publicClient.readContract({
            address: registryAddress as Address,
            abi: ADAPTER_REGISTRY_ABI_TYPED,
            functionName: "getAdapterInfo",
            args: [addr as Address],
          }) as [string, number, string, boolean, boolean, string, bigint, bigint];

          results.push({
            adapterAddress: addr,
            adapterType: Number(info[1]),
            verified: info[3],
            deprecated: info[4],
            auditReference: info[5],
            registeredAt: Number(info[6]),
          });
        }
        setAdapters(results);
      } catch (err: any) {
        setError(err.message || "Failed to load adapters from registry");
        console.warn("Failed to load adapters:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdapters();
  }, [chainId, publicClient]);

  const filtered =
    filter === "All"
      ? adapters
      : adapters.filter((a) => ADAPTER_TYPES[a.adapterType] === filter);

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <PuzzlePiece className="h-6 w-6 text-ice-500" />
            <h1 className="text-2xl font-bold text-foreground text-balance">Adapter Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse all registered adapters. Data sourced from AdapterRegistry on-chain.
            {chainId ? ` Chain: ${chainId === 84532 ? "Base Sepolia" : chainId === 11155111 ? "Sepolia" : chainId}` : ""}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-medium scrollbar-hide">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 transition-colors",
                filter === t
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-card border border-border text-muted-foreground hover:border-ice-300/50 hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Adapter Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((adapter) => (
            <div
              key={adapter.adapterAddress}
              className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-ice-300/30"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {ADAPTER_TYPES[adapter.adapterType]}
                  </span>
                  <p className="mt-1 font-mono text-sm text-foreground truncate">
                    {adapter.adapterAddress.slice(0, 10)}...{adapter.adapterAddress.slice(-6)}
                  </p>
                </div>
                <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
              </div>
              {adapter.auditReference && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Audit: <span className="font-medium">{adapter.auditReference}</span>
                </p>
              )}
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <PuzzlePiece className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              {adapters.length === 0 ? "No adapters registered yet." : "No adapters found for this filter."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
