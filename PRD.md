# Document 2: Product Requirements Document (PRD)

```markdown
# Red Chips Product Requirements Document (PRD)

Version 1.0 | January 2026

## Executive Summary

### Product Vision

Red Chips is permissionless asset lending infrastructure that enables anyone to launch a lending market for any on-chain asset with complete control over risk parameters and terms.

### Problem Statement

Current DeFi lending platforms (Aave, Compound, BendDAO) are gatekept and restrictive:

- Only support whitelisted blue-chip assets (~5% of all tokens)
- Platform controls all terms (LPs can't customize)

Governance-based asset approval (slow, political)
Gaming tokens, meme coins, niche NFTs excluded
Communities can't give their holders DeFi utility

Result: 95% of on-chain assets have zero lending utility.
```

Solution Overview
Red Chips provides the infrastructure for anyone to launch isolated lending markets in minutes:

Permissionless: No approval needed, deploy in one transaction
Any Asset: ERC20, ERC721, ERC1155, SPL tokens
LP Control: Set your own LTV, APR, duration, liquidation rules
Isolated Risk: Each market is independent, no contagion
Multi-Chain: Ethereum, Polygon, Base, Arbitrum, Optimism, Solana

Success Metrics (Year 1)

1,000+ markets launched
$50M+ Total Value Locked (TVL)
50,000+ loans originated
<5% default rate (over-collateralized markets)
<15% default rate (under-collateralized markets)
10+ chains supported

Target Users
Primary Persona 1: Liquidity Provider (Market Creator)
Profile: DeFi-savvy individual or DAO treasury manager looking to earn yield on capital.
Demographics:

Age: 25-45
Experience: 2+ years in DeFi
Capital: $50k-$5M to deploy
Tech savvy: Comfortable with smart contracts

Goals:

Earn sustainable yield (10-25% APR)
Control risk exposure (set own terms)
Support community (give token holders utility)
Diversify yield sources

Pain Points:

Aave/Compound yields too low (3-7%)
Can't lend against long-tail assets
No control over terms
Platform takes large fee cuts

Jobs to Be Done:

"I want to earn 15%+ APR on my stablecoins by lending to a gaming community I trust"
"I need to give our DAO token holders borrowing utility without waiting for Aave governance"
"I want to set conservative LTV ratios for volatile assets while earning high APR"

User Journey:

Discover Red Chips via Twitter/Discord
Browse existing markets for ideas
Decide on asset type (gaming token, NFT collection)
Configure market terms (5 min wizard)
Deposit initial liquidity (10-100 ETH)
Monitor market performance daily
Adjust terms or withdraw as needed

Primary Persona 2: Borrower (Asset Holder)
Profile: NFT/token holder needing liquidity without selling.
Demographics:

Age: 20-40
Experience: 1+ year in crypto
Net worth: $10k-$500k (mostly in crypto)
Tech savvy: Knows how to use MetaMask

Goals:

Get liquidity without selling assets
Avoid taxable events
Maintain exposure to upside
Access capital quickly (< 5 minutes)

Pain Points:

Traditional platforms don't accept my assets
Selling triggers taxes
Don't want to miss price appreciation
Need fast liquidity for opportunities

Jobs to Be Done:

"I need $5k urgently but don't want to sell my NFT"
"I want to borrow against my gaming tokens to buy more"
"I need working capital for my business without liquidating my portfolio"

User Journey:

Realize need for liquidity
Google "borrow against [my token]"
Find Red Chips market for their asset
Check terms (LTV, APR, duration)
Connect wallet, approve collateral
Request loan (receive funds in 1 min)
Monitor health factor daily
Repay before expiry or get liquidated

Secondary Persona: Asset Project / Community
Profile: Gaming DAO, NFT project, or meme coin community.
Demographics:

Team size: 5-50 people
Community: 1,000-100,000 holders
Treasury: $100k-$10M
Use case: Give holders utility

Goals:

Increase token utility (beyond trading)
Strengthen community engagement
Support price (reduce sell pressure)
Generate treasury yield

Pain Points:

Can't get listed on Aave/Compound
Holders keep asking "wen utility?"
Token lacks fundamental use case
No yield opportunities for community

Jobs to Be Done:

"Our 10,000 token holders want to borrow against their tokens"
"We need to give our NFT collection DeFi utility"
"We want to deploy treasury capital to earn yield AND support our community"

User Journey:

Community complains about lack of utility
Discover Red Chips via crypto Twitter
Decide to launch market using treasury
Configure generous terms for community (high LTV, low APR)
Announce to community (marketing boost)
Monitor usage and adjust terms
Treasury earns yield while supporting holders

Core Features & Requirements
Feature 1: Permissionless Market Creation
Priority: P0 (Must Have - MVP)
User Story:
As a liquidity provider, I want to deploy a lending market for any asset in under 5 minutes without seeking approval, so that I can start earning yield immediately.
Acceptance Criteria:

User can deploy market with single transaction
No whitelist or approval process
Market goes live immediately after deployment
Creation fee calculated and collected correctly (1% of deposit, 0.05-0.5 ETH cap)
Market appears in global marketplace within 1 minute
LP receives confirmation and market dashboard access

Functional Requirements:
FR-1.1: Market Configuration Wizard

Step 1: Asset Selection

Blockchain dropdown (Ethereum, Polygon, Base, etc.)
Asset type radio (ERC20, ERC721, ERC1155)
Contract address input with validation
Automatic asset verification (name, symbol, total supply)
Oracle selection (Uniswap V3 TWAP, Chainlink, Manual)

Step 2: Loan Terms

LTV slider (50-200%, default 70%)
APR input (1-100%, default 12%)
Duration dropdown (7, 14, 30, 60, 90, 180, 365 days)
Visual calculator showing example loan

Step 3: Risk Controls

Grace period (24-168 hours, default 72h)
Health factor toggle (enable/disable)
If enabled: threshold slider (110-200%, default 120%)
Circuit breaker toggle
If enabled: volatility threshold (5-100%, default 20%)

Step 4: Initial Liquidity

Amount input (minimum 0.1 ETH equivalent)
Creation fee display (auto-calculated)
Total transaction cost preview
Wallet balance check

FR-1.2: Parameter Validation

LTV: Must be 10-200%
APR: Must be 1-100%
Duration: Must be 1-365 days
Grace period: Must be 24-168 hours
Health threshold: Must be 110-200% if enabled
Initial liquidity: Must be > 0.1 ETH equivalent
Oracle: Must be valid contract address
Circuit breaker threshold: Must be 5-100% if enabled

FR-1.3: On-Chain Deployment

MarketFactory.createMarket() called with params
New LendingMarket contract deployed
Initial liquidity transferred from LP
Creation fee transferred to protocol treasury
Market registered in global registry
Event emitted: MarketCreated

FR-1.4: Post-Deployment

Market dashboard URL generated
LP receives email confirmation (if provided)
Market indexed by backend within 60 seconds
Appears in marketplace with status "ACTIVE"

Non-Functional Requirements:

Performance: Market deployment completes in <30 seconds (depends on gas)
Usability: Non-technical LP can complete wizard without help
Security: All parameters validated before deployment
Reliability: Failed deployments revert cleanly, no partial state

UI Mockup:
┌─────────────────────────────────────────────────────────────┐
│ Launch New Lending Market [X] │
├─────────────────────────────────────────────────────────────┤
│ │
│ Step 2 of 4: Loan Terms │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ │
│ Loan-to-Value Ratio (LTV) │
│ How much can borrowers borrow relative to collateral? │
│ │
│ [────────●────────] 75% │
│ 50% Under-collateralized Over-collateralized 200% │
│ │
│ ℹ️ 75% LTV = Borrower deposits $1000, borrows $750 │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Annual Interest Rate (APR) │
│ What interest rate will borrowers pay? │
│ │
│ [────●────────────] 12% │
│ 1% 100% │
│ │
│ ℹ️ 12% APR = $100 loan costs $1 interest per month │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Loan Duration │
│ How long can loans stay active? │
│ │
│ [7 days ▼] [14 days] [30 days] [60 days] [90 days] │
│ │
│ Selected: 30 days │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Example Loan Preview: │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Borrower deposits: 10,000 tokens ($1,000 value) │ │
│ │ Borrows: $750 USDC (75% LTV) │ │
│ │ Interest (30 days): $7.50 (12% APR) │ │
│ │ Total repayment: $757.50 │ │
│ │ Your profit: $7.50 (1% monthly return) │ │
│ └────────────────────────────────────────────────────┘ │
│ │
│ [← Back] [Continue →] │
│ │
└─────────────────────────────────────────────────────────────┘
Technical Specifications:

Frontend: React form with Formik validation
Smart Contract: MarketFactory.sol
Gas Estimate: ~500,000-800,000 gas (varies by chain)
Transaction: User pays gas + creation fee
Error Handling: Display user-friendly errors for all revert reasons

Edge Cases:

LP enters invalid contract address → Show "Invalid contract" error
LP tries to create duplicate market → Allow (markets are independent)
LP cancels transaction → Show "Transaction cancelled" message
Deployment fails due to gas → Suggest increasing gas limit
Oracle address invalid → Prevent deployment, show error

Feature 2: Borrower Loan Request
Priority: P0 (Must Have - MVP)
User Story:
As a borrower, I want to request a loan by depositing my asset as collateral, so that I can receive liquidity within minutes without selling.
Acceptance Criteria:

Borrower can browse available markets for their assets
System calculates max loan based on collateral value and LTV
Borrower approves collateral token in one transaction
Borrower requests loan in second transaction
Collateral is escrowed correctly
Loan funds transferred to borrower immediately
Loan appears in borrower's dashboard with all details
Health monitoring begins immediately (if enabled)

Functional Requirements:
FR-2.1: Market Discovery

Homepage shows all active markets
Filter by:

Asset type (ERC20, ERC721, ERC1155)
Chain (Ethereum, Polygon, etc.)
Collateral asset (search by name or address)
LTV (high to low)
APR (low to high)

"Show only markets for assets I own" toggle

Automatically detect user's token balances
Highlight compatible markets

Sort by: Best terms, Lowest APR, Highest LTV, Most liquidity

FR-2.2: Loan Calculator

Input: Amount of collateral to deposit
Auto-calculate:

Collateral value (based on current TWAP price)
Max loan amount (collateral value × LTV)
Interest for selected duration
Total repayment amount
Liquidation price (if health factor enabled)

Real-time updates as user changes collateral amount

FR-2.3: Loan Request Flow
Step 1: Select Market
├─ User clicks "Borrow" on market card
└─ Redirected to loan request page

Step 2: Configure Loan
├─ Enter collateral amount
├─ System calculates max loan
├─ User can reduce loan amount (but not exceed max)
├─ Review terms summary
└─ Click "Request Loan"

Step 3: Approve Collateral
├─ MetaMask prompts: "Approve [Token] for Red Chips?"
├─ User confirms approval transaction
├─ Wait for confirmation (~10 seconds)
└─ Proceed to Step 4

Step 4: Request Loan
├─ MetaMask prompts: "Confirm Loan Request"
├─ User confirms transaction
├─ Smart contract:
│ ├─ Checks circuit breaker status
│ ├─ Verifies collateral approval
│ ├─ Transfers collateral to escrow
│ ├─ Transfers loan funds to borrower
│ └─ Creates loan record
├─ Wait for confirmation (~10 seconds)
└─ Redirect to loan dashboard

Step 5: Confirmation
├─ Success message: "Loan funded! You received X USDC"
├─ Show loan details
├─ Link to loan dashboard
└─ Option to share (Twitter, Discord)
FR-2.4: Loan Record Creation

On-chain loan struct populated:

borrower: msg.sender
collateralAmount: user input
tokenId: (if NFT)
principal: calculated max loan
startTime: block.timestamp
expiryTime: startTime + duration
status: ACTIVE

Off-chain database record:

All above fields
health_factor: calculated initially
alert_preferences: defaults (email enabled)

FR-2.5: Post-Loan Actions

Email sent to borrower (if address provided)
Push notification: "Loan active, repay by [date]"
Health monitoring job added to queue
Loan appears in "My Loans" dashboard

Non-Functional Requirements:

Performance: Loan request completes in <60 seconds (including confirmations)
Usability: Clear progress indicator for each step
Security: Collateral verified before loan issued
Reliability: Transaction failures revert cleanly, no orphaned state

UI Mockup:
┌─────────────────────────────────────────────────────────────┐
│ Request Loan - GAME Token Market [X] │
├─────────────────────────────────────────────────────────────┤
│ │
│ Your Collateral │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ │
│ Asset: GAME Token │
│ Your Balance: 15,000 GAME │
│ Current Price: $0.25 per token (TWAP) │
│ │
│ Amount to Deposit: │
│ [10000] GAME [Max] │
│ │
│ Collateral Value: $2,500 │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Loan Details │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ │
│ Max Loan Amount: $1,875 (75% LTV) │
│ Annual Interest Rate: 12% │
│ Loan Duration: 30 days │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Repayment Breakdown │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ │
│ Principal: $1,875.00 │
│ Interest (30 days @ 12%): $18.75 │
│ ───────────────────────────────────────────────── │
│ Total Due on Feb 24, 2026: $1,893.75 │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ Risk Information │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ │
│ ⚠️ Liquidation Warning: │
│ Your collateral will be liquidated if GAME price drops │
│ below $0.189 per token (24% drop from current price). │
│ │
│ Current buffer: 32% above liquidation price │
│ │
│ [ ] I understand the liquidation risk │
│ │
│ ───────────────────────────────────────────────────── │
│ │
│ [Cancel] [Request Loan →] │
│ │
└─────────────────────────────────────────────────────────────┘
Technical Specifications:

Frontend: React with ethers.js
Smart Contract: LendingMarket.requestLoan()
Gas Estimate: ~150,000-250,000 gas (approval), ~200,000-350,000 gas (loan request)
Approval: ERC20.approve() or setApprovalForAll() for NFTs
Oracle Call: getTWAPPrice() fetches collateral value

Edge Cases:

Insufficient collateral balance → Disable "Request Loan" button
Approval transaction fails → Show retry option
Circuit breaker active → Show "Market paused due to volatility" error
Insufficient market liquidity → Show "Market has insufficient liquidity"
Price changes during approval → Recalculate before loan request
User cancels transaction → Return to market page

Feature 3: TWAP Oracle Integration
Priority: P0 (Must Have - MVP)
User Story:
As the system, I want to use time-weighted average prices for all collateral valuations, so that flash loan attacks and temporary price manipulation are impossible.
Acceptance Criteria:

Uniswap V3 TWAP integrated for all supported pools
TWAP period configurable per market (10-30 minutes)
Chainlink fallback implemented for assets without Uniswap pools
Price deviation alerts trigger when spot differs >50% from TWAP
All liquidation decisions use TWAP (never spot price)
Frontend displays TWAP price with timestamp

Functional Requirements:
FR-3.1: Uniswap V3 TWAP Implementation
solidityfunction getTWAPPrice() public view returns (uint256 price) {
require(oracleType == OracleType.UNISWAP_V3_TWAP, "Wrong oracle type");

    // Consult Uniswap V3 pool for TWAP
    (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
        primaryOracle, // Uniswap V3 pool address
        twapPeriodSeconds // Configured by LP (600-1800 seconds)
    );

    // Convert tick to price
    price = OracleLibrary.getQuoteAtTick(
        arithmeticMeanTick,
        uint128(1e18), // 1 token
        collateralAsset,
        quoteToken // WETH or USDC
    );

    require(price > 0, "Invalid TWAP price");

}
FR-3.2: Oracle Selection Logic

During market creation, LP selects oracle type:

Uniswap V3 TWAP: For tokens with active pools
Chainlink: For tokens with Chainlink feeds
Manual: For illiquid assets (LP updates price manually)

System validates oracle address exists and is active
For Uniswap V3:

Verify pool has sufficient liquidity (>$50k)
Verify pool has observation cardinality ≥2
Warn LP if pool is low liquidity

FR-3.3: TWAP Period Configuration

LP chooses during market creation
Range: 10-30 minutes (600-1800 seconds)
Recommendations shown:

Stablecoins: 10 minutes
Blue-chip tokens: 20 minutes
Volatile/meme tokens: 30 minutes

Default: 30 minutes (most conservative)

FR-3.4: Price Deviation Monitoring
javascript// Backend service runs every minute
async function monitorPriceDeviation(marketAddress) {
const market = new ethers.Contract(marketAddress, ABI, provider);

const twapPrice = await market.getTWAPPrice();
const spotPrice = await getSpotPrice(market.collateralAsset);

const deviation = Math.abs((spotPrice - twapPrice) / twapPrice) \* 100;

if (deviation > 50) {
// Alert LP and protocol team
await sendAlert({
type: 'PRICE_DEVIATION',
market: marketAddress,
twapPrice,
spotPrice,
deviation: `${deviation.toFixed(2)}%`,
action: 'Manual review required'
});

    // Log to database
    await db.query(
      'INSERT INTO price_alerts (market, deviation, twap, spot) VALUES ($1, $2, $3, $4)',
      [marketAddress, deviation, twapPrice, spotPrice]
    );

}
}
FR-3.5: Chainlink Fallback
solidityfunction getChainlinkPrice() public view returns (uint256 price) {
require(oracleType == OracleType.CHAINLINK, "Wrong oracle type");

    AggregatorV3Interface priceFeed = AggregatorV3Interface(primaryOracle);

    (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();

    require(answer > 0, "Invalid Chainlink price");
    require(block.timestamp - updatedAt < 3600, "Price stale (>1hr)");

    // Chainlink prices have different decimals (usually 8)
    uint8 decimals = priceFeed.decimals();
    price = uint256(answer) * (10 ** (18 - decimals));

}

```

**FR-3.6**: Manual Oracle (Last Resort)
- LP can update price manually via updatePrice() function
- Requires LP signature
- Price valid for 24 hours
- Frontend shows warning: "Manual pricing - use at your own risk"
- Not recommended for production markets

**Non-Functional Requirements**:
- **Security**: TWAP resistant to flash loan manipulation (30min attack would cost millions)
- **Reliability**: Oracle data must be available 99.9% of time
- **Performance**: Price queries complete in <1 second
- **Accuracy**: TWAP represents fair market value (no outlier resistance needed)

**UI Display**:
```

┌────────────────────────────────────────┐
│ GAME Token Price │
├────────────────────────────────────────┤
│ │
│ Current TWAP (30-min avg): │
│ $0.2547 │
│ │
│ Last updated: 23 seconds ago │
│ │
│ Spot price: $0.2563 (+0.6%) │
│ ↳ Normal deviation │
│ │
│ Oracle: Uniswap V3 (ETH/GAME pool) │
│ Liquidity: $2.4M │
│ │
└────────────────────────────────────────┘
Technical Specifications:

Library: @uniswap/v3-periphery OracleLibrary
Fallback: @chainlink/contracts AggregatorV3Interface
Update Frequency: On-demand (called during loan operations)
Cache: None (always fresh from blockchain)
Gas Cost: ~30,000 gas per TWAP query

Edge Cases:

Uniswap pool doesn't exist → Force Chainlink or manual
Observation cardinality too low → Show warning, suggest increasing
Price returns 0 → Revert transaction with error
Chainlink price stale (>1hr) → Revert with error
Manual price expired (>24hr) → Prevent new loans until updated

Feature 4: Circuit Breaker System
Priority: P0 (Must Have - MVP)
User Story:
As a liquidity provider, I want the market to automatically pause new loans during extreme volatility, so that I'm protected from issuing loans during crash scenarios.
Acceptance Criteria:

System monitors price volatility every minute
Market pauses when threshold exceeded (e.g., 20% move in 6 hours)
Existing loans remain active during pause
Repayments and liquidations still allowed
Market auto-resumes when volatility normalizes
LP receives alert when circuit breaker triggers
Frontend clearly shows paused status

Functional Requirements:
FR-4.1: Volatility Calculation
javascript// Backend service (runs every 60 seconds)
class VolatilityMonitor {
async checkVolatility(marketAddress) {
const market = await getMarket(marketAddress);

    if (!market.circuitBreakerEnabled) return;

    // Get current and historical prices
    const currentPrice = await market.getTWAPPrice();
    const historicalPrice = await this.getHistoricalPrice(
      market.collateralAsset,
      market.lookbackPeriodSeconds
    );

    // Calculate % change
    const change = Math.abs((currentPrice - historicalPrice) / historicalPrice) * 100;

    // Check thresholds
    if (market.status === 'ACTIVE' && change >= market.pauseThresholdBps / 100) {
      await this.triggerCircuitBreaker(marketAddress, change);
    }

    if (market.status === 'PAUSED_VOLATILITY') {
      await this.checkResume(marketAddress, change);
    }

}

async getHistoricalPrice(asset, secondsAgo) {
// Query price_history table
const result = await db.query(
`SELECT price FROM price_history 
       WHERE asset_address = $1 
       AND timestamp <= NOW() - INTERVAL '${secondsAgo} seconds'
       ORDER BY timestamp DESC LIMIT 1`,
[asset]
);

    return result.rows[0]?.price || 0;

}

async triggerCircuitBreaker(marketAddress, volatility) {
// Call smart contract to pause
const market = new ethers.Contract(marketAddress, ABI, signer);
await market.pauseMarket();

    // Update database
    await db.query(
      'UPDATE markets SET status = $1, paused_at = NOW() WHERE contract_address = $2',
      ['PAUSED_VOLATILITY', marketAddress]
    );

    // Send alerts
    await this.alertLP(marketAddress, volatility);
    await this.alertBorrowers(marketAddress);

}
}
FR-4.2: On-Chain Circuit Breaker
solidityfunction \_checkCircuitBreaker() internal {
if (!circuitBreakerEnabled) return;

    uint256 currentPrice = getTWAPPrice();
    uint256 historicalPrice = _getHistoricalPrice(lookbackPeriodSeconds);

    uint256 priceChange = currentPrice > historicalPrice
        ? ((currentPrice - historicalPrice) * 10000) / historicalPrice
        : ((historicalPrice - currentPrice) * 10000) / historicalPrice;

    // Trigger pause
    if (priceChange >= pauseThresholdBps && status == MarketStatus.ACTIVE) {
        status = MarketStatus.PAUSED_VOLATILITY;
        pausedAt = block.timestamp;
        emit CircuitBreakerTriggered(priceChange, block.timestamp);
    }

    // Check resume conditions
    if (status == MarketStatus.PAUSED_VOLATILITY) {
        bool cooldownPassed = block.timestamp >= pausedAt + cooldownSeconds;
        bool volatilityLow = priceChange < resumeThresholdBps;

        if (cooldownPassed && volatilityLow) {
            status = MarketStatus.ACTIVE;
            emit MarketResumed(block.timestamp);
        }
    }

}

modifier marketActive() {
_checkCircuitBreaker();
require(status == MarketStatus.ACTIVE, "Market paused due to volatility");
_;
}

function requestLoan(...) external marketActive {
// Loan logic
}

```

**FR-4.3**: Configuration Parameters
```

LP configures during market creation:

Enable Circuit Breaker: [✓] Yes [ ] No

Pause Threshold:
[────●────────] 20%
5% 100%

"Pause new loans if price moves more than 20% in:"

Lookback Period:
[●] 1 hour [ ] 6 hours [ ] 24 hours

Resume Threshold:
[──●──────────] 10%
2% 50%

"Resume when volatility drops below 10% and stays there for:"

Cooldown Period:
[ ] 2 hours [●] 4 hours [ ] 12 hours
FR-4.4: User Experience During Pause
For New Borrowers:
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Market Temporarily Paused │
├─────────────────────────────────────────────────────────────┤
│ │
│ This market is currently paused due to highContinue3:34 PM2 / 2volatility │
│ in the GAME token price. │
│ │
│ Volatility: 24% in last 6 hours │
│ Threshold: 20% │
│ │
│ The market will automatically resume when: │
│ • Volatility drops below 10% │
│ • Cooldown period of 4 hours passes │
│ │
│ Estimated resume: ~6 hours │
│ │
│ What you can do: │
│ • [View Other Markets] - Find alternative lending options │
│ • [Get Notified] - Receive alert when market resumes │
│ │
└─────────────────────────────────────────────────────────────┘

**For Existing Borrowers**:

- Can still repay loans
- Can still monitor health
- Receive notification: "Market paused, but your loan is still active. You can repay anytime."
- Liquidations still happen if health factor breached

**FR-4.5**: LP Controls During Pause

- LP can manually resume market (override circuit breaker)
- LP can adjust circuit breaker settings (applies to future triggers)
- LP can permanently disable circuit breaker
- LP CANNOT withdraw liquidity if there are active loans

**Non-Functional Requirements**:

- **Monitoring**: Volatility checked every 60 seconds
- **Latency**: Circuit breaker triggers within 2 minutes of threshold breach
- **Reliability**: System continues monitoring even if some RPC nodes fail
- **Transparency**: All pause/resume events logged on-chain and in database

**Technical Specifications**:

- **Backend Service**: Node.js cron job (runs every minute)
- **Database**: price_history table stores prices every minute
- **Smart Contract**: Built into LendingMarket.sol
- **Gas Cost**: Circuit breaker check adds ~5,000 gas to each loan request
- **Keeper Bot**: Automated bot calls checkCircuitBreaker() if needed

**Edge Cases**:

- Price data unavailable → Skip check, don't pause (fail open)
- Historical price missing → Use oldest available price
- Multiple rapid price swings → Only first pause counts, cooldown must pass
- LP manually pauses → Overrides circuit breaker, requires manual resume
- Blockchain reorg → Rare, handled by confirmation depth (12 blocks)

---

### Feature 5: Gradual Liquidation (ERC20)

**Priority**: P1 (Should Have - V1.0)

**User Story**:
As a borrower, I want the system to only liquidate the minimum amount of my collateral needed to cover my debt, so that I don't lose excess value when I default.

**Acceptance Criteria**:

- [ ] For ERC20 collateral, system calculates exact tokens needed to cover debt
- [ ] LP receives tokens covering debt + small penalty (5%)
- [ ] Surplus tokens returned to borrower
- [ ] For NFTs, LP pays surplus in ETH (NFTs indivisible)
- [ ] All calculations use TWAP price (no manipulation)
- [ ] Gas-efficient implementation (minimal transfers)

**Functional Requirements**:

**FR-5.1**: Liquidation Amount Calculation

```solidity
function calculateLiquidationAmounts(uint256 loanId) public view returns (
    uint256 tokensForLP,
    uint256 tokensForBorrower,
    uint256 ethSurplus // For NFTs
) {
    Loan memory loan = loans[loanId];
    uint256 totalDebt = calculateTotalDebt(loanId);
    uint256 liquidationPenalty = (totalDebt * 500) / 10000; // 5% penalty
    uint256 totalOwed = totalDebt + liquidationPenalty;

    if (assetType == AssetType.ERC20) {
        uint256 tokenPrice = getTWAPPrice();
        uint256 collateralValue = (loan.collateralAmount * tokenPrice) / 1e18;

        if (collateralValue <= totalOwed) {
            // Underwater: LP gets all tokens
            tokensForLP = loan.collateralAmount;
            tokensForBorrower = 0;
        } else {
            // Calculate exact tokens needed
            tokensForLP = (totalOwed * 1e18) / tokenPrice;
            tokensForBorrower = loan.collateralAmount - tokensForLP;
        }
    } else if (assetType == AssetType.ERC721) {
        // NFT: LP gets NFT, must pay surplus
        uint256 nftValue = getNFTFloorPrice(loan.tokenId);

        if (nftValue > totalOwed) {
            ethSurplus = nftValue - totalOwed;
        }
    }
}
```

**FR-5.2**: ERC20 Gradual Liquidation

```solidity
function _liquidateERC20(uint256 loanId) internal returns (uint256 recovered) {
    (uint256 tokensForLP, uint256 tokensForBorrower, ) = calculateLiquidationAmounts(loanId);

    // Transfer LP's share
    IERC20(collateralAsset).transfer(lp, tokensForLP);

    // Return borrower's surplus (if any)
    if (tokensForBorrower > 0) {
        IERC20(collateralAsset).transfer(loan.borrower, tokensForBorrower);
    }

    uint256 tokenPrice = getTWAPPrice();
    recovered = (tokensForLP * tokenPrice) / 1e18;

    emit GradualLiquidation(loanId, tokensForLP, tokensForBorrower, recovered);
}
```

**FR-5.3**: NFT Liquidation with Surplus Payment

```solidity
function _liquidateERC721(uint256 loanId) internal returns (uint256 recovered) {
    ( , , uint256 ethSurplus) = calculateLiquidationAmounts(loanId);
    Loan memory loan = loans[loanId];

    // Transfer NFT to LP
    IERC721(collateralAsset).safeTransferFrom(address(this), lp, loan.tokenId);

    // LP pays surplus to borrower from their liquidity
    if (ethSurplus > 0) {
        require(availableLiquidity >= ethSurplus, "LP insufficient funds for surplus");

        availableLiquidity -= ethSurplus;

        (bool success, ) = loan.borrower.call{value: ethSurplus}("");
        require(success, "Surplus payment failed");
    }

    uint256 nftValue = getNFTFloorPrice(loan.tokenId);
    recovered = nftValue > totalDebt ? totalDebt : nftValue;

    emit NFTLiquidation(loanId, nftValue, ethSurplus);
}
```

**FR-5.4**: Liquidation Penalty

- Default: 5% of debt
- Incentivizes third-party liquidators
- Compensates gas costs
- LP configurable (0-10% range)

**FR-5.5**: Price Slippage Protection

```solidity
// Use TWAP snapshot at liquidation trigger time
uint256 public liquidationTWAPSnapshot;

function _canLiquidate(uint256 loanId) internal returns (bool) {
    // ... existing checks ...

    if (canLiquidate) {
        // Snapshot TWAP price at this moment
        liquidationTWAPSnapshot = getTWAPPrice();
    }

    return canLiquidate;
}

function liquidate(uint256 loanId) external {
    // Use snapshot price (prevents manipulation during liquidation tx)
    uint256 tokenPrice = liquidationTWAPSnapshot;
    // ... rest of logic
}
```

**Non-Functional Requirements**:

- **Fairness**: Borrowers keep surplus value
- **Gas Efficiency**: Two transfers vs one (acceptable cost for fairness)
- **Security**: No manipulation possible (uses TWAP)
- **Reliability**: Works correctly even if price changes during transaction

**UI Display**:
Liquidation Preview:
Your Loan:
├─ Debt: $1,050 (including 5% penalty)
├─ Collateral: 10,000 GAME tokens
├─ Collateral Value: $2,500 (@ $0.25/token)
Liquidation Breakdown:
├─ LP receives: 4,200 GAME tokens ($1,050 worth)
├─ You receive back: 5,800 GAME tokens ($1,450 worth)
└─ You keep: 55% of your collateral despite default
This is FAIR. You still lost the debt amount, but didn't lose excess value.

**Technical Specifications**:

- **Smart Contract**: Built into LendingMarket.sol
- **Gas Cost**: ~20,000 additional gas for surplus transfer
- **Oracle**: Uses TWAP (snapshot at trigger time)
- **Precision**: 18 decimals for all calculations

**Edge Cases**:

- Collateral exactly equals debt → No surplus, borrower gets 0
- Price changes between liquidation check and execution → Use snapshot
- NFT surplus > LP liquidity → Liquidation fails, LP must add liquidity
- Rounding errors → Always favor LP (round down for borrower)
- Zero surplus (<$0.01) → Skip transfer (save gas)

---

### Feature 6: Health Monitoring Dashboard

**Priority**: P1 (Should Have - V1.0)

**User Story**:
As a borrower, I want to see my loan health in real-time with predictive alerts, so that I can take action before liquidation and avoid losing my collateral.

**Acceptance Criteria**:

- [ ] Dashboard shows current health factor (if enabled)
- [ ] Real-time price updates every 60 seconds
- [ ] Liquidation probability forecast (24h, 7d, 30d)
- [ ] Email/SMS/push alerts at configurable thresholds
- [ ] Clear action buttons (Repay, Add Collateral, Extend)
- [ ] Historical health chart

**Functional Requirements**:

**FR-6.1**: Dashboard Layout
┌─────────────────────────────────────────────────────────────┐
│ Loan #4821 - GAME Token Collateral [●] │
├─────────────────────────────────────────────────────────────┤
│ │
│ Health Score: 145% ✓ Healthy │
│ ██████████████████░░░░░ 145/120 (liquidation threshold) │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Current Status │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Collateral: 10,000 GAME tokens │ │
│ │ Value: $2,500 (@ $0.25/token) │ │
│ │ Debt: $1,723 (principal + interest) │ │
│ │ Buffer: $777 (45% above liquidation) │ │
│ └────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Liquidation Risk Forecast │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ │ │
│ │ Based on 30-day volatility (35%) │ │
│ │ │ │
│ │ Next 24 hours: 2.3% 🟢 Very Low Risk │ │
│ │ Next 7 days: 8.7% 🟡 Low Risk │ │
│ │ Next 30 days: 23.1% 🟠 Moderate Risk │ │
│ │ │ │
│ │ Liquidation triggers at $0.172/token │ │
│ │ Current price: $0.250 (45% buffer) │ │
│ │ │ │
│ │ [View Methodology] │ │
│ └────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Price History (7 days) │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ $0.26 ┤ │ │
│ │ │ ╱╲ │ │
│ │ $0.25 ┤────╱ ╲──╱─╲──── ← Current │ │
│ │ │ ╲ ╲ │ │
│ │ $0.24 ┤ ╲ ╲ │ │
│ │ │ ╲ ╲ │ │
│ │ Liquidation → │................................ │ │
│ │ $0.17 ┤ │ │
│ │ └──────────────────────────────── │ │
│ │ Jan 17 Jan 20 Jan 24 │ │
│ └────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Loan Details │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Start Date: Dec 25, 2025 │ │
│ │ Due Date: Jan 24, 2026 (Today!) │ │
│ │ Duration: 30 days │ │
│ │ APR: 12% │ │
│ │ Grace Period: 72 hours after expiry │ │
│ └────────────────────────────────────────────────────────┘ │
│ │
│ [Repay Loan] [Add Collateral] [Request Extension] │
│ │
└─────────────────────────────────────────────────────────────┘

**FR-6.2**: Real-Time Health Calculation

```javascript
// Frontend hook (updates every 60 seconds)
import { useEffect, useState } from "react";

export const useLoanHealth = (loanId) => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const updateHealth = async () => {
      // Fetch current price
      const price = await market.getTWAPPrice();
      const loan = await market.loans(loanId);
      const debt = await market.calculateTotalDebt(loanId);

      // Calculate health
      const collateralValue = (loan.collateralAmount * price) / 1e18;
      const healthFactor = (collateralValue * 10000) / debt;

      // Calculate liquidation price
      const liquidationPrice =
        (debt * market.healthFactorThreshold()) /
        (loan.collateralAmount * 10000);

      // Calculate buffer
      const buffer = ((price - liquidationPrice) / liquidationPrice) * 100;

      setHealth({
        factor: healthFactor / 100, // Convert to percentage
        collateralValue,
        debt,
        liquidationPrice,
        buffer,
        currentPrice: price,
        lastUpdated: Date.now(),
      });
    };

    updateHealth();
    const interval = setInterval(updateHealth, 60000); // Every 60s

    return () => clearInterval(interval);
  }, [loanId]);

  return health;
};
```

**FR-6.3**: Liquidation Probability Model

```javascript
// Backend calculation (Python)
import numpy as np
from scipy.stats import norm

def calculate_liquidation_probability(
    current_health,
    liquidation_threshold,
    time_horizon_days,
    historical_volatility_30d
):
    """
    Uses Geometric Brownian Motion to estimate probability
    of hitting liquidation threshold within time horizon.
    """

    # Buffer to liquidation
    buffer = (current_health - liquidation_threshold) / liquidation_threshold

    # Annualize volatility
    annual_vol = historical_volatility_30d * np.sqrt(365 / 30)

    # Time fraction
    T = time_horizon_days / 365

    # Distance in standard deviations
    # Negative because we're looking at downside risk
    d = buffer / (annual_vol * np.sqrt(T))

    # Probability of breaching threshold (one-tailed)
    prob = norm.cdf(-d)

    return min(prob, 0.99)  # Cap at 99%

# API endpoint
@app.get('/api/loans/{loan_id}/risk-forecast')
async def get_risk_forecast(loan_id: int):
    loan = await get_loan(loan_id)

    # Get historical volatility
    volatility = await calculate_historical_volatility(
        loan.collateral_asset,
        days=30
    )

    # Calculate probabilities
    prob_24h = calculate_liquidation_probability(
        loan.health_factor,
        loan.liquidation_threshold,
        1,
        volatility
    )

    prob_7d = calculate_liquidation_probability(
        loan.health_factor,
        loan.liquidation_threshold,
        7,
        volatility
    )

    prob_30d = calculate_liquidation_probability(
        loan.health_factor,
        loan.liquidation_threshold,
        30,
        volatility
    )

    return {
        'prob_24h': round(prob_24h * 100, 1),
        'prob_7d': round(prob_7d * 100, 1),
        'prob_30d': round(prob_30d * 100, 1),
        'volatility': round(volatility * 100, 1),
        'methodology': 'Geometric Brownian Motion with historical volatility'
    }
```

**FR-6.4**: Alert System

```javascript
// Backend alert service
class AlertService {
  async checkAndSendAlerts() {
    const loans = await db.query(
      "SELECT * FROM loans WHERE status = $1 AND health_factor IS NOT NULL",
      ["ACTIVE"],
    );

    for (const loan of loans.rows) {
      const alerts = this.determineAlertLevel(loan.health_factor);

      for (const alert of alerts) {
        const lastAlert = await this.getLastAlert(loan.id, alert.level);

        // Don't spam: Only alert if level changed or >6 hours since last
        if (this.shouldSendAlert(lastAlert, alert.level)) {
          await this.sendAlert(loan, alert);
        }
      }
    }
  }

  determineAlertLevel(healthFactor) {
    const alerts = [];

    if (healthFactor < 125) {
      alerts.push({ level: "CRITICAL", urgency: "high" });
    } else if (healthFactor < 130) {
      alerts.push({ level: "WARNING", urgency: "medium" });
    } else if (healthFactor < 140) {
      alerts.push({ level: "WATCH", urgency: "low" });
    }

    return alerts;
  }

  async sendAlert(loan, alert) {
    const borrower = await getBorrowerPreferences(loan.borrower_address);

    const message = {
      CRITICAL: `🚨 URGENT: Your Red Chips loan (Health: ${loan.health_factor}%) is near liquidation! Repay or add collateral now.`,
      WARNING: `⚠️ WARNING: Your loan health is ${loan.health_factor}%. Consider repaying soon to avoid liquidation.`,
      WATCH: `ℹ️ FYI: Your loan health is ${loan.health_factor}%. Still safe, but worth monitoring.`,
    }[alert.level];

    // Email
    if (
      borrower.email &&
      (alert.urgency !== "low" || borrower.emailAllAlerts)
    ) {
      await sendEmail({
        to: borrower.email,
        subject: `[${alert.level}] Loan Health Alert`,
        body: message,
        cta: {
          text: "View Loan",
          url: `https://redchips.xyz/loans/${loan.id}`,
        },
      });
    }

    // SMS (only for CRITICAL)
    if (borrower.sms && alert.level === "CRITICAL") {
      await sendSMS({
        to: borrower.sms,
        message: message.substring(0, 160), // SMS character limit
      });
    }

    // Push notification
    if (borrower.pushEnabled) {
      await sendPush({
        userId: loan.borrower_address,
        title: `Loan Health: ${alert.level}`,
        body: message,
        data: { loanId: loan.id, healthFactor: loan.health_factor },
      });
    }

    // Record alert
    await db.query(
      "INSERT INTO alerts (loan_id, alert_type, health_factor, sent_via) VALUES ($1, $2, $3, $4)",
      [
        loan.id,
        alert.level,
        loan.health_factor,
        [
          borrower.email ? "email" : null,
          borrower.sms && alert.level === "CRITICAL" ? "sms" : null,
          borrower.pushEnabled ? "push" : null,
        ].filter(Boolean),
      ],
    );
  }
}
```

**FR-6.5**: Alert Preferences UI
┌─────────────────────────────────────────────────────────────┐
│ Alert Preferences [Save]│
├─────────────────────────────────────────────────────────────┤
│ │
│ How should we notify you about your loan health? │
│ │
│ Email Alerts: │
│ [✓] Enable email alerts │
│ Email: borrower@example.com [Edit] │
│ │
│ Send me an email when: │
│ [✓] Health drops below 140% (Watch) │
│ [✓] Health drops below 130% (Warning) │
│ [✓] Health drops below 125% (Critical) │
│ [✓] Price moves >10% in 1 hour │
│ [✓] Loan expiring in 24 hours │
│ │
│ SMS Alerts: (for urgent notifications only) │
│ [✓] Enable SMS alerts │
│ Phone: +1-555-123-4567 [Edit] [Verify] │
│ │
│ Send me SMS when: │
│ [ ] Health drops below 140% (Watch) │
│ [ ] Health drops below 130% (Warning) │
│ [✓] Health drops below 125% (Critical) ← Recommended │
│ │
│ Push Notifications: │
│ [✓] Enable push notifications │
│ │
│ [Save Preferences] │
│ │
└─────────────────────────────────────────────────────────────┘

**Non-Functional Requirements**:

- **Real-time**: Health updates every 60 seconds
- **Reliability**: Alerts sent within 2 minutes of threshold breach
- **Accuracy**: Probability model validated against historical data
- **Scalability**: System handles 10,000+ active loans

**Technical Specifications**:

- **Frontend**: React + Recharts for graphs
- **Backend**: Node.js cron job (runs every minute)
- **Database**: PostgreSQL (loans, alerts, price_history tables)
- **Email**: SendGrid API
- **SMS**: Twilio API
- **Push**: Firebase Cloud Messaging

**Edge Cases**:

- Borrower has no contact info → Show in-app notifications only
- Email bounce → Mark as undeliverable, try SMS
- SMS delivery fails → Log failure, show in-app notification
- Too many alerts (spam) → Rate limit to max 1 per 6 hours per level
- Price data unavailable → Use last known price, show warning

---

## User Flows

### Flow 1: LP Creates Market (Happy Path)

Actor: Liquidity Provider (Sarah)
Goal: Launch a lending market for a gaming token
Duration: ~5 minutes
Steps:

Sarah navigates to redchips.xyz
Clicks "Launch Market" button
Connects MetaMask wallet
└─ System detects she has 50 ETH
Market Creation Wizard - Step 1: Asset Selection
├─ Selects "Ethereum" from blockchain dropdown
├─ Selects "ERC20 Token" radio button
├─ Pastes token address: 0x1234...abcd
├─ System validates contract
│ ├─ Fetches name: "GameToken"
│ ├─ Fetches symbol: "GAME"
│ ├─ Checks total supply: 1B tokens
│ └─ Shows ✓ "Contract verified"
├─ Selects "Uniswap V3 TWAP" for oracle
├─ System finds GAME/WETH pool
│ ├─ Liquidity: $2.4M ✓
│ ├─ Volume (24h): $180k ✓
│ └─ Shows "Sufficient liquidity"
└─ Clicks "Continue"
Step 2: Loan Terms
├─ Moves LTV slider to 75%
├─ Enters APR: 12%
├─ Selects duration: 30 days
├─ Example preview updates in real-time:
│ "Borrower deposits 10,000 GAME ($2,500)
│ Borrows $1,875 (75% LTV)
│ Repays $1,894 after 30 days
│ Your profit: $19 (0.76% monthly)"
└─ Clicks "Continue"
Step 3: Risk Controls
├─ Sets grace period: 72 hours
├─ Enables health factor liquidation
│ └─ Sets threshold: 120%
├─ Enables circuit breaker
│ ├─ Pause at: 20% volatility in 6 hours
│ └─ Resume at: 10% volatility for 4 hours
└─ Clicks "Continue"
Step 4: Initial Liquidity
├─ Enters: 50 ETH
├─ System calculates:
│ ├─ Creation fee: 0.5 ETH (1% of 50 ETH)
│ ├─ Total cost: 50.5 ETH
│ └─ Checks wallet balance: 52 ETH ✓
├─ Reviews summary:
│ "Asset: GAME Token
│ LTV: 75% | APR: 12% | Duration: 30 days
│ Liquidity: 50 ETH
│ Estimated APY: 12-18%"
└─ Clicks "Deploy Market"
Transaction Approval
├─ MetaMask popup: "Confirm transaction"
├─ Gas estimate: 0.02 ETH (~$60)
├─ Total: 50.52 ETH
├─ Sarah confirms
└─ Waits ~15 seconds for confirmation
Deployment Success
├─ Success screen shows:
│ "🎉 Market deployed successfully!"
│ Market address: 0x5678...efgh
│ Transaction: 0xabcd...1234
│ "Your market is now live and accepting loans"
├─ Buttons:
│ [View My Market] [Share on Twitter] [Done]
└─ Sarah clicks "View My Market"
LP Dashboard
├─ Shows market stats:
│ Total Liquidity: 50 ETH
│ Available: 50 ETH (100%)
│ Active Loans: 0
│ Total Borrowed: 0 ETH
├─ Share link: redchips.xyz/markets/0x5678
└─ Sarah shares link in her DAO Discord

Result: Market live in 5 minutes, ready to accept loans

### Flow 2: Borrower Takes Loan (Happy Path)

Actor: Borrower (Mike)
Goal: Borrow USDC against GAME tokens
Duration: ~3 minutes
Steps:

Mike sees Sarah's market link in Discord
Clicks link → redirected to market page
Connects MetaMask wallet
└─ System detects: 15,000 GAME tokens
Market Overview Page
├─ Shows market details:
│ Asset: GAME Token
│ LTV: 75% | APR: 12% | Duration: 30 days
│ Available Liquidity: 50 ETH ($150k)
│ Your GAME Balance: 15,000 tokens
├─ Loan Calculator (auto-populated):
│ "If you deposit 10,000 GAME ($2,500)
│ You can borrow up to $1,875"
└─ Mike clicks "Borrow Now"
Loan Request Page
├─ Collateral input:
│ "Amount to deposit: [10000] GAME"
│ [Max] button (fills with 15,000)
├─ Mike keeps 10,000 (wants to keep some liquid)
├─ System calculates:
│ Collateral value: $2,500 (@ $0.25/token TWAP)
│ Max loan: $1,875 (75% LTV)
│ Interest (30 days): $18.75 (12% APR)
│ Total repayment: $1,893.75
│ Due date: Feb 24, 2026
├─ Risk warning shown:
│ "⚠️ Liquidation at $0.189/token (24% drop)"
│ "Current buffer: 32%"
├─ Mike checks "I understand" box
└─ Clicks "Request Loan"
Approval Transaction
├─ MetaMask popup 1: "Approve GAME for Red Chips?"
├─ Mike confirms
├─ Waits ~10 seconds
└─ Shows "Approval confirmed ✓"
Loan Request Transaction
├─ MetaMask popup 2: "Confirm Loan Request"
├─ Mike confirms
├─ Smart contract executes:
│ ├─ Checks circuit breaker: Active ✓
│ ├─ Fetches TWAP price: $0.25 ✓
│ ├─ Validates collateral: 10,000 GAME ✓
│ ├─ Transfers collateral to escrow
│ ├─ Transfers $1,875 to Mike
│ └─ Creates loan record
├─ Waits ~10 seconds
└─ Shows "Loan funded ✓"
Success Screen
├─ "🎉 Loan funded successfully!"
├─ Details:
│ Received: $
Continue3:38 PM1,875 USDC
│ Collateral: 10,000 GAME (locked)
│ Repay by: Feb 24, 2026
│ Total due: $1,893.75
├─ Buttons:
│ [View Loan Dashboard] [Share] [Done]
└─ Mike clicks "View Loan Dashboard"

Loan Dashboard
├─ Health Score: 145% ✓ Healthy
├─ Real-time price: $0.25
├─ Liquidation price: $0.189
├─ Buffer: 32% above liquidation
├─ Forecast:
│ 24h liquidation risk: 2.3% 🟢
│ 7d liquidation risk: 8.7% 🟡
├─ Actions:
│ [Repay Now] [Monitor Price]
└─ Mike sets up email alerts

Result: Mike has $1,875 USDC, 10,000 GAME locked as collateral

### Flow 3: Loan Repayment (Happy Path)

Actor: Borrower (Mike)
Goal: Repay loan and reclaim collateral
Time: Day 28 of 30-day loan
Steps:

Mike receives email: "Loan expiring in 2 days"
Clicks "Repay Loan" link in email
Redirected to loan dashboard
Reviews repayment details:
├─ Principal: $1,875
├─ Interest (28 days): $17.50
├─ Total due: $1,892.50
└─ Collateral to be released: 10,000 GAME
Clicks "Repay Loan" button
MetaMask popup: "Confirm Repayment"
├─ Send: 1,892.50 USDC
├─ Receive: 10,000 GAME
└─ Gas: ~$5
Mike confirms transaction
Smart contract executes:
├─ Verifies payment: 1,892.50 USDC ✓
├─ Transfers to LP: $1,892.50
├─ Releases collateral to Mike: 10,000 GAME
├─ Updates loan status: REPAID
└─ Emits LoanRepaid event
Success screen:
"✓ Loan repaid successfully!
Your 10,000 GAME tokens have been returned.
Thanks for using Red Chips!"
Backend updates:
├─ Marks loan as REPAID in database
├─ Stops health monitoring
├─ Sends confirmation email
└─ Updates LP dashboard (available liquidity +$1,892.50)

Result: Mike gets collateral back, Sarah earns $17.50 profit

### Flow 4: Liquidation (Unhappy Path)

Actor: Borrower (Mike) - forgets to repay
Time: Day 33 (3 days past expiry, grace period over)
Steps:

Day 30: Loan expires
├─ System sends email: "Loan expired, 72-hour grace period started"
├─ Mike sees email but ignores (busy)
└─ Status changes: ACTIVE → GRACE_PERIOD
Day 31: Grace period warning
├─ Email: "48 hours until liquidation"
├─ SMS: "URGENT: Repay loan or lose collateral"
├─ Mike doesn't see (phone on silent)
└─ GAME price stable at $0.25
Day 32: Final warning
├─ Email: "24 hours until liquidation"
├─ Push notification: "Final warning!"
├─ Mike traveling, no internet access
└─ Still no repayment
Day 33: Grace period expires
├─ Backend service detects: loan.expiryTime + 72 hours < now
├─ Marks loan as liquidatable
├─ Triggers liquidation bot
└─ Bot calls liquidateLoan(loanId)
Liquidation Execution
├─ Smart contract verifies:
│ ├─ Loan in GRACE_PERIOD ✓
│ ├─ Grace period expired ✓
│ └─ Can liquidate: true
├─ Calculates amounts:
│ ├─ Debt: $1,875 + $18.75 interest = $1,893.75
│ ├─ Penalty (5%): $94.69
│ ├─ Total owed: $1,988.44
│ ├─ Collateral value: $2,500 (10,000 GAME @ $0.25)
│ ├─ Tokens for LP: 7,954 GAME ($1,988.44 worth)
│ └─ Surplus to Mike: 2,046 GAME ($511.56)
├─ Executes gradual liquidation:
│ ├─ Transfers 7,954 GAME to LP (Sarah)
│ ├─ Transfers 2,046 GAME to Mike
│ └─ Updates loan status: LIQUIDATED
Notifications Sent
├─ To Mike:
│ Email: "Your loan was liquidated.
│ You received 2,046 GAME back ($512).
│ Next time, repay before grace period expires."
│
├─ To Sarah (LP):
│ Email: "Loan liquidated successfully.
│ You received 7,954 GAME ($1,988 value).
│ Profit: $94.69 (5% liquidation penalty)"
│
└─ On-chain event emitted: Liquidated
Mike checks email (finally)
├─ Sees liquidation notice
├─ Checks wallet: Has 2,046 GAME
├─ Realizes: Lost $1,394 ($1,988 - $512 surplus)
└─ Lesson learned: Set calendar reminders!

Result: Sarah made $94.69 profit, Mike lost debt amount but kept surplus

### Flow 5: Circuit Breaker Triggered (Edge Case)

Actor: System (automated)
Scenario: GAME price crashes 25% in 4 hours
Time: Random Tuesday
Steps:

10:00 AM: GAME price = $0.25 (normal)
└─ All markets ACTIVE, loans being issued
11:00 AM: Bad news drops (exploit found in GAME protocol)
├─ Price drops to $0.22 (-12%)
├─ Backend monitors volatility
├─ Volatility: 12% in 1 hour (below 20% threshold)
└─ No action taken yet
12:00 PM: Panic selling intensifies
├─ Price drops to $0.19 (-24% from 10 AM)
├─ Backend calculates: 24% move in 2 hours
├─ Exceeds circuit breaker threshold (20%)
└─ Triggers pause
Circuit Breaker Execution
├─ Smart contract called: pauseMarket()
├─ Status changes: ACTIVE → PAUSED_VOLATILITY
├─ pausedAt timestamp: block.timestamp
├─ Event emitted: CircuitBreakerTriggered(volatility=24%)
└─ Database updated: status = 'PAUSED_VOLATILITY'
LP Notification (Sarah)
├─ Email: "⚠️ Circuit Breaker Triggered
│ Your GAME market was paused due to 24% volatility.
│ New loans suspended. Existing loans still active.
│ Estimated resume: ~6 hours"
├─ SMS: "Red Chips: GAME market paused (24% volatility)"
└─ Push notification with same info
Borrower Experience (Potential new borrower - Alex)
├─ Alex visits market page
├─ Sees banner:
│ "⚠️ Market Temporarily Paused
│ This market is paused due to high volatility (24% in 2 hours).
│ Will resume when volatility drops below 10% for 4 hours.
│ Estimated resume: ~6 hours
│ [View Other Markets] [Get Notified]"
├─ "Borrow Now" button disabled
└─ Alex clicks "Get Notified", enters email
Existing Borrower (Mike)
├─ Receives notification:
│ "FYI: GAME market paused, but your loan is still active.
│ You can repay anytime. Liquidations still happening."
├─ Checks loan dashboard
├─ Health dropped from 145% to 108% (price crash)
├─ Status: 🔴 CRITICAL - Near liquidation!
└─ Mike decides to repay immediately (still allowed)
2:00 PM: Price stabilizes at $0.19
├─ Volatility over last 4 hours: 24% (still high)
├─ Cooldown period: Still active (needs 4 hours from pause)
└─ Market remains paused
4:00 PM: Cooldown complete, checking resume
├─ Time since pause: 4 hours ✓
├─ Current volatility (4-hour window): 8% (below 10% threshold) ✓
├─ Backend calls: resumeMarket()
├─ Status changes: PAUSED_VOLATILITY → ACTIVE
└─ Event emitted: MarketResumed()
Resume Notifications
├─ To Sarah (LP):
│ "✓ GAME market resumed
│ Volatility normalized. New loans now accepted."
│
├─ To Alex (wanted notification):
│ "The GAME market you were interested in has resumed!"
│
└─ Market page: Banner removed, "Borrow Now" enabled

Result: Market protected from crash lending, resumed safely after stabilization

---

## Technical Architecture

### System Components

┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Next.js │ │ React UI │ │ Web3 SDK │ │
│ │ SSR/SSG │ │ Components │ │ (wagmi) │ │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │
│ │ │ │ │
│ └─────────────────┴──────────────────┘ │
│ │ │
└───────────────────────────┼──────────────────────────────────────┘
│
┌───────────────────────────▼──────────────────────────────────────┐
│ BACKEND │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ API Layer (Node.js) │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ REST API │ │ GraphQL │ │ WebSocket │ │ │
│ │ │ (Express) │ │ (Apollo) │ │ (Socket.io) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Background Services │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Health │ │ Volatility │ │ Liquidation │ │ │
│ │ │ Monitor │ │ Monitor │ │ Bot │ │ │
│ │ │ (Cron) │ │ (Cron) │ │ (Keeper) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Alert │ │ Price │ │ Indexer │ │ │
│ │ │ Service │ │ Tracker │ │ (Events) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Database │ │
│ │ PostgreSQL 15+ │ │
│ │ ┌──────────────────────────────────────────────────────┐ │ │
│ │ │ Tables: markets, loans, price*history, alerts, │ │ │
│ │ │ users, transactions, health_snapshots │ │ │
│ │ └──────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Cache Layer │ │
│ │ Redis 7+ │ │
│ │ ┌──────────────────────────────────────────────────────┐ │ │
│ │ │ Cached: TWAP prices (60s TTL), loan health, │ │ │
│ │ │ market stats, user sessions │ │ │
│ │ └──────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
│
┌───────────────────────────▼──────────────────────────────────────┐
│ BLOCKCHAIN LAYER │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Smart Contracts (EVM) │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │Market │ │ Lending │ │ Loan │ │ │
│ │ │Factory.sol │ │ Market.sol │ │ Contract.sol │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Smart Programs (Solana) │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │market* │ │ lending* │ │ loan* │ │ │
│ │ │factory.rs │ │ market.rs │ │ account.rs │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Oracles │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Uniswap V3 │ │ Chainlink │ │ Pyth │ │ │
│ │ │ TWAP │ │ Price Feeds │ │ (Solana) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
│
┌───────────────────────────▼──────────────────────────────────────┐
│ EXTERNAL SERVICES │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ SendGrid │ │ Twilio │ │ Firebase │ │
│ │ (Email) │ │ (SMS) │ │ (Push) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└───────────────────────────────────────────────────────────────────┘

### Database Schema (PostgreSQL)

```sql
-- Markets table
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(66) UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    lp_address VARCHAR(66) NOT NULL,
    collateral_asset VARCHAR(66) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('ERC20', 'ERC721', 'ERC1155', 'SPL')),

    -- Terms
    ltv_bps INTEGER NOT NULL CHECK (ltv_bps BETWEEN 1000 AND 20000),
    apr_bps INTEGER NOT NULL CHECK (apr_bps BETWEEN 100 AND 10000),
    duration_seconds INTEGER NOT NULL,
    grace_period_hours INTEGER NOT NULL,

    -- Health factor
    enable_health_factor BOOLEAN DEFAULT FALSE,
    health_threshold_bps INTEGER,

    -- Circuit breaker
    enable_circuit_breaker BOOLEAN DEFAULT FALSE,
    pause_threshold_bps INTEGER,
    lookback_period_seconds INTEGER,
    resume_threshold_bps INTEGER,
    cooldown_seconds INTEGER,

    -- Oracle
    oracle_type VARCHAR(20) NOT NULL CHECK (oracle_type IN ('UNISWAP_V3_TWAP', 'CHAINLINK', 'MANUAL')),
    oracle_address VARCHAR(66) NOT NULL,
    twap_period_seconds INTEGER,

    -- State
    total_liquidity DECIMAL(30, 18) DEFAULT 0,
    available_liquidity DECIMAL(30, 18) DEFAULT 0,
    total_borrowed DECIMAL(30, 18) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED_VOLATILITY', 'PAUSED_MANUAL')),
    paused_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_lp (lp_address),
    INDEX idx_asset (collateral_asset),
    INDEX idx_chain (chain_id),
    INDEX idx_status (status)
);

-- Loans table
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    loan_id_onchain INTEGER NOT NULL,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    market_address VARCHAR(66) NOT NULL,
    borrower_address VARCHAR(66) NOT NULL,

    -- Collateral
    collateral_amount DECIMAL(30, 18),
    token_id BIGINT,

    -- Loan details
    principal DECIMAL(30, 18) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    expiry_time TIMESTAMP NOT NULL,

    -- State
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRACE_PERIOD', 'REPAID', 'LIQUIDATED')),
    health_factor DECIMAL(10, 2),
    liquidation_price DECIMAL(30, 18),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    repaid_at TIMESTAMP,
    liquidated_at TIMESTAMP,

    -- Constraints
    UNIQUE(market_address, loan_id_onchain),

    -- Indexes
    INDEX idx_borrower (borrower_address),
    INDEX idx_market (market_id),
    INDEX idx_status (status),
    INDEX idx_health (health_factor) WHERE status = 'ACTIVE',
    INDEX idx_expiry (expiry_time) WHERE status IN ('ACTIVE', 'GRACE_PERIOD')
);

-- Price history table (for TWAP and volatility calculations)
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    asset_address VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    price DECIMAL(30, 18) NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('UNISWAP_V3', 'CHAINLINK', 'PYTH', 'MANUAL')),
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_asset_time (asset_address, timestamp DESC),
    INDEX idx_chain_asset (chain_id, asset_address, timestamp DESC)
);

-- Partitioning by month for better performance
CREATE TABLE price_history_2026_01 PARTITION OF price_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Auto-create partitions via pg_partman or similar

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('WATCH', 'WARNING', 'CRITICAL', 'EXPIRING', 'EXPIRED')),
    health_factor DECIMAL(10, 2),
    message TEXT,
    sent_via TEXT[], -- ['email', 'sms', 'push']
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_loan_time (loan_id, created_at DESC),
    INDEX idx_type_time (alert_type, created_at DESC)
);

-- Users table (optional, for preferences)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(66) UNIQUE NOT NULL,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,

    -- Alert preferences
    alert_email BOOLEAN DEFAULT TRUE,
    alert_sms BOOLEAN DEFAULT FALSE,
    alert_push BOOLEAN DEFAULT TRUE,
    alert_watch BOOLEAN DEFAULT TRUE,
    alert_warning BOOLEAN DEFAULT TRUE,
    alert_critical BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,

    -- Indexes
    INDEX idx_wallet (wallet_address)
);

-- Transactions table (event log)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    from_address VARCHAR(66) NOT NULL,
    to_address VARCHAR(66) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_tx_hash (tx_hash),
    INDEX idx_from (from_address),
    INDEX idx_to (to_address),
    INDEX idx_event_type (event_type),
    INDEX idx_block (chain_id, block_number DESC)
);

-- Health snapshots (for historical analysis)
CREATE TABLE health_snapshots (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    health_factor DECIMAL(10, 2) NOT NULL,
    collateral_price DECIMAL(30, 18) NOT NULL,
    debt_amount DECIMAL(30, 18) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_loan_time (loan_id, timestamp DESC)
);

-- Partitioning by month
CREATE TABLE health_snapshots_2026_01 PARTITION OF health_snapshots
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### API Endpoints

```typescript
// REST API Spec (OpenAPI 3.0)

/api/v1/markets
  GET    - List all markets (with filters)
  POST   - Create new market (requires wallet signature)

  Query params:
    - chain_id: number
    - asset_type: 'ERC20' | 'ERC721' | 'ERC1155'
    - lp_address: string
    - status: 'ACTIVE' | 'PAUSED_VOLATILITY' | 'PAUSED_MANUAL'
    - min_liquidity: number
    - sort_by: 'liquidity' | 'apr' | 'created_at'
    - page: number
    - limit: number (max 100)

/api/v1/markets/:marketAddress
  GET    - Get market details
  PATCH  - Update market settings (LP only)

/api/v1/markets/:marketAddress/stats
  GET    - Get market statistics
    Response:
      {
        total_loans: number,
        active_loans: number,
        total_volume: string,
        default_rate: number,
        avg_loan_size: string,
        utilization_rate: number,
        performance: {
          total_interest_earned: string,
          roi: number,
          apr_realized: number
        }
      }

/api/v1/markets/:marketAddress/loans
  GET    - List loans for market
  POST   - Request loan (requires wallet signature)

/api/v1/loans
  GET    - List all loans (with filters)

  Query params:
    - borrower_address: string
    - market_address: string
    - status: 'ACTIVE' | 'GRACE_PERIOD' | 'REPAID' | 'LIQUIDATED'
    - min_health: number
    - max_health: number

/api/v1/loans/:loanId
  GET    - Get loan details

  Response:
    {
      id: number,
      loan_id_onchain: number,
      market_address: string,
      borrower_address: string,
      collateral: {
        amount: string,
        token_id: string | null,
        value_usd: string
      },
      principal: string,
      interest_accrued: string,
      total_debt: string,
      start_time: string (ISO 8601),
      expiry_time: string,
      status: string,
      health: {
        factor: number,
        liquidation_price: string,
        current_price: string,
        buffer_percent: number
      }
    }

/api/v1/loans/:loanId/repay
  POST   - Repay loan (requires wallet signature)

  Request:
    {
      amount: string, // Can be partial or full
      signature: string
    }

/api/v1/loans/:loanId/health
  GET    - Get loan health details

  Response:
    {
      current_health: number,
      liquidation_threshold: number,
      liquidation_price: string,
      current_price: string,
      buffer_percent: number,
      risk_forecast: {
        prob_24h: number,
        prob_7d: number,
        prob_30d: number,
        volatility_30d: number
      },
      history: Array<{
        timestamp: string,
        health: number,
        price: string
      }>
    }

/api/v1/loans/:loanId/alerts
  GET    - Get alert history for loan
  POST   - Update alert preferences

  POST Request:
    {
      email: boolean,
      sms: boolean,
      push: boolean,
      thresholds: {
        watch: number,
        warning: number,
        critical: number
      }
    }

/api/v1/prices/:assetAddress
  GET    - Get current price and TWAP

  Query params:
    - chain_id: number
    - period: number (TWAP period in seconds)

  Response:
    {
      spot_price: string,
      twap_price: string,
      twap_period: number,
      source: string,
      last_updated: string,
      deviation_percent: number
    }

/api/v1/prices/:assetAddress/history
  GET    - Get historical prices

  Query params:
    - from: string (ISO 8601)
    - to: string
    - interval: '1m' | '5m' | '1h' | '1d'

/api/v1/user/:walletAddress
  GET    - Get user profile and preferences
  PUT    - Update user preferences

  PUT Request:
    {
      email: string,
      phone: string,
      alert_preferences: {
        email: boolean,
        sms: boolean,
        push: boolean
      }
    }

/api/v1/user/:walletAddress/loans
  GET    - Get all loans for user

/api/v1/user/:walletAddress/markets
  GET    - Get all markets created by user (if LP)

/api/v1/analytics/platform
  GET    - Get platform-wide analytics

  Response:
    {
      total_markets: number,
      total_tvl: string,
      total_loans: number,
      total_volume: string,
      avg_apr: number,
      active_borrowers: number,
      active_lps: number,
      chain_breakdown: {
        [chainId: number]: {
          markets: number,
          tvl: string,
          volume: string
        }
      }
    }

/api/v1/health/system
  GET    - System health check

  Response:
    {
      status: 'healthy' | 'degraded' | 'down',
      services: {
        api: 'up' | 'down',
        database: 'up' | 'down',
        redis: 'up' | 'down',
        ethereum_rpc: 'up' | 'down',
        solana_rpc: 'up' | 'down'
      },
      uptime: number,
      version: string
    }
```

---

## Non-Functional Requirements

### Performance

- **Page Load Time**: <2 seconds (75th percentile)
- **Transaction Confirmation**: Display within 30 seconds of on-chain confirmation
- **API Response Time**: <500ms (95th percentile)
- **Database Queries**: <100ms (95th percentile)
- **Real-Continue8:12 PMtime Updates**: Health dashboard refreshes every 60 seconds

Concurrent Users: Support 10,000 concurrent users
Throughput: Handle 100 transactions per second

Scalability

Horizontal Scaling: API servers can scale to 10+ instances
Database: PostgreSQL with read replicas (1 primary, 3 replicas)
Caching: Redis cluster for session and data caching
CDN: Static assets served via CloudFlare CDN
Load Balancer: NGINX or AWS ALB for traffic distribution

Availability

Uptime: 99.9% SLA (< 9 hours downtime per year)
RPC Redundancy: 3+ RPC providers per chain (Alchemy, Infura, QuickNode)
Database Backups: Hourly snapshots, retained for 30 days
Disaster Recovery: RPO < 1 hour, RTO < 4 hours
Monitoring: 24/7 monitoring via DataDog/Grafana

Security

Smart Contract Audits: 2+ independent audits before mainnet
Bug Bounty: $50k-$500k rewards on Immunefi
API Rate Limiting: 100 requests/minute per IP
DDoS Protection: CloudFlare Enterprise
Encryption: TLS 1.3 for all connections
Secrets Management: AWS Secrets Manager or HashiCorp Vault
Access Control: Role-based access (RBAC) for admin functions

Compliance

Privacy: GDPR compliant (user data deletion on request)
Data Retention: 7 years for transaction data (regulatory requirement)
KYC/AML: Not required initially (fully decentralized)
Terms of Service: Clear disclaimers about risks
Geographic Restrictions: Block sanctioned countries (OFAC list)

This concludes the PRD. The implementation plan follows in the next document.

---
