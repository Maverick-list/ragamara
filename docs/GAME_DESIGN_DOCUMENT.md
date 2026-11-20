# NULAR — Game Design Document (GDD)

## 1. Core Loop
1. **Enter Hub / Portal (`portal.html` -> `world.html`):** Choose avatar (hairstyle, Nusantara textile outfit, accessory), camera mode (First-Person, Third-Person, Free-Explore), and active mission.
2. **Explore 38 Provinces:** Travel via the Nusantara Hub Plaza or Interactive 38-Province GeoJSON Atlas into 42 traditional house environments.
3. **Inspect & Learn:** Walk inside interiors, inspect architectural components (`E`), examine traditional clothing & weapons, consult the AI House Tour Guide, and complete knowledge quizzes.
4. **Progress & Collect:** Earn server-validated XP, level up, maintain daily learning streaks, unlock verified achievements, populate the Cultural Collection Book, and compete ethically on privacy-safe leaderboards.

## 2. XP & Level Progression Formula
- **Formula:** `xpForNextLevel(level) = Math.round(100 * Math.pow(level, 1.5))`
- **Titles:** Level 1 *New Explorer*, Level 2 *Cultural Seeker*, Level 3 *Heritage Adventurer*, Level 4 *Nusantara Discoverer*, Level 5 *Cultural Scholar*, Level 6+ *Master Nusantara Archivist*.
- **Anti-Abuse Rules:** Idempotent `eventKey` deduplication (`discover:<itemId>`, `article:<itemId>`, `mission:<missionId>`, `quiz:<quizId>`) prevents repeated XP farming or client score tampering.

## 3. Camera & Control Design
- **First-Person:** Eye-level (`1.62m`), mouse-look with pitch clamp `[-75°, +75°]`, optional body visibility toggle, wall collision check.
- **Third-Person:** Over-the-shoulder follow with adjustable distance (`2.5–7.5m`), height (`1.2–3.0m`), and collision raycast obstruction avoidance.
- **Free-Explore:** Orbit, pan, zoom, reset camera, and optional cinematic orbit around architectural monuments.
- **Controls:** `WASD` move, `Shift` run, `Space` jump, `E` interact, `R` roof cutaway, `C` cycle camera, `Esc` settings/pause; Mobile virtual joystick + touch camera drag + action pads.
