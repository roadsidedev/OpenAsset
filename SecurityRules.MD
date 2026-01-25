# SECURITY & ARCHITECTURE RULES

# This project enforces a STRICT "Backend-First" security model.

# AI MUST follow these constraints to prevent Vibe Coding vulnerabilities.

# 1. ARCHITECTURE: BACKEND-ONLY DATA ACCESS

- **NEVER** write business logic in Client Components.
- **NEVER** use `supabase-js` client-side methods (`.select`, `.insert`, `.update`, `.delete`) directly in the frontend.
- **ALWAYS** use Next.js Server Actions, API Routes, or Supabase Edge Functions for ALL data access (Read & Write).
- The Frontend is a View Layer only. It speaks to APIs, not the Database.

# 2. DATABASE & RLS (Supabase) - THE "ZERO POLICY" RULE

- **RLS IS MANDATORY:** Enable Row Level Security on every table immediately.
- **NO POLICIES ALLOWED:** Do NOT create any RLS policies (e.g., `create policy...`).
  - _Context:_ Enabling RLS without policies acts as a "Deny All" firewall.
  - _Effect:_ The `anon` key (Client) will have ZERO access to data.
- **SERVICE ROLE ONLY:** All data interaction must occur via the `service_role` key inside Edge Functions or Server Actions (which bypasses RLS).

# 3. STORAGE SECURITY

- **NO PUBLIC BUCKETS:** Never set `public: true` for storage buckets.
- **UUID FILENAMES:** Always rename files to a `crypto.randomUUID()` string before uploading to prevent enumeration attacks.
- **SIGNED URLS:** Always use `createSignedUrl` for retrieving files. Never expose the direct path.

# 4. PAYMENTS & WEBHOOKS

- **VERIFY SIGNATURES:** When writing a webhook handler (Stripe/LemonSqueezy):
  - **NEVER** trust `req.body` directly.
  - **ALWAYS** use the provider's SDK to verify the signature (e.g., `stripe.webhooks.constructEvent`).
  - If verification fails, return `400` immediately.

# 5. ENVIRONMENT VARIABLES

- **STRICT HYGIENE:** Never hardcode secrets.
- **NO COMMIT:** If you see a secret in the code, replace it with `process.env.VAR_NAME` and warn the user.
- **VALIDATION:** Ensure environment variables are validated (using Zod or similar) at build time.

# 6. INPUT VALIDATION & RATE LIMITING

- **TRUST NO ONE:** Validate ALL inputs in Server Actions/API Routes using Zod.
- **RATE LIMITS:** Suggest adding rate limiting (e.g., `upstash/ratelimit`) to all mutation endpoints, especially auth and payment routes.

# 7. RPC LOCKDOWN

- **REVOKE PUBLIC ACCESS:** When creating a Postgres function (`CREATE FUNCTION`):
  - ALWAYS immediately run: `REVOKE EXECUTE ON FUNCTION function_name FROM public;`
  - ALWAYS immediately run: `REVOKE EXECUTE ON FUNCTION function_name FROM anon;`
  - Explicitly grant access only to `service_role`.

---

# COMPLIANCE CHECK

Before generating code, ask yourself: "Is this code asking the Frontend to talk to the Database?"
If YES -> REJECT IT. Write a Backend API/Action instead.
