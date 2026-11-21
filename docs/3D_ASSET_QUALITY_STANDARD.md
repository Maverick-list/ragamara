# NULAR — 3D ASSET QUALITY STANDARD
**Version:** 3.0.0 (Phase 3 Reconstruction Standard)  
**Target Renderer:** Three.js r160 WebGL2 (ACES Filmic Tone Mapping, PCF Soft Shadows)

---

## 1. Architectural Geometry Standards

1. **Real-World Metric Scale:** `1.0 Three.js unit = 1.0 meter`. Human avatars stand `~1.72m`; traditional doorways range from `1.25m` (Honai alpine stooping door) to `2.40m` (Javanese Pendopo/Gebyok).
2. **Named Structural Hierarchy:** Every house GLB MUST separate meshes into semantic architectural groups (`FOUNDATION_STONES` / `UMPAK`, `STILT_COLUMNS` / `SOKO_GURU`, `TUMPANG_SARI`, `FLOOR_SYSTEM`, `WALL_SYSTEM`, `DOORS`, `ROOF_SYSTEM` / `ROOF_BRUNJUNG`, `INTERIOR_FURNITURE`, `COLLISION`).
3. **No Generic Box Placeholders:** Roof silhouettes must reflect authentic regional geometry (parabolic gonjong, hyperbolic saddleback *Longa*, 7-tier *Tumpang Sari* + *Brunjung*, 5-tier concentric *Mbaru Niang*, spherical *Honai* dome).
4. **Explicit Collision Geometry:** Invisible `COLLISION_FLOOR_*`, `COLLISION_STAIR_*`, and `COLLISION_WALL_*` AABBs guarantee zero clipping and smooth stair climbing.

---

## 2. PBR Material & Regional Textile Standards (`js/world/PbrTextureFactory.js`)

Flat untextured solid colors are prohibited on final architectural surfaces and character garments. Every loaded GLB receives procedural cached PBR albedo + bump maps:
- **Wood (`wood_teak`, `wood_ironwood`):** Directional timber grain, fiber striations, plank seams, bumpScale `0.035`.
- **Carved Relief (`wood_carved`):** Traditional gold/crimson/obsidian motif friezes (*Siriah Gadang*, *Pa'ssura*, *Gebyok*), bumpScale `0.05`.
- **Woven Bamboo (`bamboo_woven`):** Interlaced *bedek/gedek* basket weave, bumpScale `0.045`.
- **Thatch (`thatch_ijuk`, `thatch_grass`):** Layered vertical organic fibers with horizontal eave courses, bumpScale `0.06`.
- **Terracotta (`terracotta_tiles`):** Overlapping staggered *genteng* clay tiles, bumpScale `0.05`.
- **Natural Stone (`stone_andesite`):** Speckled volcanic stone pedestals & river boulders, bumpScale `0.04`.
- **6 Distinct Regional Character Textiles:**
  1. `batik-parang-solo` — Soga brown & warm ivory diagonal *Parang Rusak* blades.
  2. `batik-megamendung-cirebon` — Concentric royal indigo/cobalt *Mega Mendung* clouds.
  3. `songket-minangkabau` — Crimson silk with metallic gold *Pucuak Rabuang* bamboo shoots.
  4. `ulos-ragidup-batak` — Maroon, obsidian, and ivory warp stripes with geometric diamond weft.
  5. `tenun-ikat-sumba` — Indigo and kombu-red horizontal ikat bands.
  6. `sasirangan-banjar` — Emerald, gold, and maroon *Ombak Sinapur Karang* waves.

---

## 3. Adaptive Graphics & Budget Targets

| Profile | DPR | Shadows | Max Draw Calls / House | Max GLB Size |
| :--- | :---: | :---: | :---: | :---: |
| **Low** | `1.0` | Off | `< 30` | `< 360 KB` |
| **Medium** | `<= 1.5` | `1024x1024` | `< 30` | `< 360 KB` |
| **High** | `<= 2.0` | `1024x1024` | `< 30` | `< 360 KB` |
| **Ultra** | `<= 2.0` | `2048x2048` | `< 30` | `< 360 KB` |
