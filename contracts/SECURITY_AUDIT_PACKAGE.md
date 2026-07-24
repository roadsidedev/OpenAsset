# OpenAsset Market V2 — Security Audit Package

## 1. Architecture Overview

OpenAsset Market V2 is a permissionless, isolated lending protocol using a pluggable adapter architecture. The core engine delegates all asset-specific logic to five adapter interfaces:

```
MarketFactoryV2 → deploys → LendingMarketV2 (per market)
                                  ├── IAssetAdapter      (collateral custody)
                                  ├── IOracleAdapter     (price feeds)
                                  ├── IComplianceAdapter (eligibility, optional)
                                  ├── ILiquidationAdapter (default resolution)
                                  └── IPositionAdapter   (loan representation)
```

### Key Design Decision
The core engine encodes exactly four verbs: **escrow, price, check eligibility, liquidate**. It never contains asset-type-specific or issuer-specific logic. New asset classes are added by writing a new adapter, not by touching the engine.

---

## 2. Contract Inventory

### Core Engine (in scope for audit)
| Contract | File | Purpose |
|----------|------|---------|
| LendingMarketV2 | `src/LendingMarketV2.sol` | Core lending engine: loan lifecycle, circuit breaker, adapter delegation |
| MarketFactoryV2 | `src/MarketFactoryV2.sol` | Market deployment with Validation Matrix enforcement |
| AdapterRegistry | `src/AdapterRegistry.sol` | Permissionless adapter registration with verification metadata |

### Adapter Interfaces (frozen, in scope)
| Interface | File |
|-----------|------|
| IAssetAdapter | `src/interfaces/adapters/IAssetAdapter.sol` |
| IOracleAdapter | `src/interfaces/adapters/IOracleAdapter.sol` |
| IComplianceAdapter | `src/interfaces/adapters/IComplianceAdapter.sol` |
| ILiquidationAdapter | `src/interfaces/adapters/ILiquidationAdapter.sol` |
| IPositionAdapter | `src/interfaces/adapters/IPositionAdapter.sol` |

### Reference Adapters (in scope individually)
| Adapter | Type | File |
|---------|------|------|
| ERC20Adapter | ASSET | `src/adapters/asset/ERC20Adapter.sol` |
| ERC721Adapter | ASSET | `src/adapters/asset/ERC721Adapter.sol` |
| ChainlinkAdapter | ORACLE | `src/adapters/oracle/ChainlinkAdapter.sol` |
| UniswapV3TWAPAdapter | ORACLE | `src/adapters/oracle/UniswapV3TWAPAdapter.sol` |
| DEXSwapLiquidationAdapter | LIQUIDATION | `src/adapters/liquidation/DEXSwapLiquidationAdapter.sol` |
| NFTAuctionLiquidationAdapter | LIQUIDATION | `src/adapters/liquidation/NFTAuctionLiquidationAdapter.sol` |
| StandardPositionAdapter | POSITION | `src/adapters/position/StandardPositionAdapter.sol` |
| SoulboundPositionAdapter | POSITION | `src/adapters/position/SoulboundPositionAdapter.sol` |
| TransferablePositionAdapter | POSITION | `src/adapters/position/TransferablePositionAdapter.sol` |

### RWA Adapters (in scope individually, gated on legal)
| Adapter | Type | File |
|---------|------|------|
| ChainlinkEquityFeedAdapter | ORACLE | `src/adapters/rwa/ChainlinkEquityFeedAdapter.sol` |
| ERC3643ComplianceAdapter | COMPLIANCE | `src/adapters/rwa/ERC3643ComplianceAdapter.sol` |
| IssuerRedemptionLiquidationAdapter | LIQUIDATION | `src/adapters/rwa/IssuerRedemptionLiquidationAdapter.sol` |
| NAVOracleAdapter | ORACLE | `src/adapters/rwa/NAVOracleAdapter.sol` |

### Supporting (in scope)
| Contract | File | Purpose |
|----------|------|---------|
| LPTokenV2 | `src/LendingMarketV2.sol` | ERC20 LP shares (embedded in market) |
| CircuitBreaker | `src/libraries/CircuitBreaker.sol` | Volatility detection library |
| ChainlinkOracle | `src/oracles/ChainlinkOracle.sol` | Legacy Chainlink wrapper |

---

## 3. Critical Invariants to Verify

### 3.1 Core Engine Invariants

| # | Invariant | Where Enforced | Test |
|---|-----------|----------------|------|
| I1 | Collateral escrowed matches collateralAmount in loan struct | `LendingMarketV2.requestLoan()` — balance check after `assetAdapter.escrow()` | `LendingMarketV2.test.ts` |
| I2 | `recoveredForLP + returnedToHolder` reconciles against assets received from escrow on liquidation | `LendingMarketV2.liquidate()` — accounting verification | `SecurityIntegration.test.ts` |
| I3 | Health factor threshold enforcement (if enabled) | `LendingMarketV2.liquidate()` — `_getHealthFactor() < healthFactorThreshold` | `LendingMarketV2.test.ts` |
| I4 | Loan cannot be repaid/liquidated twice | `LendingMarketV2.repay()/liquidate()` — status checks | `LendingMarketV2.test.ts` |
| I5 | Position holder (not original borrower) receives collateral on repay | `LendingMarketV2.repay()` — `positionAdapter.ownerOf(loanId)` | `SecurityIntegration.test.ts` |
| I6 | Circuit breaker pauses on untrusted oracle | `_checkCircuitBreaker()` — `isTrusted == false` | `SecurityIntegration.test.ts` |
| I7 | Circuit breaker pauses on price volatility exceeding threshold | `_checkCircuitBreaker()` — price change > pauseThresholdBps | Unit test |
| I8 | Market cannot create loans when paused | `marketActive` modifier | `SecurityIntegration.test.ts` |
| I9 | Async liquidation: LIQUIDATION_CURE is reversible (holder can repay) | `LendingMarketV2.repay()` accepts status == LIQUIDATION_CURE | `SecurityIntegration.test.ts` |
| I10 | Async liquidation: LIQUIDATION_SETTLING is irreversible (cure window expired) | `LendingMarketV2.settleLiquidation()` checks cure deadline | `SecurityIntegration.test.ts` |
| I11 | `frozenInterestAt` is set on entering LIQUIDATION_CURE | `LendingMarketV2.liquidate()` — async path | `SecurityIntegration.test.ts` |
| I12 | Penalty charged on repay during LIQUIDATION_CURE | `LendingMarketV2.repay()` — penalty calc when status == LIQUIDATION_CURE | `SecurityIntegration.test.ts` |

### 3.2 Factory Validation Matrix Invariants

| # | Rule | Enforcement |
|---|------|-------------|
| V1 | Lending asset must be in allowlist | `MarketFactoryV2._validateAdapterCompatibility()` |
| V2 | If async liquidation, compliance adapter must not be address(0) | Same |
| V3 | All adapters must be registered and selectable in AdapterRegistry | Same |
| V4 | No duplicate market config | Config hash dedup |
| V5 | All addresses must be non-zero | `_validateMarketConfig()` |

### 3.3 Adapter Trust Model Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| A1 | Core engine calls adapters, never trusts return values blindly | Balance checks, reconciliation |
| A2 | `IComplianceAdapter.isEligible()` — revert treated as false (fail-closed) | `try/catch` in `requestLoan()` |
| A3 | `IOracleAdapter.getPrice()` — `isTrusted == false` triggers circuit breaker | `_checkCircuitBreaker()` |
| A4 | `ILiquidationAdapter.liquidate()` — both return values enforced | Accounting verification |
| A5 | `IPositionAdapter.ownerOf()` — returns current holder, not original borrower | Used in repay/liquidate |

### 3.4 Access Control

| Function | Access | Notes |
|----------|--------|-------|
| `MarketFactoryV2.createMarket()` | Payable, anyone | Market creation is permissionless |
| `MarketFactoryV2.addLendingAsset()` | `onlyOwner` | Stablecoin allowlist management |
| `AdapterRegistry.registerAdapter()` | Anyone | Permissionless registration |
| `AdapterRegistry.markVerified()` | `auditGovernance` | Multisig only |
| `AdapterRegistry.markDeprecated()` | `auditGovernance` | Multisig only |
| `LendingMarketV2.pause()` | `onlyMarketOwner` | Emergency pause |
| `LendingMarketV2.unpause()` | `onlyMarketOwner` | Resume from manual pause |

---

## 4. Known Attack Surface

### 4.1 Flash Loan / Price Manipulation
- Mitigated by TWAP (30-min default) for crypto assets
- Chainlink feeds for equity/RWA (aggregated multi-venue data)
- `isTrusted` signal from oracle adapters triggers circuit breaker

### 4.2 Reentrancy
- All state-changing functions use `nonReentrant`
- CEI ordering: validate → update state → call adapter
- Adapter calls are external calls to semi-trusted code

### 4.3 Oracle Manipulation
- Price bounds: rejects price == 0 or > $1T
- Staleness: maxStaleness configurable per oracle
- Circuit breaker: auto-pauses on volatility spikes

### 4.4 Collateral Under-Delivery
- Engine verifies balance deltas after `assetAdapter.escrow()`
- Malicious adapter delivering less → caught by balance verification

### 4.5 Async Liquidation Exploits
- Cure window is immutable per adapter (set at deployment)
- Settlement timeout (7 days) flagged for manual intervention
- Penalty charged even on cure-period repayment

### 4.6 Position Transfer Compliance Bypass
- TransferablePositionAdapter + ComplianceAdapter: transfer hook calls `isEligible()`
- Fail-closed: any revert blocks the transfer
- SoulboundPositionAdapter: all transfers revert unconditionally

---

## 5. Test Coverage Summary

| Category | Tests | Pass |
|----------|-------|------|
| AdapterRegistry | 16 | 16 |
| LendingMarketV2 | 8 | 8 |
| MarketFactoryV2 | 7 | 7 |
| Security & Integration | 15 | 15 |
| **Total** | **46** | **46** |

### Test Categories Covered
- Registration, verification, deprecation lifecycle
- Full loan lifecycle (deposit → borrow → repay → liquidate)
- Circuit breaker (volatility, stale oracle, resume)
- Async liquidation (cure, penalty, settle, timeout)
- Position transfer + holder tracking
- Adversarial scenarios (zero price, untrusted oracle, compliance revert, denial)
- Validation Matrix (LTV bounds, allowlist, deprecated adapter, duplicate config)

---

## 6. Deployment Verification Checklist

- [ ] AdapterRegistry deployed with correct `auditGovernance` multisig
- [ ] MarketFactoryV2 deployed with correct `owner` and `protocolTreasury`
- [ ] All reference adapters registered and verified in AdapterRegistry
- [ ] Lending assets (stablecoins) added to factory allowlist
- [ ] Etherscan/Basescan verification complete for all contracts
- [ ] Testnet deployment tested end-to-end (create market → deposit → borrow → repay → liquidate)
- [ ] Bug bounty program launched before mainnet

---

## 7. Files for Auditor

All Solidity source files are in `contracts/src/`. The key files to audit are:

```
Core:
  src/LendingMarketV2.sol          (core engine — highest priority)
  src/MarketFactoryV2.sol          (validation matrix)
  src/AdapterRegistry.sol          (access control)
  src/interfaces/adapters/*.sol    (5 interfaces — frozen)

Reference Adapters:
  src/adapters/asset/*.sol
  src/adapters/oracle/*.sol
  src/adapters/liquidation/*.sol
  src/adapters/position/*.sol

RWA Adapters (gated on legal):
  src/adapters/rwa/*.sol

Libraries:
  src/libraries/CircuitBreaker.sol
```
