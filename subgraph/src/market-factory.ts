import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  MarketCreated,
  StablecoinAdded,
  MarketDeactivated,
} from "../generated/MarketFactory/MarketFactory";
import { LendingMarket as LendingMarketTemplate } from "../generated/templates";
import { Market, MarketFactory as FactoryEntity, FactoryStats } from "../generated/schema";

// ============ Market Creation ============

export function handleMarketCreated(event: MarketCreated): void {
  // Load or create factory entity
  let factory = FactoryEntity.load(event.address.toHexString());
  if (factory == null) {
    factory = new FactoryEntity(event.address.toHexString());
    factory.owner = event.transaction.from;
    factory.treasury = Address.fromString("0x..."); // Get from contract
    factory.totalMarketsCreated = BigInt.fromI32(0);
    factory.totalFeesCollected = BigInt.fromI32(0);
    factory.createdAt = event.block.timestamp;
  }
  
  factory.totalMarketsCreated = factory.totalMarketsCreated.plus(BigInt.fromI32(1));
  factory.save();
  
  // Create market entity
  let market = new Market(event.params.market.toHexString());
  market.factory = factory.id;
  market.owner = event.params.owner;
  market.collateralAsset = event.params.collateralAsset;
  market.loanAsset = event.params.loanAsset;
  market.assetType = getAssetType(event.params.assetType);
  market.oracleType = "UNISWAP_V3_TWAP"; // Parse from event if available
  
  market.ltvBps = event.params.ltvBps;
  market.aprBps = BigInt.fromI32(0); // Load from contract
  market.durationSeconds = BigInt.fromI32(0);
  market.healthFactorThreshold = BigInt.fromI32(12000);
  
  market.totalLiquidity = event.params.initialLiquidity;
  market.reservedLiquidity = BigInt.fromI32(0);
  market.availableLiquidity = event.params.initialLiquidity;
  market.totalShares = BigInt.fromI32(0);
  
  market.utilizationRate = BigDecimal.fromString("0");
  market.totalVolume = BigInt.fromI32(0);
  market.totalInterestEarned = BigInt.fromI32(0);
  
  market.active = true;
  market.circuitBreakerTriggered = false;
  market.createdAt = event.block.timestamp;
  market.updatedAt = event.block.timestamp;
  
  market.save();
  
  // Start indexing this market
  LendingMarketTemplate.create(event.params.market);
  
  // Update global stats
  updateFactoryStats(event.block.timestamp);
}

export function handleStablecoinAdded(event: StablecoinAdded): void {
  // Track stablecoin additions (could be used for USD conversions)
}

export function handleMarketDeactivated(event: MarketDeactivated): void {
  let market = Market.load(event.params.market.toHexString());
  if (market != null) {
    market.active = false;
    market.updatedAt = event.block.timestamp;
    market.save();
  }
  
  updateFactoryStats(event.block.timestamp);
}

// ============ Helpers ============

function getAssetType(value: i32): string {
  if (value == 0) return "ERC20";
  if (value == 1) return "ERC721";
  if (value == 2) return "ERC1155";
  return "ERC20";
}

function updateFactoryStats(timestamp: BigInt): void {
  let stats = FactoryStats.load("FACTORY_STATS");
  if (stats == null) {
    stats = new FactoryStats("FACTORY_STATS");
    stats.totalMarketsCreated = BigInt.fromI32(0);
    stats.totalActiveMarkets = BigInt.fromI32(0);
    stats.totalLoansCreated = BigInt.fromI32(0);
    stats.totalLoansRepaid = BigInt.fromI32(0);
    stats.totalLoansLiquidated = BigInt.fromI32(0);
    stats.totalVolumeUSD = BigInt.fromI32(0);
    stats.totalLiquidityUSD = BigInt.fromI32(0);
    stats.totalFeesCollectedUSD = BigInt.fromI32(0);
  }
  
  // Calculate active markets
  // This would require iterating all markets (expensive)
  // Better to increment/decrement on create/deactivate
  
  stats.updatedAt = timestamp;
  stats.save();
}
