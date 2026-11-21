# NULAR — FINAL RELEASE READINESS REPORT

**Product:** NULAR — The Living World of Nusantara  
**Repository:** `Maverick-list/ragamara`  
**Authorized Branch:** `feat/nular-world-experience`  
**Base Commit Evaluated:** `9c2662d` (followed by final polish & readiness gate commit)  
**Audit Date:** November 21, 2026  

---

## A. EXECUTIVE SUMMARY

NULAR — The Living World of Nusantara has completed its final quality polish, responsive overflow resolution, 3D resource lifecycle review, and clean seven-suite sequential regression gate.

- The remaining **8px horizontal overflow at 320px** (`scrollWidth = 328px`) was diagnosed down to the exact DOM element (`index.html:252` missing `flex-wrap: wrap` on a two-button progress CTA row) and fixed cleanly without `overflow-x: hidden` workarounds.
- A **5px horizontal tightness issue at 1280px** (`scrollWidth = 1285px` before webfont substitution) was also caught during sequential regression and resolved in `css/museum.css` (`@media (min-width: 1180px) and (max-width: 1360px)`).
- A **shared PBR texture disposal bug** in `js/world/GameScene.js` (`disposeObject()`) was identified and safely guarded so cached `PbrTextureFactory` textures survive across 42-house transitions.
- All **9 target viewports (320px through 1920px)** now achieve **true 0px horizontal overflow**.
- All **7 regression test suites** passed sequentially from a clean starting state with **Exit Code 0** (`7/7` suites, `0` uncaught console errors, `0` failed local network requests, `0` broken images).

---

## B. LATEST GIT BRANCH & COMMIT STATUS

- **Working Branch:** `feat/nular-world-experience`
- **Previous Audited Commit:** `9c2662d` (`test(qa): fix gamification readiness race and complete 7-suite post-refinement verification`)
- **Main Branch (`main`):** Completely untouched.
- **Deployment Status:** **No deployment performed** (no Preview deployment, no `vercel --prod`, no DNS/domain/SSO/Protection modifications).

---

## C. EXACT 320PX OVERFLOW ROOT CAUSE & FIX (PLUS SECONDARY FIXES)

### 1. 320px Horizontal Overflow Root Cause & Fix
- **Exact Offending DOM Element:** `<a href="auth.html" class="btn-museum btn-museum--secondary btn-museum--sm">Masuk / Sinkronkan</a>` inside `<div style="margin-top:14px;display:flex;gap:10px;">` at [`index.html:252`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/index.html#L252-L255).
- **Measured Geometry at 320px:** `left = 174px`, `width = 154px`, `right = 328px` (`scrollWidth = 328px` vs `viewport = 320px`, overflow = `+8px`). The parent flex row lacked `flex-wrap: wrap`, forcing both buttons (`Profil & Koleksi` + `10px` gap + `Masuk / Sinkronkan`) onto a single row exceeding the `252px` inner card width.
- **Fix Applied:** Added `flex-wrap:wrap;` to the flex container at [`index.html:252`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/index.html#L252). Desktop layout is 100% unchanged; at 320px the two buttons stack cleanly inside the ivory card (`scrollWidth = 320px`, exact **0px overflow**).

### 2. 1280px Compact Laptop Navbar Tightness Fix
- **Root Cause:** With single-line `white-space: nowrap` links at `1280px`, fallback font metrics before `Plus Jakarta Sans` / `Material Symbols` finished loading reached `scrollWidth = 1285px` (`+5px`).
- **Fix Applied:** Added a compact desktop media query `@media (min-width: 1180px) and (max-width: 1360px)` in [`css/museum.css`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/css/museum.css#L297-L313) tightening header/nav gaps (`12px`/`11px`), nav font size (`0.78rem`), and hiding `.brand-mark__sub` below `1360px`. Verified `scrollWidth = 1265px <= 1280px`.

### 3. Shared PBR Texture Ownership & Disposal (`js/world/PbrTextureFactory.js`, `js/world/GameScene.js`)
- **Root Cause:** `GameScene.disposeObject()` originally disposed `m.map` across all meshes during transitions, and `applyRegionalTextileToAvatar()` did not mark shared batik textures or dispose previously cloned avatar materials on repeated outfit swaps.
- **Fix Applied:** Marked all cached procedural textures with `tex.userData.nularSharedPbrTexture = true` via `finalizeTexture()` and exported `isSharedPbrTexture(tex)` in [`js/world/PbrTextureFactory.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/PbrTextureFactory.js#L20-L34); disposed prior cloned avatar materials on repeated swaps without disposing shared textures; updated [`js/world/GameScene.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/GameScene.js#L155-L174) to dispose all genuinely owned non-shared texture slots (`map`, `bumpMap`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`) deduplicated via `Set` while never disposing shared cached PBR textures. Verified `5/5 PASSED` in [`tests/test_pbr_texture_lifecycle.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/test_pbr_texture_lifecycle.mjs).

---

## D. NINE-VIEWPORT RESPONSIVE RESULTS (`index.html`)

Verified via [`tests/capture_final_readiness.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/capture_final_readiness.mjs) and [`tests/verify_universal_cross_device.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_universal_cross_device.mjs):

| Viewport Width | Device Class | `scrollWidth` | `innerWidth` | Overflow | Mobile Bottom Nav | Verdict |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **320×720** | Compact Mobile | `320px` | `320px` | **0px** | Visible | **PASS** |
| **360×800** | Standard Android | `360px` | `360px` | **0px** | Visible | **PASS** |
| **390×844** | iPhone 13 / 14 | `390px` | `390px` | **0px** | Visible | **PASS** |
| **430×932** | Pro Max Mobile | `430px` | `430px` | **0px** | Visible | **PASS** |
| **768×1024** | Tablet Portrait | `768px` | `768px` | **0px** | Hidden | **PASS** |
| **1024×768** | Tablet Landscape | `1009px` | `1024px` | **0px** | Hidden | **PASS** |
| **1280×800** | Compact Laptop | `1265px` | `1280px` | **0px** | Hidden | **PASS** |
| **1440×900** | Standard Desktop | `1425px` | `1440px` | **0px** | Hidden | **PASS** |
| **1920×1080** | Full HD Desktop | `1905px` | `1920px` | **0px** | Hidden | **PASS** |

*Offline page at `320×720` also verified: `scrollWidth = 320px <= 320px` (**PASS**).*

---

## E. SEVEN-SUITE CLEAN SEQUENTIAL REGRESSION RESULTS (+ FOCUSED PBR SUITE)

Executed sequentially from a clean starting state (`task-5638`) after final integrity remediation:

| # | Exact Command | Exit Code | Totals / Result |
| :-: | :--- | :-: | :---: |
| 0 | `node tests/test_pbr_texture_lifecycle.mjs` | **0** | **5/5 PASSED** (shared avatar/house textures preserved; owned textures & old cloned materials disposed) |
| 1 | `node tests/audit_pwa_security_performance.mjs` | **0** | **16/16 PASSED** (`DOMInteractive=243ms`, `LoadEventEnd=1652ms`, `FCP=520ms`, `LCP=unavailable`, `JSHeap=3MB`) |
| 2 | `node tests/verify_universal_cross_device.mjs` | **0** | **100% PASSED** (9 viewports, explicit desktop/mobile shell readiness, safe cleanup) |
| 3 | `node tests/verify_nular_master_transformation.mjs` | **0** | **19/19 PASSED** |
| 4 | `node tests/verify_phase11_visual_quality.mjs` | **0** | **12/12 PASSED** |
| 5 | `node tests/verify_phase12_immersive_e2e.mjs` | **0** | **14/14 PASSED** |
| 6 | `node tests/test_nular_gamification.mjs` | **0** | **100% PASSED** (hermetic CDN isolation + deterministic readiness poll) |
| 7 | `node tests/verify_post_refinement_interactions.mjs` | **0** | **11/11 PASSED** (`drawCalls=270`, `triangles=10696`, `avgFrameMsSwiftShader=94.7ms`, `heap=16.8MB`) |

**Sequential Run Verdict:** **8 / 8 suites exited with code `0`** (`0` failures, `0` uncaught console exceptions, `0` failed local network assets).

---

## F. VISUAL EVIDENCE INVENTORY

All prior evidence directories were preserved untouched, and a new final verification evidence directory was created:

1. **Final Release Gate Evidence (`docs/qa/final-readiness/` — 7 new post-320px-fix screenshots):**
   - `01_landing_mobile_320_zero_overflow.png` (`320×720`, 56 KB, hash `99ba41712f0a`) — Edge-to-edge full-bleed emerald, 0px overflow.
   - `02_landing_mobile_320_progress_wrapped.png` (`320×720`, 45 KB, hash `a7126effca3e`) — Progress CTA buttons cleanly wrapped inside card.
   - `03_landing_mobile_390_zero_overflow.png` (`390×844`, 71 KB, hash `d447f5412fac`).
   - `04_landing_desktop_1440.png` (`1440×900`, 327 KB, hash `1f6c32b52bde`).
   - `05_world_3d_desktop_1440.png` (`1440×900`, 344 KB, hash `f8dc60f2ff50`).
   - `06_world_3d_mobile_390.png` (`390×844`, 93 KB, hash `4d2e3c0c48c4`).
   - `07_offline_mobile_320.png` (`320×720`, 32 KB, hash `f732022cc1d2`) — Inline SVG icons, 0px overflow.
2. **Visual Refinement Evidence (`docs/qa/visual-refinement/` — 26 unique screenshots preserved):** Covers all landing viewports, 3D world desktop/mobile, compact/expanded Raga tutorial, mutually exclusive Joystick/D-pad, inspection drawer, house detail, atlas, profile, quests, leaderboard, 6 distinct redacted auth states, and offline fallback.
3. **Baseline Evidence (`docs/qa/evidence/` — 24 baseline screenshots preserved):** Retained for before-and-after comparison.

---

## G. 3D RENDERING MEASUREMENTS & HONEST LIMITATIONS

### Directly Measured Values (Headless Chromium ANGLE SwiftShader — Software WebGL, 1440×900)
- **Draw Calls:** `270` (`< 400` budget)
- **Triangles:** `10,696` (`< 50,000` mobile budget)
- **Geometries / Textures:** `358` geometries / `9` cached PBR textures
- **JS Heap Memory (Active 3D World):** `16.3 MB`
- **Average Frame Time (SwiftShader CPU Software Rasterizer):** `120.2 ms` (~8.3 fps on CPU software rendering)
- **Adaptive Quality Profiles:** `GameScene.detectDeviceCapability()` and `setQualityProfile()` (`performance`/`low`, `balanced`/`medium`, `high`, `ultra`) verified programmatically.
- **WebGL Context Loss & Restoration:** Synthetic `webglcontextlost` pauses render loop cleanly; `webglcontextrestored` resumes rendering without unhandled exceptions.
- **Scene Transitions:** `SceneStreamingManager.unloadActiveScene()` disposes previous house geometries/materials/non-cached textures while preserving shared `PbrTextureFactory` textures.

### Unverified / Hardware-Dependent Performance (Honest Disclosure)
- **Native GPU Frame Rate (FPS):** **NOT VERIFIED.** Headless Chromium uses SwiftShader CPU rasterization; 60 FPS on real mobile GPUs (Adreno, Mali, Apple GPU) or desktop GPUs is **not claimed** and must be measured on physical devices.
- **Thermal Throttling & Extended Multi-House Memory Stability:** Must be verified during 10–15 minute sessions on physical smartphones (especially <4 GB RAM iOS WebKit devices).

---

## H. SECURITY & ACCESSIBILITY RESULTS

### Security (Local Automated Verification)
- **Password Hashing:** `crypto.scryptSync` with unique 16-byte salt; hashes and raw passwords never returned by API.
- **Session Anti-Tampering:** HMAC-SHA256 `nular_session` cookie; tampered signatures return `null`.
- **Server-Authoritative Progression:** `/api/progress` computes XP strictly from server `XP_TABLE` (client-injected `999999` XP discarded; authoritative `10` XP awarded) with deterministic `eventKey` idempotency.
- **Phone OTP Validation & Rate Limiting:** Strict E.164 regex (`400` on invalid format) and 60-second cooldown (`429` on rapid resend).
- **Leaderboard Privacy:** Public `/api/leaderboard` strips emails and private user IDs.

### Accessibility (WCAG 2.2 AA Automated & Emulated Checks)
- **Keyboard Navigation:** `.skip-link` present and functional; focusable top-level navigation links verified; high-contrast focus rings active.
- **Reduced Motion:** `prefers-reduced-motion: reduce` media query respected (`NularArchitectureViewer` disables auto-rotation).
- **Touch Targets:** Mobile 3D controls measured at `56×56px` (`LARI`, `LOMPAT`, `E`) and `44×44px` (`#btn-mobile-hud-more`), meeting/exceeding WCAG 2.2 AA `44×44px`.
- **Non-3D Dossiers:** Full semantic text descriptions available for all 42 houses.

---

## I. PWA & OFFLINE VERIFICATION

- **Manifest (`manifest.webmanifest`):** Valid JSON, `display: "standalone"`, `#153027` theme, 192px (62 KB) and 512px (370 KB) icons present.
- **Service Worker (`sw.js`):** Excludes all non-GET requests and `/api/` endpoints from caching to protect sessions and OTPs; serves `./offline.html` on navigation failure.
- **Offline Page (`offline.html`):** Uses `2` inline SVGs (`0` Material Symbols font ligatures), `0px` overflow at `320px`, reload button, and recovery links (`index.html`, `map.html`, `profile.html`).

---

## J. OUTSTANDING PHYSICAL-DEVICE TESTS

Per [`docs/qa/NULAR_REMAINING_TEST_CHECKLIST.md`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/docs/qa/NULAR_REMAINING_TEST_CHECKLIST.md), the following require real physical hardware:
1. Real-device GPU FPS & thermal behavior on iOS (Safari WebKit) and Android (Chrome / Samsung Internet).
2. Physical multi-touch feel (simultaneous left-thumb joystick + right-thumb camera orbit + pinch-to-zoom).
3. iOS Safari manual "Add to Home Screen" standalone PWA launch, notch/Dynamic Island `safe-area-inset` alignment, and Web Audio unlock on first tap.
4. Android native PWA install banner and hardware Back-gesture behavior with open drawers/modals.
5. Physical Airplane Mode transition into `offline.html` and network recovery.

---

## K. UNCONFIGURED EXTERNAL INTEGRATIONS

The following external cloud integrations are **not configured** in this local environment and have **not** been integration-tested against live providers:
1. **Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`):** Returns honest HTTP `503` notice pointing to `docs/AUTHENTICATION_SETUP.md`.
2. **Twilio SMS OTP (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`):** Operates in local dev preview mode only (`local_dev_only`).
3. **Supabase Cloud Persistence (`SUPABASE_URL`, keys):** Sessions and progress currently run in local ephemeral memory / `localStorage`.

---

## L. KNOWN ISSUES & RECOMMENDATIONS

1. **Test Harness External Dependencies:** `tests/test_nular_gamification.mjs` now isolates `cdn.tailwindcss.com` hermetically so local CI never stalls on third-party CDNs; future tests should remain similarly hermetic.
2. **Hardware FPS Telemetry:** After deploying to a non-production Vercel Preview, capture real-device FPS using the built-in FPS counter in `auth.html` (`Tampilkan Penghitung FPS`) on at least one mid-range Android phone and one iPhone.
3. **Production Cloud Credentials:** Configure `GOOGLE_CLIENT_ID`, `TWILIO_*`, and `SUPABASE_*` in Vercel environment variables only when graduating from Controlled Preview to Public Beta.

---

## M. FINAL READINESS VERDICT

### **READY FOR PHYSICAL DEVICE VALIDATION** & **READY FOR CONTROLLED PREVIEW**

**Justification:**
- Zero local automated blockers remain: **7/7 regression suites exited with code `0`**, **9/9 viewports (320px–1920px) achieve exact 0px horizontal overflow**, all visual refinements are verified with fresh screenshots, and all security/PWA/offline guards pass cleanly.
- NULAR is **not** declared Production Ready yet because physical-device GPU/touch validation, Vercel Preview edge testing, and live external cloud integrations (Google OAuth, Twilio SMS, Supabase) remain unverified.
