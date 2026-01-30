# Red Chips Deployment Guide

This guide details how to deploy the Red Chips protocol to production using **Railway** (Backend & Database) and **Vercel** (Frontend).

## Prerequisites

1.  **GitHub Account**: This repository should be pushed to your GitHub.
2.  **Railway Account**: [railway.app](https://railway.app) (Free tier available).
3.  **Vercel Account**: [vercel.com](https://vercel.com) (Free tier available).
4.  **RPC Provider**: Alchemy, Infura, or similar (for reliable blockchain connection).
5.  **Smart Contracts**: Deployed addresses (Factory contract).

---

## Part 1: Database & Backend (Railway)

### 1. Create Project & Database
1.  Log in to [Railway](https://railway.app).
2.  Click **"New Project"** -> **"Provision PostgreSQL"**.
3.  This will create a PostgreSQL database. Click on it to view **Variables**.
4.  Copy the `DATABASE_URL`.

### 2. Deploy API Server
1.  In the same project, click **"New"** -> **"GitHub Repo"**.
2.  Select your `redchips` repository.
3.  Click **"Variables"** (Environment variables) and add:

    | Variable | Value | Description |
    | :--- | :--- | :--- |
    | `NODE_ENV` | `production` | Production mode |
    | `DATABASE_URL` | *[Paste from Step 1]* | Connection string |
    | `JWT_SECRET` | *[Generate Random String]* | For auth tokens |
    | `RPC_URLS` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` | Comma-separated RPCs |
    | `MARKET_FACTORY_ADDRESS` | `0x...` | Deployed Factory Address |
    | `FRONTEND_URL` | *[Leave empty for now]* | Add Vercel URL later |

4.  Click **"Settings"**:
    *   **Root Directory**: `backend`
    *   **Build Command**: `npm run build`
    *   **Start Command**: `npm run start`
    *   **Watch Paths**: `backend/**`
5.  Railway will automatically build and deploy.
6.  Once live, copy the **Service Domain** (e.g., `https://backend-production.up.railway.app`).

### 3. Deploy Workers (Indexer & Monitor)
To run the background workers, we deploy the same repository 2 more times (or use Railway's "Add Service" feature) but with different start commands.

**Service: Event Indexer**
1.  Add a new service from the same GitHub repo.
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Start Command**: `node dist/indexerWorker.js`
3.  **Variables**: Copy all variables from the API Server service.

**Service: Monitoring Worker**
1.  Add a new service from the same GitHub repo.
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Start Command**: `node dist/monitoringWorker.js`
3.  **Variables**: Copy all variables from the API Server service.

---

## Part 2: Frontend (Vercel)

### 1. Create Project
1.  Log in to [Vercel](https://vercel.com).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import the `redchips` repository.

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
    *   Update the `FRONTEND_URL` variable with your new Vercel domain (e.g., `https://redchips.vercel.app`).
    *   Redeploy the API Server.

2.  **Verify Deployment**:
    *   Visit your Vercel URL.
    *   Open Developer Tools (F12) -> Network.
    *   Refresh. Ensure requests to `/api/v1/users/...` or `/api/v1/markets` are successful (200 OK).

---

## Troubleshooting

*   **Database Connection Error**: Ensure `DATABASE_URL` in Railway variables matches the PostgreSQL service connection string.
*   **Build Fails**: Check `backend/package.json` to ensure `prisma generate` runs before `tsc`.
*   **CORS Errors**: Ensure `FRONTEND_URL` in Railway matches the Vercel domain exactly (no trailing slash usually, unless your code expects it).
