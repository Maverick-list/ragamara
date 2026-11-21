# NULAR — KNOWN LIMITATIONS & HONEST ARCHITECTURAL NOTES
**Version:** 3.0.0 (Phase 7 Audit)
**Branch:** `feat/nular-world-experience`

---

## 1. External Service & Credential Limitations

1. **Authentication Persistence (`api/auth.js` — Updated Completion Phase):**
   - **Production Fail-Closed Enforcement:** In production (`VERCEL_ENV=production` / `NODE_ENV=production`), `api/auth.js` **never** falls back to ephemeral in-memory or local filesystem storage. Missing or incomplete `SUPABASE_URL` + key, or a missing/short `<32`-char `NULAR_SESSION_SECRET`, causes persistence-dependent auth endpoints to fail closed with HTTP `503`.
   - **Local Development Only:** In explicit local development, users, login rate-limit windows, and revoked session JTIs persist atomically to `.gitignore`d `.nular-local-data/auth-store.json` (`0600`).
   - See `docs/NULAR_AUTHENTICATION_PRODUCTION_GATE.md` and `docs/AUTHENTICATION_SETUP.md` for exact owner configuration steps.
2. **Google OAuth 2.0:**
   - Not connected until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are added to environment variables. Currently displays an honest unconfigured notice and returns HTTP `503`.
3. **Phone OTP SMS Delivery:**
   - Real SMS delivery requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. In local development only, an explicitly labeled local test OTP preview is displayed. Production rejects unconfigured SMS requests with HTTP `503`.
4. **AI Cultural Guide & Neural TTS:**
   - Without `GEMINI_API_KEY`, the Minimal Transparent AI Chat uses deterministic grounded retrieval from `data/houses.json` and `data/cultural-items.json` (`KnowledgeRetriever.js`).
   - Without `GOOGLE_TTS_API_KEY` or `ELEVENLABS_API_KEY`, Indonesian voice narration falls back to the browser's native `window.speechSynthesis` API, explicitly labeled `Suara Peramban (Fallback ID)`.

---

## 2. 3D Asset & Visual Fidelity Limitations

1. **Blender Unavailable in Build Container:**
   - `blender` CLI is not installed in the current environment. All 3D models are authored via reproducible Node.js + Three.js `GLTFExporter` scripts and enhanced at runtime with procedural `CanvasTexture` PBR maps (`js/world/PbrTextureFactory.js`).
2. **Verified vs. Interpretive Models:**
   - **5 Masterpieces** (`rumah-gadang`, `rumah-joglo`, `tongkonan-toraja`, `honai-papua`, `mbaru-niang`) have bespoke multi-part architecture verified against Google Drive component diagrams.
   - **37 Regional Houses** use regional typology reconstructions with procedural PBR materials; some share similar stilt proportions and remain candidates for future bespoke sculptural passes.
   - **4 Exploration Vehicles & Open-Air Pavilions** are original stylized conceptual visualizations designed for accessible arcade exploration and museum display, not archaeological scans.
3. **Draw Calls in Full World Mode:**
   - With Rumah Gadang (98 PBR meshes) + 4 vehicles + pavilions + 20 regional trees active simultaneously, draw calls measure ~`215`. Future optimization can merge static foliage trunks/canopies into `THREE.InstancedMesh` to bring draw calls below `80` on low-end mobile GPUs.
4. **Local Static Server (`scripts/local_server.mjs`):**
   - The legacy untracked `scripts/local_server.mjs` serves static files only and does not route `/api/*` serverless endpoints. Automated QA (`tests/verify_nular_master_transformation.mjs`) uses a full HTTP+API server; for full local API testing, run via Vercel CLI (`vercel dev`) or the API-enabled server pattern.
