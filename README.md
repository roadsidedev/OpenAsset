# OpenAsset Market: Permissionless Asset Lending Infrastructure

OpenAsset Market is a decentralized, permissionless lending protocol that enables anyone to launch an isolated lending market for any on-chain asset (ERC20, ERC721, ERC1155). It empowers communities, DAOs, and individual LPs to provide liquidity and set their own risk parameters, bringing DeFi utility to the 95% of assets currently excluded from traditional platforms like Aave or Compound.

## 🚀 Key Features

- **Permissionless Market Creation**: Deploy an isolated lending market in minutes without governance approval.
- **Any Asset Support**: Support for long-tail tokens, gaming assets, and NFT collections.
- **Isolated Risk**: Each market is independent, preventing contagion risks across the platform.
- **LP Control**: Liquidity providers define LTV, APR, duration, and liquidation rules.
- **Uniswap V3 TWAP Integration**: Flash-loan resistant pricing using time-weighted average prices.
- **Automated Circuit Breakers**: Built-in volatility protection that pauses markets during extreme price swings.
- **Gradual Liquidation**: A fair liquidation model that only seizes the necessary collateral to cover debt plus a penalty.

## 🛠 Tech Stack

- **Smart Contracts**: Solidity 0.8.20+, Hardhat, OpenZeppelin.
- **Backend**: Node.js, TypeScript, Express, Prisma (PostgreSQL), Redis.
- **Frontend**: Next.js 16, Tailwind CSS, shadcn/ui, wagmi/viem.
- **Oracles**: Uniswap V3 TWAP, Chainlink (fallback).
- **Notifications**: SendGrid (Email), Twilio (SMS), Firebase (Push).

## 📂 Project Structure

```text
openasset/
├── contracts/        # Smart contracts (Hardhat project)
├── backend/          # Node.js API and worker services
├── web/              # Next.js frontend application
└── .agent/           # AI agent configuration and skills
```

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Docker (optional, for local database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/roadsidedev/openasset.git
   cd openasset
   ```

2. Install dependencies for all components:
   ```bash
   # Root (if package.json exists) or individually:
   cd backend && npm install
   cd ../contracts && npm install
   cd ../web && npm install
   ```

### Running the Project

#### 1. Smart Contracts
```bash
cd contracts
npx hardhat compile
npx hardhat test      # Run the test suite
```

#### 2. Backend
1. Set up environment variables in `backend/.env` (use `.env.example` as a template).
2. Run Prisma migrations:
   ```bash
   npx prisma generate
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Start workers (optional):
   ```bash
   npm run indexer    # Event indexer
   npm run monitor    # Health & Volatility monitor
   ```

#### 3. Web Frontend
```bash
cd web
npm run dev
```

## 🏗 Architecture

### Isolated Markets
Unlike shared-pool protocols, OpenAsset Market uses a factory pattern to deploy unique `LendingMarket` contracts for each asset pair. This ensures that a bad debt event in one market cannot affect others.

### TWAP Oracle System
To prevent price manipulation, OpenAsset Market consults Uniswap V3 pools to calculate a Time-Weighted Average Price (TWAP) over a configurable window (e.g., 30 minutes). This makes the protocol highly resistant to flash loan attacks.

### Circuit Breaker
The `monitoringWorker` tracks volatility in real-time. If an asset's price moves beyond the LP-defined threshold within the lookback window, the market automatically pauses new loan requests while still allowing repayments and liquidations.

## 🛡 Security

- **Backend-First Model**: Strict enforcement of business logic on the server side. Frontend is a view layer only.
- **Zero RLS Policy**: Database access is restricted to the service role within secure backend environments.
- **Input Validation**: All API inputs are validated using Zod schemas.
- **Checks-Effects-Interactions**: Smart contracts strictly follow CEI patterns to prevent reentrancy.

## 🗺 Roadmap

- **Phase 1**: Core Smart Contracts & TWAP Integration (In Progress)
- **Phase 2**: Backend Infrastructure & Indexing
- **Phase 3**: Frontend Dashboards & Analytics
- **Phase 4**: Security Audits & Testnet Deployment
- **Phase 5**: Mainnet Launch (Limited)


