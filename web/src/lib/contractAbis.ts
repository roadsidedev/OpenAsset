/**
 * @file contractAbis.ts
 * @description Contract ABIs for frontend Web3 interactions
 */

export const MARKET_FACTORY_ABI = [
  'function createMarket(address collateralAsset, address loanAsset, uint8 assetType, uint8 oracleType, address primaryOracle, address nftOracle, uint256 ltvBps, uint256 aprBps, uint256 durationSeconds, uint256 initialLiquidity) external returns (address)',
  'function getMarketCount() external view returns (uint256)',
  'function getMarkets(uint256 start, uint256 count) external view returns (address[])',
  'function getMarketInfo(address market) external view returns (tuple(address marketAddress, address owner, address collateralAsset, address loanAsset, uint8 assetType, uint8 oracleType, uint256 ltvBps, uint256 aprBps, uint256 durationSeconds, uint256 createdAt, bool active))',
  'function checkMarketExists(address collateralAsset, address loanAsset, uint8 assetType, uint256 ltvBps, uint256 aprBps, uint256 durationSeconds) external view returns (bool exists, address market)',
  'event MarketCreated(address indexed market, address indexed owner, address indexed collateralAsset, address loanAsset, uint8 assetType, uint256 ltvBps, uint256 initialLiquidity)',
] as const;

export const LENDING_MARKET_ABI = [
  'function depositLiquidity(uint256 amount) external returns (uint256)',
  'function withdrawLiquidity(uint256 shares) external returns (uint256)',
  'function requestLoan(uint256 collateralAmount, uint256 tokenId, uint256 erc1155Amount, uint256 desiredPrincipal) external returns (address)',
  'function liquidateLoan(address loanAddress) external',
  'function getTotalLiquidity() external view returns (uint256)',
  'function getAvailableLiquidity() external view returns (uint256)',
  'function getLoanCount() external view returns (uint256)',
  'function getLoans(uint256 start, uint256 count) external view returns (address[])',
  'event LiquidityDeposited(address indexed provider, uint256 amount, uint256 sharesIssued)',
  'event LiquidityWithdrawn(address indexed provider, uint256 shares, uint256 amountReturned)',
  'event LoanRequested(address indexed loanAddress, address indexed borrower, uint256 collateral, uint256 principal)',
  'event LoanLiquidated(address indexed loanAddress, uint256 timestamp)',
] as const;

export const LOAN_CONTRACT_ABI = [
  'function repayLoan(uint256 amount) external',
  'function getHealthFactor() external view returns (uint256)',
  'function getPrincipal() external view returns (uint256)',
  'function getAccruedInterest() external view returns (uint256)',
  'function getExpiryTime() external view returns (uint256)',
  'function getBorrower() external view returns (address)',
  'function getStatus() external view returns (uint8)',
  'event LoanRepaid(address indexed borrower, uint256 totalRepayment, uint256 timestamp)',
  'event LoanLiquidated(address indexed liquidator, address indexed borrower, uint256 collateralSeized, uint256 debtRecovered, uint256 timestamp)',
] as const;

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;
