/**
 * @file contractAbis.ts
 * @description V2 Contract ABIs for frontend Web3 interactions
 */

export const MARKET_FACTORY_ABI = [
  {
    name: 'createMarket',
    type: 'function',
    stateMutability: 'nonpayable',
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
      { name: 'initialLiquidity', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  { name: 'getMarketCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getAllMarkets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'isMarket', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isAllowedLendingAsset', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'MarketCreated', type: 'event', inputs: [{ name: 'marketAddress', type: 'address', indexed: true }, { name: 'lpAddress', type: 'address', indexed: true }, { name: 'collateralAsset', type: 'address', indexed: true }, { name: 'initialLiquidity', type: 'uint256', indexed: false }, { name: 'creationFee', type: 'uint256', indexed: false }] },
] as const;

export const MARKET_FACTORY_B20_ABI = [
  {
    name: 'createB20Market',
    type: 'function',
    stateMutability: 'nonpayable',
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
      { name: 'initialLiquidity', type: 'uint256' },
      {
        name: 'b20Config',
        type: 'tuple',
        components: [
          { name: 'feed', type: 'address' },
          { name: 'maxStaleness', type: 'uint256' },
          { name: 'l2Sequencer', type: 'address' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const MARKET_FACTORY_PROVIDER_ABI = [
  {
    name: 'createProviderMarket',
    type: 'function',
    stateMutability: 'nonpayable',
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
      { name: 'initialLiquidity', type: 'uint256' },
      {
        name: 'providerConfig',
        type: 'tuple',
        components: [
          { name: 'providerId', type: 'bytes32' },
          { name: 'providerData', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const LENDING_MARKET_ABI = [
  'function depositLiquidity(uint256 amount) external returns (uint256)',
  'function withdrawLiquidity(uint256 shares) external returns (uint256)',
  'function requestLoan(uint256 collateralAmount) external returns (uint256)',
  'function requestLoan(uint256 collateralAmount, uint256 requestedPrincipal) external returns (uint256)',
  'function repay(uint256 loanId) external',
  'function repayPartial(uint256 loanId, uint256 repayAmount) external',
  'function liquidate(uint256 loanId) external',
  'function settleLiquidation(uint256 loanId) external',
  'function getMarketStats() external view returns (uint256 totalLiquidity, uint256 availableLiquidity, uint256 totalBorrowed, uint256 activeLoans, uint8 marketStatus)',
  'function getLoanDetails(uint256 loanId) external view returns (uint256 collateralAmount, uint256 principal, uint256 startTime, uint256 expiryTime, uint256 frozenInterestAt, uint8 status, uint256 healthFactor, address positionHolder)',
  'function getHealthFactor(uint256 loanId) external view returns (uint256)',
  'function loans(uint256) external view returns (uint256 collateralAmount, uint256 principal, uint256 startTime, uint256 expiryTime, uint256 frozenInterestAt, uint8 status)',
  'function nextLoanId() external view returns (uint256)',
  'function status() external view returns (uint8)',
  'function totalLiquidity() external view returns (uint256)',
  'function availableLiquidity() external view returns (uint256)',
  'function lpToken() external view returns (address)',
  'function marketOwner() external view returns (address)',
  'function collateralAsset() external view returns (address)',
  'function lendingAsset() external view returns (address)',
  'function lendingDecimals() external view returns (uint8)',
  'function protocolTreasury() external view returns (address)',
  'function assetAdapter() external view returns (address)',
  'function oracleAdapter() external view returns (address)',
  'function complianceAdapter() external view returns (address)',
  'function liquidationAdapter() external view returns (address)',
  'function positionAdapter() external view returns (address)',
  'function ltvBps() external view returns (uint256)',
  'function aprBps() external view returns (uint256)',
  'function durationSeconds() external view returns (uint256)',
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateralAmount)',
  'event LoanRepaid(uint256 indexed loanId, address indexed repayer, uint256 principal, uint256 interest)',
  'event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 recoveredForLP, uint256 returnedToHolder)',
  'event LiquidationCureStarted(uint256 indexed loanId, uint256 cureDeadline, uint256 frozenDebt)',
  'event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares)',
  'event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares)',
] as const;

export const ADAPTER_REGISTRY_ABI = [
  {
    name: 'registerAdapter',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'adapter', type: 'address' }, { name: 'adapterType', type: 'uint8' }],
    outputs: [],
  },
  {
    name: 'registerAdapterWithMetadata',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'adapterType', type: 'uint8' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'supportedAssets', type: 'string' },
      { name: 'documentationURI', type: 'string' },
      { name: 'repositoryURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'updateMetadata',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'supportedAssets', type: 'string' },
      { name: 'documentationURI', type: 'string' },
      { name: 'repositoryURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'getAdapterMetadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'developer', type: 'address' },
          { name: 'category', type: 'string' },
          { name: 'supportedAssets', type: 'string' },
          { name: 'documentationURI', type: 'string' },
          { name: 'repositoryURI', type: 'string' },
          { name: 'auditURI', type: 'string' },
          { name: 'reviewStatus', type: 'uint8' },
          { name: 'usageCount', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getAdapterInfo',
    type: 'function',
    stateMutability: 'view',
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
  },
  { name: 'isSelectable', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'getAllAdapters', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'getAdaptersByType', type: 'function', stateMutability: 'view', inputs: [{ name: 'adapterType', type: 'uint8' }], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'getTotalAdapterCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'AdapterRegistered', type: 'event', inputs: [{ name: 'adapter', type: 'address', indexed: true }, { name: 'adapterType', type: 'uint8', indexed: true }, { name: 'registeredBy', type: 'address', indexed: true }] },
  { name: 'AdapterVerified', type: 'event', inputs: [{ name: 'adapter', type: 'address', indexed: true }, { name: 'auditReference', type: 'string', indexed: false }] },
  { name: 'AdapterDeprecated', type: 'event', inputs: [{ name: 'adapter', type: 'address', indexed: true }, { name: 'reason', type: 'string', indexed: false }] },
] as const;

export const IORACLE_ADAPTER_ABI = [
  'function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt)',
  'function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256)',
] as const;

export const ICOMPLIANCE_ADAPTER_ABI = [
  'function isEligible(address participant) external view returns (bool)',
] as const;

export const IPOSITION_ADAPTER_ABI = [
  'function ownerOf(uint256 loanId) external view returns (address)',
] as const;

export const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
] as const;

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

export const LP_TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)',
] as const;

// Adapter type enum mapping
export const ADAPTER_TYPES: Record<number, string> = {
  0: 'ASSET',
  1: 'ORACLE',
  2: 'COMPLIANCE',
  3: 'LIQUIDATION',
  4: 'POSITION',
};

// Loan status enum mapping
export const LOAN_STATUS: Record<number, string> = {
  0: 'ACTIVE',
  1: 'GRACE_PERIOD',
  2: 'LIQUIDATION_CURE',
  3: 'LIQUIDATION_SETTLING',
  4: 'REPAID',
  5: 'LIQUIDATED',
};

// Market status enum mapping
export const MARKET_STATUS: Record<number, string> = {
  0: 'ACTIVE',
  1: 'PAUSED_VOLATILITY',
  2: 'PAUSED_STALE_ORACLE',
  3: 'PAUSED_MANUAL',
};

// Pre-typed ABIs for use with viem readContract/writeContract (no parseAbi needed)
export const MARKET_FACTORY_ABI_TYPED = MARKET_FACTORY_ABI as any;
export const ADAPTER_REGISTRY_ABI_TYPED = ADAPTER_REGISTRY_ABI as any;
