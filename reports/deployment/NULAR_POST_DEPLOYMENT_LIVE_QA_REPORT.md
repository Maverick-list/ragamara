# NULAR (NUSA LEARN) — POST-DEPLOYMENT LIVE VERIFICATION & ACCESS AUDIT REPORT

**Audit Date & Time:** 2026-11-14T22:25:00+07:00  
**Auditor Roles:** Senior QA Engineer, Vercel Deployment Engineer, Web Security Auditor  
**Project:** NULAR (Nusa Learn) — The Living Atlas of Nusantara  
**Deployment Target:** Vercel Preview Only  
**Final Verdict:** **PREVIEW DEPLOYED, LIVE-VERIFIED VIA AUTHORIZED CHANNEL & SECURITY-HARDENED**  

---

## 1. EXECUTIVE SUMMARY

The NULAR (Nusa Learn) feature branch `feat/ragamara-final-experience` was safely deployed to a dedicated Vercel Preview environment under deployment ID `dpl_8yFjczk23zXNiSBEUMv7zE9Uj82s` and achieved status **`READY`**.

An access and quality assurance investigation was conducted to:
1. Identify the root cause of the previous exit code 1 in `verify_live_preview.mjs`.
2. Inspect the live Preview deployment using authorized Vercel Preview channels without disabling or weakening Vercel SSO Protection or security policies.
3. Validate that public-facing pages deliver the finalized **NULAR (Nusa Learn)** identity.
4. Verify that internal directories (`.env`, `data/backups/`, `ragamara-data-engine/`, `tests/`, `venv/`, `reports/`) are strictly blocked from public access.
5. Re-confirm that **no Production deployment** occurred and that branch `main` remains untouched.

---

## 2. DEPLOYMENT METADATA & GIT INTEGRITY

| Attribute | Verified Value |
| :--- | :--- |
| **Product Name** | NULAR — Nusa Learn |
| **Project Name** | `ragamara` (`prj_Y8fCcRL1qgIITGo6WVyxKjarmW9M`) |
| **Team Scope** | `firza-miftahul-ilmis-projects` (`team_y5x7HA5icQsIyKZ2KPvZIudU`) |
| **Deployment ID** | `dpl_8yFjczk23zXNiSBEUMv7zE9Uj82s` |
| **Deployment State** | **`READY`** |
| **Target Environment** | `preview` (`target: null` — **Strictly isolated from Production**) |
| **Active Branch** | `feat/ragamara-final-experience` |
| **HEAD Commit** | `7538b29aead31eed9216b94d4f808a838f6cc225` |
| **Production Branch (`main`)** | `111cf1b84d8c65586d7f466b7012fbc5f9f8c461` (**Untouched**) |
| **Unique Preview URL** | `https://ragamara-gzpf7usf1-firza-miftahul-ilmis-projects.vercel.app` |
| **Branch Alias URL** | `https://ragamara-git-feat-ragamara-f513f6-firza-miftahul-ilmis-projects.vercel.app` |

---

## 3. TASK 1 — ROOT CAUSE ANALYSIS OF `verify_live_preview.mjs`

### 3.1 Observed Failure Symptom
`verify_live_preview.mjs` exited with code 1 at line 190:
```
Error: JS Eval Error: Uncaught (in promise) SyntaxError: Unexpected token '#', "# Page not"... is not valid JSON
    at evalJS (verify_live_preview.mjs:133:15)
    at async main (verify_live_preview.mjs:190:21)
```

### 3.2 Exact Root Cause
The failure was caused by a combination of two factors:
1. **Vercel SSO / Deployment Protection on Preview Domain:**
   - The project has `ssoProtection: "all_except_custom_domains"` enabled.
   - When Headless Chrome navigated to the share URL, it was redirected to `https://vercel.com/login?next=...` (`Title: Login – Vercel`) because an unauthenticated browser instance cannot complete interactive SSO automatically.
2. **Cascading Script Assertion Error:**
   - Because the browser remained on the Vercel SSO login page rather than the application, subsequent relative path fetches like `fetch('/ragamara_culture_db.json')` resolved to `https://vercel.com/ragamara_culture_db.json`.
   - Vercel's login domain returned an HTML/text 404 page starting with `# Page not found`.
   - When the script called `(await r.json())`, Node's evaluation threw `SyntaxError: Unexpected token '#', "# Page not"... is not valid JSON`.

### 3.3 Supporting Evidence
- Line 2 of task log 1959 confirms redirect destination:
  `Authenticated at: https://vercel.com/login?next=%2Fsso-api%3Furl%3D... | Title: Login – Vercel`
- Line 3–7 show every route title rendered as `"Login – Vercel"`.
- This confirms the failure was purely an **automated browser authentication flow barrier on an SSO-protected preview**, NOT a frontend bug, missing asset, or runtime failure in the application itself.

---

## 4. TASK 2 — SAFE PREVIEW VERIFICATION VIA AUTHORIZED CHANNEL

Per safety guidelines, Vercel SSO Protection was **NOT disabled** or weakened. Instead, deployment verification was performed through the official authorized integration channel (`web_fetch_vercel_url`) which authenticates directly against the active Vercel deployment session.

### Live Route HTTP Verification

| Target Route | HTTP Status | Response Header / Content Verification |
| :--- | :--- | :--- |
| `/` (Root Landing) | `HTTP 200 OK` | `x-vercel-id: iad1:sin1:iad1:iad1::kr47d-...`, Content-Type: `text/html; charset=utf-8` |
| `/app.html` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::sm255-...`, Complete 2491-line interactive application payload |
| `/design-system.html` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::225m9-...`, Living Atlas design system tokens & components |
| `/ragamara_culture_db.json` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::82v9f-...`, Schema v2.0.0, 45 canonical entities, 50 DAPOBUD records |
| `/css/tokens.css` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::7hx6c-...`, Living Atlas design tokens (`--atlas-forest`, `--atlas-parchment`) |
| `/css/components.css` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::xsb7s-...`, Component stylesheets and button tactile styles |
| `/css/animations.css` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::4lnv4-...`, Motion system, reduced motion media queries |
| `/css/landing.css` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::d9nkh-...`, Bento grid, 3D arc container styles |
| `/js/culture_db_data.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::dplg8-...`, Culture DB data payload (`window.RAGAMARA_CULTURE_DB`) |
| `/js/ecosystem.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::l9m8q-...`, Complete state store, missions, achievements, sound engine |
| `/js/mascot.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::rcc7q-...`, Vector SVG mascot renderer with 10 expressive states |
| `/js/illustrations.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::vwb4k-...`, Graphic primitives (Saik Kalamai motif, cloud dividers) |
| `/js/motion.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::smfkk-...`, Scroll reveal observer & XP burst particles |
| `/js/minigames.js` | `HTTP 200 OK` | `x-vercel-id: sin1:iad1::5x854-...`, Complete 6-game engine (A, B, C, D, E, F) |

All 14 core routes and static code assets loaded with `HTTP 200 OK`.

---

## 5. TASK 3 — BRANDING & ARCHITECTURE VERIFICATION

### 5.1 Public Identity & Metadata
Inspection of the live payload retrieved from `dpl_8yFjczk23zXNiSBEUMv7zE9Uj82s` confirmed:
- `<title>NULAR — Nusa Learn | The Living Atlas of Nusantara</title>` on landing and `<title>NULAR — Nusa Learn | Markas Penjelajah &amp; Petualangan Budaya Nusantara</title>` on app.
- `<meta name="description" content="NULAR (Nusa Learn) — Platform petualangan budaya interaktif berbasis data resmi DAPOBUD RI dan pengayaan ensiklopedis Nusantara."/>`
- Open Graph tags present: `og:site_name` ("NULAR — Nusa Learn"), `og:title`, `og:description`, `og:type` ("website"), `og:image` ("assets/images/logo.png").
- Favicon link present: `<link rel="icon" type="image/png" href="assets/images/logo.png"/>`.
- Header Branding: Displays `NULAR` in bold gold typography with subtext `Nusa Learn • Living Atlas`.

### 5.2 Six Mini-Games Architecture (Arena A–F)
All game modes are fully implemented and bundled in `js/minigames.js`:
- **Mode A (Kuis Pusaka Adat):** 10 curated multiple-choice questions with Fisher-Yates shuffle, instant feedback, and timer.
- **Mode B (Pasangan Pusaka Tradisi):** 6 paired cultural cards, memory matching logic, mismatch shake feedback.
- **Mode C (Konstruksi Rumah Gadang):** 5-stage sequential assembly of Minangkabau vernacular architecture with structural explanations.
- **Mode D (Simulasi Laras Saluang & Talempong):** 4-note pentatonic auditory memory simulation with Web Audio API synthesis.
- **Mode E (Dilema Musyawarah Adat):** 3 ethical cultural scenarios assessing community consensus, custom, and preservation.
- **Mode F (Restorasi Ukir Pusaka Asmat):** 9-tile interactive rotational puzzle restoring traditional Asmat woodcraft.

### 5.3 Automated E2E Regression Baseline
The complete E2E Headless Chrome test suite (`node tests/e2e_full_verification.mjs`) verified:
- **Viewports:** 20/20 passed across 320px, 375px, 390px, 430px, 768px, 1024px, 1280px, 1440px with `overflowPx: 0`.
- **Game Sessions:** 18/18 full sessions passed (3 sessions per game mode A–F).
- **XP Claim Exploit Protection:** Verified duplicate reward claims are strictly blocked via `session.claimed`.
- **Console & Page Errors:** 0 uncaught exceptions, 0 console errors.

---

## 6. TASK 4 — SECURITY & DIRECTORY ISOLATION AUDIT

The deployment was audited against public exposure risks. Requests to sensitive or internal paths returned:

| Tested Internal Path | Expected Status | Actual Status | Result |
| :--- | :--- | :--- | :--- |
| `/.env` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/data/backups/pre-final-transformation/app.html` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/reports/final-transformation/11_INDEPENDENT_PREDEPLOYMENT_AUDIT.md` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/venv/pyvenv.cfg` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/ragamara-data-engine/pipeline.py` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/tests/e2e_full_verification.mjs` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/code.html` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |
| `/.git/HEAD` | `404 Not Found` | `HTTP 404` | **SECURE (Blocked by .vercelignore)** |

### Security Policy Compliance
- **No Secret Leakage:** No environment variables, private tokens, or credentials exist in public files or committed reports.
- **SSO Protection Untouched:** Project SSO protection remains enabled (`all_except_custom_domains`).
- **No Share Token Exposure:** Private deployment share tokens were scrubbed and are excluded from all persistent reports.

---

## 7. REMAINING SYSTEM LIMITATIONS

1. **Browser Authentication on SSO Preview URLs:**
   Direct navigation by automated external headless crawlers that lack active Vercel cookies will be redirected to the Vercel SSO login page. Human team members can access the deployment by logging into Vercel or opening the authorized share link.
2. **Local Client-Side Persistence:**
   All player progress (XP, level, gems, streaks, achievements, mascot unlocks, bookmarks) is persisted in browser `localStorage` under `ragamara_state_v2`. There is no centralized user database or cloud synchronization backend.
3. **Local Leaderboard:**
   The leaderboard ranks the local user alongside deterministic community archetypes rather than a multi-tenant cloud leaderboard.
4. **Cultural Knowledge Base Scope:**
   Contains 45 canonical cultural entities linked to 50 official DAPOBUD source records. Four entities requiring editorial review remain clearly flagged with transparent badges in Culturepedia.

---

## 8. CONFIRMATION OF NON-PRODUCTION DEPLOYMENT

- **Production Deployment Executed:** **NO** (Strictly avoided `vercel --prod` and any production target).
- **Git `main` Branch Modified:** **NO** (Branch `main` remains locked at `111cf1b`).
- **DNS / Domain Modifications:** **NO** (Zero domain, DNS, or plan alterations).
- **Target Verification:** The active deployment `dpl_8yFjczk23zXNiSBEUMv7zE9Uj82s` has `target: null` (Preview environment).

---

## 9. CONCLUSION & FINAL SIGN-OFF

The NULAR (Nusa Learn) Vercel Preview deployment `dpl_8yFjczk23zXNiSBEUMv7zE9Uj82s` is fully operational, verified, and secured. The product is ready for stakeholder review on Vercel Preview.
