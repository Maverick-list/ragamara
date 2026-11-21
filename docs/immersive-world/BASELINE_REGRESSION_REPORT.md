# NULAR — Baseline Regression & Honai GLB Investigation Report
**Phase 0 Deliverable — Pre-Transformation Verification**

> **Historical Archive Notice:** References in this document to the legacy brand identifier "Ragamara" reflect the codebase and deployment state at the time of authoring. The official product identity is now **NULAR — The Living World of Nusantara**.

- **Date:** November 21, 2026
- **Branch:** `feat/nular-immersive-world` (Branched from verified Production/RC commit `1a110b0`)
- **Production URL Investigated:** `https://nularin.vercel.app` (Deployment `dpl_6GyfCtkjjFFJCenvEGur6orUqX42`)
- **RC Preview URL Baseline:** `https://ragamara-ntajmyfxq-firza-miftahul-ilmis-projects.vercel.app` (Deployment `dpl_GLUR5DbRp9iinv5YeSbj2NpDtmrf`)

---

## 1. Executive Summary

All 4 existing binary GLB models (`honai-papua.glb`, `rumah-gadang.glb`, `tongkonan-toraja.glb`, `rumah-joglo.glb`) and all 7 museum routes were tested directly against live Production (`https://nularin.vercel.app`) via headless Chrome with WebGL enabled (SwiftShader/ANGLE) and HTTP header probes.

### Key Verdict
- **Zero HTTP 4xx/5xx errors, zero JavaScript runtime exceptions, and zero corrupted GLBs** exist on `nularin.vercel.app`.
- **Root Cause of Perceived Honai GLB Error Identified:** Cold-load latency (6.6s–14.0s) caused primarily by serving the **unminified** `js/vendor/three/build/three.module.js` (54,155 lines / ~1.3 MB raw) combined with static default hidden DOM text (`"Gagal memuat berkas 3D GLB."`) in `js/viewer-3d.js`.

---

## 2. Honai GLB & Production Asset Diagnostic Results

### A. HTTP Asset Probe (`curl -sI https://nularin.vercel.app/assets/models/*.glb`)

| Asset | HTTP Status | Content-Type | Content-Length | Vercel Edge Cache |
| :--- | :---: | :--- | :---: | :---: |
| `honai-papua.glb` | **200 OK** | `model/gltf-binary` | `374,512` bytes | `HIT` |
| `rumah-gadang.glb` | **200 OK** | `model/gltf-binary` | `439,556` bytes | `HIT` |
| `rumah-joglo.glb` | **200 OK** | `model/gltf-binary` | `228,460` bytes | `HIT` |
| `tongkonan-toraja.glb` | **200 OK** | `model/gltf-binary` | `455,312` bytes | `HIT` |

### B. Live Headless Browser WebGL Verification (`nularin.vercel.app`)

| Route | Model Loaded | Structural Groups | Hotspots | Cold Load Time | Console/Page Errors | Error Overlay Visible |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/house?id=honai-papua` | **YES** | 6 | 6 | 7,319 ms | 0 | `false` |
| `/house?id=rumah-gadang` | **YES** | 8 | 8 | 13,995 ms | 0 | `false` |
| `/house?id=tongkonan-toraja` | **YES** | 7 | 7 | 12,102 ms | 0 | `false` |
| `/house?id=rumah-joglo` | **YES** | 7 | 7 | 6,632 ms | 0 | `false` |
| `/explore` | N/A | N/A | N/A | < 2,000 ms | 0 | N/A |
| `/map` | N/A | N/A | N/A | < 2,000 ms | 0 | N/A |
| `/anatomy` | N/A | N/A | N/A | < 2,000 ms | 0 | N/A |
| `/about` | N/A | N/A | N/A | < 2,000 ms | 0 | N/A |
| `/profile` | N/A | N/A | N/A | < 2,000 ms | 0 | N/A |

---

## 3. Root Cause Analysis: Previously Observed Honai Load Issue

1. **Cold-Load Latency (>3s on first visit):**
   - `js/vendor/three/build/three.module.js` is vendored in unminified form (~1.3 MB source + `GLTFLoader.js` + `OrbitControls.js` + `DRACOLoader.js`). On slower connections or cold cache, parsing the ESM module graph before fetching `honai-papua.glb` takes 6.6–14.0 seconds.
   - A test harness or impatient visitor checking before 7.3 seconds sees `modelRoot === null` while the loading progress overlay is still active.
2. **Hidden DOM Error String False Positive:**
   - In `js/viewer-3d.js` line 105, `this.errorOverlay` is rendered in DOM with `hidden = true` and default fallback copy `"Gagal memuat berkas 3D GLB."`. Any DOM text scraper that doesn't check `.hidden` can mistakenly report that error message even when `errorHidden === true` and the model loaded cleanly.
3. **Clean URLs Redirect Overhead:**
   - Requests to `/house.html?id=honai-papua` return `HTTP 308` to `/house?id=honai-papua` due to `"cleanUrls": true` in `vercel.json`, adding one round-trip on cold navigation when links include `.html`.

---

## 4. Recommended Baseline Fixes (Integrated in Upcoming Phases)

1. Remove eager `DRACOLoader` import when models are standard uncompressed GLB, and evaluate minified Three.js module build or preloading hints (`<link rel="modulepreload">`) to cut cold-load time.
2. Only populate error copy inside `errorOverlay` when an actual error event fires.
3. Preserve all existing museum routes and backward compatibility while layering the new Playable Cultural World (`world.html`), 38-Province GeoJSON Atlas (`map.html`), and AI House Tour Guide (`api/ai-guide.js`).
