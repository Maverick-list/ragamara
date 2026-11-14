# RAGAMARA — PHASE 5: PRODUCT ECOSYSTEM REPORT
**Document ID:** `06_PRODUCT_ECOSYSTEM_REPORT.md`  
**Phase:** Phase 5 — Culturepedia Museum, Daily Missions, Local Simulation Leaderboard, Achievements & Explorer Profile  
**Date:** 14 November 2026  
**Branch:** `feat/ragamara-final-experience`  

---

## 1. Executive Summary

Phase 5 rebuilt `js/ecosystem.js` (resolving the fatal syntax error from the pre-transformation baseline) and connected all 5 secondary product pillars into a single, reactive ecosystem backed by `RagamaraEcosystem.Store`.

---

## 2. Culturepedia: Dual-Layer Provenance Museum (`RagamaraEcosystem.Culturepedia`)

### 2.1 Direct Canonical Entity Ingestion
`Culturepedia.getCanonicalEntities()` reads the 45 canonical entities from `window.RAGAMARA_CULTURE_DB.entities` (preserving the 50 underlying DAPOBUD source records in `entity.source_records`).

### 2.2 Search, OPK Category Filter, Regional Filter & Bookmarking
- **Real-Time Search (`#culturepedia-search-input`):** Filters across canonical name, aliases, OPK category, regional scope provinces, and cultural summary.
- **OPK Category Filter Pills (`.opk-filter-btn`):** Filters across *Semua*, *Adat Istiadat*, *Pengetahuan Tradisional*, *Teknologi Tradisional*, *Seni*, *Permainan Rakyat*, *Ritus*, *Kemahiran Kerajinan Tradisional*, *Tradisi Lisan*, and *Tersimpan*.
- **Regional Filter Pills (`.region-filter-btn`):** Filters across *Semua Wilayah*, *Sumatra*, *Jawa*, *Bali & Nusa Tenggara*, *Kalimantan*, *Sulawesi*, *Maluku*, and *Papua*, plus a dedicated **Cakupan Lintas Provinsi / Nasional** filter for the 4 multi-province entities (*Aksara Ka Ga Nga*, *Tabot atau Tabuik*, *Rumah Panjang Dayak*, *Batik Indonesia*).
- **Persistent Bookmarks (`toggleBookmark`):** Saves bookmarked entity IDs to `RagamaraStore.state.bookmarks` and awards `+5 XP` on first bookmark.

### 2.3 Dual-Layer Museum Detail Modal (`#culturepedia-detail-modal`)
When a user opens any Culturepedia card, the modal renders two clearly separated provenance layers on a Warm Parchment (`#F4EBDD`) museum reading surface:
1. **Layer 1 — Rekaman Resmi DAPOBUD Kemendikbudristek RI:**
   - Displays every underlying official DAPOBUD source record (`source_id` UUID, `registration_num`, `record_type` WBTb/OPK, `original_category`, and `original_province`).
   - For deduplicated canonical entities (such as *Acaineno*, *ADAT BUANTAK*, *ADIDANG*, *Adrem*, *Aek Soap*), both preserved DAPOBUD source records are listed individually so zero official provenance is hidden.
2. **Layer 2 — Pengayaan Konteks Ensiklopedis (Wikipedia Bahasa Indonesia):**
   - For matched entities (`22/45`): Displays the verified Wikipedia extract, match method, semantic confidence score (`%`), and direct source link (`https://id.wikipedia.org/wiki/...`).
   - For unmatched entities (`23/45`): Displays an honest amber verification notice explaining that automatic Wikipedia matching was withheld to prevent semantic false positives (such as *Debus Banten ≠ Suku Banten* and *Batik Indonesia ≠ Museum Batik Indonesia*).
3. **Contextual Action Bridge:**
   - Every detail modal includes a **"Mainkan Tantangan Terkait (Arena Mode X)"** button that closes the modal and launches the relevant mini-game in `MiniGameEngine`, plus related regional cultural items at the bottom.

---

## 3. Daily Missions (`RagamaraEcosystem.DailyMissions`)

- **3 Actionable Daily Quests:**
  1. `dm_quiz_1`: *Cendekia Budaya Harian* — Complete 1 mini-game challenge in the Arena (`+30 XP`, `+10 💎`).
  2. `dm_pedia_2`: *Kurator Pusaka Nusantara* — Read 2 cultural entity records in Culturepedia (`+25 XP`, `+10 💎`).
  3. `dm_region_1`: *Ekspedisi Kepulauan* — Open 1 Regional Dossier on the World Map (`+25 XP`, `+15 💎`).
- **Live Progress & Idempotent Claiming:**
  - Completing a mini-game, opening a Culturepedia article, or opening a Regional Dossier automatically increments the corresponding mission counter (`incrementProgress`).
  - Once `progress >= target`, the **"Klaim Hadiah 🎁"** button activates and grants rewards idempotently via `Store.awardIdempotent('daily_' + todayKey + '_' + missionId, xp, gems)`.
  - Includes a live countdown timer (`#daily-missions-timer`) to midnight local time.

---

## 4. Honest Local Simulation Leaderboard (`RagamaraEcosystem.Leaderboard`)

- **Explicit Transparency Labeling:**
  - Both the `#leaderboard-modal` header and `Leaderboard.render()` display an explicit badge:
    > **"Simulasi Papan Peringkat Lokal (Demo) • Peringkat Anda dihitung langsung dari perolehan XP perangkat ini terhadap rekan simulasi lokal."**
- **Dynamic Player Ranking:**
  - Rather than displaying a hardcoded static HTML list, `Leaderboard.render()` injects the player's live `Store.state.player.xp`, `name`, and `title` into the peer array (`weekly`, `monthly`, or `friends`), sorts all entries in descending XP order, and highlights the player's current rank row dynamically.

---

## 5. Achievements & Explorer Profile (`RagamaraEcosystem.Achievements` & `Profile`)

- **6 Dynamic Achievements:**
  1. `ach_first_step`: *Langkah Pertama Penjelajah* (Unlocked)
  2. `ach_minang_architect`: *Arsitek Gonjong Minang* (Unlocks automatically upon completing Mode C)
  3. `ach_rhythm_maestro`: *Maestro Laras Tradisi* (Unlocks automatically upon completing Mode D)
  4. `ach_adat_wise`: *Hakim Adat Bijaksana* (Unlocks automatically upon completing Mode E)
  5. `ach_pedia_scholar`: *Cendekiawan Pusaka DAPOBUD* (Tracks Culturepedia articles read / bookmarked)
  6. `ach_nusantara_voyager`: *Penjelajah Tujuh Samudra* (Tracks Regional Dossiers explored across the 7 islands)
- **Explorer Identity & Customization (`#view-profil`):**
  - Supports equippable cultural avatar frames (`Emas Minang`, `Surya Majapahit`, `Ukir Asmat`) and selectable honorary titles (*Ahli Warisan Minang*, *Penjaga Adat Nusantara*, *Kurator Pusaka Bahari*, *Cendekiawan Budaya Luhur*), persisted in `RagamaraStore`.
