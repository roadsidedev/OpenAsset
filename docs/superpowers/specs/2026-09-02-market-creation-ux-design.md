# Market Creation UX Overhaul + Unified Auth/Chain Layer

**Date:** 2026-09-02
**Status:** Approved (user approved in chat)

## Problem

1. Market creation is plumbing-first: users must pick an asset adapter (ERC20/ERC721/B20) before choosing collateral. B20/Robinhood adapters are hidden on unsupported chains with no asset previews.
2. Two unreconciled identity systems: Privy auth (JWT via `AuthContext`) and wagmi tx capability (`useAccount`). Social-login users see "Connect Wallet" CTAs and "unsupported chain" defaults.
3. Zero chain-switching logic anywhere in the app. Writes target the wallet's current chain, ignoring `market.chainId`.
4. No client-side minimum-liquidity validation. On-chain, `MarketFactory.sol:40` defines `MIN_LIQUIDITY_USD = 1000e18` ($1,000 minimum, validated on net liquidity after 0.5% creation fee); the deployed `MarketFactoryV2.sol` only enforces `initialLiquidity > 0`, so the $1,000 protocol minimum must be enforced client-side.
5. No transaction trail outside backend indexer-derived activity; no success celebration.

## Design

### Principles

- Asset-first, plumbing-second: users pick "what to lend against"; adapter/chain/compliance auto-resolve.
- The system does the bookkeeping: chain, adapter stack resolved automatically.
- One session, no dead ends: Privy social and external wallets are the same citizen.
- Fail open to action: every blocked state has a one-click resolution.

### A. Asset-first market creation (step 1)

- Search-first entry (`AssetSearchPicker`) over a merged catalog (`lib/assetCatalog.ts`): B20 stocks, Robinhood stocks, curated ERC20s, NFT collections, custom address.
- Selecting an asset auto-resolves adapter stack (existing `getSuggestedAdaptersForB20`/`getSuggestedAdaptersForRobinhood` + ERC20/ERC721 defaults) and chain (via orchestrator).
- Advanced mode: manual adapter selection with all four asset-adapter cards always visible (ERC20, ERC721, B20 Stocks, Robinhood Stocks), each with an inline supported-asset preview strip and a chain-availability chip. Clicking a card on the wrong chain triggers the chain-switch flow.
- ERC721 gets a curated NFT fallback so previews are not empty.

### B. Unified session layer

- `hooks/useSession.ts`: reconciles Privy auth and wagmi into `{ ready, isAuthenticated, address, walletType: 'embedded'|'external'|null, chainId }`.
- Auto-bridge: Privy `ready && authenticated` + no wagmi account → auto-connect the Privy wagmi connector.
- Works in no-Privy fallback mode (pure wagmi).

### C. Dynamic chain orchestration

- `hooks/useChainOrchestrator.ts` → `ensureChain(target)`: silent `switchChainAsync` for embedded wallets; "needs-user" state + `ChainSwitchBanner` one-click UI for external wallets.
- Triggers: asset/adapter selection, market page mount (`market.chainId`), pre-write check inside `useContractInteraction` (typed `ChainMismatchError`).

### D. Live market / borrow fix

- CTA is state-driven: signed in + connected + on `market.chainId` → enabled; wrong chain → switch prompt (silent for embedded); not signed in → sign in.
- Write path respects `market.chainId` via `ensureChain(market.chainId)`.

### E. Minimum supply validation

- `MIN_INITIAL_LIQUIDITY_USD = 1000` (from `MarketFactory.sol MIN_LIQUIDITY_USD = 1000e18`, normalized; V2 deployed factories only check `> 0`, so the $1,000 protocol minimum is enforced client-side).
- Validated in step 7 (inline) and in `validateConfig()` pre-deploy, using lending-asset decimals.

### F. Transaction trail + confetti

- `store/useTxTrail.ts`: localStorage-persisted zustand store recording user txs (`MARKET_CREATED`, `LOAN_REQUESTED`, `LOAN_REPAID`, `LIQUIDITY_DEPOSITED`) with txHash, chainId, status.
- `useActivity` output merged with local trail (deduped by txHash) in the account "Activity" tab; local events render instantly, backend indexer events take over.
- `components/Confetti.tsx`: zero-dependency canvas confetti burst on successful market creation.

## Files

**New:** `hooks/useSession.ts`, `hooks/useChainOrchestrator.ts`, `components/ChainSwitchBanner.tsx`, `components/Confetti.tsx`, `components/tokens/AssetSearchPicker.tsx`, `lib/assetCatalog.ts`, `lib/minDeposit.ts`, `store/useTxTrail.ts`, `tests/asset-catalog.test.ts`.

**Modified:** `create-market/page.tsx` (step 1 + chain chip + min-deposit + confetti + tx recording), `markets/[marketId]/page.tsx`, `repay/[loanId]/page.tsx`, `hooks/useContractInteraction.ts`, `lib/supportedAssets.ts`, `hooks/useActivity.ts`, `app/account/page.tsx`.

## Out of scope

Steps 2–8 restructuring, backend API changes, contract changes/redeploys.
