-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ERC20', 'ERC721', 'ERC1155');

-- CreateEnum
CREATE TYPE "OracleType" AS ENUM ('UNISWAP_V3_TWAP', 'CHAINLINK', 'MANUAL');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('ACTIVE', 'PAUSED_VOLATILITY', 'PAUSED_MANUAL');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'REPAID', 'LIQUIDATED', 'GRACE_PERIOD');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HEALTH_FACTOR', 'LIQUIDATION_RISK', 'MARKET_PAUSED', 'LOAN_EXPIRING');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('WATCH', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "address" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "sms" TEXT,
    "smsVerified" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushToken" TEXT,
    "emailAllAlerts" BOOLEAN NOT NULL DEFAULT false,
    "nonce" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lpAddress" TEXT NOT NULL,
    "collateralAsset" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "ltvBasisPoints" INTEGER NOT NULL,
    "aprBasisPoints" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "gracePeriodHours" INTEGER NOT NULL,
    "enableHealthFactor" BOOLEAN NOT NULL,
    "healthFactorThreshold" INTEGER,
    "oracleType" "OracleType" NOT NULL,
    "primaryOracle" TEXT NOT NULL,
    "twapPeriodSeconds" INTEGER NOT NULL,
    "circuitBreakerEnabled" BOOLEAN NOT NULL,
    "pauseThresholdBps" INTEGER,
    "lookbackPeriodSeconds" INTEGER,
    "resumeThresholdBps" INTEGER,
    "cooldownSeconds" INTEGER,
    "status" "MarketStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pausedAt" TIMESTAMP(3),
    "totalLiquidity" TEXT NOT NULL DEFAULT '0',
    "availableLiquidity" TEXT NOT NULL DEFAULT '0',
    "totalBorrowed" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contractLoanId" TEXT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "borrowerAddress" TEXT NOT NULL,
    "collateralAmount" TEXT NOT NULL DEFAULT '0',
    "tokenId" TEXT,
    "principal" TEXT NOT NULL DEFAULT '0',
    "repaymentAmount" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "expiryTime" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "healthFactor" DOUBLE PRECISION,
    "lastHealthCheck" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "repaidAt" TIMESTAMP(3),
    "liquidatedAt" TIMESTAMP(3),

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidity_positions" (
    "marketAddress" TEXT NOT NULL,
    "lpAddress" TEXT NOT NULL,
    "lpTokenBalance" BIGINT NOT NULL DEFAULT 0,
    "stablecoinDeposited" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidity_positions_pkey" PRIMARY KEY ("marketAddress","lpAddress")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT,
    "type" "AlertType" NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentVia" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_address_key" ON "markets"("address");

-- CreateIndex
CREATE INDEX "markets_lpAddress_idx" ON "markets"("lpAddress");

-- CreateIndex
CREATE INDEX "markets_collateralAsset_idx" ON "markets"("collateralAsset");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "loans_address_key" ON "loans"("address");

-- CreateIndex
CREATE INDEX "loans_borrowerAddress_idx" ON "loans"("borrowerAddress");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "loans_marketAddress_contractLoanId_key" ON "loans"("marketAddress", "contractLoanId");

-- CreateIndex
CREATE INDEX "price_history_marketAddress_timestamp_idx" ON "price_history"("marketAddress", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_userId_idx" ON "alerts"("userId");

-- CreateIndex
CREATE INDEX "verification_codes_address_type_idx" ON "verification_codes"("address", "type");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_lpAddress_fkey" FOREIGN KEY ("lpAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_marketAddress_fkey" FOREIGN KEY ("marketAddress") REFERENCES "markets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrowerAddress_fkey" FOREIGN KEY ("borrowerAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_marketAddress_fkey" FOREIGN KEY ("marketAddress") REFERENCES "markets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

