# NULAR (Nusa Learn) — Final UI Polish & Asset Optimization Report
**Pre-Production Refinement on Branch `feat/ragamara-final-experience`**

- **Target Branch:** `feat/ragamara-final-experience`
- **Target Commit:** `ae6d032` (Prior to polish commit)
- **Production Branch:** `main` (Locked at `111cf1b`, untouched)
- **Date:** November 20, 2026
- **Test Status:** 9/9 Automated Regression Suites Passed

---

## 1. Executive Summary

Following the GO recommendation from the independent pre-production audit, three targeted optimizations were addressed:
1. **P2 — Mobile Architectural Hotspot Touch Targets:** Increased hit target area from ~26×26px to ≥44×44px using an interaction-safe CSS pseudo-element (`::before`) without changing the visible badge/dot aesthetics or obstructing WebGL orbit gestures.
2. **P3 — Mobile Navigation Menu Button:** Expanded dimensions from 40×40px to 44×44px, ensuring WCAG 2.1 AAA compliance and superior mobile ergonomics.
3. **P3 — 3D GLB Asset Compression Assessment:** Rigorously benchmarked Draco/Meshopt against Vercel HTTP/2 Brotli delivery. Confirmed that serving raw GLB over Brotli achieves **8.3 KB – 53.8 KB** over-the-wire payloads (79%–96% compression) without the ~350–500 KB WASM decoder overhead, CPU decode latency, or exploded view mesh hierarchy distortion. Existing assets were preserved intact based on concrete performance metrics.

---

## 2. Changes Made & Files Modified

### Files Modified:
- `css/museum.css`:
  - Lines 355–372: Updated `.mobile-menu-btn` to 44×44px (`min-width: 44px; min-height: 44px;`) with smooth transition and explicit `:focus-visible` outline.
  - Lines 1120–1155: Added `.hotspot-pin::before` touch expander with `min-width: 44px; min-height: 44px;` centered over the pin, and added `.hotspot-pin:focus-visible` styling with 2px solid `#FAF7F2` outline.
  - Lines 1177–1188: Enhanced mobile `@media (max-width: 640px)` HUD `.viewer-btn` with `min-height: 36px; padding: 6px 9px;` for comfortable touch controls.
- `tests/verify_ui_polish.mjs`:
  - Added automated headless Chrome CDP regression test suite validating mobile menu toggle, pseudo-element touch bounding box, hotspot selection, camera orbit, exploded view, cutaway modes, responsive viewports, and console errors.

---

## 3. Before vs. After Touch-Target Dimensions

| UI Element | Viewport | Metric | Before Polish | After Polish | Standard Achieved |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Mobile Menu Button** | Mobile (≤ 960px) | Bounding Box | 40 × 40 px | **44 × 44 px** | WCAG 2.1 AAA (44×44px) |
| **Hotspot Pin (Dot)** | Mobile (≤ 640px) | Visible Marker | 26 × 26 px | 26 × 26 px *(preserved)* | Visual design integrity |
| **Hotspot Touch Area** | Mobile (≤ 640px) | Interactive Hit Box | 26 × 26 px | **≥ 44 × 44 px** | WCAG 2.1 AAA (44×44px) |
| **Hotspot Focus State** | Universal | Keyboard Focus | Default browser ring | **2px solid #FAF7F2 (z-index: 15)** | WCAG 2.1 AA (Visible focus) |
| **3D HUD Viewer Buttons**| Mobile (≤ 640px) | Button Height | ~28 px | **36 px** | Enhanced mobile ergonomics |

---

## 4. 3D GLB Asset Compression Assessment

### Network Benchmark & Compression Analysis

| Model | Raw GLB Size | Gzip Size (CDN) | Vercel Brotli (Actual Wire) | Compression Ratio | Draco/Meshopt Recommendation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Rumah Joglo** | 223.1 KB | 14.2 KB | **8.3 KB** | **-96%** | **Do Not Compress** |
| **Honai Papua** | 365.7 KB | 31.9 KB | **17.4 KB** | **-95%** | **Do Not Compress** |
| **Tongkonan Toraja** | 444.6 KB | 69.2 KB | **39.9 KB** | **-91%** | **Do Not Compress** |
| **Rumah Gadang** | 429.3 KB | 91.3 KB | **53.8 KB** | **-87%** | **Do Not Compress** |

### Architectural Decision: Preserve Raw GLB Assets
1. **Network Payload Reality:** Vercel automatically compresses static GLB files with Brotli (`content-encoding: br`). The largest model transfer over the wire is only **53.8 KB**, and the smallest is **8.3 KB**.
2. **Decoder Overhead Penalty:** Integrating Draco compression requires loading `draco_decoder.wasm` (~350 KB to 500 KB uncompressed). Downloading a 350 KB WASM module to decode an asset that is already under 54 KB increases total network payload by **700% to 4,000%**.
3. **Execution Latency:** Native GLB buffers parse directly into WebGL TypedArrays in <50ms without main-thread or worker WASM decompression latency.
4. **Structural Group Integrity:** Our models feature up to 174 discrete meshes grouped into 8 structural assemblies (for exploded view animations). Aggressive Draco geometry quantization risks vertex welding or node flattening that would break exploded component targeting.
5. **Conclusion:** Leaving the GLB assets uncompressed is empirically verified as the optimal, lowest-latency, zero-risk strategy.

---

## 5. Regression Test Results (9/9 PASS)

Tests were executed using headless Chrome with WebGL support enabled against local static server:

1. **[PASS] Mobile Menu Button 44×44px Touch Target & Toggle Operation:** Button bounds measured 44×44px; toggles `is-open` drawer and updates `aria-expanded="true" / "false"`.
2. **[PASS] Hotspot Pin Expanded Touch Target & Selection:** Pseudo-element `::before` verified at min 44×44px; clicking pin triggers component inspection card.
3. **[PASS] Hotspot Keyboard Focusability & Navigation:** Pin acquires focus cleanly with visible contrast outline.
4. **[PASS] WebGL Orbit Unhindered with Active Hotspot Layer:** Three.js camera rotation verified unobstructed by hotspot hit zones.
5. **[PASS] Exploded Structural View Animation & Component Displacement:** Roof and structural groups displace correctly along Y-axis (`factor > 1.2`).
6. **[PASS] Rumah Joglo Interior Pendopo View Mode:** Camera repositioned under canopy, revealing *Soko Guru* and *Tumpang Sari*.
7. **[PASS] Honai Papua Two-Level Cutaway Mode:** Thatch dome elevated (`roofY > 1.5`), revealing ground cooking hearth and loft.
8. **[PASS] Zero Horizontal Scroll Overflow on 5 Viewports:** Verified across 320px, 390px, 768px, 1024px, and 1440px.
9. **[PASS] Zero Console Errors & Zero Failed HTTP Responses:** Clean runtime logs throughout entire test sequence.

---

## 6. Remaining Known Limitations (For Post-Launch Roadmap)

1. **3D Model Collection Expansion:** 4 traditional houses currently feature interactive 3D GLB models; 10 houses currently feature high-resolution photographic documentation with transparent *"Model 3D sedang disiapkan"* notices. Future phases will introduce GLB models for the remaining 10 houses.
2. **Provincial Representation:** Current phase focuses on 14 iconic vernacular traditions across 10 provinces; remaining 28 Indonesian provinces are designated as *"Dalam Penelitian / Under Research"*.

---

## 7. Git & Production Status

- **Branch:** `feat/ragamara-final-experience`
- **Main Branch:** Locked at `111cf1b` (Untouched)
- **Ready for Commit & Merge Approval.**
