import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  LoanRepaid,
  LoanLiquidated,
} from "../generated/templates/LoanContract/LoanContract";
import { Loan, User, Market, Liquidation } from "../generated/schema";

// ============ Loan Repayment ============

export function handleLoanRepaid(event: LoanRepaid): void {
  let loan = Loan.load(event.address.toHexString())!;
  let user = User.load(loan.borrower)!;
  let market = Market.load(loan.market)!;
  
  // Update loan status
  loan.status = "REPAID";
  loan.repaidAt = event.block.timestamp;
  loan.save();
  
  // Update user stats
  user.totalRepaid = user.totalRepaid.plus(loan.principal);
  user.activeLoanCount = user.activeLoanCount - 1;
  user.save();
  
  // Update market stats
  market.reservedLiquidity = market.reservedLiquidity.minus(loan.principal);
  market.availableLiquidity = market.availableLiquidity.plus(loan.principal);
  market.totalInterestEarned = market.totalInterestEarned.plus(loan.interestAmount);
  
  // Recalculate utilization rate
  if (market.totalLiquidity.gt(BigInt.fromI32(0))) {
    let utilization = market.reservedLiquidity.toBigDecimal()
      .div(market.totalLiquidity.toBigDecimal());
    market.utilizationRate = utilization;
  } else {
    market.utilizationRate = BigDecimal.fromString("0");
  }
  
  market.updatedAt = event.block.timestamp;
  market.save();
}

// ============ Loan Liquidation ============

export function handleLoanLiquidated(event: LoanLiquidated): void {
  let loan = Loan.load(event.address.toHexString())!;
  let borrower = User.load(loan.borrower)!;
  let liquidatorId = event.params.liquidator.toHexString();
  let market = Market.load(loan.market)!;
  
  // Load or create liquidator user
  let liquidator = User.load(liquidatorId);
  if (liquidator == null) {
    liquidator = new User(liquidatorId);
    liquidator.totalBorrowed = BigInt.fromI32(0);
    liquidator.totalRepaid = BigInt.fromI32(0);
    liquidator.totalLiquidated = BigInt.fromI32(0);
    liquidator.activeLoanCount = 0;
    liquidator.totalDeposited = BigInt.fromI32(0);
    liquidator.totalWithdrawn = BigInt.fromI32(0);
    liquidator.totalInterestEarned = BigInt.fromI32(0);
  }
  
  liquidator.totalLiquidated = liquidator.totalLiquidated.plus(event.params.collateralSeized);
  liquidator.save();
  
  // Update loan status
  loan.status = "LIQUIDATED";
  loan.liquidatedAt = event.block.timestamp;
  loan.save();
  
  // Create liquidation event
  let liquidationId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidation = new Liquidation(liquidationId);
  liquidation.loan = loan.id;
  liquidation.liquidator = liquidatorId;
  liquidation.collateralSeized = event.params.collateralSeized;
  liquidation.debtRecovered = event.params.debtRecovered;
  liquidation.timestamp = event.params.timestamp;
  liquidation.txHash = event.transaction.hash;
  liquidation.save();
  
  // Update borrower stats
  borrower.activeLoanCount = borrower.activeLoanCount - 1;
  borrower.save();
  
  // Update market stats
  market.reservedLiquidity = market.reservedLiquidity.minus(loan.principal);
  market.availableLiquidity = market.availableLiquidity.plus(event.params.debtRecovered);
  
  // Recalculate utilization
  if (market.totalLiquidity.gt(BigInt.fromI32(0))) {
    market.utilizationRate = market.reservedLiquidity.toBigDecimal()
      .div(market.totalLiquidity.toBigDecimal());
  } else {
    market.utilizationRate = BigDecimal.fromString("0");
  }
  
  market.updatedAt = event.block.timestamp;
  market.save();
}
