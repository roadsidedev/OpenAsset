# Security Hardening Report

We have applied a comprehensive security hardening pass based on `SecurityRules.MD`.

## Applied Changes

### 1. Network Security (Backend)
- **Rate Limiting:** Implemented `express-rate-limit` (100 reqs / 15 min).
- **CORS:** Restricted to `http://localhost:3000` (Frontend). Access from other origins is now blocked.
- **Helmet:** Confirmed usage for secure HTTP headers.

### 2. Input Validation & File Handling
- **Input Validation:** Verified strict `zod` schemas in controllers.
- **File Security:** Modified `PushService.ts` to allow passing the Firebase Service Account as an environment variable (`FIREBASE_SERVICE_ACCOUNT_KEY` content) instead of requiring a file on disk. This prevents potential path traversal or missing file issues in production.

### 3. Frontend Architecture
- **API Client:** Created `web/src/lib/api.ts` to ensure the frontend communicates *only* via the backend API.
- **No DB Access:** Verified no usage of `supabase-js` or direct DB calls in the frontend.

## Required Manual Actions (Database)

Since we cannot directly execute SQL against your production database, we created a SQL script to enforce the **"RLS IS MANDATORY"** and **"RPC LOCKDOWN"** rules.

**Action Required:**
Please execute the following SQL script against your Postgres database:
`backend/prisma/security_hardening.sql`

This script will:
1. Enable Row Level Security (RLS) on all tables.
2. Ensure no policies exist (effectively "Deny All" for direct connections).
3. The Backend (Prisma) will continues to work as it connects with a privileged user.

## Verification
You can run the security verification script to test the network defenses:
```bash
cd backend
npx ts-node scripts/verify-security.ts
```
