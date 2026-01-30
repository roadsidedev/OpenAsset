# Red Chips - Complete Verification Checklist

## Pre-Flight Checks

### System Requirements
- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] PostgreSQL running (or Docker with postgres image)
- [ ] MetaMask browser extension installed
- [ ] Access to Sepolia testnet RPC

### Environment Files
- [ ] `backend/.env` exists with all required variables
- [ ] `web/.env.local` exists with Privy app ID
- [ ] No secrets committed to git

## Backend Verification

### Installation
```bash
cd backend
npm install
npm run build
```
- [ ] No dependency conflicts
- [ ] TypeScript compiles without errors
- [ ] Build output in `dist/` directory

### Route Verification
```bash
# Check that routes are properly exported
grep -r "export function create" src/routes/
```
- [ ] `authRoutes.ts` exports `createAuthRoutes(prisma)`
- [ ] `userRoutes.ts` exports `createUserRoutes(prisma)`
- [ ] `marketRoutes.ts` exports `createMarketRoutes(prisma)`
- [ ] `loanRoutes.ts` exports `createLoanRoutes(prisma)`

### Startup Test
```bash
npm run dev
```
- [ ] Server starts on port 3000
- [ ] No connection errors in logs
- [ ] Database connection successful
- [ ] All middleware initialized

### API Endpoint Tests
```bash
# Health check
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`
- [ ] Returns 200 status code

```bash
# Markets endpoint
curl http://localhost:3000/api/v1/markets
```
- [ ] Returns 200 status code
- [ ] Response includes `total`, `start`, `count`, `markets` fields
- [ ] Markets array contains objects with proper schema

```bash
# Loans endpoint
curl http://localhost:3000/api/v1/loans
```
- [ ] Returns 200 status code
- [ ] Response includes `total`, `loans` fields

### CORS Verification
```bash
curl -i -H "Origin: http://localhost:3001" http://localhost:3000/health
```
- [ ] Response includes `Access-Control-Allow-Origin: http://localhost:3001`
- [ ] Credentials: true is set

### Error Handling
```bash
# Test 404
curl http://localhost:3000/api/v1/nonexistent
```
- [ ] Returns 404 status
- [ ] Error message is user-friendly

```bash
# Test invalid request
curl -X POST http://localhost:3000/api/v1/markets/invalid-address
```
- [ ] Returns 400 or 422 status
- [ ] Validation error message included

## Frontend Verification

### Installation
```bash
cd web
npm install
npm run build
```
- [ ] No dependency conflicts
- [ ] Build completes successfully
- [ ] `.next/` build output created
- [ ] No type errors

### Development Server
```bash
npm run dev
```
- [ ] Server starts on port 3001
- [ ] No console errors on startup
- [ ] Hot reload working (modify a file and save)
- [ ] Page loads without errors

### Page Loading
- [ ] `http://localhost:3001/` loads home page
- [ ] `http://localhost:3001/markets` loads markets page
- [ ] `http://localhost:3001/create-market` loads form
- [ ] Navbar visible on all pages
- [ ] Dark theme applied correctly

### Provider Setup
Check that all providers are initialized:
- [ ] Privy provider wraps app (for wallet connection)
- [ ] Wagmi provider initialized (for Web3 hooks)
- [ ] React Query provider initialized (for caching)
- [ ] All nested correctly in layout.tsx

### Next.js Proxy Configuration
Check `next.config.ts`:
- [ ] Rewrites are configured for `/api/v1/:path*`
- [ ] Fallback to `http://localhost:3000/api/v1` is set
- [ ] Environment variable `NEXT_PUBLIC_API_URL` supported

## Hook Verification

### useMarkets Hook
```javascript
// In browser console
const { useMarkets } = await import('http://localhost:3001/_next/static/chunks/...js')
const markets = useMarkets()
// Should show loading, then data
```
- [ ] Query key includes pagination params
- [ ] Fetch path is `/api/markets`
- [ ] Response transforms data correctly
- [ ] Cache staleTime is 30000ms
- [ ] Handles errors gracefully

### useLoans Hook
```javascript
// In browser console
const { useLoans } = await import('http://localhost:3001/_next/static/chunks/...js')
const loans = useLoans({ status: 'ACTIVE' })
// Should show loading, then data
```
- [ ] Supports filter parameters
- [ ] Fetch path includes query params
- [ ] Response transforms data correctly
- [ ] Cache staleTime is 30000ms

### useContractInteraction Hook
```javascript
// In browser console
const { useContractInteraction } = await import('http://localhost:3001/_next/static/chunks/...js')
const { createMarket, isLoading, error } = useContractInteraction()
// Should have all methods
```
- [ ] Returns all 4 methods: createMarket, depositLiquidity, requestLoan, repayLoan
- [ ] Returns isLoading and error state
- [ ] Returns clearError function

## Frontend Page Verification

### Markets Page (`/markets`)
1. Open DevTools → Network tab
2. Navigate to `/markets`
3. [ ] Page loads without errors
4. [ ] Filter buttons render (All Assets, Gaming, Memes, NFTs)
5. [ ] Network request to `/api/markets` appears
6. [ ] Response status is 200
7. [ ] Market cards display with:
   - [ ] Market address (truncated)
   - [ ] Active/Inactive status
   - [ ] LTV percentage
   - [ ] APR percentage (in green)
   - [ ] Duration in days
   - [ ] Liquidity amount
   - [ ] "Borrow" and "Supply" buttons
8. [ ] Loading skeletons show while fetching
9. [ ] Error message shows if API fails
10. [ ] "Create Market" button visible in header
11. [ ] Links to `/borrow/[marketAddress]` work

### Create Market Page (`/create-market`)
1. Navigate to `/create-market`
2. [ ] Page loads without errors
3. [ ] Progress bar shows "Step 1 of 4"
4. Step 1 - Asset Selection:
   - [ ] Input field for collateral asset address
   - [ ] "Continue" button enabled
   - [ ] Back button hidden
5. Click "Continue":
   - [ ] Progress bar advances to 25%
   - [ ] Step 2 form displays
6. Step 2 - Loan Terms:
   - [ ] LTV slider (10-90%)
   - [ ] APR input field
   - [ ] Duration dropdown (7, 14, 30, 90 days)
   - [ ] Continue button works
7. Step 3 - Risk Controls:
   - [ ] Circuit breaker toggle shown
   - [ ] Oracle status shown
   - [ ] Continue button works
8. Step 4 - Initial Liquidity:
   - [ ] Liquidity input field
   - [ ] Fee calculation: (1% of amount)
   - [ ] Total cost calculation
   - [ ] Button changes to "Deploy Market"
9. Without wallet:
   - [ ] Deploy button disabled
   - [ ] Tooltip says "Connect Wallet"
10. With wallet:
    - [ ] Deploy button enabled
    - [ ] Click triggers `handleDeploy()`
    - [ ] MetaMask popup appears
    - [ ] After approval: success message with tx hash
    - [ ] After 2s: redirect to `/markets`

### Borrow Page (`/borrow/[marketAddress]`)
1. From markets page, click "Borrow" on any market
2. [ ] Navigates to `/borrow/[marketAddress]`
3. [ ] Market details load:
   - [ ] Market address displayed
   - [ ] LTV, APR, Duration, Liquidity shown
   - [ ] "Available Liquidity" displays correctly
4. [ ] Collateral Amount input works
5. When collateral entered:
   - [ ] "Maximum Borrow" calculated: collateral × LTV
   - [ ] Displayed in colored box
6. [ ] Principal Amount input works
7. When principal entered:
   - [ ] Interest calculated: principal × APR × duration / 365
   - [ ] Total repayment calculated
   - [ ] Loan summary box displays with all values
8. [ ] "Request Loan" button works
9. Without wallet:
   - [ ] Button disabled or shows "Connect Wallet"
10. With wallet:
    - [ ] Click triggers `handleRequestLoan()`
    - [ ] Principal validation: must be ≤ max borrow
    - [ ] MetaMask popup appears
    - [ ] After approval: success message with tx hash
    - [ ] After 2s: redirect to `/markets`

## Web3 Integration Verification

### Wallet Connection
1. Look for wallet button in Navbar
2. [ ] Button visible and clickable
3. Click wallet button:
   - [ ] Modal or popup appears
   - [ ] Privy auth options show
   - [ ] Can connect MetaMask
   - [ ] Account address displays after connection
4. [ ] Disconnecting works
5. Check wagmi hooks:
   - [ ] `useAccount()` returns connected address
   - [ ] `useWalletClient()` available for signing

### Contract Interaction
1. Ensure MetaMask is on Sepolia testnet:
   - [ ] Network selector shows "Sepolia"
   - [ ] Account has Sepolia ETH (from faucet)
2. On create-market page:
   - [ ] Fill all form fields
   - [ ] Click "Deploy Market"
   - [ ] MetaMask popup appears with tx details
   - [ ] Approve transaction
   - [ ] Monitor MetaMask for confirmation
   - [ ] Transaction completes (1-3 minutes on testnet)
   - [ ] Success message shows tx hash
3. Verify transaction on Etherscan:
   - [ ] Go to https://sepolia.etherscan.io
   - [ ] Search tx hash
   - [ ] Confirm transaction is from your address
   - [ ] Confirm it called MarketFactory contract
   - [ ] Status shows "Success"

## Backend-Frontend Integration Verification

### API Proxy
Open DevTools → Network tab
1. Navigate to `/markets`
2. Check network requests:
   - [ ] Request URL shows `/api/v1/markets` (not backend URL)
   - [ ] Request goes through Next.js
   - [ ] Response is from backend
3. Check response headers:
   - [ ] Content-Type is application/json
   - [ ] Access-Control-Allow-Origin header present

### Data Flow
1. Navigate to `/markets`
2. [ ] Markets load in < 2 seconds
3. [ ] Each market card shows real data
4. [ ] Data matches backend database
5. Navigate to specific market's borrow page:
   - [ ] Market details load
   - [ ] Calculations use backend data (LTV, APR)
   - [ ] Liquidity amount reflects backend state

### Error Handling
1. Stop backend server
2. Refresh frontend:
   - [ ] Error message displays: "Failed to fetch markets"
   - [ ] No console errors
   - [ ] Page doesn't crash
3. Start backend again:
   - [ ] Data loads after refresh
   - [ ] Error clears

## Performance Verification

### Load Times
- [ ] Home page: < 1 second
- [ ] Markets page: < 2 seconds (with data)
- [ ] Create market page: < 1 second
- [ ] Borrow page: < 2 seconds
- [ ] Transaction submission: < 5 seconds (until MetaMask popup)

### Network Performance
- [ ] API calls completed in < 500ms
- [ ] Concurrent requests don't fail
- [ ] Rate limiting: 100 requests per 15 minutes

### Browser DevTools
1. Open DevTools → Console
   - [ ] No red errors
   - [ ] No unhandled promise rejections
   - [ ] TypeScript types check out

2. Open DevTools → Network
   - [ ] All requests successful (200-299 status)
   - [ ] No 404s or 500s
   - [ ] Payload sizes reasonable

3. Open DevTools → React Developer Tools
   - [ ] Component tree renders correctly
   - [ ] No extra re-renders
   - [ ] Hook states update properly

## Database Verification (Backend)

### Connection
```bash
npm run migrate
```
- [ ] Migrations complete successfully
- [ ] No connection errors

### Data Integrity
1. Check markets table:
```sql
SELECT COUNT(*) FROM "Market";
```
- [ ] Returns number ≥ 0

2. Check loans table:
```sql
SELECT COUNT(*) FROM "Loan";
```
- [ ] Returns number ≥ 0

### Indexer (If Running)
```bash
npm run indexer
```
- [ ] Indexer starts without errors
- [ ] Logs show block polling
- [ ] Events indexed to database

## Security Verification

### Frontend
- [ ] No hardcoded secrets in code
- [ ] Environment variables for sensitive data
- [ ] Input validation on forms
- [ ] XSS protection (React auto-escapes)

### Backend
- [ ] No hardcoded secrets in code
- [ ] JWT validation on protected routes
- [ ] CORS restricted to frontend origin
- [ ] Rate limiting enabled
- [ ] Input validation in controllers

### Web3
- [ ] Private keys never exposed
- [ ] MetaMask handles all signing
- [ ] ABI matches deployed contracts
- [ ] Contract addresses verified

## Final Acceptance Checklist

- [ ] All backend tests pass
- [ ] All frontend pages load without errors
- [ ] All API endpoints respond correctly
- [ ] Web3 transactions can be signed and submitted
- [ ] Data flows correctly from backend to frontend
- [ ] Error handling is comprehensive
- [ ] No console errors or warnings
- [ ] Performance is acceptable
- [ ] Ready for Sepolia testnet testing

## Ready for Production?

Before deploying to mainnet:
- [ ] All items above checked and passing
- [ ] Contracts audited by professional firm
- [ ] Load testing completed
- [ ] Security review completed
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures documented
- [ ] Incident response plan prepared

## Sign-Off

- Integration Date: [DATE]
- Tested By: [NAME]
- Verified By: [NAME]
- Ready for Testing: [YES/NO]
- Issues Found: [LIST ANY BLOCKING ISSUES]
