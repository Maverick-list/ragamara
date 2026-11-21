# NULAR — Technical Architecture & Product Transformation Guide

> [!NOTE] Historical Archive Notice
> **Ragamara** was the legacy project codename during initial exploratory phases. The official, permanent brand identity of this platform is **NULAR — The Living World of Nusantara**. This document is retained for historical traceability and architectural audit purposes.

## 1. Executive Summary
NULAR has been transformed into **NULAR — The Living World of Nusantara**, an immersive 3D cultural exploration world and interactive digital architecture museum.

- **Branch:** `feat/ragamara-final-experience` (Production branch `main` remains strictly untouched).
- **Stack:** Pure static multi-page ES Modules web architecture (`HTML5`, `CSS3`, `JavaScript ES2022`, vendored `Three.js v0.169.0` MIT with `GLTFLoader`, `DRACOLoader`, and `OrbitControls`), deployed cleanly via Vercel (`cleanUrls: true`).

## 2. Migration & Legacy Preservation Audit
Before transformation, the existing project was audited:
- **Removed from primary product journey:** 6 mini-games (`js/minigames.js`), XP/Gems/Shop/Streak/Leaderboard dashboard (`js/ecosystem.js`, legacy `app.html`).
- **Safely preserved (not blindly deleted):**
  - `data/backups/pre-museum-transformation/legacy_index.html` and `legacy_app.html`
  - `ragamara_culture_db.json` & `js/culture_db_data.js` (DAPOBUD official record IDs for Rumah Gadang, Rumah Adat Karo, and Rumah Panjang Dayak are cited directly in `data/houses.json`)
  - Legacy `localStorage` user profile display name & bio (`ragamara_ecosystem_v2` / `ragamara_player_state`) are non-destructively migrated once into `nular_museum_v1` (`js/museum-store.js`).
  - `app.html` acts as a clean redirect bridge to `explore.html` / `map.html` / `profile.html` / `index.html`.

## 3. New Information Architecture & Routes
| Route | File | Role |
| :--- | :--- | :--- |
| `/` | `index.html` | **HOME — The Living Atlas:** Editorial hero with live interactive 3D preview switcher, Featured Architecture, Explore by Island (7 regions), Architectural Stories, Recently Added Collections. |
| `/explore` | `explore.html` | **EXPLORE — Traditional House Collection:** Searchable (local names & alternative spellings) and multi-facet filterable catalog (Island, Province, Community, Architectural Type, Material, 3D Model Status). |
| `/house?id=<id>` | `house.html` | **HOUSE DETAIL PAGE & 3D EXPLORER:** Dedicated dossier with full Three.js GLB 3D Explorer, hotspot raycasting, exploded/interior view modes, specifications, cultural meaning, references, attribution, personal notes, and related houses. |
| `/map` | `map.html` | **ARCHITECTURE MAP:** Interactive 7-region schematic archipelago map + 38-province directory transparently distinguishing *3D Model Available*, *Documented*, and *Under Research*. |
| `/anatomy` | `anatomy.html` | **ARCHITECTURAL DETAILS:** Tripartite vernacular anatomy study, interactive side-by-side two-house structural comparator, and full architectural essays. |
| `/about` | `about.html` | **ABOUT NULAR:** Cultural preservation manifesto, tangible vs intangible heritage distinction, live attribution & license registry, and CMS data workflow documentation. |
| `/profile` | `profile.html` | **EXPLORATION JOURNAL:** Saved houses, recently explored history, meaningful non-gamified discovery milestones, favorite regions, and personal architectural study notes. |

## 4. Structured Data Schema (`data/houses.json`)
Every traditional house entry follows a strict 25-field data schema supporting multiple distinct traditions per province and pure configuration-driven 3D viewer onboarding:
- Identity: `id`, `houseName`, `localName`, `alternativeNames`
- Geography & Community: `province`, `island`, `districtOrRegion`, `culturalCommunity`, `heritageCategory`
- Architectural Taxonomy: `architecturalType`, `introduction`, `historicalContext`, `architecturalFeatures` (`roofForm`, `foundation`, `walls`, `spatialLayout`, `constructionTechniques`, `climateAdaptation`), `constructionMaterials`, `structuralSystem`, `spatialFunctions`
- Culture: `culturalSignificance` (`symbolism`, `traditionalFunctions`, `socialOrganization`, `ceremonialRelevance`)
- 3D Assets & Capabilities: `model3DUrl`, `modelStatus`, `modelCapabilities` (`interiorSupported`, `explodedSupported`, `separatedComponents`, `limitationsNote`), `cameraPresets`, `hotspots` (mesh-linked `meshName`, 3D `anchor`, `cameraPos`, `explodeOffset`, `localName`, `title`, `constructionAndMaterial`, `practicalFunction`, `culturalMeaning`)
- Governance & Provenance: `referenceImages`, `sources`, `assetCreator`, `assetLicense`, `attribution`, `verificationStatus`, `lastReviewedAt`

## 5. Adding New GLB Models Without Modifying the Viewer
1. Author or verify an openly licensed binary `.glb` model with cleanly named structural `THREE.Group` children (e.g. `atap`, `dinding`, `tiang`, `pondasi`), optimized under ~1 MB (with optional Draco compression).
2. Save the file to `assets/models/<house-id>.glb`.
3. Update the corresponding house object in `data/houses.json`:
   - Set `"model3DUrl": "assets/models/<house-id>.glb"`
   - Set `"modelStatus": "available"`
   - Populate `"modelCapabilities"`, `"cameraPresets"`, `"hotspots"`, `"assetCreator"`, `"assetLicense"`, and `"attribution"`.
4. `js/viewer-3d.js`, `explore.html`, `map.html`, `house.html`, and `about.html` automatically reflect the new 3D model, hotspots, counts, and attribution table.

## 6. Known Limitations & Future Roadmap
- **Coverage:** 14 documented traditional houses across 10 provinces (covering all 7 island regions); 28 provinces are transparently marked *Dalam Penelitian* until primary documentation is verified.
- **3D Model Coverage:** 4 houses currently have full multi-component `.glb` models (*Rumah Gadang*, *Tongkonan*, *Rumah Joglo*, *Honai*); the remaining 10 documented houses display verified CC BY-SA 4.0 architectural photographs with `"Model 3D sedang disiapkan"` status.
- **Interior Geometry:** *Rumah Joglo* (open *Pendopo* & *Tumpang Sari*) and *Honai* (two-story loft & hearth cutaway) support true Interior mode; *Rumah Gadang* and *Tongkonan* disable Interior mode transparently until interior partition geometry is authored.
- **Future CMS & Photogrammetry:** Connect `data/houses.json` to a headless CMS (Strapi/Sanity/Directus) with role-based curator sign-off and expand the 3D library with photogrammetry/LiDAR scans in partnership with Indonesian museums and architecture faculties.
