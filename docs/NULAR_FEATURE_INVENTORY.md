# NULAR — FEATURE INVENTORY & BASELINE RECONCILIATION
**Audit Date:** 2026-11-21  
**Baseline Commit:** `1d7321b` (includes `ae6d032`, Phase 0–12 history preserved)  
**Working Branch:** `feat/nular-world-experience`

---

## 1. Existing Implemented Features (Verified in Code)

| Area | Files / Assets | Baseline Status | Notes from Direct Code Inspection |
| :--- | :--- | :--- | :--- |
| **Museum Shell & Pages** | `index.html`, `explore.html`, `portal.html`, `map.html`, `learn.html`, `quests.html`, `house.html`, `anatomy.html`, `profile.html`, `auth.html`, `about.html`, `world.html` | Implemented | Consistent navigation via `js/museum-shell.js`; Indonesian default + 8-language `I18nManager.js` (with Arabic RTL). |
| **38-Province Catalog & Atlas** | `data/houses.json` (42 houses), `data/indonesia-38-provinces.geojson`, `js/atlas-map.js` | Implemented | 42 house records across 38 provinces; 37 mapped to Google Drive folders + 5 academic traditions. |
| **House 3D Models** | `assets/models/houses/*.glb` (42 GLBs), `data/asset-manifests/*.json` | Implemented (5 Verified Masterpieces, 37 Partial) | Flat standard materials without procedural wood/thatch/batik textures yet; Phase 3 will upgrade PBR materials & geometry detail. |
| **3D Inspector & Anatomy** | `js/viewer-3d.js`, `house.html`, `anatomy.html` | Implemented | Supports exploded view, hotspots, component selection, camera presets; Phase 3 will add isolated component mode, roof cutaway sync & PBR texture enhancement. |
| **Playable Avatar & Outfits** | `assets/models/avatars/*.glb` (6 GLBs), `js/world/CharacterController.js` | Implemented (Low-Detail) | 6 regional textile rigs (`batik-parang-solo`, `batik-megamendung-cirebon`, `songket-minangkabau`, `ulos-ragidup-batak`, `tenun-ikat-sumba`, `sasirangan-banjar`); needs visible high-contrast batik fabric textures, refined proportions & vehicle mount pose. |
| **3D World Engine** | `js/world/WorldManager.js`, `GameScene.js`, `CameraController.js`, `PlayerController.js`, `CollisionManager.js`, `EnvironmentManager.js`, `SceneStreamingManager.js`, `InteractionManager.js` | Implemented | 3 camera modes (FP/TP/Free), capsule collision, auto roof cutaway, 8 regional biomes, wind trees & water animation. |
| **Mascot Identity** | `js/mascot.js` | Implemented | **Raga the Javan Rhinoceros** (`Rhinoceros sondaicus`) with Minang Songket collar bib & Deta headpiece. Must be preserved as guide identity. |
| **Cultural Collections** | `data/cultural-items.json` (19 items), `assets/models/artifacts/*.glb` (6 GLBs) | Implemented | Covers textiles, weapons-as-display, music, dance, crafts, food; needs in-world Cultural Exhibition Pavilions + Collection Book persistence. |
| **Auth & Security API** | `api/auth.js`, `js/auth-client.js`, `db/migrations/001_nular_cultural_world.sql` | Partial | Has Email signup/login + scrypt + HMAC HttpOnly cookie + Guest fallback. Missing: Google OAuth adapter, Phone OTP adapter, Password Reset, Email Verification, Protected World redirect gate, `.env.example`. |
| **AI Tour Guide** | `js/ai-guide/TourGuideUI.js`, `api/guide-chat.js`, `api/guide-session.js` | Needs UI Refactor | Currently renders a bulky multi-bar sidebar panel. Phase 5 requires a **minimal transparent conversation-only overlay** + neural TTS backend adapter `/api/tts`. |
| **Gamification & Leaderboard** | `api/progress.js`, `api/leaderboard.js`, `js/gamification/ProgressionEngine.js`, `data/missions.json`, `data/achievements.json` | Implemented | Server-authoritative XP, anti-replay `eventKey`, privacy-safe leaderboard. Needs deeper integration with Collection Book, Vehicles, and 9-step Tutorial. |
| **Local Dev Server** | `scripts/local_server.mjs` | Static-only | Does not route `/api/*` endpoints locally. Will add an API-capable local verification server (`scripts/dev_server.mjs`) without touching untracked `local_server.mjs`. |

---

## 2. Gaps Addressed by This Master Transformation

1. **Cinematic Real-Progress Loading Screen (Phase 1):** Currently absent on `index.html` and `world.html`.
2. **Unified Auth Methods & Protected Gate (Phase 2):** Google OAuth adapter, Phone OTP with cooldown/rate-limit, Password Reset, Email Verification, and `?next=` redirect gate into interactive 3D world & leaderboard.
3. **High-Fidelity PBR Textures & Recognizable Batik Characters (Phase 3):** Procedural wood grain, bamboo, thatch, woven wall, stone, terracotta, carved reliefs, and crisp regional batik/songket/ulos/tenun textures on avatars + isolated component & roof cutaway in `viewer-3d.js`.
4. **Open-World Pavilions & 4-Vehicle Transportation System (Phase 4):** Cultural exhibition pavilions in Nusantara World + Motorcycle, Car, Boat, and Airplane with boarding, driving/sailing/flying physics, driving camera, engine synth, and mobile vehicle HUD.
5. **9-Step Interactive Guided Tutorial & Minimal Transparent AI Chat (Phase 5):** Raga-guided interactive onboarding with Indonesian voice/subtitles + strict minimal transparent chat overlay.
6. **Integrated Digital Collection Book & Exploration Missions (Phase 6):** Unified exhibit collection persistence with discovery timestamps, references, and authenticated leaderboard dimensions.
