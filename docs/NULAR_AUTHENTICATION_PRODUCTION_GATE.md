# NULAR — Authentication Production Integrity Gate

**Project:** NULAR — The Living World of Nusantara
**Branch:** `feat/nular-world-experience`
**Date:** 2026-11-21

---

## 1. Fail-Closed Production Enforcement (`api/auth.js`)

Production authentication **no longer falls back silently to ephemeral in-memory or local filesystem storage**:

1. **Mandatory Production Session Secret:** When `VERCEL_ENV === 'production'`, `NODE_ENV === 'production'`, or deployed on Vercel non-development, `NULAR_SESSION_SECRET` (or `RAGAMARA_SESSION_SECRET` / `SESSION_SECRET`) with length `>= 32` characters is mandatory. If absent or too short, persistence-dependent auth endpoints return HTTP `503` (`code: 'SESSION_SECRET_MISSING'`) and `verifySessionToken()` returns `null`.
2. **Mandatory Complete Production Supabase Configuration:** Both a valid `https://` `SUPABASE_URL` AND `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) are required in production.
   - Missing both → HTTP `503` (`code: 'AUTH_STORAGE_UNAVAILABLE'`).
   - Only one present → HTTP `503` (`code: 'SUPABASE_CONFIG_INCOMPLETE'`).
   - Local filesystem persistence (`.nular-local-data/auth-store.json`) is strictly rejected in production.
3. **Four Distinct Diagnostic Storage Modes (`GET /api/auth?action=providers`):**
   - `durable_production_supabase` — Production-ready Supabase URL + key configured.
   - `local_dev_persistent` — Explicitly identified local development mode backed by `.nular-local-data/auth-store.json` (`0600`, `.gitignore`d).
   - `ephemeral_test_fixture` — Explicit non-production test fixture (`NULAR_AUTH_TEST_FIXTURE=1`).
   - `unconfigured_fail_closed` — Production (or unwritable environment) without durable persistence.
4. **Session Revocation & Rate-Limit Persistence:**
   - Every signed session token carries a unique `jti`. Logout and `DELETE /api/auth` immediately revoke the `jti` (persisted in local dev) so replayed cookies are rejected even before `exp`.
   - Failed login attempts (`5` attempts per `15` min → HTTP `429` + `Retry-After`) are persisted to `.nular-local-data/auth-store.json` in local dev so process restarts cannot trivially reset rate limits.
   - Zero secrets, keys, or password hashes are ever exposed in diagnostics or API responses.

---

## 2. Automated Integrity Verification

Verified via [tests/test_auth_production_integrity.mjs](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/test_auth_production_integrity.mjs) (9/9 scenarios) and [tests/test_auth_hardening.mjs](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/test_auth_hardening.mjs) (6/6 assertions):

- Production with missing session secret → `503 SESSION_SECRET_MISSING`
- Production with missing Supabase variables → `503 AUTH_STORAGE_UNAVAILABLE` & rejects filesystem fallback
- Production with incomplete Supabase variables → `503 SUPABASE_CONFIG_INCOMPLETE`
- Ephemeral test fixture opt-in → `storageMode: 'ephemeral_test_fixture'`
- Local development persistent storage across reload & restart → PASS
- Cross-restart login rate-limit persistence (`429`) → PASS
- Invalid / tampered session cookie rejection → PASS
- Logout & account deletion JTI revocation → PASS
- Unconfigured `verify-email` returns honest `503` → PASS

---

## 3. Honest Production Readiness Status & Owner Action Checklist

**Current Status:** **NOT YET PRODUCTION-ENABLED FOR CLOUD ACCOUNTS** (fail-closed safety gate is implemented and verified; Guest Mode remains 100% functional).

To enable durable production authentication across independent serverless instances, the project owner must configure these Vercel environment variables:

1. `NULAR_SESSION_SECRET` — Cryptographically random string (`>= 32` characters, e.g. `openssl rand -hex 32`).
2. `SUPABASE_URL` — Project URL (`https://<project-ref>.supabase.co`).
3. `SUPABASE_SERVICE_ROLE_KEY` (recommended for server-side auth/progress tables) or `SUPABASE_ANON_KEY`.
4. *(Optional)* Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
5. *(Optional)* SMS OTP: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
6. *(Optional)* Transactional Email: `SMTP_HOST` or `RESEND_API_KEY`.
