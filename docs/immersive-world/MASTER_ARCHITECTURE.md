# NULAR — THE LIVING ARCHIPELAGO
## Master Architecture Specification (`docs/immersive-world/MASTER_ARCHITECTURE.md`)

- **Version:** `3.0.0-arch`
- **Active Feature Branch:** `feat/nular-immersive-world`
- **Base Commit:** `1a110b00c0d182e72e9eddb79a097a1dccbd550c`
- **Production Branch:** `main` (Preserved & Isolated — Do Not Modify Directly)

---

## 1. Repository & Capability Audit (Phase 0 Findings)

### A. Proven Baseline Architecture (Preserved)
- **Runtime:** Pure static Web ES Modules (zero framework lock-in, zero build failure surface, instant Vercel CDN Brotli delivery) + Vercel Serverless Functions (`/api/*`) for Phase 5 AI Guide session security.
- **3D Engine:** Vendored **Three.js v0.169.0** (`js/vendor/three/build/three.module.js`, `OrbitControls.js`, `GLTFLoader.js`, `GLTFExporter.js`, `BufferGeometryUtils.js`).
- **Existing Museum Pages (100% Preserved):**
  - `index.html` (Living Atlas Home)
  - `explore.html` (Multi-facet Catalog)
  - `house.html` (3D Architectural Inspector + Dossier)
  - `map.html` (Upgraded in Phase 1 to 38-Province GeoJSON Indonesia Living Atlas)
  - `anatomy.html` (Architectural Anatomy & Two-House Comparator)
  - `about.html` (Methodology, Attribution & Licensing Registry)
  - `profile.html` (Non-Gamified Exploration Journal)
  - `app.html` (Legacy Redirect Bridge)
- **New Playable Cultural World Entry:**
  - `world.html` (**PLAY / ENTER NUSANTARA WORLD** — Third-person playable open-world hub & streamed architectural house interiors, linked from museum navigation & every house dossier).

### B. Installed Environment & Tooling Inventory (Verified Honestly)
- **Node.js:** `v26.13.0` (with native ES Modules, WebSocket, Fetch, FileReader polyfill for `GLTFExporter`)
- **Python:** `3.14.4` (stdlib `zipfile`, `xml.etree.ElementTree`, `json`, `csv`, `py_compile`)
- **Google Drive CLI (`gdrive`):** Authenticated (`firzailmidja@gmail.com`), operational (`cl/1015343799`).
- **Headless Browser QA:** `/usr/bin/google-chrome` with SwiftShader/ANGLE WebGL via CDP.
- **Installed Relevant Skills Inspected:**
  - `gdrive` — Used for authenticated recursive Google Drive inventory & document retrieval.
  - `gemini-live-api-dev` — Used to architect Phase 5 AI House Tour Guide (`gemini-3.8-live`, ephemeral tokens / secure backend session, PCM 16kHz/24kHz audio streaming, Hybrid VAD, live captions, text fallback).
  - `vercel-functions` — Used to architect Node.js Fluid Compute serverless route handlers (`/api/guide-session.js`, `/api/guide-chat.js`) without exposing API keys.
- **Documented Tooling Blockers / Constraints (Zero Fabrication):**
  - **Blender CLI (`blender`):** Not installed on this Linux host (`blender: command not found`).
  - **Git LFS (`git-lfs`):** Not installed on this Linux host.
  - **Google Drive 3D Meshes:** Recursive audit of Drive folder `13jHt1dsB63bAsS_ciSTqNc-9w2uiIIdA` discovered **473 items = 37 folders + 434 component reference `.png` sheets + 2 `.docx` research documents**, and **0 `.blend`/`.glb`/`.gltf`/`.fbx`/`.obj` files**.
  - **Mitigation Architecture:**
    1. Author complete, syntax-verified Blender 4.x Python automation scripts (`scripts/blender/*.py`) ready for studio execution when Blender is installed.
    2. Build a **deterministic Three.js Node.js `GLTFExporter` asset production pipeline** (`scripts/build_world_models.mjs` and `scripts/build_avatars.mjs`) that compiles genuine, multi-component, walkable exterior+interior `.glb` architectural reconstructions (with `COLLISION` bounding volumes, named architectural parts, floors, walls, doors, stairs, and traditional interior furniture) AND original rigged/animated `.glb` playable avatars with authentic Nusantara textile PBR materials.
    3. Label every generated architectural model honestly in its manifest (`provenance: "original_digital_reconstruction"` referencing the exact Google Drive component sheets and `.docx` descriptions), never misrepresenting procedural/digital reconstructions as original lidar scans.

---

## 2. Target System Architecture (Phases 1–6)

```
NULAR — THE LIVING ARCHIPELAGO
├── Cultural Knowledge & Atlas Layer (Phase 1)
│   ├── data/houses.json (Schema v3.0.0 — 42+ houses covering ALL 38 Indonesian provinces)
│   ├── data/provinces.json (38 provinces with island metadata & centroids)
│   ├── data/indonesia-38-provinces.geojson (Authoritative simplified 38-province GeoJSON)
│   ├── data/articles/ (Structured 10-section cultural dossiers sourced from Drive .docx & academic refs)
│   ├── data/textiles.json (Authenticated Batik, Tenun Ikat, Songket, Ulos, Tapis provenance registry)
│   └── js/atlas-map.js (Interactive 38-province SVG/GeoJSON renderer with zoom, filters & discovery progress)
│
├── 3D Asset Production Pipeline (Phase 2)
│   ├── scripts/blender/ (Blender 4.x Python automation: validate, normalize, collider, LOD, GLB export)
│   ├── scripts/build_world_models.mjs (Node/Three.js GLTFExporter pipeline for walkable exterior+interior GLBs)
│   ├── scripts/build_avatars.mjs (Original NULAR Avatar Collection: rigged GLB + skeletal AnimationClips)
│   ├── assets/models/houses/*.glb (Per-house multi-component walkable GLBs + COLLISION meshes)
│   ├── assets/models/avatars/*.glb (Playable character GLBs with Nusantara textile outfits)
│   └── data/asset-manifests/*.json (Per-house geometry, interior, collision & license manifest)
│
├── Playable Third-Person Cultural World Engine (Phase 3 & 4)
│   ├── world.html (Play / Enter Nusantara World UI + HUD + Avatar Selector + World Teleport)
│   └── js/world/
│       ├── GameScene.js (Renderer, PBR lighting, tone mapping, shadows, disposal)
│       ├── WorldManager.js (Nusantara Hub Plaza + streamed regional house scenes)
│       ├── InputManager.js (WASD/Arrows, Shift sprint, Space jump, E interact, Esc menu, mobile joystick + drag)
│       ├── PlayerController.js (Capsule physics, gravity, stair stepping, floor/wall collision)
│       ├── CharacterController.js (Avatar GLB loader, AnimationMixer, Idle/Walk/Run/Turn/Interact/Wave/Sit)
│       ├── CameraController.js (Smooth 3rd-person orbit camera with wall obstruction spring arm + interior roof cutaway)
│       ├── CollisionManager.js (AABB/capsule collision boxes extracted from COLLISION groups + stair ramps)
│       ├── InteractionManager.js (Proximity prompt [E], architectural component inspection, door entry, tour trigger)
│       ├── EnvironmentManager.js (Regional sky, sun angle, terrain, documented tropical/highland flora, WebAudio ambience)
│       ├── SceneStreamingManager.js (On-demand GLB scene streaming + strict GPU dispose() on scene transitions)
│       ├── WorldNavigation.js (Island Gateways, Mini-Atlas teleport, Return to Museum)
│       └── ExplorationState.js (Shared localStorage journal integration — discovered houses, components, rooms)
│
└── AI House Tour Guide — Gemini 3.8 Live & Grounded Fallback (Phase 5)
    ├── api/guide-session.js (Vercel Node.js Function: mints ephemeral auth token or grounded session config; NEVER exposes API key)
    ├── api/guide-chat.js (Vercel Node.js Function: grounded Q&A fallback using @google/genai when Live WebSocket or mic is unavailable)
    └── js/ai-guide/
        ├── ContextResolver.js (Reads live visitor location: houseId, province, current room, inspected component)
        ├── KnowledgeRetriever.js (Retrieves strict verified facts & citations from houses.json & articles; blocks hallucination)
        ├── AudioPipeline.js (Web Audio API 16kHz PCM capture, Hybrid VAD, 24kHz PCM playback queue, instant barge-in interruption)
        ├── GeminiLiveClient.js (WebSocket client for gemini-3.8-live with session resumption + graceful text/WebSpeech fallback)
        └── TourGuideUI.js (Museum guide overlay: mic permission consent, push-to-talk / continuous toggle, live captions, transcript, ID/EN switch)
```

---

## 3. Data & Cultural Governance Rules

1. **All 38 Provinces Represented:** Every province from Aceh to Papua Selatan has at least one verified representative house record, while multi-tradition provinces (e.g., Sumatera Barat: Rumah Gadang + Uma Mentawai; Sumatera Utara: Rumah Bolon + Siwaluh Jabu; Sulawesi Selatan: Tongkonan + Saoraja; Jawa Tengah: Joglo + Limasan) retain multiple traditions.
2. **Honest Provenance Labels:** Every house explicitly reports `assetStatus`: `COMPLETE` (tested walkable exterior + interior GLB), `RECONSTRUCTION` (documented digital reconstruction with walkable exterior + interior), `PARTIAL`, or `PENDING`.
3. **Zero Fabricated History or Textiles:** Non-batik textiles (Tenun Ikat NTT, Songket Palembang/Minangkabau, Ulos Batak, Tapis Lampung, Sasirangan Banjar) are NEVER mislabeled as "batik".
4. **Zero API Key Exposure:** `GEMINI_API_KEY` stays strictly server-side in Vercel environment variables (`/api/*`). When running locally or in environments without `GEMINI_API_KEY` configured, the AI Tour Guide operates in transparent **Local Curated Knowledge Mode** (grounded retrieval + Web Speech API synthesis/recognition) and clearly displays its mode badge without pretending to be connected to Gemini Live.
