-- Enable Row Level Security on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "markets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;

-- "Zero Policy" Rule:
-- We do NOT create any policies. This defaults to "Deny All" for the 'anon' and 'authenticated' roles
-- (unless they are superusers or the table owner).
-- The application connects via 'service_role' (or a user with BYPASSRLS), so it will still work.
-- This effectively blocks any direct connection from the frontend (using anon key) from reading data.

-- RPC Lockdown (Example for generic functions, customize as needed)
-- REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public;
-- REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant usage back to service_role only if needed (usually implicit for owner)
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
