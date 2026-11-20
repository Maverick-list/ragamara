# NULAR — System Architecture

## 1. Audited Baseline
- **Runtime:** Static HTML5 + ES Modules (Three.js `0.160+` via importmap in `js/vendor/three/`) + Vercel Serverless Node.js Functions (`api/*.js`), configured with `vercel.json` (`"cleanUrls": true`).
- **Database / Auth Audit:** No `package.json`, `.env`, or external Supabase credentials exist in the current repository. Therefore:
  - A full PostgreSQL/Supabase migration (`db/migrations/001_nular_cultural_world.sql`) with Row-Level Security (RLS) is provided for cloud deployment.
  - Serverless API endpoints (`api/auth.js`, `api/progress.js`, `api/missions.js`, `api/leaderboard.js`, `api/guide-session.js`, `api/guide-chat.js`) use HMAC-SHA256 signed cookies/tokens and server-side validation, with transparent local/guest persistence fallback when no remote database URL is provisioned.
- **Installed Skills Applied:** `a11y-debugging`, `chrome-devtools`, `gemini-live-api-dev`, `vercel-functions`, `auth`, `verification`.

## 2. Two-Layer Interconnected Architecture
- **Layer A — Editorial & Discovery Web Platform:**
  - `index.html` (Landing), `explore.html` (Discovery), `portal.html` (World Entry Portal), `map.html` (38-Province GeoJSON Atlas), `learn.html` (Learning Center & Collection Book), `quests.html` (Missions & Leaderboards), `house.html` (3D Inspector + 10-Section Monograph), `anatomy.html` (Comparator), `profile.html` (Player Profile), `auth.html` (Sign In / Register / Settings), `about.html` (Governance & Sources).
- **Layer B — Playable 3D Cultural World (`world.html`):**
  - `js/world/` (`WorldManager`, `GameScene`, `InputManager`, `CollisionManager`, `CharacterController`, `PlayerController`, `CameraController`, `EnvironmentManager`, `SceneStreamingManager`, `InteractionManager`, `ExplorationState`, `WorldNavigation`, `AudioManager`).
  - `js/ai-guide/` (`TourGuideUI`, `GeminiLiveClient`, `AudioPipeline`, `KnowledgeRetriever`, `ContextResolver`).
- **Shared Core Services:**
  - `js/i18n/I18nManager.js` (8 interface languages + RTL + regional language registry)
  - `js/auth-client.js` (Session + Guest Mode)
  - `js/gamification/ProgressionEngine.js` (XP, Levels, Streaks, Achievements, Quests)
  - `js/museum-store.js` (Unified local & synced state)
