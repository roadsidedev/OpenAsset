/**
 * @file contractAbis.ts
 * @description V2 Contract ABIs for frontend Web3 interactions
 */

export const MARKET_FACTORY_ABI = [
  'function createMarket(tuple(address lpAddress, address collateralAsset, address assetAdapter, address oracleAdapter, address complianceAdapter, address liquidationAdapter, address positionAdapter, address lendingAsset, uint256 ltvBasisPoints, uint256 aprBasisPoints, uint256 durationSeconds, uint256 gracePeriodHours, bool enableHealthFactor, uint256 healthFactorThreshold, bool enableCircuitBreaker, uint256 pauseThresholdBps, uint256 lookbackPeriodSeconds, uint256 resumeThresholdBps, uint256 cooldownSeconds) config, uint256 initialLiquidity) external returns (address)',
  'function getMarketCount() external view returns (uint256)',
  'function getAllMarkets() external view returns (address[])',
  'function isMarket(address) external view returns (bool)',
  'function isAllowedLendingAsset(address) external view returns (bool)',
  'event MarketCreated(address indexed marketAddress, address indexed lpAddress, address indexed collateralAsset, uint256 initialLiquidity, uint256 creationFee)',
] as const;

export const LENDING_MARKET_ABI = [
  'function depositLiquidity(uint256 amount) external returns (uint256)',
  'function withdrawLiquidity(uint256 shares) external returns (uint256)',
  'function requestLoan(uint256 collateralAmount) external returns (uint256)',
  'function repay(uint256 loanId) external',
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
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateralAmount)',
  'event LoanRepaid(uint256 indexed loanId, address indexed repayer, uint256 principal, uint256 interest)',
  'event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 recoveredForLP, uint256 returnedToHolder)',
  'event LiquidationCureStarted(uint256 indexed loanId, uint256 cureDeadline, uint256 frozenDebt)',
  'event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares)',
  'event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares)',
] as const;

export const ADAPTER_REGISTRY_ABI = [
  'function getAdapterInfo(address adapter) external view returns (tuple(address adapterAddress, uint8 adapterType, address registeredBy, bool verified, bool deprecated, string auditReference, uint256 registeredAt, uint256 totalValueSecured))',
  'function isSelectable(address adapter) external view returns (bool)',
  'function getAllAdapters() external view returns (address[])',
  'function getAdaptersByType(uint8 adapterType) external view returns (address[])',
  'function getTotalAdapterCount() external view returns (uint256)',
  'event AdapterRegistered(address indexed adapter, uint8 indexed adapterType, address indexed registeredBy)',
  'event AdapterVerified(address indexed adapter, string auditReference)',
  'event AdapterDeprecated(address indexed adapter, string reason)',
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
