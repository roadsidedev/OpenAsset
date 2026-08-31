/**
 * @file contractErrors.ts
 * @description Decode viem contract errors into human-readable messages.
 */

interface ViemErrorLike {
  name?: string;
  message?: string;
  shortMessage?: string;
  details?: string;
  data?: { errorName?: string; args?: unknown; data?: string } | string;
  cause?: unknown;
  [key: string]: unknown;
}

// 4-byte selectors for the custom errors defined in MarketFactoryV2.sol and LendingMarketV2.sol.
// Computed as keccak256("ErrorName(argTypes)")[:4]. Matching these directly avoids
// depending on viem's decodeErrorResult export surface across versions.
const CUSTOM_ERROR_SELECTORS: Record<string, string> = {
  '0x836808fd': 'LendingAssetNotAllowed',
  '0x39ec5d0b': 'AsyncLiquidationRequiresCompliance',
  '0x2c5211c6': 'InvalidAmount',
  '0x0313b285': 'MarketAlreadyExists',
  '0x6d98329e': 'TransferablePositionRequiresComplianceHook',
  '0x82b42900': 'Unauthorized',
  '0x35be3ac8': 'InvalidConfig',
  '0x30cd7471': 'NotOwner',
  '0xb521771a': 'MarketNotActive',
  '0x54882d18': 'MarketPaused',
  '0xfbd85bc3': 'InvalidCollateralAmount',
  '0x0e7e621d': 'LoanNotFound',
  '0x082f7846': 'LoanNotActive',
  '0xbb55fd27': 'InsufficientLiquidity',
  '0x96ab19c8': 'AmountExceedsBalance',
  '0xc7cbe25a': 'GracePeriodNotExpired',
  '0x27786942': 'CureWindowStillOpen',
  '0xbcb2bf2b': 'LoanNotInCure',
  '0xf25411ad': 'LoanNotSettling',
  '0x283e8cce': 'AdapterUnderDelivered',
  '0xdbed393c': 'AdapterAccountingMismatch',
};

const CUSTOM_ERROR_MESSAGES: Record<string, string> = {
  // MarketFactoryV2 custom errors
  LendingAssetNotAllowed: 'The selected lending asset is not approved. Use an allowlisted stablecoin (e.g. USDC).',
  AsyncLiquidationRequiresCompliance: 'Async liquidation adapters (e.g. issuer redemption) require a compliance adapter.',
  TransferablePositionRequiresComplianceHook: 'Transferable positions require a compliance adapter.',
  MarketAlreadyExists: 'A market with this configuration already exists.',
  InvalidAmount: 'Amount must be greater than zero.',
  InvalidConfig: 'Market configuration is invalid.',
  Unauthorized: 'You are not authorized to perform this action.',

  // LendingMarketV2 custom errors
  NotOwner: 'You are not the market owner.',
  MarketNotActive: 'This market is not currently active.',
  MarketPaused: 'This market is paused.',
  InvalidCollateralAmount: 'Collateral amount is invalid.',
  LoanNotFound: 'Loan not found.',
  LoanNotActive: 'This loan is not active.',
  InsufficientLiquidity: 'Not enough liquidity in the market.',
  AmountExceedsBalance: 'Amount exceeds your balance.',
  GracePeriodNotExpired: 'Grace period has not expired yet.',
  CureWindowStillOpen: 'The cure window is still open.',
  LoanNotInCure: 'This loan is not in the cure window.',
  LoanNotSettling: 'This loan is not settling.',
  AdapterUnderDelivered: 'An adapter under-delivered on its obligation.',
  AdapterAccountingMismatch: 'Adapter accounting mismatch detected.',
};

const REQUIRE_MESSAGES: Array<[RegExp, string]> = [
  [/Collateral must be a contract/i, 'The collateral asset address is not a smart contract. Check you are using a valid token address on the current network.'],
  [/Invalid LP address/i, 'The LP address is invalid.'],
  [/Asset adapter required/i, 'An asset adapter is required.'],
  [/Oracle adapter required/i, 'An oracle adapter is required.'],
  [/Liquidation adapter required/i, 'A liquidation adapter is required.'],
  [/Position adapter required/i, 'A position adapter is required.'],
  [/Lending asset required/i, 'A lending asset is required.'],
  [/LTV must be/i, 'LTV must be between 1% and 95%.'],
  [/APR must be/i, 'APR must be 100% or less.'],
  [/Duration must be/i, 'Duration must be between 1 hour and 365 days.'],
  [/adapter not selectable/i, 'One or more selected adapters is not registered or has been deprecated.'],
  [/Position adapter registration failed/i, 'Position adapter registration failed.'],
  [/ERC20: transfer amount exceeds balance/i, 'Insufficient balance for this transaction.'],
  [/ERC20: transfer amount exceeds allowance/i, 'Token approval is required. Deploy will ask your wallet to approve the factory, then create the market.'],
  [/ERC20: insufficient allowance/i, 'Insufficient allowance. Approve the token first.'],
  [/ERC20: transfer from the zero address/i, 'Invalid token transfer.'],
  [/SafeERC20: approve failed/i, 'Token approval failed. The token may be non-standard or incompatible.'],
  [/SafeERC20: transfer failed/i, 'Token transfer failed. The token may be non-standard or incompatible.'],
  [/call to non-contract/i, 'The target address is not a smart contract.'],
  [/not a smart contract/i, 'The address is not a smart contract on the current network.'],
  [/user rejected/i, 'Transaction was rejected in your wallet.'],
  [/user rejected the request/i, 'Transaction was rejected in your wallet.'],
  [/execution reverted/i, 'The transaction was reverted on-chain. Check the collateral and lending token addresses are valid ERC20 contracts on the current network.'],
];

function extractRevertData(err: unknown): { data?: string; errorName?: string } {
  const e = err as ViemErrorLike;

  // viem >=2: error.data may be a hex string, or { errorName, args }
  if (e.data && typeof e.data !== 'string') {
    return {
      data: typeof (e.data as { data?: string }).data === 'string' ? (e.data as { data?: string }).data : undefined,
      errorName: (e.data as { errorName?: string }).errorName,
    };
  }
  if (e.data && typeof e.data === 'string' && e.data.startsWith('0x')) {
    return { data: e.data };
  }

  // Traverse cause chain
  const cause = e.cause as ViemErrorLike | undefined;
  if (cause) {
    const nested = extractRevertData(cause);
    if (nested.data || nested.errorName) return nested;
  }

  return {};
}

function matchSelector(data: string): string | null {
  if (!data.startsWith('0x') || data.length < 10) return null;
  const selector = data.slice(0, 10).toLowerCase();
  return CUSTOM_ERROR_SELECTORS[selector] ?? null;
}

export function decodeContractError(err: unknown): string {
  if (!err) return 'Transaction failed.';

  const e = err as ViemErrorLike;
  const { data, errorName: directName } = extractRevertData(err);

  // 1. Custom error name already decoded by viem
  if (directName && CUSTOM_ERROR_MESSAGES[directName]) {
    return CUSTOM_ERROR_MESSAGES[directName];
  }

  // 2. Match raw revert data against known custom error selectors
  if (data) {
    const errorName = matchSelector(data);
    if (errorName && CUSTOM_ERROR_MESSAGES[errorName]) {
      return CUSTOM_ERROR_MESSAGES[errorName];
    }
  }

  // 3. Match require() strings embedded in the error message
  const fullMessage = [e.message, e.shortMessage, e.details].filter(Boolean).join('\n');
  if (fullMessage) {
    for (const [pattern, friendly] of REQUIRE_MESSAGES) {
      if (pattern.test(fullMessage)) return friendly;
    }
  }

  // 4. Fall back to a generic message
  if (e.shortMessage && e.shortMessage !== 'An error occurred.') {
    return e.shortMessage;
  }
  if (e.message && e.message !== 'An error occurred.') {
    return e.message;
  }
  return 'Transaction failed. Please try again.';
}
