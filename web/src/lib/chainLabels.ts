/**
 * @file chainLabels.ts
 * @description Canonical chain labels shared across the app.
 */

export function getChainLabel(chainId: number | null | undefined): string {
  if (!chainId) return 'Unknown network';
  switch (chainId) {
    case 8453:
      return 'Base';
    case 84532:
      return 'Base Sepolia';
    case 11155111:
      return 'Sepolia';
    case 4663:
      return 'Robinhood Chain';
    case 46630:
      return 'Robinhood Testnet';
    default:
      return `Chain ${chainId}`;
  }
}

export function isSupportedChainId(chainId: number | null | undefined): boolean {
  return chainId === 8453 || chainId === 84532 || chainId === 11155111 || chainId === 4663 || chainId === 46630;
}

/**
 * Accent color for the chain's indicator dot (network chips, filters).
 * Kept next to the label so both stay in sync.
 */
export function getChainAccent(chainId: number | null | undefined): string {
  switch (chainId) {
    case 8453:
    case 84532:
      return '#0052FF'; // Base blue
    case 4663:
    case 46630:
      return '#00C805'; // Robinhood green
    case 11155111:
      return '#627EEA'; // Sepolia eth blue
    default:
      return '#94A3B8';
  }
}
