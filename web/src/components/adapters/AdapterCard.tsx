'use client';

import { useState } from 'react';
import { AdapterBadge } from './AdapterBadge';
import { AdapterIcon } from '@/components/tokens/TokenPreview';
import { getAdapterMeta, type AdapterMetadata } from '@/lib/adapterRegistry';
import { cn } from '@/lib/utils';
import { CaretDown, Copy, Check, CheckCircle } from '@phosphor-icons/react';

export interface Adapter {
  address: string;
  name: string;
  type: number;
  verified: boolean;
  deprecated: boolean;
  auditReference?: string;
}

interface AdapterCardProps {
  adapter: Adapter;
  chainId?: number;
  selected: boolean;
  onSelect: () => void;
}

export function AdapterCard({ adapter, chainId, selected, onSelect }: AdapterCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta: AdapterMetadata | undefined = getAdapterMeta(chainId, adapter.address);
  const displayName = meta?.name || adapter.name;
  const displayDescription = meta?.description || null;
  const iconName = meta?.icon || 'PuzzlePiece';
  const version = meta?.version || null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(adapter.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleAdvancedToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAdvanced(!showAdvanced);
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-all relative',
        selected
          ? 'border-ice-400 bg-ice-50 dark:bg-ice-500/10 ring-2 ring-ice-400/30 dark:ring-ice-400/20'
          : 'border-border bg-card dark:bg-muted/20 hover:border-ice-300/50 dark:hover:border-ice-400/30 hover:bg-accent/50 dark:hover:bg-muted/40',
        adapter.deprecated && 'opacity-50 cursor-not-allowed',
      )}
      disabled={adapter.deprecated}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle className="h-5 w-5 text-ice-500" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          selected ? 'bg-ice-400/20 dark:bg-ice-500/15 text-ice-600 dark:text-ice-300' : 'bg-muted dark:bg-muted/50 text-muted-foreground',
        )}>
          <AdapterIcon iconName={iconName} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
            <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
          </div>

          {displayDescription && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {displayDescription}
            </p>
          )}

          {/* Version + audit row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {version && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {version}
              </span>
            )}
            {adapter.auditReference && (
              <span className="text-[10px] text-muted-foreground">
                Audit: {adapter.auditReference}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Advanced section — hidden contract address */}
      <div className="mt-3 border-t border-border/50 pt-2">
        <button
          type="button"
          onClick={handleAdvancedToggle}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretDown className={cn('h-3 w-3 transition-transform', showAdvanced && 'rotate-180')} />
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[11px] font-mono text-muted-foreground truncate flex-1">
              {adapter.address}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        )}
      </div>
    </button>
  );
}
