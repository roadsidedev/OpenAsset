'use client';

import { useState, useEffect, useCallback } from 'react';
import { isAddress } from 'viem';
import { useTokenMetadata } from '@/lib/tokenMetadata';
import { TokenPreview } from '@/components/tokens/TokenPreview';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Warning } from '@phosphor-icons/react';

interface TokenAddressInputProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
  placeholder?: string;
  chainId?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function TokenAddressInput({
  value,
  onChange,
  label = 'Token Address',
  placeholder = '0x...',
  chainId,
  required,
  disabled,
  id,
}: TokenAddressInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const debouncedAddress = inputValue.trim();
  const isValidAddress = debouncedAddress ? isAddress(debouncedAddress) : false;

  const { data: tokenInfo, isLoading, error } = useTokenMetadata(
    isValidAddress ? debouncedAddress : undefined,
    chainId,
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    setInputValue(raw);
    setHasInteracted(true);
    if (isAddress(raw)) {
      onChange(raw);
    } else if (raw === '') {
      onChange('');
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    if (inputValue.trim() && !isAddress(inputValue.trim())) {
      // Keep the invalid input visible so user sees the error
    }
  }, [inputValue]);

  const showInvalidError = hasInteracted && debouncedAddress && !isValidAddress && !isLoading;
  const showTokenError = isValidAddress && !isLoading && tokenInfo?.error;
  const showPreview = isValidAddress && !isLoading && tokenInfo && !tokenInfo.error && tokenInfo.isValid;
  const showLoading = isValidAddress && isLoading;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}

      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'w-full rounded-2xl border bg-muted/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 transition-colors',
          showInvalidError || showTokenError
            ? 'border-destructive/50 focus:ring-destructive/30'
            : showPreview
            ? 'border-emerald-500/30 focus:ring-emerald-400/30'
            : 'border-border focus:ring-ice-400',
          'placeholder:text-muted-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />

      {showLoading && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      )}

      {showInvalidError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          <Warning className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Invalid address format. Must be a valid 0x Ethereum address.</span>
        </div>
      )}

      {showTokenError && (
        <TokenPreview
          name=""
          symbol=""
          decimals={18}
          address={debouncedAddress}
          error={tokenInfo?.error || 'Could not resolve token metadata.'}
        />
      )}

      {showPreview && tokenInfo && (
        <TokenPreview
          name={tokenInfo.name}
          symbol={tokenInfo.symbol}
          decimals={tokenInfo.decimals}
          logoUri={tokenInfo.logoUri}
          address={tokenInfo.address}
        />
      )}
    </div>
  );
}
