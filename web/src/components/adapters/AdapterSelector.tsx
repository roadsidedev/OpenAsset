"use client";

import { AdapterCard } from "./AdapterCard";
import { cn } from "@/lib/utils";

export interface Adapter {
  address: string;
  name: string;
  type: number;
  verified: boolean;
  deprecated: boolean;
  auditReference?: string;
}

interface AdapterSelectorProps {
  label: string;
  description?: string;
  adapters: Adapter[];
  selected: string;
  onSelect: (address: string) => void;
  required?: boolean;
  deprecationWarning?: string;
  loading?: boolean;
  chainId?: number;
}

function AdapterSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function AdapterSelector({
  label,
  description,
  adapters,
  selected,
  onSelect,
  required,
  deprecationWarning,
  loading,
  chainId,
}: AdapterSelectorProps) {
  const selectableAdapters = adapters.filter((a) => !a.deprecated);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {deprecationWarning && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {deprecationWarning}
        </div>
      )}

      {loading && selectableAdapters.length === 0 && (
        <div className="space-y-2">
          <AdapterSkeleton />
          <AdapterSkeleton />
        </div>
      )}

      {!loading && selectableAdapters.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          No adapters available for this category.
        </div>
      )}

      <div className="space-y-2">
        {selectableAdapters.map((adapter) => (
          <AdapterCard
            key={adapter.address}
            adapter={adapter}
            chainId={chainId}
            selected={selected === adapter.address}
            onSelect={() => onSelect(adapter.address)}
          />
        ))}
      </div>

      {selected && (
        <div className="flex items-center gap-2 rounded-lg bg-ice-50 dark:bg-ice-900/20 border border-ice-300/30 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-ice-400" />
          <span className="text-xs text-ice-600 dark:text-ice-400 font-medium">
            Selected: {selected.slice(0, 6)}...{selected.slice(-4)}
          </span>
        </div>
      )}
    </div>
  );
}
