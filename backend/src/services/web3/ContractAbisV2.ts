/**
 * @file ContractAbisV2.ts
 * @description V2 ABI definitions for the adapter-based architecture
 */

// ============ MarketFactoryV2 ============

export const MARKET_FACTORY_V2_ABI = [
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'lpAddress', type: 'address' },
          { name: 'collateralAsset', type: 'address' },
          { name: 'assetAdapter', type: 'address' },
          { name: 'oracleAdapter', type: 'address' },
          { name: 'complianceAdapter', type: 'address' },
          { name: 'liquidationAdapter', type: 'address' },
          { name: 'positionAdapter', type: 'address' },
          { name: 'lendingAsset', type: 'address' },
          { name: 'ltvBasisPoints', type: 'uint256' },
          { name: 'aprBasisPoints', type: 'uint256' },
          { name: 'durationSeconds', type: 'uint256' },
          { name: 'gracePeriodHours', type: 'uint256' },
          { name: 'enableHealthFactor', type: 'bool' },
          { name: 'healthFactorThreshold', type: 'uint256' },
          { name: 'enableCircuitBreaker', type: 'bool' },
          { name: 'pauseThresholdBps', type: 'uint256' },
          { name: 'lookbackPeriodSeconds', type: 'uint256' },
          { name: 'resumeThresholdBps', type: 'uint256' },
          { name: 'cooldownSeconds', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'marketAddress', type: 'address' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'marketProvider',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllMarkets',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMarket',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowedLendingAssets',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAllowedLendingAsset',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateCreationFee',
    inputs: [{ name: 'totalDeposit', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    name: 'ProviderMarketInitialized',
    inputs: [
      { name: 'providerId', type: 'bytes32', indexed: true },
      { name: 'marketAddress', type: 'address', indexed: true },
      { name: 'configurator', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { name: 'marketAddress', type: 'address', indexed: true },
      { name: 'lpAddress', type: 'address', indexed: true },
      { name: 'collateralAsset', type: 'address', indexed: true },
      { name: 'initialLiquidity', type: 'uint256', indexed: false },
      { name: 'creationFee', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ============ LendingMarketV2 ============

export const LENDING_MARKET_V2_ABI = [
  {
    type: 'function',
    name: 'requestLoan',
    inputs: [{ name: 'collateralAmount', type: 'uint256' }],
    outputs: [{ name: 'loanId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestLoan',
    inputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'requestedPrincipal', type: 'uint256' },
    ],
    outputs: [{ name: 'loanId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidate',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleLiquidation',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalizeRedemptionSettlement',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositLiquidity',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawLiquidity',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLoanDetails',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principal', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'expiryTime', type: 'uint256' },
      { name: 'frozenInterestAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'healthFactor', type: 'uint256' },
      { name: 'positionHolder', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketStats',
    inputs: [],
    outputs: [
      { name: 'totalLiquidity', type: 'uint256' },
      { name: 'availableLiquidity', type: 'uint256' },
      { name: 'totalBorrowed', type: 'uint256' },
      { name: 'activeLoans', type: 'uint256' },
      { name: 'marketStatus', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getHealthFactor',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loans',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principal', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'expiryTime', type: 'uint256' },
      { name: 'frozenInterestAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextLoanId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'status',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalLiquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableLiquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lpToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  ...[
    ['collateralAsset', 'address'],
    ['lendingAsset', 'address'],
    ['assetAdapter', 'address'],
    ['oracleAdapter', 'address'],
    ['complianceAdapter', 'address'],
    ['liquidationAdapter', 'address'],
    ['positionAdapter', 'address'],
    ['ltvBps', 'uint256'],
    ['aprBps', 'uint256'],
    ['durationSeconds', 'uint256'],
    ['gracePeriodHours', 'uint256'],
    ['enableHealthFactor', 'bool'],
    ['healthFactorThreshold', 'uint256'],
  ].map(([name, type]) => ({
    type: 'function',
    name,
    inputs: [],
    outputs: [{ name: '', type }],
    stateMutability: 'view',
  })),
  {
    type: 'event',
    name: 'LoanCreated',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
      { name: 'collateralAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LoanRepaid',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'repayer', type: 'address', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
      { name: 'interest', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LoanLiquidated',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'liquidator', type: 'address', indexed: true },
      { name: 'recoveredForLP', type: 'uint256', indexed: false },
      { name: 'returnedToHolder', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LiquidationCureStarted',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'cureDeadline', type: 'uint256', indexed: false },
      { name: 'frozenDebt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LiquidityDeposited',
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CircuitBreakerTriggered',
    inputs: [
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MarketPaused',
    inputs: [{ name: 'timestamp', type: 'uint256', indexed: false }],
  },
  {
    type: 'event',
    name: 'MarketResumed',
    inputs: [{ name: 'timestamp', type: 'uint256', indexed: false }],
  },
] as const;

// ============ AdapterRegistry ============

export const ADAPTER_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerAdapter',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'adapterType', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'markVerified',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'auditReference', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'markDeprecated',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAdapterInfo',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'adapterAddress', type: 'address' },
          { name: 'adapterType', type: 'uint8' },
          { name: 'registeredBy', type: 'address' },
          { name: 'verified', type: 'bool' },
          { name: 'deprecated', type: 'bool' },
          { name: 'auditReference', type: 'string' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'totalValueSecured', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSelectable',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllAdapters',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAdaptersByType',
    inputs: [{ name: 'adapterType', type: 'uint8' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalAdapterCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AdapterRegistered',
    inputs: [
      { name: 'adapter', type: 'address', indexed: true },
      { name: 'adapterType', type: 'uint8', indexed: true },
      { name: 'registeredBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AdapterVerified',
    inputs: [
      { name: 'adapter', type: 'address', indexed: true },
      { name: 'auditReference', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AdapterDeprecated',
    inputs: [
      { name: 'adapter', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

// ============ Adapter Interface ABIs (for reads) ============

export const IORACLE_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'getPrice',
    inputs: [],
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'isTrusted', type: 'bool' },
      { name: 'updatedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getHistoricalPrice',
    inputs: [{ name: 'secondsAgo', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const ICOMPLIANCE_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'isEligible',
    inputs: [{ name: 'participant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const ILIQUIDATION_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'isAsynchronous',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cureWindowSeconds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const IPOSITION_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

// ============ B20 (Base Tokenized Stocks) ============

export const B20_FACTORY_ABI = [
  {
    type: 'event',
    name: 'B20Created',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'isB20',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const B20_TOKEN_ABI = [
  {
    type: 'event',
    name: 'UIMultiplierUpdated',
    inputs: [
      { name: 'newMultiplier', type: 'uint256', indexed: false },
      { name: 'effectiveAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MultiplierUpdated',
    inputs: [
      { name: 'oldMultiplier', type: 'uint256', indexed: false },
      { name: 'newMultiplier', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UIMultiplierUpdateCancelled',
    inputs: [],
  },
  {
    type: 'event',
    name: 'Announcement',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'description', type: 'string', indexed: false },
      { name: 'uri', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EndAnnouncement',
    inputs: [{ name: 'id', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'ExtraMetadataUpdated',
    inputs: [
      { name: 'key', type: 'string', indexed: true },
      { name: 'value', type: 'string', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'multiplier',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'scaledBalanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'WAD_PRECISION',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const IERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
