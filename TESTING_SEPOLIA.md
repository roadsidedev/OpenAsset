# Testing Red Chips on Sepolia Testnet

## Prerequisites
- Node.js 18+
- MetaMask or compatible wallet
- Sepolia testnet ETH (from [Sepolia Faucet](https://www.sepoliafaucet.com/))
- Backend and frontend running locally

## Setup

### 1. Environment Configuration

**Backend (.env)**
```
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/redchips"
NODE_ENV="development"
RPC_URLS="https://sepolia.infura.io/v3/YOUR_KEY"
MARKET_FACTORY_ADDRESS="0x99352bAA80de51fA23a8235EbdabF48a3C0B799d"
LOAN_IMPLEMENTATION_ADDRESS="0xBE170Cdaa743C58284b221933d0dfc596D7abC6f"
FRONTEND_URL="http://localhost:3001"
JWT_SECRET="dev-secret-change-in-production"
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your-project-id"
NEXT_PUBLIC_ALCHEMY_KEY="your-alchemy-key"
NEXT_PUBLIC_API_URL="http://localhost:3000/api/v1"
```

### 2. Start Services

**Backend**
```bash
cd backend
npm install
npm run dev
```

**Frontend**
```bash
cd web
npm install
npm run dev
```

Backend runs on `http://localhost:3000`
Frontend runs on `http://localhost:3001`

## Testing Workflow

### Phase 1: Backend API Testing

#### 1.1 Health Check
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

#### 1.2 Markets API
```bash
# Get all markets
curl http://localhost:3000/api/v1/markets

# Get specific market
curl http://localhost:3000/api/v1/markets/0x99352bAA80de51fA23a8235EbdabF48a3C0B799d/liquidity
```

#### 1.3 Loans API
```bash
# Get all loans
curl http://localhost:3000/api/v1/loans

# Get loan details
curl http://localhost:3000/api/v1/loans/0xLOAN_ADDRESS
```

### Phase 2: Frontend UI Testing

1. **Navigation**
   - [ ] Home page loads
   - [ ] Navigation to /markets works
   - [ ] Navigation to /create-market works
   - [ ] Navigation to /borrow/:marketId works

2. **Markets Page**
   - [ ] Connects to `useMarkets()` hook
   - [ ] Loads market list from `/api/v1/markets`
   - [ ] Displays market cards with real data
   - [ ] Filter buttons functional
   - [ ] Links to borrow page work

3. **Create Market Page**
   - [ ] All 4 form steps load
   - [ ] Form data persists across steps
   - [ ] Connect wallet button works
   - [ ] Back/Continue buttons functional
   - [ ] Deploy button calls `useContractInteraction.createMarket()`

### Phase 3: Web3 Integration Testing

#### 3.1 Wallet Connection
1. Open frontend in browser
2. Look for wallet connection button in navbar
3. [ ] MetaMask popup appears
4. [ ] Select Sepolia testnet
5. [ ] Account address shows in navbar

#### 3.2 Create Market Transaction
1. Navigate to `/create-market`
2. Fill form with test data:
   - Collateral Asset: `0x...` (any valid ERC20 on Sepolia)
   - LTV: 75%
   - APR: 12%
   - Duration: 30 days
   - Initial Liquidity: 1000
3. [ ] Connect wallet prompt shows if needed
4. [ ] Deploy button enabled when wallet connected
5. [ ] MetaMask transaction popup appears
6. [ ] After approval, success message shows with tx hash
7. [ ] Redirects to markets page after 2 seconds

#### 3.3 Market Listing
1. Navigate to `/markets`
2. [ ] Markets list loads from API
3. [ ] Real market data displays
4. [ ] Liquidity values show correctly

#### 3.4 Borrow Functionality
1. Navigate to `/markets`
2. Click "Borrow" on a market
3. [ ] Market details load correctly
4. [ ] Collateral amount input accepts values
5. [ ] Maximum borrow calculation updates
6. [ ] Principal input accepts values
7. [ ] Interest calculation displays correctly
8. [ ] "Request Loan" button calls `useContractInteraction.requestLoan()`
9. [ ] MetaMask transaction popup appears
10. [ ] Success message shows after approval

### Phase 4: Backend Event Indexing

1. **Monitor IndexerService**
   ```bash
   # Check backend logs for indexing events
   tail -f backend/logs/index.log | grep "MarketCreated\|LoanRequested"
   ```

2. **Verify Database**
   ```sql
   -- Check indexed markets
   SELECT marketAddress, owner, active FROM "Market" ORDER BY createdAt DESC LIMIT 5;
   
   -- Check indexed loans
   SELECT address, borrowerAddress, status FROM "Loan" ORDER BY createdAt DESC LIMIT 5;
   ```

### Phase 5: Error Handling

Test error scenarios:
- [ ] Disconnect wallet during transaction
- [ ] Insufficient balance for collateral
- [ ] Invalid contract address
- [ ] Network timeout
- [ ] Invalid form inputs
- [ ] API error responses

## Test Checklist

**Backend Routes**
- [ ] `GET /health` returns 200
- [ ] `GET /api/v1/markets` returns market list
- [ ] `GET /api/v1/markets/:address` returns market details
- [ ] `GET /api/v1/markets/:address/liquidity` returns liquidity
- [ ] `POST /api/v1/markets/estimate-creation` calculates gas
- [ ] `GET /api/v1/loans` returns loan list
- [ ] `GET /api/v1/loans/:address` returns loan details
- [ ] `GET /api/v1/loans/:address/liquidation-status` checks status
- [ ] `POST /api/v1/loans/:market/estimate-request` estimates loan

**Frontend Hooks**
- [ ] `useMarkets()` fetches paginated markets
- [ ] `useMarket()` fetches single market
- [ ] `useMarketLiquidity()` fetches liquidity
- [ ] `useLoans()` fetches loan list with filters
- [ ] `useLoan()` fetches single loan
- [ ] `useLoanLiquidationStatus()` checks liquidation
- [ ] `useContractInteraction()` signs transactions
- [ ] All hooks handle errors gracefully

**Frontend Components**
- [ ] Home page renders
- [ ] Markets page uses hooks and displays real data
- [ ] Create market form integrates with wallet
- [ ] Borrow page calculates loans correctly
- [ ] All pages have error boundaries

**Smart Contracts (Sepolia)**
- [ ] Market creation transaction succeeds
- [ ] Loan request transaction succeeds
- [ ] Events are emitted
- [ ] Liquidation checks work

## Troubleshooting

### "Failed to fetch markets"
- [ ] Check backend is running on port 3000
- [ ] Check CORS configuration in `backend/src/app.ts`
- [ ] Verify `FRONTEND_URL` matches frontend origin

### "Wallet not connected"
- [ ] Install MetaMask
- [ ] Switch to Sepolia testnet
- [ ] Check wallet is unlocked

### "Contract call failed"
- [ ] Verify contract addresses match Sepolia deployment
- [ ] Check you have Sepolia ETH for gas
- [ ] Verify ABI matches contract version

### "Database connection error"
- [ ] Check PostgreSQL is running
- [ ] Verify `DATABASE_URL` is correct
- [ ] Run migrations: `npm run migrate`

## Performance Metrics

Expected response times on Sepolia:
- GET /api/v1/markets: < 500ms
- POST /api/v1/markets/estimate-creation: < 2s
- Market creation tx: 10-30 seconds
- Loan request tx: 10-30 seconds

## Deployment Checklist (Before Mainnet)

- [ ] All tests pass on Sepolia
- [ ] No console errors in browser
- [ ] No unhandled promise rejections
- [ ] Backend logs show clean operation
- [ ] Database migrations successful
- [ ] All environment variables set correctly
- [ ] CORS properly configured
- [ ] Rate limiting working
- [ ] Error handling comprehensive
- [ ] Security headers present
