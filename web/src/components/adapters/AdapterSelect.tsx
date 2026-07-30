'use client';

import { AdapterBadge } from './AdapterBadge';
import { AdapterIcon } from '@/components/tokens/TokenPreview';
import { getAdapterMeta } from '@/lib/adapterRegistry';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface Adapter {
  address: string;
  name: string;
  type: number;
  verified: boolean;
  deprecated: boolean;
  auditReference?: string;
}

interface AdapterSelectProps {
  label: string;
  description?: string;
  adapters: Adapter[];
  selected: string;
  onSelect: (address: string) => void;
  required?: boolean;
  loading?: boolean;
  chainId?: number;
  placeholder?: string;
}

export function AdapterSelect({
  label,
  description,
  adapters,
  selected,
  onSelect,
  required,
  loading,
  chainId,
  placeholder = 'Select an adapter...',
}: AdapterSelectProps) {
  const selectableAdapters = adapters.filter((a) => !a.deprecated);

  const selectedAdapter = selectableAdapters.find((a) => a.address === selected);
  const selectedMeta = selectedAdapter ? getAdapterMeta(chainId, selectedAdapter.address) : undefined;

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {loading && selectableAdapters.length === 0 ? (
        <div className="h-9 w-full rounded-md border border-border bg-muted/50 animate-pulse" />
      ) : (
        <Select
          value={selected || undefined}
          onValueChange={onSelect}
        >
          <SelectTrigger className="w-full rounded-2xl border-border bg-muted/50 px-4 py-3 text-sm focus:ring-2 focus:ring-ice-400">
            <SelectValue placeholder={placeholder}>
              {selectedAdapter && (
                <div className="flex items-center gap-2">
                  <AdapterIcon
                    iconName={selectedMeta?.icon || 'PuzzlePiece'}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">{selectedMeta?.name || selectedAdapter.name}</span>
                  {selectedAdapter.verified && (
                    <span className="text-[10px] text-emerald-500 font-medium">Verified</span>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {selectableAdapters.map((adapter) => {
              const meta = getAdapterMeta(chainId, adapter.address);
              const displayName = meta?.name || adapter.name;
              const iconName = meta?.icon || 'PuzzlePiece';

              return (
                <SelectItem
                  key={adapter.address}
                  value={adapter.address}
                  className="rounded-xl py-2.5 px-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <AdapterIcon iconName={iconName} className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{displayName}</span>
                        <AdapterBadge
                          verified={adapter.verified}
                          deprecated={adapter.deprecated}
                        />
                      </div>
                      {meta?.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {meta.description}
                        </p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {selected && (
        <div className="flex items-center gap-2 rounded-lg bg-ice-50 dark:bg-ice-900/20 border border-ice-300/30 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-ice-400" />
          <span className="text-xs text-ice-600 dark:text-ice-400 font-medium">
            {selectedMeta?.name || selectedAdapter?.name || selected.slice(0, 10) + '...'}
          </span>
        </div>
      )}
    </div>
  );
}
