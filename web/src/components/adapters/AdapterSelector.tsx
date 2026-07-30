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

export function AdapterSelector({
  label,
  description,
  adapters,
  selected,
  onSelect,
  required,
  deprecationWarning,
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
        <p className="text-xs text-muted-foreground font-mono">
          Selected: {selected.slice(0, 6)}...{selected.slice(-4)}
        </p>
      )}
    </div>
  );
}
