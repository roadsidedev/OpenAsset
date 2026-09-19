-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nonceExpiresAt" TIMESTAMP(3);
