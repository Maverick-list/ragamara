# NULAR — Product Experience Overhaul Report

**Project:** NULAR — The Living World of Nusantara  
**Repository:** `Maverick-list/ragamara`  
**Branch:** `feat/nular-world-experience`  
**Baseline Commit:** `c6480405221a0beba51f28e92e7cc60136bd99df`  
**Production `main` Baseline:** `1a110b00c0d182e72e9eddb79a097a1dccbd550c` (untouched)  
**Date:** 2026-11-21

---

## 1. Executive Summary

This overhaul elevates NULAR from a technically verified cultural platform into a cohesive **Living Heritage Museum × Contemporary Nusantara Editorial** experience while hardening the authentication backend for production honesty and reliability. All changes were implemented directly in source code, visually verified via headless Chrome captures, and validated across all **10 automated regression suites** (all exiting with code `0`).

---

## 2. Implemented Upgrades

### Pillar 1 — Production-Grade Authentication Hardening (`api/auth.js`, `auth.html`, `.gitignore`)
- **Atomic Local Persistence (`api/auth.js`):** Added `hydrateLocalAuthStore()` and `persistLocalAuthStore()` backed by `.nular-local-data/auth-store.json` (`0600` file permissions, `.gitignore`d) for writable non-production environments so accounts survive local server restarts, while gracefully falling back to `serverless_ephemeral` on read-only serverless runtimes when `SUPABASE_URL` is absent.
- **Brute-Force Login Rate Limiting (`api/auth.js`):** Added per-email failed-login tracking (`5` failed attempts within `15` minutes → HTTP `429` with `Retry-After` header and `retryAfterSeconds`, reset automatically on successful authentication).
- **Honest Email Verification (`api/auth.js`):** Replaced the silent fake-verified response in `action=verify-email` with an honest HTTP `503` (`configured: false, emailVerified: false`) whenever SMTP/Supabase is not configured.
- **Transparent Provider Diagnostics & UX (`auth.html`):** Added a live **Storage & Provider Diagnostics Strip** (`storageMode`, `Rate-Limit Login`, `Google OAuth`, `SMS OTP`, `Email SMTP`) populated from `/api/auth?action=providers`, plus an accessible live **Password Strength Meter** (`Lemah` / `Sedang` / `Kuat`) below `#auth-password`.

### Pillar 2 — Purposeful Museum Motion System (`css/exhibition-motion.css`, `js/museum-motion.js`, `js/museum-shell.js`)
- **Museum Scroll Progress Bar:** Added a `2px` warm-gold reading progress bar (`.museum-scroll-progress`) mounted to `.museum-header` and updated via `requestAnimationFrame`.
- **Subtle Nusantara Architectural Atmosphere:** Added a refined *kawung/tenun* hairline lattice and warm gallery radial spotlight on `.hero-atlas` (isolated with `overflow: hidden` so zero horizontal overflow is introduced at any viewport) and a damped desktop pointer spotlight on `.hero-viewer-frame`.
- **Purposeful Exhibition Reveals:** Added `IntersectionObserver`-driven reveal choreography (`640ms cubic-bezier(0.22, 1, 0.36, 1)`, subtle `14px` vertical rise, staggered `--reveal-delay`).
- **Strict WCAG 2.2 AA Reduced-Motion Compliance:** Full `@media (prefers-reduced-motion: reduce)` and `body.reduced-motion` overrides guarantee immediate `opacity: 1` visibility with zero motion transitions.
- **Global Shell Integration (`js/museum-shell.js`):** Automatically injects `css/exhibition-motion.css` and initializes `initMuseumMotion()` across all museum pages.

### Pillar 3 — Cultural Museum Exhibitions & Editorial Polish (`index.html`)
- **Curatorial Exhibition Showcase (`Galeri Pameran Tematik`):** Added four museum exhibition plates (`PL. 01`–`PL. 04`) linking directly to `house.html?id=rumah-gadang`, `learn.html#clothing`, `anatomy.html`, and `world.html` with bronze top-edge rules, plate numbering, and micro-elevation hover choreography.
- **Curatorial Philosophy Pull-Quote Band:** Added a deep-emerald (`#153027`) editorial statement band with bronze rules and Fraunces display typography celebrating Indonesian vernacular architecture as living heritage.

---

## 3. Verification Results (10/10 Suites Passed, Exit Code 0)

All 10 suites were executed sequentially from a clean starting state (`set -e`) against the live local server (`http://127.0.0.1:3000`):

| # | Test Suite | Result | Key Verified Coverage |
|---|---|---|---|
| 1 | `tests/test_auth_hardening.mjs` | **PASS (6/6, exit 0)** | Local file persistence across reload, HTTP `503` unconfigured `verify-email`, 5-attempt HTTP `429` brute-force lockout, DELETE cleanup |
| 2 | `tests/test_pbr_texture_lifecycle.mjs` | **PASS (5/5, exit 0)** | Shared PBR texture ownership & disposal safety |
| 3 | `tests/verify_overhaul_experience.mjs` | **PASS (exit 0)** | 9-viewport (`320px`–`1920px`) `0px` horizontal overflow on `index.html` & `auth.html`, 4 exhibition plates, quote band, auth diagnostics strip, password strength meter, `prefers-reduced-motion` |
| 4 | `tests/audit_pwa_security_performance.mjs` | **PASS (16/16, exit 0)** | PWA manifest/SW/offline, HMAC & XP anti-tamper, `DOMInteractive=305ms`, `FCP=568ms`, `JSHeapUsed=3MB` |
| 5 | `tests/verify_universal_cross_device.mjs` | **PASS (exit 0)** | Cross-device responsive checks (`320px`–`1920px`) & mobile bottom nav |
| 6 | `tests/verify_nular_master_transformation.mjs` | **PASS (exit 0)** | Core NULAR transformation & 3D world journey |
| 7 | `tests/verify_phase11_visual_quality.mjs` | **PASS (exit 0)** | 3D visual quality & Rumah Gadang architecture |
| 8 | `tests/verify_phase12_immersive_e2e.mjs` | **PASS (exit 0)** | End-to-end desktop & mobile immersive world flows |
| 9 | `tests/test_nular_gamification.mjs` | **PASS (exit 0)** | Toko Adat economy, 7-day streak, profile edit, Web Audio |
| 10 | `tests/verify_post_refinement_interactions.mjs` | **PASS (11/11, exit 0)** | Tutorial lifecycle, joystick/D-pad toggle, >=44px touch targets, 0 console errors, 0 failed local assets |

Visual evidence captured in `docs/qa/overhaul-evidence/`:
- `home_desktop_1440_top.png`, `home_desktop_1440_exhibitions.png`, `home_desktop_1440_quote.png`
- `home_mobile_390_top.png`, `home_mobile_390_exhibitions.png`, `home_mobile_320_top.png`
- `auth_desktop_1440_hardened.png`, `auth_mobile_390_hardened.png`

---

## 4. Remaining Owner-Controlled Items (Not Fabricated)

1. **Physical-Device Verification:** Real iOS Safari / Android Chrome testing on physical hardware remains owner-controlled (automated verification used headless Chrome device emulation + SwiftShader WebGL).
2. **External Production Credentials:** Real cloud account persistence (`SUPABASE_URL`), Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), Twilio SMS OTP, and SMTP email delivery remain transparently reported as unconfigured until production environment variables are supplied per `docs/AUTHENTICATION_SETUP.md`.
3. **Deployment:** No Preview or Production deployment was executed; `main` remains untouched at `1a110b0`.
