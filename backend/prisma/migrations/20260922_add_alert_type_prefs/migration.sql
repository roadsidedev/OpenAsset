-- Per-alert-bucket delivery preferences for the Account "Config & Rules" toggles.
-- Defaults true: existing users keep current delivery behavior; toggles can opt out.
ALTER TABLE "users" ADD COLUMN "alertLiquidation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "alertMarketPaused" BOOLEAN NOT NULL DEFAULT true;
