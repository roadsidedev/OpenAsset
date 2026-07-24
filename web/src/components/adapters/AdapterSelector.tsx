'use client';

import { AdapterBadge } from './AdapterBadge';

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
        <label className="block text-sm font-medium text-zinc-200">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {description && (
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        )}
      </div>

      {deprecationWarning && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          {deprecationWarning}
        </div>
      )}

      <div className="space-y-2">
        {selectableAdapters.map((adapter) => (
          <button
            key={adapter.address}
            onClick={() => onSelect(adapter.address)}
            className={`w-full rounded-lg border p-3 text-left transition-all ${
              selected === adapter.address
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-200">{adapter.name}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {adapter.address.slice(0, 6)}...{adapter.address.slice(-4)}
                </span>
              </div>
              <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
            </div>
            {adapter.auditReference && (
              <p className="mt-1 text-xs text-zinc-500">Audit: {adapter.auditReference}</p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <p className="text-xs text-zinc-500">
          Selected: {selected.slice(0, 6)}...{selected.slice(-4)}
        </p>
      )}
    </div>
  );
}
