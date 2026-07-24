# OpenAsset Market Deployment Guide

This guide details how to deploy the OpenAsset Market protocol to production using **Railway** (Backend & Database) and **Vercel** (Frontend).

## Prerequisites

1.  **GitHub Account**: This repository should be pushed to your GitHub.
2.  **Railway Account**: [railway.app](https://railway.app) (Free tier available).
3.  **Vercel Account**: [vercel.com](https://vercel.com) (Free tier available).
4.  **RPC Provider**: Alchemy, Infura, or similar (for reliable blockchain connection).
5.  **Smart Contracts**: Deployed addresses (Factory contract, Adapter Registry).

---

## Part 1: Database & Backend (Railway)

### 1. Create Project & Database
1.  Log in to [Railway](https://railway.app).
2.  Click **"New Project"** -> **"Provision PostgreSQL"**.
3.  This will create a PostgreSQL database. Click on it to view **Variables**.
4.  Copy the `DATABASE_URL`.

### 2. Deploy Backend Service (Single Service)
All workers (API, Indexer, Monitor, Keeper) run in a **single process**. No separate services needed.

1.  In the same project, click **"New"** -> **"GitHub Repo"**.
2.  Select your `openasset` repository.
3.  Click **"Variables"** (Environment variables) and add:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_URL` | *[Paste from Step 1]* | Connection string |
| `JWT_SECRET` | *[Generate Random String]* | For auth tokens |
| `FRONTEND_URL` | *[Vercel URL from Part 2]* | CORS origin |

#### Multi-Chain RPC Configuration

| Variable | Value | Description |
| :--- | :--- | :--- |
| `RPC_URLS` | `11155111:https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` | Chain-specific RPC URLs |

Format: `chainId:url1,url2;chainId:url3,url4`
- Single chain: `11155111:https://rpc.sepolia.org,https://backup.sepolia.org`
- Multi-chain: `1:https://eth.llamarpc.com;11155111:https://rpc.sepolia.org;8453:https://base.llamarpc.com`

#### Contract Addresses

| Variable | Value | Description |
| :--- | :--- | :--- |
| `MARKET_FACTORY_ADDRESS` | `chainId:0x...` | Chain-prefixed format: `11155111:0x...;1:0x...` |
| `ADAPTER_REGISTRY_ADDRESS` | `chainId:0x...` | Chain-prefixed format |

#### Alert Services (Optional)

| Variable | Value | Description |
| :--- | :--- | :--- |
| `SENDGRID_API_KEY` | *[API Key]* | Email alerts |
| `TWILIO_ACCOUNT_SID` | *[SID]* | SMS alerts |
| `KEEPER_ENABLED` | `true` | Enable liquidation bot |

#### Keeper Service (Liquidation Execution)

| Variable | Value | Description |
| :--- | :--- | :--- |
| `KEEPER_ENABLED` | `false` | Set to `true` to enable automated liquidations |
| `KEEPER_PRIVATE_KEY` | *[Private Key]* | Signer wallet with gas funds |
| `KEEPER_CHAIN_ID` | `11155111` | Chain to run keeper on |
| `KEEPER_MAX_GAS_PRICE_GWEI` | `100` | Max gas price for keeper txs |
| `KEEPER_POLL_INTERVAL_MS` | `30000` | Poll interval (30s) |
| `KEEPER_MIN_HEALTH_FACTOR_BPS` | `12000` | Min health factor (1.2) |
| `KEEPER_BATCH_SIZE` | `10` | Max liquidations per batch |

#### Alert Deduplication (Configurable)

| Variable | Value | Description |
| :--- | :--- | :--- |
| `ALERT_DEDUP_DEFAULT_WINDOW` | `3600` | Default 1 hour window |
| `ALERT_DEDUP_WINDOWS` | `{"HEALTH_FACTOR": 1800}` | Per-type windows (JSON) |

4.  Click **"Settings"**:
    *   **Root Directory**: `backend`
    *   **Build Command**: `npm run build`
    *   **Start Command**: `npm run start`
    *   **Watch Paths**: `backend/**`
    *   **Health Check Path**: `/health`

5.  Railway will automatically build and deploy. Only **1 service** is needed (not 3).

6.  Once live, copy the **Service Domain** (e.g., `https://backend-production.up.railway.app`).

---

## Part 2: Frontend (Vercel)

### 1. Create Project
1.  Log in to [Vercel](https://vercel.com).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import the `openasset` repository.

### 2. Configuration
1.  **Framework Preset**: Next.js (Default).
2.  **Root Directory**: Click "Edit" and select `web`.
3.  **Environment Variables**:

    | Variable | Value | Description |
    | :--- | :--- | :--- |
    | `NEXT_PUBLIC_API_URL` | `https://[YOUR_RAILWAY_URL]/api/v1` | Backend API URL |
    | `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | *[Optional]* | For WalletConnect |

4.  Click **"Deploy"**.

---

## Part 3: Final Configuration

1.  **Update Backend CORS**:
    *   Go back to your **Railway API Server** service.
    *   Update the `FRONTEND_URL` variable with your new Vercel domain (e.g., `https://openasset.vercel.app`).
    *   Redeploy.

2.  **Verify Deployment**:
    *   Visit `https://[YOUR_RAILWAY_URL]/health` — should return `{"status":"ok","workers":{...}}`
    *   Visit your Vercel URL. Open Developer Tools (F12) -> Network.
    *   Refresh. Ensure requests to `/api/v1/...` are successful (200 OK).

---

## Troubleshooting

*   **Database Connection Error**: Ensure `DATABASE_URL` matches the PostgreSQL service connection string.
*   **Build Fails**: Check `backend/package.json` to ensure `prisma generate` runs before `tsc`.
*   **CORS Errors**: Ensure `FRONTEND_URL` matches the Vercel domain exactly.
*   **Worker Health**: Visit `/health` endpoint to see individual worker status.
*   **Keeper Not Running**: Verify `KEEPER_ENABLED=true` and `KEEPER_PRIVATE_KEY` is set.
*   **Alert Deduplication**: Configure `ALERT_DEDUP_WINDOWS` JSON to control alert frequency.