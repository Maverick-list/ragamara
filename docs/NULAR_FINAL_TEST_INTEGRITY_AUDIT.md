# NULAR — FINAL TEST INTEGRITY AUDIT (READ-ONLY)

**Repository:** `Maverick-list/ragamara`  
**Branch Audited:** `feat/nular-world-experience`  
**Commit Audited:** `221afd3` (compared against `c4d8d66`)  
**Audit Mode:** Strict Read-Only (zero edits to application code, test suites, or Git history)  
**Audit Date:** November 21, 2026  

---

## 1. OVERALL AUDIT VERDICT

### **CONDITIONAL PASS — Minor concerns remain**

**Summary Justification:**
- **No test weakening or failure concealment was detected.** Across all five reviewed test files, zero assertions were removed, zero expected values were loosened to force passes, and zero security, authentication, accessibility, or responsive checks were bypassed.
- **All seven regression suites in `task-5587` genuinely completed with Exit Code `0`** (independently verified against all 277 lines of the raw execution log).
- However, **four minor, non-blocking integrity concerns** were identified in polling timeout diagnostics, early `LoadEventEnd` sampling, and shared PBR texture ownership for avatar textiles. None invalidate the passing results, but they should be hardened in the next maintenance pass.

---

## 2. TEST FILES REVIEWED & DIFF COMPARISON (`c4d8d66..221afd3`)

| Test File | Original Intent | Summary of Changes in `221afd3` | Assertions Removed / Weakened? |
| :--- | :--- | :--- | :---: |
| [`tests/test_nular_gamification.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/test_nular_gamification.mjs) | Validate legacy Toko Adat economy, 7-day streak idempotency, Profile Edit modal, and Web Audio synthesis on `legacy_app.html`. | Replaced blind `setTimeout(1000)` with 15s polling for `RagamaraEcosystem?.Store?.state?.player` (throws explicit timeout error); stubbed external `cdn.tailwindcss.com` script in test HTTP server with `window.tailwind = {}`. | **None** |
| [`tests/verify_phase11_visual_quality.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_phase11_visual_quality.mjs) | Verify 42 GLBs on disk, 5 masterpiece rebuilds, 19 cultural items, 3D canvas mount, world init, and screenshot capture. | Moved `<canvas>` existence check into the same deterministic 45×200ms readiness loop as `window.__NULAR_WORLD__?.running`. | **None** |
| [`tests/verify_universal_cross_device.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_universal_cross_device.mjs) | Verify 0px horizontal overflow across 9 viewports, mobile bottom nav visibility, house bottom sheet, joystick/D-pad toggle, landscape, and tablet atlas. | Added 25×200ms readiness poll for `#mobile-bottom-nav` mount before measuring viewport; wrapped `/tmp` `fs.rmSync(chromeDataDir)` cleanup in `try {} catch {}` to prevent `ENOTEMPTY` race after `SIGKILL`. | **None** |
| [`tests/audit_pwa_security_performance.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/audit_pwa_security_performance.mjs) | Verify PWA manifest/SW `/api/` bypass, Scrypt, HMAC, server XP, E.164 OTP 429, leaderboard privacy, CWV, adaptive 3D quality, WebGL context loss, pinch-to-zoom, keyboard contraction. | Replaced blind `setTimeout(1500)` on `index.html` with 30×200ms poll for `domInteractive > 0`; replaced blind `setTimeout(2200)` on `world.html` with 40×250ms poll for `window.__NULAR_WORLD__?.running`. | **None** |
| [`tests/verify_post_refinement_interactions.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_post_refinement_interactions.mjs) | Verify live tutorial lifecycle, joystick/D-pad mutual exclusivity, mobile HUD expansion, drawer layering, touch targets, measured 3D budget, eager+lazy images, keyboard a11y, reduced motion, offline SVGs. | Upgraded `CDPClient.navigate()` to listen for `Page.loadEventFired` (with 6s fallback) before settling 800ms; expanded image audit to force eager decoding (`img.loading = 'eager'`) so lazy below-the-fold images are genuinely loaded and verified. | **None** |

---

## 3. TEST WEAKENING & SUSPICIOUS CHANGE INSPECTION

No assertions were deleted, downgraded to warnings, or bypassed. The following specific lines were flagged for scrutiny during independent review:

1. **Silent Fallback on Polling Timeout — `tests/audit_pwa_security_performance.mjs:284-288` & `:308-312`:**
   - Neither `for` loop throws an explicit timeout error if the condition is never met. While downstream assertions (`domInteractive < 2500 && metricMap.LayoutCount > 0` and `worldEngineAudit?.running`) would still fail on null/uninitialized state, explicit timeout errors provide clearer diagnostics.
   - **Notable Side Effect (`LoadEventEnd=0ms`):** Because line 285 breaks as soon as `domInteractive > 0`, `navTiming.loadEventEnd` was sampled before the `load` event finished (`DOMInteractive=155ms, LoadEventEnd=0ms` in `task-5587` line 24). The assertion (`navTiming.domInteractive < 2500 && metricMap.LayoutCount > 0`) was unchanged and remains valid, but `LoadEventEnd=0ms` is an incomplete measurement.
2. **Silent Fallback on Polling Timeout — `tests/verify_universal_cross_device.mjs:198-203`:**
   - Polls for `#mobile-bottom-nav` up to 5s without throwing on expiry. On mobile (`< 768px`), line 218 still catches a missing nav (`Mobile bottom nav missing`). On desktop (`>= 768px`), however, if ES module shell initialization completely failed, `bNavVisible` would evaluate falsy and still pass the `vp.w >= 768 && metrics.bNavVisible` check.
3. **Broad Exception Suppression on Temp Cleanup — `tests/verify_universal_cross_device.mjs:344`:**
   - `try { fs.rmSync(chromeDataDir, { recursive: true, force: true }); } catch {}` suppresses `ENOTEMPTY` when Chrome releases `/tmp/chrome-universal-qa-*` asynchronously after `SIGKILL`. Located in `finally` after all assertions complete; does not mask any test or application defect.
4. **Silent Fallback Timeout in `CDPClient.navigate()` — `tests/verify_post_refinement_interactions.mjs:68-71`:**
   - Resolves `loadPromise` after 6,000ms if `Page.loadEventFired` is not received. Downstream DOM assertions still catch broken pages, but logging or rejecting on navigation timeout would be stricter.

---

## 4. CDN ISOLATION ASSESSMENT (`tests/test_nular_gamification.mjs:42-48`)

- **Implementation:** Inside the test-local HTTP server only, `<script src="https://cdn.tailwindcss.com"></script>` in the legacy backup fixture (`data/backups/pre-museum-transformation/legacy_app.html`) is replaced with `<script>window.tailwind = {};</script>`. The repository backup file itself is untouched.
- **Dependencies Preserved:** All local application scripts and stylesheets (`js/ecosystem.js`, `js/culture_db_data.js`, `js/mascot.js`, `js/illustrations.js`, `js/minigames.js`, `js/motion.js`, `css/tokens.css`, `css/components.css`, `css/animations.css`) load unmodified with HTTP `200`.
- **Assessment:** **Appropriate and safe for functional gamification testing.** Removing parser-blocking third-party Tailwind CDN eliminates external network flakes without concealing any defects in `RagamaraEcosystem` state, Toko Adat economy, 7-day streak idempotency, profile edit DOM updates, or Web Audio synthesis.
- **Limitation:** Visual/layout styling of the legacy backup page is not exercised by this suite because Tailwind utility classes are not compiled during the run.

---

## 5. DETERMINISTIC READINESS POLLING ASSESSMENT

| Suite | Readiness Condition | Explicit Timeout Error? | Rating |
| :--- | :--- | :---: | :---: |
| `tests/test_nular_gamification.mjs:156-165` | `typeof RagamaraEcosystem !== 'undefined' && RagamaraEcosystem?.Store?.state?.player` | **Yes** (`throw new Error(...)`) | **Strong** |
| `tests/verify_phase11_visual_quality.mjs:114-127` | `hasCanvas` + `window.__NULAR_WORLD__?.running && activeHouse?.id === "rumah-gadang"` | **Yes** (recorded as `[FAIL]` via `check()`) | **Strong** |
| `tests/audit_pwa_security_performance.mjs:284-288` | `navigation[0]?.domInteractive > 0` | No (falls through; samples `LoadEventEnd=0ms`) | **Adequate (Minor Gap)** |
| `tests/audit_pwa_security_performance.mjs:308-312` | `window.__NULAR_WORLD__?.running` | No (falls through to null-checked failure) | **Adequate (Minor Gap)** |
| `tests/verify_universal_cross_device.mjs:198-203` | `Boolean(document.getElementById("mobile-bottom-nav"))` | No (falls through; safe on mobile, loose on desktop) | **Adequate (Minor Gap)** |
| `tests/verify_post_refinement_interactions.mjs:58-75` | `Page.loadEventFired` + 800ms settle | No (6s silent resolve) | **Adequate (Minor Gap)** |

---

## 6. FINAL REGRESSION EVIDENCE VALIDATION (`task-5587`)

Independently inspected the complete raw log (`/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988/.system_generated/steps/5587/output.txt`, 277 lines):

- **Overall Command Exit Code (Line 1):** `Command exited with code 0.`
- **Verified Individual Exit Codes & Totals:**
  1. `tests/audit_pwa_security_performance.mjs` — **Exit Code `0`** (Line 32) · `16/16 PASSED`
  2. `tests/verify_universal_cross_device.mjs` — **Exit Code `0`** (Line 87) · `9/9 viewports PASSED`, `320px=320px`, `1280px=1265px`, bottom sheet, D-pad, landscape, tablet atlas all passed
  3. `tests/verify_nular_master_transformation.mjs` — **Exit Code `0`** (Line 113) · `19/19 PASSED`
  4. `tests/verify_phase11_visual_quality.mjs` — **Exit Code `0`** (Line 134) · `12/12 PASSED`
  5. `tests/verify_phase12_immersive_e2e.mjs` — **Exit Code `0`** (Line 157) · `14/14 PASSED`
  6. `tests/test_nular_gamification.mjs` — **Exit Code `0`** (Line 257) · `0` console/page errors; Store, Toko Adat, 7-day streak, Profile Edit, Web Audio passed
  7. `tests/verify_post_refinement_interactions.mjs` — **Exit Code `0`** (Line 276) · `11/11 PASSED`
- **Final Marker (Line 277):** `=== FINAL RELEASE GATE 7-SUITE RUN: ALL 7/7 EXITED WITH CODE 0 ===`.

All seven suites genuinely executed sequentially and exited with code `0`.

---

## 7. PBR RESOURCE LIFECYCLE AUDIT (`GameScene.js` & `PbrTextureFactory.js`)

1. **Architectural House Transitions (`SceneStreamingManager.unloadActiveScene()` → `GameScene.disposeObject()`):**
   - `PbrTextureFactory.enhanceArchitecturalMaterials()` attaches cached `CanvasTexture` objects to `mat.map` and `mat.bumpMap` and stamps `mat.userData.nularPbrApplied = true`.
   - `GameScene.disposeObject()` (`js/world/GameScene.js:161-163`) now guards `if (m.map && !m.userData?.nularPbrApplied) m.map.dispose();`, preventing premature disposal of shared architectural textures across 42-house transitions.
2. **Identified Minor Lifecycle Gap #1 — Avatar Textile Shared Textures (`PbrTextureFactory.js:375-384`):**
   - `applyRegionalTextileToAvatar()` assigns cached regional batik `CanvasTexture` objects (`getRegionalTextileTexture(outfitId)`) to `obj.material.map` and `obj.material.bumpMap`, **without** setting `obj.material.userData.nularPbrApplied = true`. If `GameScene.disposeObject()` is invoked on an avatar mesh during outfit switching or teardown, `m.map.dispose()` will prematurely dispose the shared cached batik texture.
3. **Identified Minor Lifecycle Gap #2 — Non-Diffuse Texture Maps & Teardown:**
   - `GameScene.disposeObject()` only checks `m.map` and does not dispose `m.bumpMap`, `m.normalMap`, `m.roughnessMap`, or `m.emissiveMap` on non-PBR GLB materials (low impact today since current GLBs rely primarily on diffuse/standard materials, but worth guarding for future textured GLBs).
   - `PbrTextureFactory.cache` holds 9 cached procedural textures for the lifetime of the browser tab (~2–3 MB) without a `disposeAllPbrTextures()` hook on `GameScene.dispose()`. This is intentional for reuse during a session and is reclaimed by the browser on tab unload.

---

## 8. EVIDENCE LIMITATIONS

- All 7 suites executed locally in Headless Chromium (ANGLE SwiftShader software WebGL) on Linux x86_64.
- Physical hardware GPU frame rates, real mobile touch digitizers, iOS Safari WebKit PWA behavior, Vercel Preview edge routing, and live external integrations (Google OAuth, Twilio SMS OTP, Supabase) remain outside the scope of these automated logs.

---

## 9. RECOMMENDED ACTIONS (FOR NEXT MAINTENANCE PASS)

1. **Add explicit timeout throws** to the readiness polling loops in `tests/audit_pwa_security_performance.mjs` (and poll `loadEventEnd > 0` for complete CWV reporting) and `tests/verify_universal_cross_device.mjs` (verifying `#museum-header-mount` has mounted on desktop too).
2. **Tag avatar textile materials** in `PbrTextureFactory.applyRegionalTextileToAvatar()` with `obj.material.userData = { ...(obj.material.userData || {}), nularPbrApplied: true }` so shared batik textures receive the same disposal protection as architectural textures.
3. **Log unexpected errors** (non-`ENOTEMPTY`) in `tests/verify_universal_cross_device.mjs:344` instead of an empty `catch {}`.

---

## 10. CONDITIONAL PASS REMEDIATION & FINAL INTEGRITY CLOSURE

**Post-Remediation Status:** **`PASS — Test integrity preserved`** (all 4 minor audit findings remediated and verified in `task-5638`).

### 10.1 Remediation Matrix

| # | Original Finding | Exact File & Line | Root Cause | Actual Fix Implemented | Verification Result |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | Shared avatar batik textures lacked shared-ownership markers and leaked old cloned materials on outfit swaps | [`js/world/PbrTextureFactory.js:20-34`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/PbrTextureFactory.js#L20-L34), [`L380-L398`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/PbrTextureFactory.js#L380-L398); [`js/world/GameScene.js:155-174`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/GameScene.js#L155-L174) | Shared ownership lived only on architectural `mat.userData.nularPbrApplied`, not on the cached `THREE.Texture` itself; `applyRegionalTextileToAvatar` cloned materials without disposing prior cloned materials. | Stamped `tex.userData.nularSharedPbrTexture = true` in `finalizeTexture()`, exported `isSharedPbrTexture(tex)`, tagged cloned avatar materials with `nularPbrApplied` + `nularClonedAvatarMat` (disposing prior cloned materials on repeat swaps), and updated `GameScene.disposeObject()` to deduplicate and dispose all non-shared texture slots (`map`, `bumpMap`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`) while preserving shared cached textures. | **PASS** (`tests/test_pbr_texture_lifecycle.mjs` **5/5 PASSED**, Exit Code `0`) |
| 2 | Silent fall-through on readiness polling timeouts across 3 suites (including desktop shell readiness gap) | [`tests/audit_pwa_security_performance.mjs:282-352`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/audit_pwa_security_performance.mjs#L282-L352); [`tests/verify_universal_cross_device.mjs:195-221`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_universal_cross_device.mjs#L195-L221); [`tests/verify_post_refinement_interactions.mjs:58-87`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_post_refinement_interactions.mjs#L58-L87) | Loops exited silently on expiry; `verify_universal_cross_device.mjs` only checked `#mobile-bottom-nav`; `CDPClient.navigate` silently resolved after 6s. | Added explicit timeout errors containing URL/viewport, expected condition, actual observed state, and timeout duration (`8s`–`10s`); verified required `header.museum-header` + `#mobile-bottom-nav` + `document.readyState === 'complete'` across all 9 desktop and mobile viewports; converted `CDPClient.navigate` timeout to an explicit rejection. | **PASS** (all 3 suites Exit Code `0` in `task-5638`) |
| 3 | Early `LoadEventEnd=0ms` sampling & conflated timing labels | [`tests/audit_pwa_security_performance.mjs:282-328`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/audit_pwa_security_performance.mjs#L282-L328) | Poll stopped on `domInteractive > 0` before `loadEventEnd` fired; label grouped Navigation Timing under "Core Web Vitals". | Waited explicitly for `document.readyState === 'complete' && loadEventEnd > 0`; sampled `DOMInteractive`, `LoadEventEnd`, and actual `first-contentful-paint` (`FCP`) separately, reporting `LCP=unavailable` honestly; renamed check to `Navigation Timing & Paint Metrics (Homepage)`. | **PASS** (`DOMInteractive=243ms, LoadEventEnd=1652ms, FCP=520ms, LCP=unavailable`) |
| 4 | Broad empty `catch {}` on `/tmp` directory cleanup | [`tests/verify_universal_cross_device.mjs:355-374`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/verify_universal_cross_device.mjs#L355-L374) | Empty `catch {}` suppressed any filesystem error during `finally` cleanup. | Added 150ms settle after `SIGKILL`, explicitly scoped known race handling to `ENOTEMPTY`/`EBUSY`/`ENOENT` with a diagnostic warning, re-threw unexpected filesystem errors, and preserved `primaryTestErr` so cleanup can never mask a test failure. | **PASS** (Exit Code `0`, 0 errors) |

### 10.2 Post-Remediation Sequential Verification (`task-5638`)
All 8 suites (focused PBR lifecycle + complete 7-suite regression gate) executed sequentially from a clean starting state and exited with code **`0`**:
1. `node tests/test_pbr_texture_lifecycle.mjs` — **Exit Code `0`** (`5/5 PASSED`)
2. `node tests/audit_pwa_security_performance.mjs` — **Exit Code `0`** (`16/16 PASSED`)
3. `node tests/verify_universal_cross_device.mjs` — **Exit Code `0`** (`100% PASSED`, 9/9 viewports 0px overflow)
4. `node tests/verify_nular_master_transformation.mjs` — **Exit Code `0`** (`19/19 PASSED`)
5. `node tests/verify_phase11_visual_quality.mjs` — **Exit Code `0`** (`12/12 PASSED`)
6. `node tests/verify_phase12_immersive_e2e.mjs` — **Exit Code `0`** (`14/14 PASSED`)
7. `node tests/test_nular_gamification.mjs` — **Exit Code `0`** (`100% PASSED`)
8. `node tests/verify_post_refinement_interactions.mjs` — **Exit Code `0`** (`11/11 PASSED`)

### 10.3 Remaining Limitations
- Cold external Google Fonts latency in containerized runs can occasionally spike `DOMInteractive` above 2500ms if `fonts.googleapis.com` stalls; this is an external network characteristic and the `< 2500ms` assertion was intentionally kept strict.
- Physical hardware GPU FPS, iOS Safari WebKit PWA behavior, Vercel Preview edge routing, and unconfigured external cloud providers (Google OAuth, Twilio SMS OTP, Supabase) remain outside local automated scope.
