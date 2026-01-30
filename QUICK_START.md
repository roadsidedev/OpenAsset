# Red Chips - Quick Start Guide

## What Was Just Completed

✅ **Backend Routes Wired**
- All routes mounted in `app.ts` with proper Prisma injection
- Factory pattern for route creation: `createMarketRoutes()`, etc.
- Routes at `/api/v1/*` with CORS and rate limiting

✅ **Frontend Hooks Ready**
- `useMarkets()`, `useMarket()`, `useLoans()`, `useLoan()`, etc.
- `useContractInteraction()` for Web3 transactions
- React Query integration for caching and state

✅ **UI Components Built**
- Markets page with real data fetching
- Create market wizard with transaction submission
- Borrow page with loan calculations
- All integrated with backend APIs

✅ **API Proxy Configured**
- Next.js rewrites `/api/v1/*` to backend
- Environment variable support for different environments

## Starting the Application

### 1. Start Backend (Terminal 1)
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- API docs: Check Swagger if configured, else test with curl

### 2. Start Frontend (Terminal 2)
```bash
cd web
npm install
npm run dev
```
Frontend runs on `http://localhost:3001`
- Open in browser: `http://localhost:3001`
- Hooks will proxy requests to backend

### 3. Test API (Optional, Terminal 3)
```bash
bash test-api.sh
```
Tests all backend endpoints for connectivity

## Testing Flows

### Flow 1: View Markets
1. Open `http://localhost:3001`
2. Click "Borrow Funds" or navigate to `/markets`
3. Should see market cards loading from backend API
4. Each card shows real market data (LTV, APR, Duration, Liquidity)

### Flow 2: Create a Market
1. Navigate to `/create-market`
2. Fill out 4-step form:
   - Step 1: Collateral Asset Address (ERC20)
   - Step 2: LTV, APR, Duration
   - Step 3: Risk Controls (review defaults)
   - Step 4: Initial Liquidity
3. Click "Deploy Market" on final step
4. MetaMask popup appears → Approve transaction
5. Success message shows tx hash
6. Redirects to markets page after 2 seconds

### Flow 3: Borrow from Market
1. Navigate to `/markets`
2. Find a market card, click "Borrow"
3. Enters `/borrow/[marketAddress]` page
4. Fill collateral amount (updates max borrow)
5. Fill desired principal (updates interest calc)
6. Review loan summary with repayment total
7. Click "Request Loan"
8. MetaMask popup → Approve transaction
9. Success message shows tx hash

## Environment Setup

### Backend (.env)
```
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/redchips"
NODE_ENV="development"
RPC_URLS="https://sepolia.infura.io/v3/YOUR_KEY"
MARKET_FACTORY_ADDRESS="0x99352bAA80de51fA23a8235EbdabF48a3C0B799d"
LOAN_IMPLEMENTATION_ADDRESS="0xBE170Cdaa743C58284b221933d0dfc596D7abC6f"
FRONTEND_URL="http://localhost:3001"
JWT_SECRET="dev-secret"
```

### Frontend (.env.local)
```
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
NEXT_PUBLIC_API_URL="http://localhost:3000/api/v1"
```

## Key Components

### Backend Routes
- `POST /api/v1/auth/*` - Authentication
- `GET /api/v1/markets` - List markets
- `GET /api/v1/markets/:address` - Market details
- `POST /api/v1/markets/estimate-creation` - Gas estimation
- `GET /api/v1/loans` - List loans
- `POST /api/v1/loans/:market/estimate-request` - Loan estimation

### Frontend Hooks
```typescript
// Fetch markets
const { data, isLoading, error } = useMarkets(start, count);

// Fetch single market
const { data: market } = useMarket(address);

// Web3 transactions
const { createMarket, requestLoan, isLoading, error } = useContractInteraction();
```

### Pages
- `/` - Home
- `/markets` - Market listing
- `/create-market` - Create market wizard
- `/borrow/[marketId]` - Borrow UI
- `/dashboard` - (placeholder)

## Debugging

### Backend not responding
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Frontend can't reach API
- Check backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Check CORS headers: `curl -i -H "Origin: http://localhost:3001" http://localhost:3000/health`

### MetaMask not working
- Install MetaMask extension
- Switch to Sepolia testnet
- Get Sepolia ETH from faucet
- Ensure wallet is unlocked

### Database not connecting
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Run migrations: `npm run migrate` (in backend)

## Next Steps

1. **Test on Sepolia Testnet**
   - Get Sepolia ETH from faucet
   - Test market creation transaction
   - Test loan request transaction
   - Monitor blockchain explorer

2. **Event Indexing**
   - Start indexer worker: `npm run indexer` (in backend)
   - Monitor for market/loan events
   - Verify database population

3. **Production Deployment**
   - See `INTEGRATION_COMPLETE.md` for checklist
   - Deploy backend to VPS/Railway
   - Deploy frontend to Vercel
   - Configure production environment variables

## Reference Documentation

- `INTEGRATION_STATUS.md` - Detailed integration status
- `TESTING_SEPOLIA.md` - Full testing guide for Sepolia
- `ARCHITECTURE.md` - System architecture overview
- `ReferenceDoc.md` - API documentation

## Quick Commands

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Production build
npm run start        # Run production build

# Testing
bash test-api.sh     # Test API endpoints
npm run test         # Run unit tests

# Database
npm run migrate      # Run migrations
npm run seed         # Seed test data

# Formatting
npm run format       # Format code
npm run lint         # Check linting
```

## Support

Issues? Check:
1. All services running (backend, frontend, database)
2. Correct environment variables
3. Console errors in browser DevTools
4. Backend logs: `npm run dev 2>&1 | tee output.log`
