# NULAR — SECURITY REMEDIATION REPORT
## Comprehensive Backend Integrity, Supabase Persistence & Production Security Audit

**Project:** NULAR — The Living World of Nusantara
**Repository:** `Maverick-list/ragamara`
**Branch:** `feat/nular-world-experience`
**Base Commit:** `4b3a6dce583b14d85e48f7ea231691c98c47a5cd`
**Audit Report Version:** 1.0.0 (Post-Remediation Verification)
**Verification Date:** 21 November 2026
**Status:** **REMEDIATED & VERIFIED (49/49 Security Tests Passed)**

---

## 1. Executive Summary

During the final independent engineering audit of NULAR (`4b3a6dc`), critical security and persistence deficiencies were identified across authentication, guest session handling, database authorization, and provider integrations:
1. **Mock Persistence Fallback in Production:** `api/auth.js` gates production behind `cfg.supabase.configured`, but the actual handler routines never made HTTP calls to Supabase PostgREST endpoints, continuing to rely on in-memory Maps.
2. **Guest Identity Spoofing:** `api/progress.js` accepted caller-supplied `guestId` in request bodies or headers without signature verification, enabling unauthenticated callers to read or overwrite another guest's progression.
3. **Database RLS Incomplete:** `db/migrations/001_nular_cultural_world.sql` left `public.users` without RLS, omitted owner policies on 5 key tables, and lacked protection against direct client modification of `total_xp` and `current_level` on `player_profiles`.
4. **Rate Limiting & Revocation Non-Durable:** Rate limits and session revocations were kept only in ephemeral process RAM in production.
5. **Provider Discrepancies:** Phone OTP SMS was simulated locally without propagating Twilio errors, and email verification / password reset lacked single-use cryptographic token validation.
6. **Missing HTTP Security Headers:** `vercel.json` omitted `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, and `X-Frame-Options`.
7. **Cultural Model Ambiguity (NB-001):** Mannequin silhouettes for non-batik textiles (`item-ulos-ragidup-batak` and `item-sasirangan-banjar`) lacked explicit curatorial disclaimer badges.

All seven defect clusters have been completely re-engineered, verified, and automated in `tests/test_security_remediation.mjs` with **49/49 automated checks passing**.

---

## 2. Remediation Architecture & Implementation Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               NULAR SECURITY ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   api/auth.js    │             │ api/progress.js  │             │ db/migrations/   │
│                  │             │                  │             │  002_rls_...sql  │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│• PostgREST Fetch │             │• HMAC Signed     │             │• RLS public.users│
│• Fail-Closed 503 │             │  nular_guest     │             │• 5 Owner Policies│
│• Single-Use Hash │             │• Anti-Spoofing   │             │• XP Tamper Trig  │
│  Tokens (sha256) │             │  Check (403)     │             │• Revocation Table│
│• Twilio REST     │             │• Server-Authorit.│             │• RateLimit Table │
│• Google OAuth 503│             │  XP Table        │             │• Token Hash Table│
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### 2.1 Phase A & D: Real Supabase PostgREST Client & Production Fail-Closed Durability
- **Engineered `sbPostgrest(pathAndQuery, options)`:** Implemented native Node.js `fetch` client to PostgREST endpoints `${SUPABASE_URL}/rest/v1/...` with `apikey`, `Authorization: Bearer <key>`, and `Prefer: return=representation`.
- **Wired Handlers:**
  - `POST /api/auth?action=signup`: Checks existing emails in `public.users`, inserts record into `public.users`, creates profile in `public.player_profiles`, generates single-use verification token in `public.auth_verification_tokens`, and signs session.
  - `POST /api/auth?action=login`: Checks brute-force lock in `public.login_rate_limits`, validates scrypt hash, clears rate limits upon success, or records failure and locks account for 15 minutes upon 5 failures.
  - `POST /api/auth?action=logout`: Records session `jti` in `public.revoked_tokens`.
  - `POST /api/auth?action=profile-update`: Validates that `jti` is not in `public.revoked_tokens`, updates allowed fields (`avatar_id`, `is_public`), strictly ignoring client attempts to mutate `total_xp` or `current_level`.
  - `DELETE /api/auth`: Revokes session `jti` in `public.revoked_tokens` and deletes user record from `public.users`.
  - `GET /api/auth`: Checks `public.revoked_tokens` for token `jti`, queries `public.users` and `public.player_profiles`, rejecting deleted users or revoked sessions.
- **Fail-Closed Guarantee:** Any network or database failure in production returns HTTP `503 Service Unavailable` with `code: 'DATABASE_OPERATION_FAILED'`, never falling back to local files or memory Maps.
- **Local Dev Persistence:** In local development mode (`!cfg.isProd`), storage safely uses `.nular-local-data/auth-store.json` (0600 mode) for developer convenience.

### 2.2 Phase B: Cryptographically Signed Guest Sessions & Anti-Spoofing
- **HMAC-SHA256 Guest Tokens (`signGuestToken` / `verifyGuestToken`):** Guest sessions now carry an HMAC-SHA256 signature: `${guestId}.${signature}`.
- **Anti-Spoofing Enforcement in `api/progress.js`:**
  - If a guest cookie (`nular_guest`) or header (`x-nular-guest`) is presented, its HMAC signature is verified using `signingSecret`.
  - If the signature is tampered with or invalid, the request is immediately rejected with HTTP `403 Forbidden` (`code: 'INVALID_GUEST_SIGNATURE'`).
  - If the caller supplies `body.guestId` that differs from the verified token's `guestId`, the request is rejected with HTTP `403 Forbidden` (`code: 'GUEST_ID_MISMATCH'`).
  - When an unauthenticated visitor arrives without a token, the server generates a fresh UUID, signs it, and sets `Set-Cookie: nular_guest=...; Path=/; HttpOnly; SameSite=Lax`.
- **Truthful Leaderboard Source in `api/leaderboard.js`:**
  - Queries `public.player_profiles` via PostgREST when Supabase is configured (`source: 'supabase_postgres'`).
  - Returns `source: 'session_verified'` when aggregating local session records. Never falsifies data source.

### 2.3 Phase C: Database Migration `002_security_rls_hardening.sql`
- **`public.users` Row-Level Security:** RLS enabled; deny-all policy for `public`, `anon`, and `authenticated` roles. Client connections cannot query password hashes or user records directly.
- **Owner Policies for 5 Tables:** Added explicit owner policies (`auth.uid() = user_id`) for `mission_progress`, `player_achievements`, `player_collections`, `daily_streaks`, and `language_preferences`.
- **Trigger-Enforced XP & Level Tamper Protection:** Created PostgreSQL function `protect_player_profile_integrity()` and trigger `trg_protect_player_profile_xp` BEFORE UPDATE on `player_profiles`. Any direct client modification of `total_xp` or `current_level` raises a PostgreSQL exception.
- **Durable Infrastructure Tables:** Created `public.revoked_tokens`, `public.login_rate_limits`, and `public.auth_verification_tokens` with indexes and RLS deny-all policies for public/anon access.

### 2.4 Phase E: Provider Integrity (Twilio, Google OAuth & Tokens)
- **Twilio SMS:** Real HTTP POST to Twilio REST API (`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`) with Basic Auth. When credentials are missing in production, returns HTTP `503`. When upstream Twilio fails, returns HTTP `502 Bad Gateway` (`code: 'SMS_DELIVERY_FAILED'`).
- **Google OAuth:** Returns honest HTTP `503` (unconfigured) on `google-start` and HTTP `501` on `google-callback` when OAuth credentials are absent.
- **Single-Use Cryptographic Tokens:**
  - `reset-request` generates a 32-byte cryptographic random token, stores its `sha256` hash with 1-hour expiration.
  - `reset-confirm` validates the hash, marks it used (`used_at`), updates the password hash, and revokes active sessions. Replaying the token is rejected with HTTP `400` (`INVALID_RESET_TOKEN`).
  - `verify-email` requires a valid token parameter, validates hash, marks it used, and marks `email_verified = true`. Calls without tokens or replayed tokens return HTTP `400`.

### 2.5 Phase F: HTTP Security Headers
Configured in `vercel.json` and active in `scripts/local_server.mjs`:
- `Content-Security-Policy`: Restricts scripts, styles, fonts, objects (`'none'`), frame ancestors (`'none'`), and connection endpoints to authorized domains (`https://*.supabase.co`, `https://api.twilio.com`).
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`

### 2.6 Phase H: Cultural Finding NB-001 (Generic Mannequin Silhouette Labeling)
- `data/cultural-items.json`: Added `isGenericSilhouette: true` and `model3DNote: "Representasi visual 3D menggunakan siluet manekin umum berbalut kain tekstil tradisional untuk menjaga kehormatan artefak asli dan keterbatasan model 3D saat ini."` to `item-ulos-ragidup-batak` and `item-sasirangan-banjar`.
- `js/exhibition-data.js`: Propagated `isGenericSilhouette` and `model3DNote` through `normalizeCulturalExhibit`.
- `exhibition.html` & `learn.html`: Thumbnails show `● SILUET MANEKIN ILUSTRATIF` and display an honest curatorial info box above/below the 3D viewer.

---

## 3. Verification & Test Evidence

### 3.1 Automated Security Remediation Suite (`tests/test_security_remediation.mjs`)
Command:
```bash
node tests/test_security_remediation.mjs
```
Output:
```
================================================================
🛡️  NULAR SECURITY REMEDIATION & BACKEND INTEGRITY VERIFICATION
================================================================

1. Production Supabase PostgREST Fail-Closed Tests:
  ✓ Signup Fail-Closed on DB Error
  ✓ Login Fail-Closed on DB Error
  ✓ Leaderboard Fail-Closed on DB Error in Production

2. Real Supabase PostgREST Lifecycle & Revocation:
  ✓ PostgREST Signup Succeeded
  ✓ PostgREST Inserted User into users Table
  ✓ PostgREST Inserted Profile into player_profiles Table
  ✓ Signup Returns Set-Cookie Header
  ✓ Leaderboard Reports Truthful source: supabase_postgres

3. Cryptographic Guest Session Anti-Spoofing Tests:
  ✓ Initial Guest Request Mints Signed nular_guest Cookie
  ✓ Guest Token Signature is Valid HMAC-SHA256
  ✓ Tampered Guest Token Rejected (403 INVALID_GUEST_SIGNATURE)
  ✓ Guest ID Spoofing Rejected (403 GUEST_ID_MISMATCH)
  ✓ Legitimate Guest Progress Succeeded

4. Server-Authoritative Anti-Tamper XP Engine:
  ✓ Server Strictly Ignores Client-Injected XP/Amount
  ✓ Idempotent Replay Awards 0 XP (duplicate: true)

5. Single-Use Cryptographic Tokens:
  ✓ verify-email Without Token Unconfigured Returns 503
  ✓ verify-email With Invalid Token Rejected (400)
  ✓ Signup Returns Cryptographic Verification Token
  ✓ First verify-email Succeeded
  ✓ Replay Attack on Verification Token Rejected (400)
  ✓ reset-request Mints Single-Use Reset Token
  ✓ reset-confirm Succeeded with Valid Token
  ✓ Replaying Password Reset Token Rejected (400)

6. Provider Integrity:
  ✓ Production Phone OTP without Twilio Fails Closed (503)
  ✓ Twilio Upstream Error Returns 502 SMS_DELIVERY_FAILED
  ✓ Google OAuth Without Credentials Returns 503

7. HTTP Security Headers:
  ✓ vercel.json Configures CSP
  ✓ vercel.json Configures HSTS
  ✓ vercel.json Configures X-Content-Type-Options: nosniff
  ✓ vercel.json Configures X-Frame-Options: DENY
  ✓ vercel.json Configures Referrer-Policy
  ✓ Live Server Delivers Content-Security-Policy
  ✓ Live Server Delivers X-Frame-Options: DENY
  ✓ Live Server Delivers X-Content-Type-Options: nosniff

8. Cultural Finding NB-001 (Generic Mannequin Silhouette Labeling):
  ✓ item-ulos-ragidup-batak has isGenericSilhouette: true
  ✓ item-ulos-ragidup-batak has model3DNote
  ✓ item-sasirangan-banjar has isGenericSilhouette: true
  ✓ item-sasirangan-banjar has model3DNote

9. Database Migration 002 RLS & Trigger Integrity:
  ✓ Migration 002 Enables RLS on public.users
  ✓ Migration 002 Denies Direct Public Access to public.users
  ✓ Migration 002 Creates Mission Progress Owner Policy
  ✓ Migration 002 Creates Player Achievements Owner Policy
  ✓ Migration 002 Creates Player Collections Owner Policy
  ✓ Migration 002 Creates Daily Streaks Owner Policy
  ✓ Migration 002 Creates Language Preferences Owner Policy
  ✓ Migration 002 Protects total_xp and current_level Tampering via Trigger
  ✓ Migration 002 Creates public.revoked_tokens Table
  ✓ Migration 002 Creates public.login_rate_limits Table
  ✓ Migration 002 Creates public.auth_verification_tokens Table

================================================================
🎉 ALL 49 SECURITY REMEDIATION CHECKS PASSED PERFECTLY!
================================================================
```

### 3.2 Regression Suite Pass Rate
| Test Suite | Result | Details |
|---|---|---|
| `test_security_remediation.mjs` | **PASS (49/49)** | Complete security, fail-closed, RLS, provider & anti-spoofing audit |
| `test_auth_production_integrity.mjs` | **PASS (9/9)** | Fail-closed gate, secret length, persistence mode verification |
| `test_auth_hardening.mjs` | **PASS (6/6)** | Local persistence across reloads, scrypt password hashing, rate limits |
| `test_nular_gamification.mjs` | **PASS (100%)** | Economy, Toko Adat, 7-day streak idempotency, Web Audio synthetics |
| `verify_phase7_8_gamification.mjs` | **PASS (6/6)** | Server-authoritative XP, idempotent replay, streak dates |
| `test_pbr_texture_lifecycle.mjs` | **PASS (5/5)** | CanvasTexture reuse, material disposal, shared texture preservation |
| `verify_post_refinement_interactions.mjs` | **PASS (11/11)** | Responsive touch targets, tutorial lifecycle, 3D rendering budget |

---

## 4. Remediation Matrix & Closure Status

| ID | Finding Category | Root Cause | Remediation Action | Status |
|---|---|---|---|---|
| **SEC-01** | Production Persistence | Handlers only used memory Maps | Wired native PostgREST CRUD (`sbPostgrest`) with fail-closed HTTP 503 | **RESOLVED** |
| **SEC-02** | Guest Spoofing | Unsigned caller `guestId` trusted | Enforced HMAC-SHA256 `nular_guest` token & rejected mismatched `guestId` (403) | **RESOLVED** |
| **SEC-03** | Missing RLS on Users | `public.users` had no RLS | Created `002_security_rls_hardening.sql` with deny-all policy on `public.users` | **RESOLVED** |
| **SEC-04** | Missing Table Owner Policies | 5 tables enabled RLS without policies | Added owner policies for `mission_progress`, `achievements`, `collections`, etc. | **RESOLVED** |
| **SEC-05** | XP Tampering in Profiles | UPDATE policy permitted XP writes | Added `protect_player_profile_integrity()` trigger rejecting client XP edits | **RESOLVED** |
| **SEC-06** | Ephemeral Revocation | Revoked JTIs stored in RAM | Added `public.revoked_tokens` table & verified JTI query on authenticated routes | **RESOLVED** |
| **SEC-07** | Ephemeral Rate Limiting | Login rate limits stored in RAM | Added `public.login_rate_limits` table with 15-min lockout enforcement | **RESOLVED** |
| **SEC-08** | Twilio SMS Simulation | Simulated OTP without sending | Added real Twilio REST call with Basic Auth, returning 502/503 honestly | **RESOLVED** |
| **SEC-09** | Replay of Email/Reset Tokens | Blind email verification without tokens | Created `public.auth_verification_tokens` with single-use `sha256` enforcement | **RESOLVED** |
| **SEC-10** | Missing Security Headers | `vercel.json` lacked headers | Configured CSP, HSTS, nosniff, DENY, and Referrer-Policy in config and server | **RESOLVED** |
| **CUL-01** | Cultural Labeling (NB-001) | Mannequin reuse without disclosure | Added `isGenericSilhouette: true` and curatorial notes across data & UI | **RESOLVED** |

---

## 5. Deployment Instructions for Production Readiness Gate

When deploying to production with Supabase:
1. **Apply PostgreSQL Migrations:**
   Run `db/migrations/001_nular_cultural_world.sql` followed by `db/migrations/002_security_rls_hardening.sql` in the Supabase SQL Editor.
2. **Set Mandatory Production Environment Variables in Vercel:**
   - `NULAR_SESSION_SECRET`: Cryptographically strong random string >= 32 characters (`openssl rand -base64 32`).
   - `SUPABASE_URL`: Project URL (`https://<project-ref>.supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (bypasses RLS for secure backend API operations).
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: Required for live production SMS OTP delivery.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Required for live Google Sign-In.
3. **Fail-Closed Verification:**
   Before routing production traffic, verify `GET /api/auth?action=providers` returns `productionReady: true` and `storageMode: 'durable_production_supabase'`.
