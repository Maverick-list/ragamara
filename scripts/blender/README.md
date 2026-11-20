# NULAR — Blender 4.x & Node.js 3D Asset Production Pipeline

## Environment Status (Verified)
- **Blender CLI (`blender`):** Not installed in the current Linux sandbox environment (`blender: command not found`).
- **Repeatable Blender 4.x Python Scripts:** Authored and Python-syntax verified (`python3 -m py_compile`) in `scripts/blender/validate_asset.py` and `scripts/blender/export_glb.py` for offline studio authoring.
- **Active Automated GLB Compiler:** Deterministic Three.js `GLTFExporter` pipeline in `scripts/build_avatars.mjs` and `scripts/build_world_models.mjs`, producing valid binary glTF 2.0 (`.glb`) models with PBR materials, named architectural component groups, `COLLISION` meshes, and embedded skeletal `AnimationClip` tracks.

## Storage Policy
- Store raw `.blend` source projects in `assets/blender/source/` using Git LFS or external studio object storage (never commit oversized raw `.blend` binaries into standard Git history).
- Commit only verified, compact web-ready `.glb` binaries (`assets/models/houses/`, `assets/models/avatars/`) and their JSON manifests (`data/asset-manifests/`).
