# NULAR — 3D ASSET PROVENANCE & CULTURAL ACCURACY REGISTRY
**Version:** 3.0.0  
**Toolchain:** Node.js + Three.js `GLTFExporter` (`scripts/build_authentic_houses.mjs`, `scripts/build_world_models.mjs`, `scripts/build_avatars.mjs`, `scripts/build_cultural_collection.mjs`) + Runtime PBR Texture Factory (`js/world/PbrTextureFactory.js`). *(Note: Blender CLI is not installed in the current build environment.)*  
**License:** CC BY 4.0 — NULAR Original Digital Architectural & Cultural Reconstructions

---

## 1. Accuracy Classification Definitions

- **Verified Architectural Reconstruction:** Built directly from Google Drive component PNG diagrams (`13jHt1dsB63bAsS_ciSTqNc-9w2uiIIdA`) and `Deskripsi_Rumah_Adat.docx` monograph tables, visually inspected via multi-angle contact sheets, and enhanced with procedural PBR materials.
- **Interpretive Vernacular Reconstruction:** Structurally grounded in regional typology from Google Drive / DAPOBUD monographs with walkable interiors and PBR materials; designated for future bespoke ornamental detail passes.
- **Conceptual Visualization / Gameplay Prop:** Original stylized 3D assets built for museum exhibition pavilions, arcade exploration vehicles, and UI beacons (not claimed to be 1:1 archaeological scans).

---

## 2. Asset Provenance Summary

| Asset Group | Count | Authoring Method | Primary References | Accuracy Status |
| :--- | :---: | :--- | :--- | :--- |
| **Top 5 Masterpiece Houses** (`rumah-gadang`, `rumah-joglo`, `tongkonan-toraja`, `honai-papua`, `mbaru-niang`) | 5 GLBs | Bespoke parametric Three.js + PBR CanvasTextures | Google Drive folders (`01`, `03`, `13`, `26`, `34`) + `Deskripsi_Rumah_Adat.docx` | **Verified Architectural Reconstruction** |
| **37 Regional Houses across 38 Provinces** | 37 GLBs | Regional archetype Three.js + PBR CanvasTextures | Google Drive folders (32 direct + 5 academic DAPOBUD/TMII traditions) | **Interpretive Vernacular Reconstruction** |
| **6 Playable Nusantara Avatars** | 6 GLBs | Rigged skeletal Three.js + 6 distinct procedural regional textile maps | UNESCO ICH Batik (2009), DAPOBUD Songket/Ulos/Tenun/Sasirangan | **Interpretive Cultural Costume** |
| **6 Cultural Artifact Exhibits** (Keris, Mandau, Rencong, Batik Parang, Songket, Tenun Sumba) | 6 GLBs | Procedural Three.js display models | Museum Nasional Indonesia & DAPOBUD (historical display only) | **Interpretive Cultural Display** |
| **Open-World Exhibition Pavilions & 4 Exploration Vehicles** (Motorcycle, Car, Boat, Airplane) | Runtime Three.js | Procedural Three.js modular builders | Original NULAR museum architecture & arcade exploration design | **Conceptual Visualization** |
