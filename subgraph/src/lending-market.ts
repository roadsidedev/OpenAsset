import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
import {
  LiquidityDeposited,
  LiquidityWithdrawn,
  LoanCreated,
  CircuitBreakerTriggered,
} from "../generated/templates/LendingMarket/LendingMarket";
import { LoanContract as LoanContractTemplate } from "../generated/templates";
import {
  Market,
  Loan,
  User,
  LiquidityProvider,
  LiquidityEvent,
  CircuitBreakerEvent,
} from "../generated/schema";

// ============ Liquidity Events ============

export function handleLiquidityDeposited(event: LiquidityDeposited): void {
  let market = Market.load(event.address.toHexString())!;
  let userId = event.params.provider.toHexString();
  
  // Load or create user
  let user = User.load(userId);
  if (user == null) {
    user = new User(userId);
    user.totalBorrowed = BigInt.fromI32(0);
    user.totalRepaid = BigInt.fromI32(0);
    user.totalLiquidated = BigInt.fromI32(0);
    user.activeLoanCount = 0;
    user.totalDeposited = BigInt.fromI32(0);
    user.totalWithdrawn = BigInt.fromI32(0);
    user.totalInterestEarned = BigInt.fromI32(0);
    user.save();
  }
  
  user.totalDeposited = user.totalDeposited.plus(event.params.amount);
  user.save();
  
  // Update or create liquidity provider position
  let lpId = userId + "-" + event.address.toHexString();
  let lp = LiquidityProvider.load(lpId);
  if (lp == null) {
    lp = new LiquidityProvider(lpId);
    lp.user = userId;
    lp.market = market.id;
    lp.shares = BigInt.fromI32(0);
    lp.deposited = BigInt.fromI32(0);
    lp.withdrawn = BigInt.fromI32(0);
    lp.interestEarned = BigInt.fromI32(0);
    lp.firstDepositAt = event.block.timestamp;
  }
  
  lp.shares = lp.shares.plus(event.params.shares);
  lp.deposited = lp.deposited.plus(event.params.amount);
  lp.lastActionAt = event.block.timestamp;
  lp.save();
  
  // Update market stats
  market.totalLiquidity = market.totalLiquidity.plus(event.params.amount);
  market.availableLiquidity = market.availableLiquidity.plus(event.params.amount);
  market.totalShares = market.totalShares.plus(event.params.shares);
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Create liquidity event
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  liquidityEvent.market = market.id;
  liquidityEvent.provider = userId;
  liquidityEvent.type = "DEPOSIT";
  liquidityEvent.amount = event.params.amount;
  liquidityEvent.shares = event.params.shares;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.txHash = event.transaction.hash;
  liquidityEvent.save();
}

export function handleLiquidityWithdrawn(event: LiquidityWithdrawn): void {
  let market = Market.load(event.address.toHexString())!;
  let userId = event.params.provider.toHexString();
  let user = User.load(userId)!;
  
  user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
  user.save();
  
  // Update liquidity provider
  let lpId = userId + "-" + event.address.toHexString();
  let lp = LiquidityProvider.load(lpId)!;
  lp.shares = lp.shares.minus(event.params.shares);
  lp.withdrawn = lp.withdrawn.plus(event.params.amount);
  lp.lastActionAt = event.block.timestamp;
  
  // Calculate interest earned (withdrawn amount exceeds deposited)
  if (lp.withdrawn.gt(lp.deposited)) {
    lp.interestEarned = lp.withdrawn.minus(lp.deposited);
    user.totalInterestEarned = user.totalInterestEarned.plus(lp.interestEarned);
    user.save();
  }
  lp.save();
  
  // Update market stats
  market.totalLiquidity = market.totalLiquidity.minus(event.params.amount);
  market.availableLiquidity = market.availableLiquidity.minus(event.params.amount);
  market.totalShares = market.totalShares.minus(event.params.shares);
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Create liquidity event
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  liquidityEvent.market = market.id;
  liquidityEvent.provider = userId;
  liquidityEvent.type = "WITHDRAW";
  liquidityEvent.amount = event.params.amount;
  liquidityEvent.shares = event.params.shares;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.txHash = event.transaction.hash;
  liquidityEvent.save();
}

// ============ Loan Events ============

export function handleLoanCreated(event: LoanCreated): void {
  let market = Market.load(event.address.toHexString())!;
  let userId = event.params.borrower.toHexString();
  
  // Load or create user
  let user = User.load(userId);
  if (user == null) {
    user = new User(userId);
    user.totalBorrowed = BigInt.fromI32(0);
    user.totalRepaid = BigInt.fromI32(0);
    user.totalLiquidated = BigInt.fromI32(0);
    user.activeLoanCount = 0;
    user.totalDeposited = BigInt.fromI32(0);
    user.totalWithdrawn = BigInt.fromI32(0);
    user.totalInterestEarned = BigInt.fromI32(0);
  }
  
  user.totalBorrowed = user.totalBorrowed.plus(event.params.principal);
  user.activeLoanCount = user.activeLoanCount + 1;
  user.save();
  
  // Create loan entity
  let loan = new Loan(event.params.loanContract.toHexString());
  loan.market = market.id;
  loan.borrower = userId;
  loan.principal = event.params.principal;
  loan.interestAmount = BigInt.fromI32(0); // Will be set from loan contract
  loan.collateralAmount = BigInt.fromI32(0);
  loan.tokenId = BigInt.fromI32(0);
  loan.erc1155Amount = BigInt.fromI32(0);
  loan.startTime = event.block.timestamp;
  loan.expiryTime = event.block.timestamp.plus(market.durationSeconds);
  loan.status = "ACTIVE";
  loan.healthFactor = BigDecimal.fromString("2.0"); // Default healthy
  loan.save();
  
  // Update market stats
  market.reservedLiquidity = market.reservedLiquidity.plus(event.params.principal);
  market.availableLiquidity = market.availableLiquidity.minus(event.params.principal);
  market.totalVolume = market.totalVolume.plus(event.params.principal);
  
  // Calculate utilization rate
  if (market.totalLiquidity.gt(BigInt.fromI32(0))) {
    let utilization = market.reservedLiquidity.toBigDecimal()
      .div(market.totalLiquidity.toBigDecimal());
    market.utilizationRate = utilization;
  }
  
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Start tracking loan contract events
  LoanContractTemplate.create(event.params.loanContract);
}

// ============ Circuit Breaker ============

export function handleCircuitBreakerTriggered(event: CircuitBreakerTriggered): void {
  let market = Market.load(event.address.toHexString())!;
  
  market.circuitBreakerTriggered = true;
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Create circuit breaker event
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let cbEvent = new CircuitBreakerEvent(eventId);
  cbEvent.market = market.id;
  cbEvent.volatility = event.params.volatility;
  cbEvent.triggered = true;
  cbEvent.timestamp = event.params.timestamp;
  cbEvent.txHash = event.transaction.hash;
  cbEvent.save();
}
