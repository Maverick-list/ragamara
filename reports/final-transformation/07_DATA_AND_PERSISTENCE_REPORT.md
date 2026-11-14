# RAGAMARA — PHASE 6: CULTURAL DATA INTEGRITY & PERSISTENCE ARCHITECTURE REPORT
**Document ID:** `07_DATA_AND_PERSISTENCE_REPORT.md`  
**Phase:** Phase 6 — Schema v2.0.0 Database Integrity & Client Persistence Engine (`ragamara_state_v2`)  
**Date:** 14 November 2026  
**Branch:** `feat/ragamara-final-experience`  

---

## 1. Cultural Database Schema v2.0.0 Verification (`ragamara_culture_db.json` & `js/culture_db_data.js`)

The RAGAMARA Cultural Data Engine (`ragamara-data-engine`) produces a dual-compatible Schema v2.0.0 payload verified by 21 automated pytest checks:

| Database Integrity Metric | Verified Value | Status |
| :--- | :--- | :--- |
| Schema Version | `2.0.0` | **VERIFIED** |
| Original DAPOBUD Source Records Preserved | `50` (`25 WBTb` + `25 OPK`) | **VERIFIED** |
| Canonical Cultural Entities | `45` (5 verified exact-pair OPK deduplications) | **VERIFIED** |
| Official Source UUIDs & Registration Numbers Preserved | `50 / 50` (100% preserved in `entity.source_records`) | **VERIFIED** |
| High-Precision Semantic Wikipedia Matches | `22` entities matched (`23` conservatively unmatched) | **VERIFIED** |
| False Positive Guard 1: *Debus Banten* | Unmatched (`matched: false` — blocked from *Suku Banten*) | **VERIFIED** |
| False Positive Guard 2: *Batik Indonesia* | Matched to `Batik` (`0.8425` — blocked from *Museum Batik Indonesia*) | **VERIFIED** |
| Cross-Regional / Multi-Province Scope Metadata | 4 entities (*Aksara Ka Ga Nga*, *Tabot atau Tabuik*, *Rumah Panjang Dayak*, *Batik Indonesia*) carry structured `regional_scope.provinces` arrays | **VERIFIED** |
| Wikimedia Commons Image Provenance & Licensing | `19` entities carry full asset license, artist, and source URL metadata | **VERIFIED** |

---

## 2. Client Persistence Engine (`RagamaraEcosystem.Store` in `js/ecosystem.js`)

### 2.1 Versioned Storage Schema (`ragamara_state_v2`)
All user progression is stored under the versioned localStorage key `ragamara_state_v2` with backward-compatible synchronization to `ragamara_player_state`:

```json
{
  "schemaVersion": "2.0.0",
  "updatedAt": "2026-11-14T13:30:00.000Z",
  "player": {
    "name": "Firza Penjelajah",
    "title": "Ahli Warisan Minang",
    "equippedFrame": "frame_gold_minang",
    "level": 8,
    "xp": 2450,
    "xpToNext": 3000,
    "gems": 480,
    "streakDays": 7
  },
  "progression": {
    "completedLevels": [1, 2, 3],
    "activeLevel": 4,
    "chestClaimed": false,
    "completedMiniGames": { "A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0 },
    "highScores": { "A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0 },
    "rewardLedger": {},
    "regionsVisited": ["sumatra"],
    "articlesRead": []
  },
  "bookmarks": ["id_dapobud_f31f397c"],
  "mascots": {
    "equipped": "raga_minang",
    "unlocked": ["raga_minang", "cendro_cenderawasih", "bekti_bekantan"]
  },
  "dailyMissions": {
    "lastResetDate": "2026-11-14",
    "items": {
      "dm_quiz_1": { "progress": 1, "target": 1, "claimed": false },
      "dm_pedia_2": { "progress": 1, "target": 2, "claimed": false },
      "dm_region_1": { "progress": 1, "target": 1, "claimed": false }
    }
  },
  "settings": {
    "sfx": true,
    "highContrast": false,
    "reducedMotion": false
  }
}
```

### 2.2 Idempotent Reward Ledger (`Store.awardIdempotent(rewardKey, xpDelta, gemsDelta)`)
- Every one-time reward (such as claiming a Daily Mission, unlocking the Milestone Treasure Chest, or completing a specific mini-game session `sessionId`) passes a deterministic `rewardKey` to `Store.awardIdempotent()`.
- If `state.progression.rewardLedger[rewardKey]` already exists, `awardIdempotent` returns `false` without mutating `xp` or `gems`, preventing duplicate reward farming from rapid clicks.
- Level-ups are computed automatically via `Math.max(8, Math.floor(xp / 300) + 1)`.

### 2.3 Corrupted Storage Recovery & Legacy Key Migration
- During `Store.load()`, if `localStorage.getItem('ragamara_state_v2')` contains malformed JSON (e.g., `"{corrupted_json!!!"`) or invalid types (non-numeric `xp`/`gems` or non-array `bookmarks`), the `try/catch` block catches the parse error, initializes a clean `createDefaultState()`, migrates any valid legacy keys (`ragamara_player_state`, `ragamara_bookmarks`, `ragamara_settings`), and writes the sanitized v2 state back to `localStorage` without throwing an unhandled exception.
