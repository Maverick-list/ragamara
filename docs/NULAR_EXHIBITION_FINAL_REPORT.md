# NULAR — Real Exhibition Product Final Report

**Project:** NULAR — The Living World of Nusantara
**Branch:** `feat/nular-world-experience`
**Date:** 2026-11-21

---

## 1. Delivered Exhibition Product

| Component | Path | Status |
|---|---|---|
| Curated Exhibition Catalog | `data/exhibitions.json` | Implemented & Verified (4 rooms, 25 real catalog refs) |
| Reference & Media Resolver | `js/exhibition-data.js` | Implemented & Verified (0 fabricated IDs or GLBs) |
| Exhibition Hall | `exhibitions.html` | Implemented & Verified across 9 viewports (`320px–1920px`) |
| Narrative Exhibition Detail | `exhibition.html?id=<id>` | Implemented & Verified (chapters, 3D/fallback, save, XP) |
| Collection Book Integration | `js/museum-store.js`, `profile.html` | Implemented & Verified (save, remove, reload persistence) |
| Offline PWA Shell Inclusion | `sw.js` | Updated (`nular-shell-v1.2`) |

---

## 2. Four Curated Exhibitions (100% Real Catalog References)

| Room | ID | Category | Exhibits | Verified 3D Models | Media Honesty |
|---|---|---|---:|---:|---|
| `RUANG 01` | `arsitektur-nusantara` | Arsitektur Vernakular | 6 houses | 6 GLB | Interactive Three.js GLB viewer + reference photography |
| `RUANG 02` | `wastra-nusantara` | Wastra & Busana Adat | 8 items | 6 GLB | Interactive 3D for Batik/Songket/Ulos/Tenun + honest archival fallback for `item-tapis` & `item-songket_palembang` |
| `RUANG 03` | `bunyi-dan-gerak-nusantara` | Musik, Tari & Upacara | 5 items | 0 GLB | Honest archival ethnographic mode (no fabricated GLB files) |
| `RUANG 04` | `pusaka-dan-kriya-nusantara` | Pusaka, Kriya & Kuliner | 6 items | 3 GLB | Interactive 3D for Rencong, Keris, Mandau + honest archival fallback for Gerabah, Randang, Adrem |

---

## 3. Verified Interactive Flows (`tests/verify_exhibitions_and_full_site.mjs`)

- **Data Integrity:** All 25 `exhibitRefs` resolve to valid entries in `data/houses.json` or `data/cultural-items.json`, and 100% of referenced cover images and GLB files exist on disk.
- **Exhibition Hall Filters:** Search (`"Keris"` → 1 room), Category (`textiles` → 1 room), Region (`Papua` → 1 room), Reset (`4` rooms).
- **Chapter Journey & Progress:** Chapter switching updates heading, exhibit selector, progress bar (`1/3` → `2/3`), and persists in `MuseumStore`.
- **Collection Book Sync:** Saving exhibitions and individual exhibits updates `profile.html#saved-exhibits-section`; removing persists across page reloads.
- **Server-Authoritative XP Idempotency:** Claiming completion calls `POST /api/progress` (`activityType: 'complete_collection'`, `eventKey: 'exhibition-complete:<id>'`); first claim awards `+100 XP`, second claim returns `duplicate: true` (`+0 XP duplikat`).
- **Invalid ID Handling:** `exhibition.html?id=tidak-ada-999` renders a clean archival Not Found state with 0 uncaught exceptions.

---

## 4. Honest Status Classification

- **Implemented and tested:** Exhibition hall, 4 exhibition detail journeys, chapter navigation, 3D viewer & honest archival fallbacks, collection book save/remove, server-authoritative XP idempotency, 9-viewport responsive layout.
- **Waiting for owner configuration:** Cross-device account cloud sync of saved exhibits/progress requires production Supabase credentials.
- **Requires physical-device verification:** Real mobile touch gestures on iOS Safari / Android Chrome hardware.
