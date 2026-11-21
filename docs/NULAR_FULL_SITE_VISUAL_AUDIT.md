# NULAR — Full-Site Visual & Responsive Audit

**Project:** NULAR — The Living World of Nusantara  
**Branch:** `feat/nular-world-experience`  
**Date:** 2026-11-21  
**Visual Direction:** Contemporary Indonesian Cultural Museum × Immersive Digital Heritage × Premium Editorial Experience

---

## 1. Visual System Consistency Across Pages

All museum pages load the shared shell ([js/museum-shell.js](file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/museum-shell.js)), which injects:
- `css/design-system.css`
- `css/exhibition-motion.css` (unified motion tokens, `2px` gold scroll progress bar, exhibition plates, room spreads, reduced-motion overrides)
- `js/museum-motion.js` (`IntersectionObserver` reveals, scroll progress, desktop hero spotlight, strict `prefers-reduced-motion` compliance)

---

## 2. Visual Evidence Reviewed (`docs/qa/completion-evidence/`)

All 16 full-site screenshots were captured in headless Chrome and reviewed visually:

| File | Route / Viewport | Visual Inspection Outcome |
|---|---|---|
| `01_landing_desktop_1440.png` | `index.html` (1440×900) | Editorial emerald/ivory hero, live 3D Rumah Gadang preview, 4 exhibition plates linking to real exhibitions, pull-quote band, 0px overflow |
| `02_exhibition_hall_desktop_1440.png` | `exhibitions.html` (1440×900) | Full-width deep-emerald museum hall hero, live metrics (`4` rooms, `25` verified exhibits, `15` 3D models), featured spotlight, alternating room spreads |
| `03_exhibition_arsitektur_desktop_1440.png` | `exhibition.html?id=arsitektur-nusantara` (1440×900) | Live interactive 3D Rumah Gadang rendered inside emerald stage, chapter tabs, bronze progress bar, exhibit switcher, historical context |
| `04_exhibition_wastra_desktop_1440.png` | `exhibition.html?id=wastra-nusantara` (1440×900) | Live 3D Batik Parang model, UNESCO ICH & DAPOBUD sources, material chips, Save to Collection Book CTA |
| `05_exhibition_bunyi_gerak_desktop_1440.png` | `exhibition.html?id=bunyi-dan-gerak-nusantara` (1440×900) | Honest, dignified archival fallback (`Arsip Teks & Pustaka Terverifikasi`) beside full Gordang Sambilan ethnographic notes |
| `06_exhibition_pusaka_kriya_desktop_1440.png` | `exhibition.html?id=pusaka-dan-kriya-nusantara` (1440×900) | Live 3D Rencong Aceh on museum display plinth, material chips, Rencong/Keris/Mandau switcher |
| `07_architecture_viewer_desktop_1440.png` | `house.html?id=rumah-gadang` (1440×900) | Verified 0px overflow & interactive architectural viewer intact |
| `08_cultural_collection_desktop_1440.png` | `learn.html` (1440×900) | Verified 0px overflow & collection categories intact |
| `09_auth_hardened_desktop_1440.png` | `auth.html` (1440×900) | Transparent 6-badge provider & storage diagnostics strip + live password strength meter |
| `10_profile_collection_book_desktop_1440.png` | `profile.html` (1440×900) | Integrated *Pameran & Artefak Tersimpan* section showing saved exhibition & artifact with Remove & Open links |
| `11_quests_desktop_1440.png` | `quests.html` (1440×900) | Verified 0px overflow & missions/leaderboard intact |
| `12_atlas_map_desktop_1440.png` | `map.html` (1440×900) | Verified 0px overflow & 38-province atlas intact |
| `13_mobile_390_exhibition_hall.png` | `exhibitions.html` (390×844) | Clean vertical typography, 0px overflow, persistent mobile bottom navigation |
| `14_mobile_390_exhibition_detail.png` | `exhibition.html?id=arsitektur-nusantara` (390×844) | Crisp mobile exhibition cover, badge wrap, accessible touch CTAs, 0px overflow |
| `15_mobile_320_exhibition_hall.png` | `exhibitions.html` (320×720) | Ultra-compact 320px verified at exact 0px horizontal overflow |
| `16_offline_fallback_desktop_1440.png` | `offline.html` (1440×900) | Zero-font inline SVG offline recovery card intact |

---

## 3. Nine-Viewport Overflow Matrix

Zero horizontal overflow (`scrollWidth <= clientWidth`) verified across all 9 established viewports (`320×720`, `360×800`, `390×844`, `412×915`, `768×1024`, `1024×768`, `1280×800`, `1440×900`, `1920×1080`) on `index.html`, `exhibitions.html`, `exhibition.html`, and `auth.html`.

---

## 4. Remaining Physical-Device Validation

All browser checks above were executed in headless Chrome with device emulation and SwiftShader WebGL. Physical iOS Safari and Android Chrome device testing remains owner-controlled before any public launch.
