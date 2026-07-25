"use client";

import { AdapterBadge } from "./AdapterBadge";
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
}

export function AdapterSelector({
  label,
  description,
  adapters,
  selected,
  onSelect,
  required,
  deprecationWarning,
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
          <button
            key={adapter.address}
            onClick={() => onSelect(adapter.address)}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition-all",
              selected === adapter.address
                ? "border-ice-400 bg-ice-50 dark:bg-ice-900/20"
                : "border-border bg-muted/30 hover:border-ice-300/50"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">{adapter.name}</span>
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  {adapter.address.slice(0, 6)}...{adapter.address.slice(-4)}
                </span>
              </div>
              <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
            </div>
            {adapter.auditReference && (
              <p className="mt-1 text-xs text-muted-foreground">Audit: {adapter.auditReference}</p>
            )}
          </button>
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
