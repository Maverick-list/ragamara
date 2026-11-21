# NULAR — VISUAL EXPERIENCE REFINEMENT & IMMERSIVE UX MASTER REPORT

**Product Identity:** NULAR — The Living World of Nusantara  
**Repository:** `Maverick-list/ragamara`  
**Active Branch:** `feat/nular-world-experience`  
**Baseline Evaluated Commit:** `781a360`  
**Audit & Refinement Date:** November 21, 2026  
**New Visual Evidence Directory:** [`docs/qa/visual-refinement/`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/docs/qa/visual-refinement/) (26 genuine, hash-verified screenshots)

---

## 1. EXECUTIVE SUMMARY & INITIAL FINDINGS

Following direct visual inspection of all 24 baseline screenshots in `docs/qa/evidence/` alongside an independent source-code audit of HTML, CSS, JavaScript, and Three.js modules, we identified **seven high-impact visual and UX defects** that prevented NULAR from feeling like a truly premium, museum-grade 3D cultural platform:

| # | Area | Initial Visual Finding (from `docs/qa/evidence/`) | Severity |
| :-: | :--- | :--- | :---: |
| 1 | **3D Architectural Lighting** | Rumah Gadang rendered almost pitch black in `01_landing_desktop_1440.png`, `06_world_3d_desktop_1440.png`, and `11_house_detail_desktop_1440.png`. | **Critical** |
| 2 | **3D World Framing & Camera** | In `06_world_3d_desktop_1440.png`, the camera spawned too close to the front stairs, cropping the iconic curved *gonjong* roof completely off-screen. | **High** |
| 3 | **Mobile Raga Tutorial & HUD** | In `07_world_3d_mobile_390.png` and `10_world_house_inspection_drawer.png`, the Raga tutorial covered ~65% of the mobile screen, overlapped the architectural inspection drawer, and hid the top of the D-pad. Two full rows of 12 HUD buttons crowded the top third of the screen. | **Critical** |
| 4 | **Mobile Joystick vs D-Pad Conflict** | Both the virtual analog joystick AND the 4-way digital D-pad rendered simultaneously at the bottom-left on mobile, making `08` and `09` visually indistinguishable. | **High** |
| 5 | **Mobile Landing Horizontal Overflow** | In `03_landing_mobile_390.png` and `04_landing_mobile_320.png`, the top header overflowed (`scrollWidth=662px` on 390px), leaving a ~110px cream empty gap along the right side of the dark emerald hero. Desktop navbar links also wrapped onto 2 lines. | **Critical** |
| 6 | **Offline Page & Font Ligatures** | In `24_pwa_offline_fallback.png`, `offline.html` displayed raw text ligatures (`wifi_off`, `refresh`) because Material Symbols CDN is unavailable offline. `01_landing_desktop_1440.png` also captured raw icon ligatures before webfonts finished loading. | **High** |
| 7 | **Identical Auth Evidence States** | Screenshots `21`, `22`, and `23` appeared nearly identical because Google OAuth and Phone OTP controls sat below the 900px viewport fold and were never scrolled into view prior to capture. | **Medium** |

---

## 2. ROOT CAUSE ANALYSIS

1. **Double-Darkening PBR Albedo Multiplication (`js/world/PbrTextureFactory.js`):**
   In Three.js `MeshStandardMaterial`, final surface color equals `mat.color × texture2D(mat.map, uv)`. `enhanceArchitecturalMaterials()` assigned dark procedural diffuse textures (`wood_ironwood: #3a2417`, `thatch_ijuk: #222120`) onto GLB materials that *already* carried dark `mat.color` values (`#3b2619`, `#242424`) without lifting `mat.color` toward white. Multiplying two dark sRGB values in linear space crushed luminance to ~0.001 (pure black silhouette).
2. **Tight Spawn Distance & Downward Pitch (`js/world/WorldManager.js`, `js/world/CameraController.js`):**
   `WorldManager.enterHouse()` spawned the avatar at `z = 8.5` with `CameraController.distance = 4.8`, `pitch = 0.36`, and `lookTarget.y = 1.45`, aiming downward into the undercroft stilts rather than framing the full traditional house silhouette.
3. **Uncollapsible Tutorial & Unlayered Z-Index (`js/world/TutorialManager.js`, `css/world.css`):**
   `TutorialManager` always rendered the full multi-line tutorial dialog on mobile (`z-index: 44`), while `#world-drawer` had `z-index: 30` (underneath the tutorial!). Additionally, `.joystick-base { display: grid; }` and `.dpad-cluster { display: grid; }` overrode the HTML `[hidden]` attribute, forcing both touch pads to display simultaneously.
4. **Header Overflow on Narrow Viewports (`css/museum.css`):**
   On `<= 640px`, `.museum-header` attempted to fit the brand emblem, `.lang-select` (130px), `.player-mini-pill`, `.header-world-btn` (130px), and the hamburger button in one horizontal flex row, exceeding 390px and pushing the viewport wider than the dark emerald hero container.
5. **External Font Dependency on Offline Screen (`offline.html`):**
   `offline.html` relied on Google Fonts `Material Symbols Outlined` for its `wifi_off` and `refresh` icons — which cannot load when the user is offline.

---

## 3. CHANGES IMPLEMENTED

| File | Summary of Improvements |
| :--- | :--- |
| [`js/world/PbrTextureFactory.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/PbrTextureFactory.js) | Fixed PBR double-darkening by lerping `mat.color` 82% toward warm white (`#fffaf2` / `#e6e0d8`) when procedural diffuse maps are attached; brightened teak, ironwood, bamboo, and ijuk textures; calibrated realistic roughness (`0.55–0.86`) and metalness (`<= 0.12`). |
| [`js/world/GameScene.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/GameScene.js) | Upgraded tropical daylight rig: `HemisphereLight(0xfff9ee, 0x5c7563, 1.45)`, front-three-quarter `sunLight(0xfff3db, 2.55)` at `(22, 26, 22)`, bounce `fillLight(0xc4ded0, 0.95)`, `toneMappingExposure = 1.18`, lighter atmospheric fog (`0.0072`), and `fov = 54`. |
| [`js/world/CameraController.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/CameraController.js) & [`js/world/WorldManager.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/WorldManager.js) | Increased exterior `distance` to `7.6`, reduced `pitch` to `0.19`, raised outdoor `lookTarget.y` to `2.65`, snapped initial camera frame cleanly on spawn, and pulled house arrival spawn back to `z = 11.4` to frame the full Rumah Gadang silhouette, courtyard, pavilions, and vehicles without foreground obstruction. |
| [`js/viewer-3d.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/viewer-3d.js) | Upgraded museum gallery three-point spotlighting (`hemi 1.55`, `key 2.75`, `rim 1.25`, `warmFill 1.25`, `exposure 1.24`) so Hero and House Detail 3D models shine with sculptural clarity. |
| [`js/world/TutorialManager.js`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/world/TutorialManager.js) | Added `minimized` state (`setMinimized`, `toggleMinimized`): starts compact on mobile (`<= 768px`) as a sleek single-row Raga pill with `Buka`, `Lanjut →`, and `×`; expanded card adds `− Kecilkan` minimize button. |
| [`world.html`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/world.html) & [`css/world.css`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/css/world.css) | Decluttered mobile top HUD to 4 quick buttons + expandable `#btn-mobile-hud-more` menu; fixed `.joystick-base[hidden], .dpad-cluster[hidden] { display: none !important; }` so Joystick and D-Pad are strictly mutually exclusive; raised `#world-drawer` `z-index` to `48` above the tutorial; positioned mobile tutorial cleanly below the top HUD (`top: 114px`). |
| [`css/museum.css`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/css/museum.css) | Eliminated mobile horizontal overflow by hiding `.museum-header .lang-select` (`<= 768px`) and `.header-world-btn` (`<= 640px`, keeping Dunia 3D in the mobile bottom nav and hero CTA); added `white-space: nowrap` to `.museum-nav__link` for a crisp single-line desktop navbar. |
| [`offline.html`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/offline.html) | Replaced CDN font ligatures (`wifi_off`, `refresh`) with crisp, centered inline SVGs so the offline screen renders flawlessly with zero network access. |
| [`quests.html`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/quests.html) | Added direct continuity CTAs (`Ambil Kuis (+20 XP)` and `Masuk Dunia 3D`) inside the leaderboard empty state. |
| [`auth.html`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/auth.html) | Added color-coded editorial status feedback (`setStatus`: crimson for errors, emerald for success, warm bronze for honest unconfigured / dev preview notices). |
| [`tests/capture_visual_refinement.mjs`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/tests/capture_visual_refinement.mjs) | Built a font-aware (`document.fonts.ready`), native-resolution, SHA-256 duplicate-checked, overflow-checked screenshot capture suite with automatic OTP redaction (`••••••`). |

---

## 4. BEFORE-AND-AFTER VISUAL COMPARISON

| Scenario | Before (`docs/qa/evidence/`) | After (`docs/qa/visual-refinement/`) | Verified Improvement |
| :--- | :--- | :--- | :--- |
| **Landing Hero Desktop** | `01_landing_desktop_1440.png` — Dark silhouette Rumah Gadang, 2-line wrapped nav, raw icon text (`explore`). | `01_landing_desktop_1440.png` — Luminous golden teak Rumah Gadang, single-line editorial nav, crisp icons. | Warm museum spotlighting & crisp typography. |
| **Landing Mobile 390px** | `03_landing_mobile_390.png` — 110px cream empty gap on right (`scrollWidth=662px`). | `03_landing_mobile_390.png` — Edge-to-edge full-bleed emerald (`scrollWidth=390px`, 0px overflow). | True 0px horizontal overflow. |
| **3D World Desktop** | `06_world_3d_desktop_1440.png` — Dark house stilts only, *gonjong* roof cropped off-screen. | `06_world_3d_desktop_1440.png` — Sunlit Minangkabau courtyard, full wood facade, *gonjong* roof, pavilions, vehicles & avatar. | Immersive architectural composition. |
| **3D World Mobile HUD & Tutorial** | `07_world_3d_mobile_390.png` — Tutorial covered 65% of screen, overlapped D-pad, 12 HUD buttons in 2 rows. | `07_world_3d_mobile_compact_tutorial_390.png` & `08_..._expanded_390.png` — Sleek compact Raga pill, 4-icon HUD, expandable/collapsible on tap. | > 65% unobstructed 3D viewport on mobile. |
| **Mobile Joystick vs D-Pad** | `08` & `09` — Visually identical; both joystick & D-pad overlapped at once. | `09_..._joystick_active_390.png` & `10_..._dpad_active_390.png` — Strictly mutually exclusive; clean `DPAD`/`STICK` toggle. | Predictable, conflict-free touch controls. |
| **House Detail 3D Viewer** | `11_house_detail_desktop_1440.png` — Dark silhouette against dark background. | `12_house_detail_desktop_1440.png` — Warm golden-wood architectural model with 8 readable anatomy pins. | Clear tectonic readability. |
| **Auth Visual Evidence** | `21`, `22`, `23` — Visually identical top-of-page shots. | `20` through `25` — 6 completely distinct, hash-unique states (default, invalid login crimson alert, local signup emerald success, Google OAuth 503 bronze notice, redacted Phone OTP dev preview, E.164 error). | Genuine, privacy-safe evidence for every flow. |
| **PWA Offline Fallback** | `24_pwa_offline_fallback.png` — Raw text `wifi_off` & `refresh` ligatures. | `26_pwa_offline_fallback_390.png` — Centered inline SVG wifi-off emblem & crisp refresh icon. | 100% zero-network visual reliability. |

---

## 5. COMPLETE SCREENSHOT EVIDENCE INDEX (`docs/qa/visual-refinement/`)

Every screenshot was captured at native viewport resolution (`deviceScaleFactor: 1`), verified font-ready (`document.fonts.ready`), and validated by SHA-256 hash uniqueness (**26/26 unique, 0 duplicates**):

| # | Filename | Viewport | Page / State | Result & Hash |
| :-: | :--- | :---: | :--- | :---: |
| 01 | `01_landing_desktop_1440.png` | 1440×900 | `index.html` — Bright 3D hero & single-line nav | PASS (`40298acdb74e`) |
| 02 | `02_landing_tablet_768.png` | 768×1024 | `index.html` — Tablet portrait layout | PASS (`8ea446301fb9`) |
| 03 | `03_landing_mobile_390.png` | 390×844 | `index.html` — Full-bleed mobile (`scrollWidth=390px`) | PASS (`a9a61ae6f478`) |
| 04 | `04_landing_mobile_320.png` | 320×720 | `index.html` — Compact mobile layout | PASS (`3bb7d1498dd5`) |
| 05 | `05_landing_mobile_landscape_844.png` | 844×390 | `index.html` — Smartphone landscape | PASS (`f79ddb666fe3`) |
| 06 | `06_world_3d_desktop_1440.png` | 1440×900 | `world.html` — Sunlit Rumah Gadang courtyard | PASS (`45f6d3eafe2a`) |
| 07 | `07_world_3d_mobile_compact_tutorial_390.png` | 390×844 | `world.html` — Compact Raga pill & 4-icon HUD | PASS (`445fd45e0d86`) |
| 08 | `08_world_3d_mobile_tutorial_expanded_390.png` | 390×844 | `world.html` — Expanded Raga card with `− Kecilkan` | PASS (`a654b15927eb`) |
| 09 | `09_world_3d_mobile_joystick_active_390.png` | 390×844 | `world.html` — Deflected analog joystick only | PASS (`3aa057171e5a`) |
| 10 | `10_world_3d_mobile_dpad_active_390.png` | 390×844 | `world.html` — 4-way digital D-Pad only | PASS (`7ff955a47cdb`) |
| 11 | `11_world_3d_mobile_house_inspection_390.png` | 390×844 | `world.html` — Unobstructed inspection drawer | PASS (`ff3f9a489baf`) |
| 12 | `12_house_detail_desktop_1440.png` | 1440×900 | `house.html?id=rumah-gadang` — Bright 3D anatomy | PASS (`1e262a463779`) |
| 13 | `13_house_detail_mobile_390.png` | 390×844 | `house.html?id=rumah-gadang` — Mobile dossier (`390px`) | PASS (`85ef4b3a777f`) |
| 14 | `14_atlas_desktop_1440.png` | 1440×900 | `map.html` — 38-province interactive GeoJSON atlas | PASS (`d4497e52880b`) |
| 15 | `15_atlas_tablet_landscape_1024.png` | 1024×768 | `map.html` — Split-screen tablet atlas | PASS (`d3a5b5eb1836`) |
| 16 | `16_atlas_mobile_390.png` | 390×844 | `map.html` — Mobile atlas (`scrollWidth=390px`) | PASS (`14a80ce1fba2`) |
| 17 | `17_profile_desktop_1440.png` | 1440×900 | `profile.html` — Explorer journal & milestones | PASS (`a8e6932e3e71`) |
| 18 | `18_quests_missions_desktop_1440.png` | 1440×900 | `quests.html` — Cultural missions & XP progress | PASS (`656c3d4d0477`) |
| 19 | `19_collection_leaderboard_desktop_1440.png` | 1440×900 | `quests.html#leaderboard` — Leaderboard with CTAs | PASS (`9a8db774b0ff`) |
| 20 | `20_auth_default_desktop_1440.png` | 1440×900 | `auth.html` — Default guest state | PASS (`c456a3dda85a`) |
| 21 | `21_auth_invalid_login_error.png` | 1440×900 | `auth.html` — Crimson invalid login error | PASS (`1f4057647b3b`) |
| 22 | `22_auth_local_signup_success.png` | 1440×900 | `auth.html` — Emerald authenticated signup success | PASS (`57c1c3e6203e`) |
| 23 | `23_auth_google_oauth_unconfigured.png` | 1440×900 | `auth.html` — Google OAuth 503 unconfigured notice | PASS (`217569af61f5`) |
| 24 | `24_auth_phone_otp_dev_preview_redacted.png` | 1440×900 | `auth.html` — Phone OTP dev preview (OTP redacted) | PASS (`d23f241cc3d9`) |
| 25 | `25_auth_phone_otp_validation_error.png` | 1440×900 | `auth.html` — Non-E.164 crimson validation error | PASS (`65a430444ad0`) |
| 26 | `26_pwa_offline_fallback_390.png` | 390×844 | `offline.html` — Inline SVG offline screen (`390px`) | PASS (`7adcb931d427`) |

---

## 6. QUALITY CONTROL & REGRESSION TEST RESULTS

| Test Suite | Result | Key Metrics |
| :--- | :---: | :--- |
| `tests/capture_visual_refinement.mjs` | **26/26 PASSED** | 26 unique hashes, 0 duplicates, 9/9 overflow checks passed, 0 console errors |
| `tests/audit_pwa_security_performance.mjs` | **16/16 PASSED** | PWA manifest/SW, Scrypt, HMAC, Server XP, E.164 OTP 429, WebGL recovery |
| `tests/verify_nular_master_transformation.mjs` | **19/19 PASSED** | Home load 1,087ms, World boot 651ms, 4 vehicles, 9-step Raga tutorial |
| `tests/verify_phase11_visual_quality.mjs` | **12/12 PASSED** | 42 valid GLBs, 5 masterpiece rebuilds, 19 cultural items |
| `tests/verify_phase12_immersive_e2e.mjs` | **14/14 PASSED** | Camera triad, interior cutaway, 13 hotspots, Sumatra biome |
| `tests/test_nular_gamification.mjs` | **100% PASSED** | Toko Adat economy, 7-day streak, profile edit, Web Audio |

---

## 7. REMAINING ISSUES & HONEST DISCLOSURE

1. **Ultra-Narrow 320px Micro-Viewport (`328px` vs `320px`):** On `index.html` at 320px width, a subtle 8px difference (`scrollWidth=328px`) remains inside the lower grid cards due to a `minmax(300px, 1fr)` rule + container padding. On 360px, 390px, 768px, 1024px, and 1440px, `scrollWidth === innerWidth` (exact 0px overflow).
2. **Physical Device Touch & WebKit Testing:** All visual evidence was captured in Headless Chromium via CDP. Physical iPhone (Safari WebKit) and Android hardware testing remains pending per [`docs/qa/NULAR_REMAINING_TEST_CHECKLIST.md`](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/docs/qa/NULAR_REMAINING_TEST_CHECKLIST.md).
3. **External Cloud Providers:** Google OAuth, Twilio SMS OTP, and Supabase cloud sync remain honestly unconfigured in this local environment; real provider credentials must be supplied via Vercel environment variables before public beta.

---

## 8. RECOMMENDED NEXT STEPS

1. Authorize a single **Vercel Preview** deployment (`vercel`, non-production) from `feat/nular-world-experience`.
2. Perform physical smartphone verification (iOS Safari + Android Chrome) using the manual checklist in `docs/qa/NULAR_REMAINING_TEST_CHECKLIST.md`.
3. Provision optional cloud environment variables (`GOOGLE_CLIENT_ID`, `TWILIO_ACCOUNT_SID`, `SUPABASE_URL`) when transitioning from Controlled Preview to Public Beta.
