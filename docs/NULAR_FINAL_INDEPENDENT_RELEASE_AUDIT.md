# NULAR — Final Independent Release Audit

**Project:** NULAR — The Living World of Nusantara
**Repository:** `/home/firza-ilmi/.gemini/antigravity/scratch/ragamara`
**Branch Audited:** `feat/nular-world-experience`
**Audited HEAD:** `4b3a6dce583b14d85e48f7ea231691c98c47a5cd` (`4b3a6dc`)
**Production `main` Baseline:** `1a110b00c0d182e72e9eddb79a097a1dccbd550c` (`1a110b0`)
**Audit Date:** 2026-11-21
**Audit Mode:** Read-Only Independent Verification (zero source/test/config edits; zero commits/pushes/deployments)

---

## Executive Verdict

**Production Readiness Classification:** **A — Not Ready for Production**
*(Candidate for **Controlled Staging / Guest-Mode Preview Only** once security headers are added; **Blocked for Production User Accounts** until real Supabase persistence and distributed security controls are implemented.)*

### Why Automated 12/12 PASS Does Not Equal Production Ready
While all **12 automated test suites pass (exit code `0`)** and the frontend museum, 3D world, and 4-room Exhibition Product are genuinely strong, direct source-code inspection uncovered **2 CRITICAL** and **5 HIGH** backend/security gaps that automated tests did not catch — most critically that `api/auth.js` and `api/progress.js` have **no actual Supabase persistence code wired**, meaning supplying Supabase env vars in production would bypass the fail-closed `503` gate while silently storing accounts and XP in ephemeral per-instance RAM.

---

## AUDIT 1 — Git & Repository Integrity *(Independently Verified)*

- **Current Branch:** `feat/nular-world-experience`
- **Current HEAD:** `4b3a6dce583b14d85e48f7ea231691c98c47a5cd` (`4b3a6dc`), matching `origin/feat/nular-world-experience` (`4b3a6dc`).
- **Production `main`:** Untouched at `1a110b00c0d182e72e9eddb79a097a1dccbd550c` (`1a110b0`).
- **Pre-Audit Working Tree:** Clean for tracked files; only pre-existing untracked historical artifacts present (`docs/NULAR_FINAL_HANDOVER_AUDIT.md`, `docs/qa/evidence.zip`, `reports/*`).
- **Deployment:** Confirmed no Preview or Production deployment performed during this audit.

---

## AUDIT 2 — Authentication Security *(Independently Verified)*

Full findings with line references are documented in [NULAR_SECURITY_FINDINGS.md](NULAR_SECURITY_FINDINGS.md). Key findings:
- **Verified Working:**
  - Production fail-closed HTTP `503` when Supabase env vars or `>=32`-char `NULAR_SESSION_SECRET` are missing/incomplete (`api/auth.js:195–224`).
  - Local dev persistence isolated to non-prod `.nular-local-data/auth-store.json` (`0600`, `.gitignore`d), with JTI revocation and cross-restart rate-limiting working in local dev.
  - Secure cookie attributes (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production), `scrypt` password hashing, and `timingSafeEqual` HMAC verification.
  - Zero secret leakage in `/api/auth?action=providers`.
- **Critical / High Gaps Discovered:**
  - **SEC-001 [CRITICAL]:** No Supabase client/REST calls exist in `api/auth.js` — setting Supabase env vars unlocks the gate into ephemeral RAM.
  - **SEC-002 [CRITICAL]:** `api/progress.js` is RAM-only and trusts arbitrary caller-supplied `guestId`.
  - **SEC-003 [HIGH]:** Rate-limiting and JTI revocation are non-distributed in production serverless.
  - **SEC-004 [HIGH]:** `db/migrations/001_nular_cultural_world.sql` lacks RLS on `public.users`, omits policies on 5 RLS-enabled tables, and permits `player_profiles` self-updates without column protection on `total_xp`.
  - **SEC-005 / SEC-006 / SEC-007 [HIGH]:** Google OAuth (`google-callback`), Twilio SMS API delivery, and SMTP/Resend token verification are not implemented even when credentials are supplied.

---

## AUDIT 3 — Exhibition Product Integrity *(Independently Verified)*

- **Data & Asset Integrity:** Independently verified via script + direct inspection of `data/exhibitions.json`, `data/houses.json`, and `data/cultural-items.json`:
  - All 4 curated exhibitions (`arsitektur-nusantara`, `wastra-nusantara`, `bunyi-dan-gerak-nusantara`, `pusaka-dan-kriya-nusantara`) resolve all **25 catalog references** and **15 GLB paths** to real files on disk. Zero fabricated IDs or missing GLBs.
  - All 25 exhibits have source citations (DAPOBUD, UNESCO ICH, KITLV, Museum Nasional/Tekstil).
  - **Medium Cultural Fidelity Caveat (NB-001):** Four distinct textile exhibits (`item-batik-parang-solo`, `item-batik-megamendung-cirebon`, `item-sasirangan-banjar`, `item-ulos-ragidup-batak`) share `assets/models/artifacts/clothing-batik-parang.glb`. Because NULAR emphasizes ethnographic separation between Batik and Tenun Ulos, reusing a Batik-named GLB for Ulos without an explicit "generic silhouette" label should be remedied.
- **Functionality & Collection Book:** Verified via automated execution + visual review (`docs/qa/completion-evidence/`):
  - Search, category, and region filtering work on `exhibitions.html`.
  - Chapter tabs, progress bar, Three.js GLB viewer (with clean geometry/material/renderer disposal), and honest archival fallbacks for non-3D exhibits (`bunyi-dan-gerak-nusantara`) work as designed.
  - Save/remove persists in `MuseumStore` and renders in `profile.html#saved-exhibits-section`.
  - XP completion is server-authoritative (`+100 XP`, idempotent on repeat), **subject to SEC-002** (ephemeral RAM + spoofable `guestId`).

---

## AUDIT 4 — Full-Site Experience *(Verified via Automated Tests + Visual Review)*

- **Routes Inspected:** `index.html`, `exhibitions.html`, `exhibition.html`, `explore.html`, `house.html`, `world.html`, `map.html`, `learn.html`, `portal.html`, `profile.html`, `quests.html`, `auth.html`, `anatomy.html`, `offline.html`.
- **Strengths:**
  - Consistent emerald/ivory/bronze editorial identity unified via `js/museum-shell.js` + `css/exhibition-motion.css` + `js/museum-motion.js`.
  - Exact `0px` horizontal overflow verified across all 9 viewports (`320px`–`1920px`).
  - Strict `prefers-reduced-motion: reduce` compliance, keyboard skip-link, `>=44×44px` mobile touch targets, and zero-font inline SVG `offline.html`.
  - Service Worker (`sw.js`, `nular-shell-v1.2`) caches core shell + exhibition assets and excludes `/api/`.
- **Limitations:**
  - External Google Fonts latency can occasionally delay `loadEventEnd` on cold network connections.
  - 3D World draw calls (~269 in SwiftShader benchmark) have not yet been profiled on real mid-range mobile GPUs.

---

## AUDIT 5 — Test Integrity *(Independently Executed & Inspected)*

All 12 unmodified suites were executed cleanly during this audit (`12/12` exited `0`). However, independent code review of the test files identified **3 important test-coverage blind spots**:
1. **Unverified Configured-Supabase Path:** `test_auth_production_integrity.mjs` tests missing/incomplete Supabase env vars (which rightly return `503`), but never tests production `signup`/`login` when Supabase env vars ARE present — which masked **SEC-001**.
2. **Minor Local Store Residue:** `test_auth_production_integrity.mjs` leaves 1 test user (`integrity_<ts>@nular.test`) in `.nular-local-data/auth-store.json`.
3. **Tracked Screenshot Mutation Side-Effect:** Running `verify_overhaul_experience.mjs` and `verify_exhibitions_and_full_site.mjs` overwrites tracked PNGs in `docs/qa/*-evidence/`, dirtying `git status` after test runs.

---

## AUDIT 6 — Subsystem Production Readiness Matrix

| Subsystem | Rating | Evidence Basis |
|---|---|---|
| **Application Code (Frontend / Exhibition)** | Ready for Staging | Independently verified + 12/12 automated tests |
| **Authentication** | **Blocked (Not Ready)** | Independently verified — SEC-001, SEC-003, SEC-005–007 |
| **Database & RLS** | **Blocked (Not Ready)** | Independently verified — SEC-001, SEC-002, SEC-004 |
| **Environment Configuration** | **Blocked (Owner Action)** | Missing production `NULAR_SESSION_SECRET`, Supabase, optional providers |
| **PWA & Offline** | Ready for Staging | Verified via automated tests (`sw.js`, `manifest.webmanifest`, `offline.html`); physical install prompt not verified |
| **3D Performance** | Needs Physical Device Validation | Verified only on SwiftShader (`~107ms/frame`, `269` draw calls); real GPU FPS unverified |
| **Accessibility (WCAG 2.2 AA)** | Strong Automated Baseline | Verified via automated keyboard/touch/reduced-motion tests; manual screen-reader pass not verified |
| **Security** | **Blocked (Not Ready)** | Independently verified — 2 CRITICAL, 5 HIGH, 5 MEDIUM findings |
| **Operational Monitoring** | Not Implemented | No telemetry/alerting configured |
| **Physical-Device Testing** | **Not Verified** | Zero real iOS Safari / Android Chrome hardware runs performed |

See [NULAR_RELEASE_BLOCKERS.md](NULAR_RELEASE_BLOCKERS.md) for the exact prioritized blocker list and remediation roadmap.
