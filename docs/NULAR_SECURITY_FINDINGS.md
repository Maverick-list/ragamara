# NULAR — Independent Security Findings Report

**Audit Type:** Read-Only Independent Security Audit
**Repository:** `Maverick-list/ragamara`
**Branch:** `feat/nular-world-experience`
**Audited HEAD:** `4b3a6dce583b14d85e48f7ea231691c98c47a5cd` (`4b3a6dc`)
**Production `main` Baseline:** `1a110b00c0d182e72e9eddb79a097a1dccbd550c` (`1a110b0`)
**Date:** 2026-11-21

---

## Severity Summary

| Severity | Count | Status |
|---|---:|---|
| **CRITICAL** | 2 | Release Blocker for Production Accounts |
| **HIGH** | 5 | Release Blocker for External Providers / Multi-Instance Security |
| **MEDIUM** | 5 | Recommended Pre-Launch Hardening |
| **LOW** | 2 | Hygiene / Defense-in-Depth |

---

## Detailed Findings

### SEC-001 [CRITICAL] — No Actual Supabase Persistence Layer Wired in `api/auth.js`
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 28–34, 41–88, 495–598)
- **Evidence:** When `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NULAR_SESSION_SECRET` are all set in production, `getRuntimeConfig()` sets `storageMode = 'durable_production_supabase'` and `getPersistenceGateError()` returns `null`. However, `api/auth.js` contains **zero Supabase SDK or REST calls**. Every `signup`, `login`, `profile-update`, `phone-verify`, `logout`, and `DELETE` still reads and writes only to per-instance in-memory `Map` objects (`usersByEmail`, `usersById`, `usersByPhone`, `loginFailures`, `revokedSessions`).
- **Impact:** Configuring production Supabase environment variables bypasses the fail-closed `503` gate while silently losing all user accounts, revoked sessions, and rate-limit state across serverless cold starts and independent instances.
- **Recommended Remediation:** Implement real Supabase Auth / PostgreSQL REST queries in `api/auth.js` (or keep `getPersistenceGateError()` failing closed with `501/503` until the Supabase adapter is implemented and integration-tested against a real Supabase project).

### SEC-002 [CRITICAL] — `api/progress.js` Uses Ephemeral In-Memory Storage & Allows Arbitrary `guestId` Impersonation
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/progress.js` (lines 43–51, 84–151), `api/leaderboard.js` (line 34)
- **Evidence:**
  1. `playerProgressStore = new Map()` is purely in-memory with no Supabase persistence, even though `api/leaderboard.js:34` reports `source: process.env.SUPABASE_URL ? 'supabase' : 'session_verified'`.
  2. For unauthenticated requests, `getActorKey()` trusts any caller-supplied `body.guestId` or `x-nular-guest` header. Any unauthenticated client can read or mutate another guest's progress by guessing/supplying their `guestId` (and `exhibition.html` defaults to a static `'guest-exhibition'` key when `nular_guest_id` is absent).
- **Impact:** Progress and leaderboard state are non-durable across serverless instances, and guest progress keys are trivially spoofable.
- **Recommended Remediation:** Persist authenticated user XP events to `public.player_xp_events` in Supabase; issue HMAC-signed guest cookies (or restrict server-side leaderboard aggregation to authenticated accounts only).

### SEC-003 [HIGH] — Non-Distributed Rate Limiting & JTI Revocation Across Serverless Instances
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 32–34, 240–254, 560–588)
- **Evidence:** `loginFailures` and `revokedSessions` are persisted to `.nular-local-data/auth-store.json` ONLY in local development. In production serverless deployments, they exist only in per-instance RAM.
- **Impact:** An attacker can bypass brute-force login lockouts and replay revoked/logged-out session cookies whenever requests hit a different serverless instance or after a cold start.
- **Recommended Remediation:** Back rate-limit counters and revoked JTIs with a distributed store (Upstash Redis or Supabase PostgreSQL tables with TTL cleanup).

### SEC-004 [HIGH] — Incomplete Supabase RLS Policies & Unprotected `public.users` Table in Migration
- **Verification Basis:** Independently verified via direct SQL inspection.
- **Affected Files:** `db/migrations/001_nular_cultural_world.sql` (lines 8–30, 215–229)
- **Evidence:**
  1. `public.users` (containing `email` and `password_hash`) does **not** have `ENABLE ROW LEVEL SECURITY`.
  2. `mission_progress`, `player_achievements`, `player_collections`, `daily_streaks`, and `language_preferences` enable RLS with **no `CREATE POLICY` rules**.
  3. `CREATE POLICY "Owner updates own profile" ON public.player_profiles FOR UPDATE USING (auth.uid() = user_id)` does not restrict updates to non-authoritative columns (`total_xp`, `current_level`, `missions_completed` could be modified directly if `SUPABASE_ANON_KEY` is used client-side).
- **Recommended Remediation:** Enable RLS on `public.users` (deny all anon/authenticated access), define explicit owner policies for all user-owned tables, and restrict `player_profiles` updates via column-level privileges or a `BEFORE UPDATE` trigger protecting XP/level columns.

### SEC-005 [HIGH] — Google OAuth Adapter Missing State Storage & `google-callback` Implementation
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 329–345)
- **Evidence:** `action === 'google-start'` generates a random `state` parameter and builds a Google redirect URL pointing to `/api/auth?action=google-callback`, but never persists `state` for CSRF validation and never implements `action === 'google-callback'`.
- **Impact:** Even with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` configured, Google OAuth sign-in cannot complete.
- **Recommended Remediation:** Store OAuth `state` + PKCE verifier in a signed `HttpOnly` cookie and implement `google-callback` token exchange and ID-token verification.

### SEC-006 [HIGH] — Twilio SMS OTP Adapter Does Not Actually Send SMS When Configured
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 352–398)
- **Evidence:** When `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are set, `phone-request` generates a 6-digit code in `otpStore` and returns `deliveryMode: 'sms_provider'`, but never makes an HTTP request to Twilio's Messages API.
- **Impact:** Users in production would never receive an SMS OTP even after Twilio credentials are configured.
- **Recommended Remediation:** Call Twilio's REST API (`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`) and fail with `502` if delivery fails.

### SEC-007 [HIGH] — Email Verification & Password Reset Lack Token Delivery & Verification
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 450–479)
- **Evidence:** When `SMTP_HOST`, `RESEND_API_KEY`, or `SUPABASE_URL` is configured, `verify-email` immediately sets `rec.emailVerified = true` without verifying any emailed one-time token, and `reset-request` returns `ok: true` without sending an email or issuing a reset token.
- **Impact:** Any authenticated user could mark an unverified email as verified by calling `POST /api/auth?action=verify-email` once SMTP/Supabase env vars exist.
- **Recommended Remediation:** Delegate email verification and password reset to Supabase Auth or implement signed single-use verification tokens delivered via Resend/SMTP.

### SEC-008 [MEDIUM] — Missing HTTP Security Headers in `vercel.json`
- **Verification Basis:** Independently verified via direct file inspection.
- **Affected Files:** `vercel.json` (lines 1–3)
- **Evidence:** `vercel.json` contains only `{ "cleanUrls": true }` — no `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, or `Referrer-Policy`.
- **Recommended Remediation:** Add a `headers` block in `vercel.json` covering all static and `/api/*` routes.

### SEC-009 [MEDIUM] — No Defense-in-Depth `Origin` Check for CSRF on State-Changing API Routes
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js`, `api/progress.js`
- **Evidence:** Cookie-authenticated `POST` and `DELETE` endpoints rely solely on `SameSite=Lax` without verifying `Origin` / `Referer` or an explicit CSRF token.
- **Recommended Remediation:** Validate the `Origin` header against the deployment origin on all cookie-authenticated `POST`/`PUT`/`DELETE` requests.

### SEC-010 [MEDIUM] — Minor Login Timing Oracle & Signup Email Enumeration
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 530–532, 575–577)
- **Evidence:** `signup` returns `409 Email sudah terdaftar.` (standard usability trade-off), and `login` skips `crypto.scryptSync` when `!rec`, creating a measurable timing difference between registered and unregistered emails.
- **Recommended Remediation:** Run a dummy `verifyPassword` against a constant scrypt hash when `!rec` so login latency is uniform.

### SEC-011 [MEDIUM] — `scripts/local_server.mjs` Uses Permissive `Access-Control-Allow-Origin: *`
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `scripts/local_server.mjs` (line 30)
- **Evidence:** Local dev server sets wildcard CORS headers. Not deployed to Vercel, but should be restricted to `http://localhost:3000` / `http://127.0.0.1:3000`.

### SEC-012 [MEDIUM] — In-Memory `otpStore` Is Ephemeral Across Serverless Instances
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (line 31)
- **Evidence:** Phone OTP codes, resend cooldowns, and attempt caps live only in an in-memory `Map`, which fails if `phone-request` and `phone-verify` hit different serverless instances.

### SEC-013 [LOW] — Scrypt Parameters Use Node Defaults Without Explicit Cost Tuning
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/auth.js` (lines 226–234)
- **Evidence:** `crypto.scryptSync(password, salt, 64)` uses Node's default `N=16384, r=8, p=1` (acceptable baseline, but explicitly specifying `{ N: 16384, r: 8, p: 1 }` and migrating to async `crypto.scrypt` prevents event-loop blocking under load).

### SEC-014 [LOW] — `api/leaderboard.js` Misreports `source: 'supabase'` When `SUPABASE_URL` Is Set
- **Verification Basis:** Independently verified via direct code inspection.
- **Affected Files:** `api/leaderboard.js` (line 34)
- **Evidence:** Reports `source: 'supabase'` based solely on `process.env.SUPABASE_URL` presence even though entries come from `playerProgressStore` RAM.

---

## Verified Positive Security Controls
- **Independently Verified:** Fail-closed HTTP `503` when production `SUPABASE_URL`/key or `>=32`-char `NULAR_SESSION_SECRET` is absent or incomplete (`api/auth.js:195–224`).
- **Independently Verified:** `HttpOnly`, `SameSite=Lax`, `Path=/`, and conditional `Secure` (when `isProd`) flags on `nular_session` cookie (`api/auth.js:264–268`).
- **Independently Verified:** `crypto.timingSafeEqual` used for both password hash comparison and HMAC-SHA256 session signature verification (`api/auth.js:233, 250`).
- **Independently Verified:** Zero secrets, password hashes, or private emails exposed in `/api/auth?action=providers` or `/api/leaderboard`.
- **Independently Verified:** Server-authoritative `XP_TABLE` in `api/progress.js` strictly ignores client-injected XP amounts.
- **Independently Verified:** Service Worker (`sw.js`) excludes `/api/` requests from caching.
