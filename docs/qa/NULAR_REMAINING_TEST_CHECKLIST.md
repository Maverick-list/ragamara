# NULAR — REMAINING TEST CHECKLIST: PHYSICAL DEVICES & PREVIEW DEPLOYMENT
**Document:** Manual Validation & Real-Device Readiness Checklist  
**Project:** NULAR — The Living World of Nusantara  
**Repository:** `Maverick-list/ragamara`  
**Target Branch:** `feat/nular-world-experience`  
**Date:** November 21, 2026  
**Status:** Live Verification Framework for Staging & Hardware Testing  

---

## 1. PURPOSE & DISTINCTION OF TEST SCOPES

Automated and headless browser tests (via Chrome DevTools Protocol) confirm that NULAR’s code, responsive stylesheets, API routes, security guards, and 3D WebGL render loops compile and execute without JavaScript errors.

However, **headless browser emulation cannot substitute for physical hardware testing**. Physical device testing evaluates hardware digitizers, real GPU drivers, operating system gestures, thermal behavior, mobile audio policies, and network handovers.

This document outlines all tests that **must be performed manually** by QA engineers or stakeholders on real physical smartphones, tablets, desktop workstations, and the Vercel Preview deployment prior to broad public release.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TESTING SCOPE HIERARCHY                                │
│                                                                                 │
│  [1] AUTOMATED TESTING          ➔ CI / Unit / Regression Scripts (COMPLETED)    │
│  [2] HEADLESS EMULATION (CDP)   ➔ Viewport scaling, Touch Emulation (COMPLETED) │
│  [3] PHYSICAL DEVICE TESTING    ➔ Real Touch Digitizers, WebKit/iOS (PENDING)   │
│  [4] EXTERNAL INTEGRATION       ➔ Live Google OAuth, Live Twilio SMS (PENDING) │
│  [5] PREVIEW DEPLOYMENT         ➔ Vercel Edge CDN, Serverless Cold Starts (NEXT)│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PHYSICAL SMARTPHONE TESTING (iOS & ANDROID)

### 2.1 Apple iOS / iPadOS (Safari & WebKit PWA)

| Test ID | Scenario | Device Target | Step-by-Step Instructions | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **IOS-01** | **Add to Home Screen (PWA)** | iPhone 13/14/15/16 (iOS 17+) | 1. Open Safari.<br>2. Navigate to NULAR URL.<br>3. Tap the **Share** button (`􀈂`).<br>4. Select **Add to Home Screen**.<br>5. Confirm icon and title "NULAR".<br>6. Launch from Home Screen. | App opens in full-screen standalone window without Safari URL bar or bottom navigation. | [ ] |
| **IOS-02** | **Safe-Area Insets (Notch & Island)** | iPhone 14 Pro / 15 / 16 (Dynamic Island) | 1. Open in standalone mode.<br>2. Rotate to landscape, then back to portrait.<br>3. Inspect the top HUD location card and bottom navigation bar. | No text or buttons collide with the Dynamic Island, notch, or bottom swipe indicator (`env(safe-area-inset)`). | [ ] |
| **IOS-03** | **Audio Autoplay Policy & Sound** | Any iPhone (iOS 16+) | 1. Enter `world.html`.<br>2. Note audio state.<br>3. Tap canvas or audio button (`#btn-toggle-audio`).<br>4. Interact with Raga voice assistant. | Web Audio unlocks cleanly on first user tap without throwing `AudioContext not allowed to start` errors. | [ ] |
| **IOS-04** | **Touch Joystick Haptic & Tactile Feel** | Any iPhone (iOS 16+) | 1. Enter `world.html`.<br>2. Place left thumb on virtual joystick.<br>3. Drag in circular motion to walk.<br>4. Drag right thumb on canvas to rotate camera. | Walking and camera rotation work simultaneously (multi-touch). No page bouncing or accidental Safari tab bar toggles. | [ ] |
| **IOS-05** | **WebKit WebGL Memory Cap** | iPhone SE (3rd Gen) or older (< 4GB RAM) | 1. Explore Nusantara 3D world for 10 minutes.<br>2. Teleport between 5 different houses.<br>3. Inspect memory stability. | Safari tab does not crash or display "This webpage was reloaded because it was using significant energy". | [ ] |

### 2.2 Android Smartphones (Chrome & Samsung Internet)

| Test ID | Scenario | Device Target | Step-by-Step Instructions | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **AND-01** | **Ambient PWA Install Prompt** | Android 13/14 (Chrome) | 1. Open Chrome.<br>2. Visit NULAR.<br>3. Wait for browser install banner or menu prompt.<br>4. Tap **Install App**.<br>5. Check app drawer. | NULAR icon installs cleanly with standalone manifest theme color (`#153027`). | [ ] |
| **AND-02** | **Hardware Back Button Navigation** | Samsung Galaxy / Google Pixel | 1. From landing page, open Cultural Atlas (`map.html`).<br>2. Open a house detail dossier.<br>3. Open bottom sheet filter.<br>4. Press hardware/gesture Back button. | Back gesture closes the sheet or modal first, without abruptly kicking the user off the website. | [ ] |
| **AND-03** | **High Refresh Rate (90Hz / 120Hz)** | Galaxy S23/S24, Pixel 7/8/9 | 1. Open `auth.html` and enable "Tampilkan Penghitung FPS".<br>2. Enter 3D World.<br>3. Walk around Rumah Gadang. | Rendering maintains smooth 60fps to 90fps without micro-stuttering or frame drops. | [ ] |
| **AND-04** | **Virtual Keyboard Viewport Contraction** | Any Android device | 1. Open `auth.html` or AI Chat overlay.<br>2. Tap input field to open Gboard/Samsung Keyboard.<br>3. Observe UI layout while keyboard is active. | Viewport contracts gracefully. Input remains visible above the keyboard. No horizontal scrolling is introduced. | [ ] |

---

## 3. PHYSICAL TABLET TESTING (iPad & Galaxy Tab)

| Test ID | Scenario | Device Target | Step-by-Step Instructions | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TAB-01** | **Tablet Landscape Cultural Atlas** | iPad (10.9" / 11") / Galaxy Tab | 1. Set orientation to Landscape (1024x768 or 1280x800).<br>2. Open `map.html`.<br>3. Select Sumatra, then Jawa, then Papua.<br>4. Click provincial polygons. | Side-by-side split layout displays interactive SVG/GeoJSON map on one side and house card dossier list on the other. | [ ] |
| **TAB-02** | **Touch Screen vs Trackpad (Magic Keyboard)** | iPad with Magic Keyboard / Surface | 1. Move pointer with trackpad.<br>2. Switch to tapping screen with finger.<br>3. Use two-finger trackpad scroll vs touch drag. | Controls seamlessly transition between mouse pointer hover states and touch interaction without locking input. | [ ] |

---

## 4. DESKTOP WORKSTATION & MULTI-BROWSER MATRIX

| Browser / Platform | GPU Hardware | Focus Areas | Steps |
| :--- | :--- | :--- | :--- |
| **Google Chrome (Win/macOS/Linux)** | Discrete GPU (NVIDIA/AMD) & Integrated (Intel/Apple M-series) | WebGL 2.0 PBR materials, shadows, high DPI rendering | Test WASD walk, mouse lock, Cutaway toggle (`R`), and audio ambients. |
| **Mozilla Firefox (Win/Linux)** | Standard GPU | CSS Grid subgrids, SVG filter rendering, Web Audio | Verify navigation drawer animations, GeoJSON map SVG rendering, and sound effects. |
| **Apple Safari (macOS Sonoma/Sequoia)** | Apple Silicon M1/M2/M3/M4 | Metal WebGL backend, Fraunces serif font rendering | Verify smooth canvas resizing and WebGL color space fidelity (P3 vs sRGB). |
| **Microsoft Edge (Windows 11)** | Standard GPU | PWA installation on desktop, touch-screen laptop gestures | Test installation via Edge app manager and pinch-to-zoom on Surface displays. |

---

## 5. VERCEL PREVIEW DEPLOYMENT VERIFICATION

When authorizing a Vercel Preview deployment (`vercel` preview command, NOT `--prod`), execute the following verification steps:

```bash
# Preview build and deployment command:
vercel
```

### 5.1 Verification Checklist on Vercel Preview URL

- [ ] **Edge Network CDN Caching:**
  - Verify static assets (`.png`, `.glb`, `.css`, `.js`) return `x-vercel-cache: HIT` on second request.
  - Verify `/api/auth`, `/api/progress`, and `/api/leaderboard` return `x-vercel-cache: MISS` (dynamic bypass).
- [ ] **Serverless Functions Cold Start Latency:**
  - Make first request to `https://<preview-url>/api/auth?action=providers`.
  - Ensure response is returned within < 1,200 ms. Subsequent warm invocations must resolve in < 150 ms.
- [ ] **HTTPS / TLS Certificate & PWA Installation:**
  - Verify TLS 1.3 certificate is valid.
  - Confirm browser recognizes HTTPS context for Service Worker registration and PWA install eligibility.
- [ ] **Large 3D Model Asset Streaming:**
  - Monitor Network tab during `world.html?house=rumah-gadang` load.
  - Verify GLB binary chunk transfers complete with HTTP 200/206 (Range requests) without truncating.

---

## 6. EXTERNAL CLOUD SERVICES CONFIGURATION (OPTIONAL PROD UPGRADES)

NULAR is engineered to function out-of-the-box in local and preview environments using self-contained HMAC sessions, local developer OTP preview, and browser Web Speech fallback.

To graduate to broad public production with external cloud providers, follow these configuration procedures:

### 6.1 Google OAuth Integration
1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials.
2. Create an OAuth 2.0 Client ID (Web Application).
3. Set Authorized Redirect URI: `https://<your-preview-or-prod-domain>/api/auth?action=google-callback`.
4. Configure environment variables in Vercel:
   ```bash
   vercel env add GOOGLE_CLIENT_ID
   vercel env add GOOGLE_CLIENT_SECRET
   ```
5. **Manual Test:** Click "Masuk dengan Google" on `auth.html`. Confirm account consent screen appears and returns authenticated session upon approval.

### 6.2 International SMS OTP via Twilio
1. Obtain Twilio Account SID, Auth Token, and a verified Sender Phone Number from [Twilio Console](https://console.twilio.com/).
2. Configure environment variables in Vercel:
   ```bash
   vercel env add TWILIO_ACCOUNT_SID
   vercel env add TWILIO_AUTH_TOKEN
   vercel env add TWILIO_FROM_NUMBER
   ```
3. **Manual Test:** On a physical phone, input real phone number in E.164 format (`+628...`). Receive actual SMS, input 6-digit code, and confirm login.

### 6.3 Persistent Cloud Database via Supabase
1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. Run database migration schema from `data/schema.sql`.
3. Configure environment variables in Vercel:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   ```
4. **Manual Test:** Register a user on one device, log in from a separate device, and verify that saved houses, XP, and streak persist seamlessly.

---

## 7. SIGN-OFF MATRIX FOR MANUAL TESTING

| Phase | Milestone | Tested By | Date | Sign-Off Status |
| :--- | :--- | :--- | :---: | :---: |
| **Phase A** | Headless Browser Automation & Zero Overflow | QA Agent (Autonomous) | 2026-11-21 | **PASSED (100%)** |
| **Phase B** | Vercel Preview Non-Production Deployment | Human Stakeholder / QA | Pending | [ ] |
| **Phase C** | Physical iPhone & iPad Safari Validation | Hardware QA Tester | Pending | [ ] |
| **Phase D** | Physical Android (Chrome & Samsung) Validation | Hardware QA Tester | Pending | [ ] |
| **Phase E** | Live Third-Party Integrations (OAuth, SMS) | Systems Lead | Pending | [ ] |
| **Phase F** | Final Public Production Sign-Off (`main`) | Product Owner | Pending | [ ] |
