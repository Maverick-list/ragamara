# NULAR — Release Blockers & Production Readiness Gate

**Audit Type:** Read-Only Independent Release Audit
**Repository:** `Maverick-list/ragamara`
**Branch:** `feat/nular-world-experience` (`4b3a6dc`)
**Production `main` Baseline:** `1a110b0` (untouched)
**Date:** 2026-11-21

---

## Release Decision

### Classification: **A — Not Ready for Production** *(Acceptable for Controlled Local/Staging Preview in Guest-Only Mode)*

Although the static cultural museum, 3D Nusantara World, and 4-room Exhibition Product are functional and pass 12/12 automated suites, **production deployment with user accounts is blocked** by genuine backend implementation gaps — not merely missing environment variables.

---

## Blocking Items (Must Resolve Before Production Launch)

| ID | Blocker | Severity | Category | Evidence | Required Action |
|---|---|---|---|---|---|
| **BLK-001** | `api/auth.js` has no real Supabase persistence queries wired; setting Supabase env vars bypasses the fail-closed `503` gate and silently falls back to in-memory Maps | **CRITICAL** | Authentication / DB | `api/auth.js:28–34, 41–88, 495–598` (Independently verified) | Implement real Supabase Auth / PostgreSQL persistence adapter and integration-test against a live Supabase staging project |
| **BLK-002** | `api/progress.js` and `api/leaderboard.js` use per-instance RAM (`playerProgressStore`) and allow unauthenticated `guestId` spoofing | **CRITICAL** | Persistence / AuthZ | `api/progress.js:43–51`, `api/leaderboard.js:34` (Independently verified) | Persist XP events & streaks to Supabase `player_xp_events` / `daily_streaks`; sign guest session cookies or restrict leaderboard to authenticated users |
| **BLK-003** | Distributed rate-limiting (`loginFailures`) and session JTI revocation (`revokedSessions`) are RAM-only in production serverless | **HIGH** | Security | `api/auth.js:32–34, 560–588` (Independently verified) | Back rate-limit windows and revoked JTIs with Upstash Redis or Supabase tables |
| **BLK-004** | Incomplete Supabase RLS migration (`public.users` lacks RLS; 5 user tables have RLS with zero policies; `player_profiles` UPDATE allows modifying `total_xp`) | **HIGH** | Database / RLS | `db/migrations/001_nular_cultural_world.sql:215–229` (Independently verified) | Harden RLS policies and apply migration to staging/production Supabase |
| **BLK-005** | External auth providers (Google OAuth callback, Twilio SMS API call, SMTP/Resend token delivery) are stubbed/incomplete even when env vars are set | **HIGH** | External Integrations | `api/auth.js:329–479` (Independently verified) | Implement real provider adapters or keep those endpoints explicitly disabled (`501`) until implemented |
| **BLK-006** | No physical-device testing on real iOS Safari or Android Chrome hardware (touch controls, WebGL GPU FPS, thermal/memory behavior, PWA install prompt) | **HIGH** | Physical QA | Not verified (all tests ran on headless Chrome + SwiftShader) | Execute physical-device test checklist on iOS Safari & Android Chrome |
| **BLK-007** | Missing HTTP security headers in `vercel.json` (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) | **MEDIUM** | Security / Ops | `vercel.json:1–3` (Independently verified) | Configure `headers` in `vercel.json` |
| **BLK-008** | No production operational monitoring / error telemetry / alerting configured | **MEDIUM** | Operations | Not verified / Not implemented | Configure Vercel Analytics / Speed Insights / Sentry or structured error logging before public launch |

---

## Non-Blocking Cultural & Test-Hygiene Findings

| ID | Item | Severity | Evidence | Recommended Action |
|---|---|---|---|---|
| **NB-001** | `clothing-batik-parang.glb` is reused as the 3D mesh for `item-ulos-ragidup-batak` (Tenun Ulos), `item-sasirangan-banjar`, and `item-batik-megamendung-cirebon` | **MEDIUM** | `data/cultural-items.json` + `exhibitions.json` (Independently verified) | Add explicit UI label ("Model 3D Siluet Busana Generik") or author distinct GLB meshes for Ulos & Sasirangan |
| **NB-002** | `test_auth_production_integrity.mjs` leaves 1 test user in `.nular-local-data/auth-store.json` and does not test configured-Supabase write path | **LOW** | `tests/test_auth_production_integrity.mjs:142–207` (Independently verified) | Delete test user in `finally` block and add real Supabase integration test once BLK-001 is built |
| **NB-003** | Running `verify_overhaul_experience.mjs` / `verify_exhibitions_and_full_site.mjs` rewrites tracked PNGs in `docs/qa/*-evidence/` | **LOW** | `tests/verify_overhaul_experience.mjs`, `tests/verify_exhibitions_and_full_site.mjs` | Write runtime screenshots to a `.gitignore`d scratch folder unless `--update-snapshots` is passed |
