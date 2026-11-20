# NULAR — Audited Asset Inventory

## 1. 3D Models (`assets/models/`)
- **Traditional Houses (`assets/models/houses/*.glb`):** `42` validated glTF 2.0 binary models covering all `38` Indonesian provinces (`50.4 KB` – `326.7 KB` uncompressed, `0.37 MB` total Brotli), each with `7–15` `COLLISION_*` meshes, interior zones, and component hotspots. Provenance: `original_digital_reconstruction` (`illustrative_scheme` for `kambik-moi`), derived from the 434 Google Drive component `.png` sheets and 2 `.docx` research files.
- **Playable Nusantara Avatars (`assets/models/avatars/*.glb`):** `6` original rigged & animated glTF 2.0 avatars (`78.9 KB` – `92.0 KB`), each with `8` embedded `AnimationClip`s (`Idle`, `Walk`, `Run`, `Turn`, `Interact`, `Point`, `Wave`, `Sit`):
  - `batik-parang-solo.glb`, `batik-megamendung-cirebon.glb` (Batik)
  - `tenun-ikat-sumba.glb`, `songket-minangkabau.glb`, `ulos-ragidup-batak.glb`, `sasirangan-banjar.glb` (Non-Batik Woven/Tie-Dye)
- **Cultural Artifacts (`assets/models/artifacts/*.glb`):** Planned in Phase 6 for verified Traditional Clothing mannequins & Traditional Weapons (`Rencong`, `Keris`, `Mandau`).

## 2. Geographic & Cultural Datasets (`data/` & `ragamara_culture_db.json`)
- `data/indonesia-38-provinces.geojson` (`248 KB`, MIT License, `38` exact post-2022 provinces).
- `data/houses.json` (`Schema v3.0.0`, `42` traditional houses with 10-section articles).
- `data/textiles.json` (`6` verified Nusantara textile provenance records).
- `ragamara_culture_db.json` (`45` DAPOBUD Kemenbud RI + Wikipedia Indonesia enriched records covering weapons like `Rencong`, dances like `Tor-Tor`, instruments like `Gordang Sambilan` and `Dambus`, textiles like `Songket Palembang`, `Tapis`, `Batik Indonesia`, crafts like `Gerabah Kasongan`, culinary heritage like `Randang`, and regional customs).
- `assets/photos/` (`28` exterior hero renders/photos with verified attribution in `data/source-registry.json`).
