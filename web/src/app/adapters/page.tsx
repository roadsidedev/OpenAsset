"use client";

import { useState } from "react";
import { AdapterBadge } from "@/components/adapters/AdapterBadge";
import { ADAPTER_TYPES } from "@/lib/contractAbis";
import { cn } from "@/lib/utils";
import { Blocks, ExternalLink } from "lucide-react";

interface AdapterInfo {
  adapterAddress: string;
  adapterType: number;
  verified: boolean;
  deprecated: boolean;
  auditReference: string;
  registeredAt: number;
}

// Mock data — in production, fetch from /api/v1/adapters
const MOCK_ADAPTERS: AdapterInfo[] = [
  { adapterAddress: "0x0000000000000000000000000000000000000001", adapterType: 0, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700000000 },
  { adapterAddress: "0x0000000000000000000000000000000000000002", adapterType: 1, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700000000 },
  { adapterAddress: "0x0000000000000000000000000000000000000003", adapterType: 1, verified: true, deprecated: false, auditReference: "", registeredAt: 1700001000 },
  { adapterAddress: "0x0000000000000000000000000000000000000005", adapterType: 3, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700002000 },
  { adapterAddress: "0x0000000000000000000000000000000000000006", adapterType: 3, verified: true, deprecated: false, auditReference: "", registeredAt: 1700003000 },
  { adapterAddress: "0x0000000000000000000000000000000000000007", adapterType: 4, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700004000 },
  { adapterAddress: "0x0000000000000000000000000000000000000008", adapterType: 4, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700005000 },
  { adapterAddress: "0x0000000000000000000000000000000000000009", adapterType: 4, verified: true, deprecated: false, auditReference: "Internal #1", registeredAt: 1700006000 },
  { adapterAddress: "0x000000000000000000000000000000000000DEAD", adapterType: 3, verified: false, deprecated: true, auditReference: "", registeredAt: 1690000000 },
];

const TYPE_FILTERS = ["All", "ASSET", "ORACLE", "COMPLIANCE", "LIQUIDATION", "POSITION"] as const;

export default function AdaptersPage() {
  const [filter, setFilter] = useState<string>("All");

  const filtered =
    filter === "All"
      ? MOCK_ADAPTERS
      : MOCK_ADAPTERS.filter((a) => ADAPTER_TYPES[a.adapterType] === filter);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Blocks className="h-6 w-6 text-ice-500" />
            <h1 className="text-2xl font-bold text-foreground">Adapter Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse all registered adapters. Verified adapters have been audited and reviewed.
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

        {/* Adapter Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((adapter) => (
            <div
              key={adapter.adapterAddress}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-ice-300/30 hover-lift"
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

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Blocks className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">No adapters found for this filter.</p>
          </div>
        )}
      </main>
    </div>
  );
}
