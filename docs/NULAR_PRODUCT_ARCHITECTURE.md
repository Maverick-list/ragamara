# NULAR — PRODUCT ARCHITECTURE (THE LIVING WORLD OF NUSANTARA)
**Document Version:** 3.0.0 (Master Product Transformation — Phase 0 Audit)  
**Repository:** `Maverick-list/ragamara`  
**Development Branch:** `feat/nular-world-experience` (branched from verified commit `1d7321b`, which includes `ae6d032`)  
**Default Language:** Indonesian (`id`), with preserved 8-language i18n switcher (`id`, `en`, `ms`, `zh`, `ja`, `ko`, `ar` RTL, `nl`)

---

## 1. Product Architecture Overview

NULAR (*Nusa Learn — The Living World of Nusantara*) is a unified static-first + Vercel Serverless Node.js web platform powered by Three.js r160 WebGL2. It merges four tightly integrated layers into one coherent product:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION & DESIGN SYSTEM LAYER                                        │
│  css/design-system.css · css/museum.css · css/world.css · js/museum-shell  │
│  Initial Cinematic Loader · Motion System · Reduced-Motion · Responsive    │
├────────────────────────────────────────────────────────────────────────────┤
│  IDENTITY, AUTHENTICATION & SECURITY LAYER                                 │
│  js/auth-client.js · api/auth.js · api/progress.js · api/leaderboard.js    │
│  Email/Password (scrypt) · Google OAuth Adapter · Phone OTP Adapter        │
│  HMAC-SHA256 HttpOnly Session · Redirect-Back Gate · Anti-Abuse XP         │
├────────────────────────────────────────────────────────────────────────────┤
│  3D LIVING WORLD & ASSET STREAMING ENGINE (Three.js r160)                  │
│  WorldManager · GameScene · SceneStreamingManager · EnvironmentManager     │
│  PbrTextureFactory · CharacterController · PlayerController                │
│  CameraController (FP/TP/Free) · CollisionManager · VehicleManager         │
│  CulturalPavilionManager · InteractionManager · TutorialManager            │
├────────────────────────────────────────────────────────────────────────────┤
│  CULTURAL KNOWLEDGE, AI GUIDE & VOICE LAYER                                │
│  data/houses.json (42 houses / 38 provinces) · data/cultural-items.json    │
│  data/textiles.json · data/missions.json · data/achievements.json          │
│  Minimal Transparent AI Chat (TourGuideUI) · api/guide-chat · api/tts      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Page Hierarchy & Navigation

| Route | Purpose | Access Policy |
| :--- | :--- | :--- |
| `index.html` | Cinematic entry & Living World showcase (with real asset-progress loader) | Public |
| `world.html` | **Nusantara World** — Open-world 3D exploration, 8 regional biomes, pavilions, 4 vehicles, 9-step tutorial, minimal AI chat | Authenticated (with redirect-back gate; explicit dev/guest configuration state when external auth providers are unconfigured) |
| `explore.html` | Curated cultural discovery across 42 houses & multi-category exhibits | Public |
| `house.html?id=<id>` | High-fidelity 3D inspector, exploded view, roof cutaway, isolated components, 10-section monograph | Public |
| `anatomy.html` | Dedicated architectural anatomy workbench | Public |
| `map.html` | 38-Province Interactive Nusantara Living Atlas (GeoJSON) | Public |
| `learn.html` | Cultural Collections & Digital Collection Book (houses, batik, food, music, crafts, maritime, pusaka) | Public browse / Auth for collection sync |
| `quests.html` | Exploration Missions, Quizzes, Achievements & Authenticated Global Leaderboard | Auth-protected for XP/leaderboard sync |
| `portal.html` | Regional World Entry Gateway (8 regional environments) | Public preview / Auth to launch world |
| `profile.html` | Player Identity, Display Name, Avatar, Region, Collection Book, Exploration History, Privacy & Settings | Authenticated |
| `auth.html` | Unified Email, Google OAuth, and Phone OTP Authentication + Configuration Status | Public |
| `about.html` | Cultural Policy, Provenance, Source Registry & Attribution | Public |

---

## 3. Authentication Architecture

- **Provider Adapter Pattern (`api/auth.js` + `js/auth-client.js`):** Frontend never couples directly to a specific auth vendor.
- **Supported Methods:**
  1. **Email:** Sign-up, Login, Password Reset token flow, Email Verification flow, Secure Logout.
  2. **Google OAuth:** Adapter checks `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (or `SUPABASE_URL` OAuth). When unconfigured, returns honest `{ configured: false }` state — never fakes production Google sign-in.
  3. **Phone OTP:** International E.164 format validation (`+62...`), per-phone rate limiting, 60-second resend cooldown, 5-minute OTP expiry, max attempt lockout. Uses configured SMS provider (`TWILIO_*` / `SUPABASE_*`) in production; in explicit local development mode (`NODE_ENV !== 'production'` or local test mode), returns a clearly labeled development preview notice without fabricating live SMS delivery.
- **Session Storage:** HMAC-SHA256 signed `HttpOnly; SameSite=Lax` cookie (`nular_session`).
- **Protected Action Redirect:** Clicking "Nusantara World" or "Explore 3D" while unauthenticated redirects to `auth.html?next=<encoded_target>` and returns immediately after authentication.

---

## 4. 3D Asset Pipeline & PBR Texture Architecture

- **Authoring Toolchain Verification:** Blender is not installed in the current execution container (`which blender` returned empty). Therefore, NULAR uses a repeatable **Node.js + Three.js GLTFExporter pipeline** (`scripts/build_authentic_houses.mjs`, `scripts/build_world_models.mjs`, `scripts/build_avatars.mjs`, `scripts/build_cultural_collection.mjs`) paired with a **runtime procedural PBR Texture Factory** (`js/world/PbrTextureFactory.js`) that synthesizes tileable diffuse + bump + roughness `CanvasTexture` maps for:
  - Seasoned teak & ironwood grain, bamboo segments, layered sago/alang-alang thatch, woven bamboo *bedek*, andesite/river stone, terracotta roof tiles, carved timber reliefs (*Siriah Gadang*, *Pa'ssura*), and regionally distinct traditional batik & textile motifs (*Batik Parang Solo*, *Batik Megamendung Cirebon*, *Songket Minangkabau*, *Ulos Ragidup Batak*, *Tenun Ikat Sumba*, *Sasirangan Banjar*).
- **Quality Profiles:** `low`, `medium`, `high`, `ultra`, and `auto` (adapting DPR, shadow maps, fog, and foliage density).
- **Strict GPU Disposal:** Every scene unload traverses geometries, materials, and textures and calls `.dispose()`.

---

## 5. World Streaming, Vehicles & Exhibition Pavilions

- **Region-Based World Streaming (`SceneStreamingManager.js`):** Only one active regional biome + house/hub scene is resident in GPU memory at a time. Travel between regions cleanly disposes previous resources and streams the target region.
- **8 Regional Biomes (`EnvironmentManager.js`):** Sumatra, Java, Kalimantan, Sulawesi, Bali & Nusa Tenggara, Maluku, Papua, and Nusantara Central Hub.
- **Cultural Exhibition Pavilions (`CulturalPavilionManager.js`):** Contextual open-air museum pavilions placed intentionally in the Hub and regional plazas showcasing curated exhibits across Architecture, Textiles/Batik, Culinary/Food, Music, Traditional Crafts, and Maritime Heritage.
- **Arcade Transportation System (`VehicleManager.js`):**
  - **Motorcycle (`motor`):** Agile 2-wheel steering, wheel spin, suspension tilt, engine synth.
  - **Car (`mobil`):** 4-wheel exploration vehicle, collision bounds, driving follow camera, braking.
  - **Boat (`perahu`):** Traditional Nusantara wooden outrigger/phinsi-inspired craft floating with wave bobbing across Kalimantan/Maluku/Hub waterways.
  - **Airplane (`pesawat`):** Accessible arcade propeller aircraft with runway acceleration, pitch-up takeoff, altitude control, gentle landing, and aerial archipelago camera.

---

## 6. Cultural Exhibit Data Model & AI Guide

- **Unified Exhibit Schema (`data/cultural-items.json` + `data/houses.json`):** Every exhibit records `id`, `name`, `category`, `province`, `region`, `description`, `culturalSignificance`, `historicalContext`, `materials`, `sources`, `attribution`, `model3D`, `accuracyStatus` (`verified_reference`, `interpretive_reconstruction`, `conceptual_visualization`), and `discoveryStatus`.
- **Interactive Tutorial (`TutorialManager.js`):** 9-step guided onboarding featuring **Raga the Javan Rhinoceros** (*Badak Jawa — Rhinoceros sondaicus*, preserving the approved NULAR mascot identity in `js/mascot.js`), Indonesian voice narration (backend neural TTS adapter `/api/tts` + clearly labeled Web SpeechSynthesis fallback), synchronized subtitles, skip/replay, and profile persistence.
- **Minimal Transparent AI Chat (`TourGuideUI.js`):** Strictly displays only the translucent conversation messages, one compact input field, send button, optional mic button, small speaker toggle, and close/minimize button — zero bulky dashboards or analytics cards.

---

## 7. Gamification & Leaderboard Model

- **Server-Authoritative Progression (`api/progress.js` + `js/gamification/ProgressionEngine.js`):** Deterministic `eventKey` deduplication prevents replay farming; server ignores client-submitted XP quantities.
- **Digital Collection Book:** Persists discovered houses, architectural components, textiles, food, instruments, crafts, and vehicles with discovery timestamps and source attributions.
- **Privacy-Safe Global Leaderboard (`api/leaderboard.js`):** Requires authenticated account; exposes only user-approved `displayName` / `username`, `avatar`, `xp`, `level`, `exhibitsCount`, and `achievementsCount`. Never leaks emails, phone numbers, or internal UUIDs.
