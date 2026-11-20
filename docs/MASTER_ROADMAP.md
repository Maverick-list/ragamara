# NULAR — Master Implementation Roadmap
## Immersive Nusantara Cultural World

- **Branch:** `feat/nular-immersive-cultural-world` (branched from `feat/nular-immersive-world` @ `d91c5d9`; `main` untouched at `1a110b0`)
- **Product Identity:** *"Explore the Living Heritage of Indonesia"*

| Phase | Scope | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Audit & Implementation Plan | Repo/asset/DB/skill audit, 8 living `docs/*.md` governance files | **In Progress** |
| **Phase 1** | Design System & Website Redesign | `css/design-system.css`, `js/motion.js`, `index.html`, `explore.html`, `portal.html`, `learn.html`, unified nav | Planned |
| **Phase 2** | Internationalization (i18n + RTL) | `js/i18n/` (`id`, `en`, `ar` RTL, `ja`, `ko`, `zh`, `es`, `fr`) + Indonesian regional language registry | Planned |
| **Phase 3** | Authentication, Identity & DB Schema | `db/migrations/001_nular_cultural_world.sql`, `api/auth.js`, `auth.html`, `js/auth-client.js`, Guest + Account sync | Planned |
| **Phase 4** | 3D Character Customization & Camera Modes | Hairstyle/outfit/accessory customization, smooth animation blending, First-Person / Third-Person / Free-Explore cameras, graphics profiles | Planned |
| **Phase 5** | World Map & 3D Environmental Polish | Regional biomes, weather/fog/wind vegetation, water, 38-province GeoJSON mission/collection integration | Planned |
| **Phase 6** | Cultural Collection Expansion | Unified `CulturalItem` catalog (`data/cultural-items.json`), Clothing, Weapons (non-violent museum artifacts), Music/Dance/Crafts/Food, 3D Artifact Viewer | Planned |
| **Phase 7** | Gamification & Anti-Abuse | `api/progress.js`, `api/leaderboard.js`, XP formula, levels, timezone-safe streaks, achievements, Collection Book, Leaderboards | Planned |
| **Phase 8** | Quest & Mission System | `api/missions.js`, Exploration/Learning/Collection/Regional/Daily missions, quizzes, in-world HUD tracker | Planned |
| **Phase 9** | Audio & AI House Tour | `js/world/AudioManager.js` (Web Audio regional ambient + SFX), grounded AI Tour integration, transcripts | Planned |
| **Phase 10** | Final Quality Assurance | End-to-end automated & visual matrix across all routes, i18n/RTL, 3D cameras, XP integrity, mobile & a11y, `docs/TESTING_REPORT.md` | Planned |
