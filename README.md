# OpenAsset

**OpenAsset lets anyone create an isolated lending market for almost any asset with measurable value.**

Most lending protocols only accept a small, governance-approved list of assets. Because they pool everyone's liquidity, one bad collateral decision puts every depositor at risk.

OpenAsset does the opposite. Anyone can launch a fully isolated market — crypto, NFTs, tokenized real-world assets — and choose pricing, compliance, and liquidation logic per market. No listing committee. No shared risk.

This is not “a better Aave.” It is infrastructure other lending markets get built on.

## What it is

- **Permissionless market creation** — deploy an isolated lending market without a governance vote
- **Isolated risk** — each market has its own liquidity, collateral, and rules; one failure cannot drain another
- **Adapters** — custody, pricing, compliance, liquidation, and position representation are swappable modules. New asset classes are supported by writing an adapter, not by rewriting the core
- **Verified, not blindly trusted** — the engine independently checks adapter reports (balances, price sanity, fail-closed compliance)
- **Non-custodial** — collateral sits in market-specific contracts, not with OpenAsset
- **EVM-first** — currently lending in stablecoins (a stated boundary, not an oversight)

## What it is not

- Not a shared liquidity pool
- Not a claim that every asset is supported today — say *the architecture supports this* until the adapter is live
- Not a token or points program
- Not a guarantor of RWA / issuer solvency — that risk sits with whoever chose the collateral

## Who it is for

| Audience | What they do |
|---|---|
| **Market creators / LPs** | Launch a market for an asset they understand; set terms; keep yield; never inherit someone else's collateral risk |
| **Adapter developers** | Write to a Solidity interface; extend coverage without touching the core |
| **Borrowers** | Borrow against a gaming token, NFT, or tokenized stock without selling it |
| **RWA / compliance partners** | Use compliance as a first-class module, not a bolt-on |

## Repository

```text
openasset/
├── contracts/        # Solidity (Hardhat)
├── backend/          # Node.js API, indexer, monitor
├── web/              # Next.js app + docs
└── docs/             # Protocol notes, deployment manifests, marketing
```

**Stack:** Solidity 0.8.20+, Hardhat, OpenZeppelin · Node.js, TypeScript, Express, Prisma, Redis · Next.js 16, Tailwind, wagmi/viem · Uniswap V3 TWAP and Chainlink oracles.

## Getting started

**Prerequisites:** Node.js 18+, PostgreSQL, Docker optional.

```bash
git clone https://github.com/roadsidedev/openasset.git
cd openasset

cd backend && npm install
cd ../contracts && npm install
cd ../web && npm install
```

**Contracts**

```bash
cd contracts
npx hardhat compile
npx hardhat test
```

**Backend** — copy `backend/.env.example` to `.env`, then:

```bash
cd backend
npx prisma generate
npm run dev
# optional: npm run indexer && npm run monitor
```

**Web**

```bash
cd web
npm run dev
```

App: create-market, markets, adapters, docs. Marketing story lives on `/`.

## Architecture (short)

**Isolated markets.** A factory deploys a dedicated `LendingMarket` per market. Bad debt in one market cannot contagion into others.

**Adapters.** Five interfaces — Asset, Oracle, Compliance, Liquidation, Position. Reference implementations exist for ERC-20, ERC-721, Uniswap V3 TWAP, Chainlink, DEX-swap and NFT-auction liquidation. RWA-oriented modules (session-aware equity feeds, ERC-3643, issuer-redemption liquidation) are architecture-ready; do not claim them live unless the deployment manifest says so.

**Oracles & circuit breaker.** TWAP pricing resists flash-loan manipulation. If price moves past the creator's threshold, new borrows pause; repayments and liquidations continue.

**Liquidation.** Adapters must return unused surplus. The interface requires it.

## Docs & claims

- Product docs: `web/content/` (served at `/docs`)
- Adapter developers: `docs/ADAPTER_DEVELOPER.md`
- Deployments: `docs/deployment-manifests/` — check before saying “live on X”
- Messaging: `docs/marketing/messaging-framework.md`
- Do not write “audited” unless a named audit exists. Do not write “adapter ecosystem” until a third-party adapter exists.

## License / security

Business logic is enforced on the backend and in contracts (CEI, Zod validation, service-role DB access). Frontend is a view layer.

If you are reviewing the protocol, start with `/docs` and the adapter spec — not this README's feature list.
