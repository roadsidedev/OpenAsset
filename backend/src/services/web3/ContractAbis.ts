/**
 * @file ContractAbis.ts
 * @description Production-grade ABI definitions for all Red Chips contracts
 * These are extracted from compiled contract ABIs and provide full type safety
 */

export const MARKET_FACTORY_ABI = [
  // Market Creation
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      { name: 'collateralAsset', type: 'address' },
      { name: 'loanAsset', type: 'address' },
      { name: 'assetType', type: 'uint8' },
      { name: 'oracleType', type: 'uint8' },
      { name: 'primaryOracle', type: 'address' },
      { name: 'nftOracle', type: 'address' },
      { name: 'ltvBps', type: 'uint256' },
      { name: 'aprBps', type: 'uint256' },
      { name: 'durationSeconds', type: 'uint256' },
      { name: 'initialLiquidity', type: 'uint256' },
    ],
    outputs: [{ name: 'market', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  // View Functions
  {
    type: 'function',
    name: 'getMarketCount',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarkets',
    inputs: [
      { name: 'start', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
    outputs: [{ name: 'markets', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketInfo',
    inputs: [{ name: 'market', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        name: '',
        components: [
          { name: 'marketAddress', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'collateralAsset', type: 'address' },
          { name: 'loanAsset', type: 'address' },
          { name: 'assetType', type: 'uint8' },
          { name: 'oracleType', type: 'uint8' },
          { name: 'ltvBps', type: 'uint256' },
          { name: 'aprBps', type: 'uint256' },
          { name: 'durationSeconds', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkMarketExists',
    inputs: [
      { name: 'collateralAsset', type: 'address' },
      { name: 'loanAsset', type: 'address' },
      { name: 'assetType', type: 'uint8' },
      { name: 'ltvBps', type: 'uint256' },
      { name: 'aprBps', type: 'uint256' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'market', type: 'address' },
    ],
    stateMutability: 'view',
  },
  // Admin Functions
  {
    type: 'function',
    name: 'addStablecoin',
    inputs: [
      { name: 'stablecoin', type: 'address' },
      { name: 'decimals', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { indexed: true, name: 'market', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'collateralAsset', type: 'address' },
      { indexed: false, name: 'loanAsset', type: 'address' },
      { indexed: false, name: 'assetType', type: 'uint8' },
      { indexed: false, name: 'ltvBps', type: 'uint256' },
      { indexed: false, name: 'initialLiquidity', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'StablecoinAdded',
    inputs: [
      { indexed: true, name: 'stablecoin', type: 'address' },
      { indexed: false, name: 'decimals', type: 'uint8' },
    ],
  },
];

export const LENDING_MARKET_ABI = [
  // Liquidity Operations
  {
    type: 'function',
    name: 'depositLiquidity',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'sharesIssued', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawLiquidity',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'amountReturned', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Loan Operations
  {
    type: 'function',
    name: 'requestLoan',
    inputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'erc1155Amount', type: 'uint256' },
      { name: 'desiredPrincipal', type: 'uint256' },
    ],
    outputs: [{ name: 'loanAddress', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidateLoan',
    inputs: [{ name: 'loanAddress', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyWithdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // View Functions
  {
    type: 'function',
    name: 'getTotalLiquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAvailableLiquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLoanCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLoans',
    inputs: [
      { name: 'start', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
    outputs: [{ name: 'loans', type: 'address[]' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'LiquidityDeposited',
    inputs: [
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'sharesIssued', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LiquidityWithdrawn',
    inputs: [
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: false, name: 'shares', type: 'uint256' },
      { indexed: false, name: 'amountReturned', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LoanRequested',
    inputs: [
      { indexed: true, name: 'loanAddress', type: 'address' },
      { indexed: true, name: 'borrower', type: 'address' },
      { indexed: false, name: 'collateral', type: 'uint256' },
      { indexed: false, name: 'principal', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LoanLiquidated',
    inputs: [
      { indexed: true, name: 'loanAddress', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
  },
];

export const LOAN_CONTRACT_ABI = [
  // Loan Operations
  {
    type: 'function',
    name: 'repayLoan',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getHealthFactor',
    inputs: [],
    outputs: [{ name: 'healthFactor', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPrincipal',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAccruedInterest',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getExpiryTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBorrower',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStatus',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'LoanRepaid',
    inputs: [
      { indexed: true, name: 'borrower', type: 'address' },
      { indexed: false, name: 'totalRepayment', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LoanLiquidated',
    inputs: [
      { indexed: true, name: 'liquidator', type: 'address' },
      { indexed: true, name: 'borrower', type: 'address' },
      { indexed: false, name: 'collateralSeized', type: 'uint256' },
      { indexed: false, name: 'debtRecovered', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
  },
];

export const ORACLE_ROUTER_ABI = [
  {
    type: 'function',
    name: 'getPrice',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{ name: 'price', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'oracleType',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supportsAsset',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
];

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
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
];
