-- Add provider identity for provider-qualified market discovery.
ALTER TABLE "markets" ADD COLUMN "providerId" TEXT;

CREATE INDEX "markets_providerId_idx" ON "markets"("providerId");
