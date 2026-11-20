# NULAR (Nusa Learn) — Production Release Candidate (RC-1) Dossier
**Interactive 3D Nusantara Architecture Museum**

- **Release Candidate Version:** `v2.0.0-rc.1`
- **Candidate Commit SHA:** `78fbcfda69db3457d4469020b495d0b4b02f8994` (`78fbcfd`)
- **Feature Branch:** `feat/ragamara-final-experience` (Synchronized with `origin/feat/ragamara-final-experience`)
- **Target Production Branch:** `main` (Locked at `111cf1b`, untouched)
- **Verified Vercel Preview:** `https://ragamara-ntajmyfxq-firza-miftahul-ilmis-projects.vercel.app`
- **Deployment ID:** `dpl_GLUR5DbRp9iinv5YeSbj2NpDtmrf`
- **Date Prepared:** November 20, 2026
- **Release Status:** **GO — READY FOR HUMAN MERGE APPROVAL**

---

## 1. Release Overview & Strategic Purpose

This release marks the fundamental product evolution of **NULAR (Nusa Learn)** from a gamified cultural trivia application into an **immersive, non-gamified digital architecture museum**:
> *"Explore the Living Architecture of Nusantara"*

The platform introduces traditional vernacular houses from across Indonesia through interactive 3D WebGL models, architectural component dossiers, regional maps, structural comparative grids, and non-gamified study journaling.

---

## 2. Comprehensive Feature Summary

### A. Living Architecture Catalog & Discovery (7 Museum Pages)
1. **`index.html` (Living Atlas Home):** Editorial hero section featuring interactive 3D preview canvas, 4 curated featured houses, 8 island cultural regions, and quick access to exploration tools.
2. **`explore.html` (Architectural Catalog):** Search by vernacular names/aliases (*"Bagonjong"*, *"Banua"*), filter by island, multi-tradition provinces (e.g. *Sumatera Barat* showing both Minangkabau and Mentawai), structural systems, and 3D availability.
3. **`house.html` (Interactive 3D Explorer & Dossier):** Real-time WebGL viewer with orbit rotation, zoom, camera reset, 3D hotspots, component highlighting, contextual dossier cards, architectural specifications, and verified photography.
4. **`map.html` (Interactive Indonesia Architectural Map):** 8 geographic island clusters, 14 pinned traditional houses, regional filter buttons, and instant side preview panels.
5. **`anatomy.html` (Structural Anatomy & Two-House Comparator):** Side-by-side comparative grid contrasting structural systems, foundation damping (*Batu Sandi* / *Umpak*), roofing geometry, and natural ventilation between any two houses.
6. **`about.html` (Curatorial Methodology & Attribution Registry):** Complete 14-entry attribution table listing Kemendikbudristek Data Pokok Kebudayaan (DAPOBUD) IDs, UNESCO citations, and Wikimedia Commons CC BY-SA 4.0 photo creators.
7. **`profile.html` (Personal Exploration Journal):** Non-gamified client-side persistence of saved houses, visit history, field notes, and architectural milestones without XP, gems, streaks, or leaderboards.
8. **`app.html` (Legacy Bridge):** Graceful redirect bridge steering legacy traffic to the museum catalog (`explore.html`).

### B. Interactive 3D Model Suite (Three.js v0.169.0)
- **Rumah Gadang (Minangkabau):** 8 discrete structural groups, exploded structural view along Y-axis, 8 interactive hotspots.
- **Tongkonan Toraja (Toraja):** 7 structural groups, exploded view, free-standing *Tulak Sombong* pillar, *Kabongo'* carving, 7 hotspots.
- **Rumah Joglo (Jawa):** 7 structural groups, exploded view, **True Interior *Pendopo* Mode** positioning the camera beneath the roof to inspect the 4 central *Soko Guru* columns and tiered *Tumpang Sari* beam corbelling, 7 hotspots.
- **Honai Papua (Dani):** 6 structural groups, **Two-Level Cutaway Mode** elevating the thatch dome to reveal ground hearth and upper sleeping loft, 6 hotspots.
- **10 Verified Photographic Fallbacks:** For houses whose 3D models are currently in research/preparation (e.g. Mbaru Niang Wae Rebo), clear *"Model 3D sedang disiapkan"* banners and CC BY-SA 4.0 photo documentation are rendered.

---

## 3. Audit & UI Polish Results

### Independent Pre-Production Audit (Verdict: GO)
- **3D Performance:** All 4 GLB models under 450 KB; 1,556–9,348 triangles; zero raster texture overhead; 100% GPU geometry and material disposal on teardown (`afterGeometries: 0`).
- **Cultural Rigor:** All 14 houses verified with DAPOBUD numbers, academic citations, indigenous terminology, and CC BY-SA 4.0 photo provenance.
- **Responsive Layout:** 35/35 screen tests passed (320px, 390px, 768px, 1024px, 1440px) with 0 horizontal scroll overflow.
- **Security:** 0 secrets, 0 unvetted external scripts, Three.js vendored locally, zero Vercel env variable leaks.

### Final UI Polish Verification (9/9 PASSED)
- **Mobile Hotspot Hit Area:** Expanded to **≥44×44px** via CSS `::before` pseudo-element, achieving WCAG 2.1 AAA touch target compliance while preserving the 26px visual badge and Three.js orbit gestures.
- **Mobile Menu Toggle Button:** Resized to **44×44px** (`min-width: 44px; min-height: 44px;`) with high-contrast `:focus-visible` styling.
- **Mobile 3D HUD Controls:** Buttons enhanced with `min-height: 36px; padding: 6px 9px;` for comfortable touch controls.
- **GLB Optimization Assessment:** Confirmed that raw GLBs transferred over Vercel Brotli require only **8.3 KB to 53.8 KB** over the wire (-87% to -96% compression). Avoided the ~350 KB Draco WASM decoder penalty.

---

## 4. Release Candidate Deployment Information

| Field | Value |
| :--- | :--- |
| **Project Name** | `ragamara` |
| **Vercel Team ID** | `team_y5x7HA5icQsIyKZ2KPvZIudU` |
| **Deployment ID** | `dpl_GLUR5DbRp9iinv5YeSbj2NpDtmrf` |
| **Deployment URL** | `https://ragamara-ntajmyfxq-firza-miftahul-ilmis-projects.vercel.app` |
| **Branch Alias** | `https://ragamara-git-feat-ragamara-f513f6-firza-miftahul-ilmis-projects.vercel.app` |
| **Commit SHA** | `78fbcfda69db3457d4469020b495d0b4b02f8994` |
| **State** | `READY` (Verified live via automated real-browser smoke tests) |
| **Target** | `Preview` (Production remains untouched) |

### Live Smoke Test Verification (6/6 PASS on `dpl_GLUR5DbRp9iinv5YeSbj2NpDtmrf`)
1. [PASS] Mobile Menu 44×44px target bounds and drawer open/close operation.
2. [PASS] Hotspot 44×44px touch expander (`::before`) and dossier inspection card.
3. [PASS] 3D Exploded View structural component displacement (`roofY > 1.2`).
4. [PASS] Rumah Joglo interior *Pendopo* mode (`mode === 'interior'`).
5. [PASS] Honai Papua two-level cutaway mode (`roofY > 1.5`).
6. [PASS] Zero console errors, zero uncaught exceptions, and zero 4xx/5xx network errors.

---

## 5. Final Risk Assessment

### A. Cultural Accuracy & Attribution (Risk Level: Low / Mitigated)
- *Verified Facts:* 14/14 houses have verified DAPOBUD IDs, academic citations, indigenous terminology, and CC BY-SA 4.0 photo licensing.
- *Transparent Limitations:* The 3D models are explicitly labeled as **proportional and structural studies** rather than millimeter-accurate archaeological point-clouds.
- *Geographic Scope:* 10 provinces represented; 28 remaining provinces are explicitly labeled as *"Dalam Penelitian / Under Research"*.

### B. 3D Model Performance & Memory (Risk Level: Low / Mitigated)
- *Verified Facts:* Raw GLB file sizes are 223–445 KB; wire transfer over Brotli is 8.3–53.8 KB; polygon counts are 1,556–9,348 triangles; active JS heap is 10–31 MB. Full memory disposal verified on viewer teardown (geometries 144 → 0).
- *Assumptions / Mitigations:* Performance on low-end mobile devices is supported by the extremely low polygon budget (<10k triangles) and lack of heavy raster textures.

### C. Mobile Accessibility & Ergonomics (Risk Level: Low / Mitigated)
- *Verified Facts:* Mobile touch targets meet WCAG 2.1 AAA (44×44px) for navigation and hotspot markers. All viewports (320px to 1440px) pass with 0 horizontal scroll overflow. Visible `:focus-visible` outlines are active.

### D. Security & Environmental Isolation (Risk Level: Very Low)
- *Verified Facts:* Zero secrets in repository. Three.js r169 vendored locally. Zero Vercel project environment variables leaked. All client-rendered strings sanitized via `escapeHtml(...)`.

### E. Browser Compatibility (Risk Level: Low / Mitigated)
- *Verified Facts:* Built with standard ES Modules, CSS custom properties, and WebGL 1/2.
- *Fallback Safety:* Non-WebGL browsers gracefully display verified high-resolution photography with contextual architectural captions.

---

## 6. Known Limitations (Post-Launch Roadmap)

1. **3D Model Collection Expansion:** 4 traditional houses currently feature interactive 3D GLB models; 10 houses currently feature high-resolution photographic documentation with transparent *"Model 3D sedang disiapkan"* notices. Future phases will introduce GLB models for the remaining 10 houses.
2. **Provincial Representation:** Current phase focuses on 14 iconic vernacular traditions across 10 provinces; remaining 28 Indonesian provinces are designated as *"Dalam Penelitian / Under Research"*.

---

## 7. Rollback Procedure

In the event of an unforeseen production anomaly after merging into `main`:

### Option A: Instant Vercel Dashboard Rollback (< 30 seconds)
1. Navigate to Vercel Dashboard → Project `ragamara` → **Deployments**.
2. Locate the previous production deployment `dpl_DvoejaXJ45oAnGr97mJHp5Ajy4BQ` (Commit `8816d66`, marked as `isRollbackCandidate: true`).
3. Click the three dots `...` and select **Promote to Production** or **Instant Rollback**.
4. Production traffic immediately reverts to the pre-transformation baseline.

### Option B: Git Revert Rollback
```bash
git checkout main
git pull origin main
git revert -m 1 <MERGE_COMMIT_SHA> -m "revert: rollback NULAR 3D museum release candidate"
git push origin main
```
Vercel CI will automatically redeploy the restored commit.

---

## 8. Post-Merge Production Verification Checklist

Upon authorized merge into `main`:
- [ ] Confirm production deployment status reaches `READY` on Vercel.
- [ ] Verify production domain resolves `index.html` with title *"NULAR — Nusa Learn | Arsitektur Vernakular Nusantara"*.
- [ ] Verify 3D hero canvas loads on desktop and mobile viewports.
- [ ] Verify `explore.html` loads all 14 house cards and filters function correctly.
- [ ] Verify `house.html?id=rumah-gadang` loads 3D model, hotspots, and exploded view.
- [ ] Verify `house.html?id=rumah-joglo` interior *Pendopo* mode.
- [ ] Verify `house.html?id=honai-papua` two-level cutaway mode.
- [ ] Verify `house.html?id=mbaru-niang` fallback banner and photo.
- [ ] Verify `map.html` and `anatomy.html` comparative tools.
- [ ] Verify `about.html` attribution registry.
- [ ] Verify `profile.html` personal exploration journal persistence.
- [ ] Verify legacy `/app.html` redirects to `/explore.html`.
- [ ] Monitor Vercel Runtime Logs for 0 uncaught exceptions and 0 4xx/5xx responses.

---

## 9. Final Decision & Recommendation

### Recommendation: **GO**
The Release Candidate `v2.0.0-rc.1` (commit `78fbcfd`) meets all technical, architectural, cultural, accessibility, and security standards. 

**Ready for explicit human authorization to merge into `main`.**
