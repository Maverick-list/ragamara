# Phase 2 — 3D Asset & Blender Production Pipeline Report

## Environment & Tooling Reality (Transparent Documentation)
- **Blender CLI (`blender`):** Not installed in the Linux host sandbox (`blender: command not found`).
- **Blender 4.x Python Automation Suite:** Authored and syntax-verified (`python3 -m py_compile`) in `scripts/blender/validate_asset.py` and `scripts/blender/export_glb.py`, with repository directories `assets/blender/source/` and `assets/blender/exports/` ready for studio `.blend` authoring under Git LFS.
- **Deterministic Three.js GLB Production Pipeline:** Implemented in `scripts/build_avatars.mjs` and `scripts/build_world_models.mjs` using vendored Three.js v0.169.0 `GLTFExporter`.

## Deliverables Verified
1. **NULAR Avatar Collection (`assets/models/avatars/*.glb` + `data/asset-manifests/avatars-manifest.json`):**
   - 6 original playable 3D characters wearing culturally authenticated Nusantara outfits:
     1. `batik-parang-solo.glb` (Batik — Surakarta/Yogyakarta, 90.2 KB)
     2. `batik-megamendung-cirebon.glb` (Batik Pesisir — Cirebon, 82.7 KB)
     3. `tenun-ikat-sumba.glb` (Tenun Ikat — Sumba NTT, **non-batik**, 88.1 KB)
     4. `songket-minangkabau.glb` (Tenun Songket — Pandai Sikek Sumbar, **non-batik**, 88.1 KB)
     5. `ulos-ragidup-batak.glb` (Tenun Ulos — Batak Toba Sumut, **non-batik**, 88.1 KB)
     6. `sasirangan-banjar.glb` (Kain Sasirangan — Banjar Kalsel, **non-batik**, 92.0 KB)
   - Every avatar GLB embeds **8 glTF AnimationClips**: `Idle`, `Walk`, `Run`, `Turn`, `Interact`, `Point`, `Wave`, `Sit`.
2. **Walkable Architectural Pilot (`assets/models/houses/rumah-joglo.glb` + `data/asset-manifests/rumah-joglo.json`):**
   - 150.9 KB binary GLB, 1,212 triangles, 13 `COLLISION_*` meshes, 2 walkable interior zones (`Pendopo` + `Ndalem Ageng & Senthong`), named component groups (`SOKO_GURU`, `TUMPANG_SARI`, `UMPAK`, `WALL_SYSTEM`, `FLOOR_SYSTEM`, `DOORS`, `INTERIOR_FURNITURE`, `ROOF_BRUNJUNG`, `ROOF_PENANGGAP`, `COLLISION`).
   - Provenance explicitly labeled `original_digital_reconstruction`.
