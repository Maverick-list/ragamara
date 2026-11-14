# RAGAMARA — PHASE 3: GAME ENGINE ARCHITECTURE & LIFECYCLE REPORT
**Document ID:** `04_GAME_ENGINE_REPORT.md`  
**Phase:** Phase 3 — Mini-Game Engine State Machine, Resource Registry, Pause/Resume & Idempotent Reward Ledger  
**Date:** 14 November 2026  
**Branch:** `feat/ragamara-final-experience`  

---

## 1. Executive Summary

Phase 3 re-engineered `js/minigames.js` into a deterministic, leak-free, state-driven educational game engine (`window.MiniGameEngine`) integrated with `window.RagamaraEcosystem.Store` (`js/ecosystem.js`).

Critical architectural bugs resolved:
1. **Eliminated Destructive `#gameplay-arena.innerHTML` Overwrite:** Previously, `showCelebrationScreen()` replaced the entire `#gameplay-arena.innerHTML`, destroying `#arena-stage-container`, the top HUD bar, mode tabs, and bottom mascot feedback bar. Clicking `"Mainkan Lagi ↻"` then silently failed because `#arena-stage-container` no longer existed. Now, `showCelebrationScreen()` renders strictly inside `#arena-stage-container`, preserving the arena shell across unlimited replays and mode switches.
2. **Eliminated Destructive `location.reload()` on Exit:** Exiting the celebration screen previously triggered `location.reload()`, wiping in-memory session state. Now, rewards are persisted immediately on completion via `RagamaraEcosystem.recordMiniGameSession(sess)` and `updateHud()`, and closing the arena smoothly returns to the active view without reloading the page.
3. **Deterministic Resource Cleanup:** All `setTimeout`, `setInterval`, `requestAnimationFrame`, and keyboard listeners are tracked in `_timers`, `_intervals`, `_rafs`, and `_keyHandler` and cleaned up via `clearAllResources()` upon mode switch, restart, or arena exit.

---

## 2. Formal Game Engine State Machine

`MiniGameEngine. STATES` defines 8 explicit lifecycle states:

```
IDLE ──► LOADING ──► READY ──► PLAYING ◄──► FEEDBACK ──► COMPLETED
                                  │
                                  ▼
                               PAUSED
                                  │
                                  ▼
                                ERROR (Fallback recovery)
```

| State | Responsibility | Allowed Transitions |
| :--- | :--- | :--- |
| `IDLE` | Arena modal is closed; zero active timers or keyboard listeners | `LOADING` |
| `LOADING` | Cleaning previous resources, resetting session metrics, building stage DOM | `READY`, `PLAYING`, `ERROR` |
| `READY` | Stage rendered and awaiting initial player input | `PLAYING`, `PAUSED`, `IDLE` |
| `PLAYING` | Active gameplay round; keyboard shortcuts (`1–4`, `Escape`) active | `FEEDBACK`, `PAUSED`, `COMPLETED`, `LOADING`, `IDLE` |
| `FEEDBACK` | Input locked while showing cultural explanation or card comparison | `PLAYING`, `COMPLETED`, `PAUSED`, `IDLE` |
| `PAUSED` | `#arena-pause-overlay` open; active timers cleared; elapsed time frozen | `PLAYING`, `LOADING` (Restart), `IDLE` (Exit) |
| `COMPLETED` | Celebration & score summary rendered inside `#arena-stage-container`; rewards committed to `RagamaraStore` | `LOADING` (Replay / Next Mode), `IDLE` (Exit) |
| `ERROR` | Graceful error recovery UI with retry button | `LOADING`, `IDLE` |

---

## 3. Session Metrics & Scoring Formula

Each session initializes a fresh `MiniGameEngine.session` object:
- `sessionId`: Unique identifier (`sess_<mode>_<timestamp>_<rand>`) used by the idempotent reward ledger.
- `mode`: `'A' | 'B' | 'C' | 'D' | 'E' | 'F'`
- `round` / `totalRounds`: Current and total rounds for the mode.
- `score`: Accumulated score (`0–100+`).
- `maxScore`: `100`
- `mistakes`: Total incorrect attempts during the session.
- `streak` / `maxStreak`: Consecutive correct actions.
- `rewardGranted`: Boolean guard ensuring `completeCurrentGame()` only awards XP/Gems once per session.

### Star Rating & Reward Calculation
- **3 Stars (`★★★`):** Accuracy `>= 85%` and `mistakes <= 1`
- **2 Stars (`★★☆`):** Accuracy `>= 60%`
- **1 Star (`★☆☆`):** Completed with accuracy `< 60%` (completion floor ensures learners are never punished with 0 stars after completing all rounds)
- **XP Earned:** `baseXp + (stars * 10) + Math.min(20, maxStreak * 5)`
- **Gems Earned:** `baseGems + (stars * 3)`

---

## 4. Pause, Resume, Restart & Keyboard Accessibility

- **Keyboard Shortcuts:**
  - Keys `1`, `2`, `3`, `4` trigger options `0–3` in Mode A (`Kuis Cendekia Budaya`) when `state === 'PLAYING'`.
  - Key `Escape` toggles `pauseArena()` / `resumeArena()` during active play, or closes the arena when `state === 'COMPLETED'`.
- **Pause Overlay (`#arena-pause-overlay`):**
  - Dynamically injected into `#gameplay-arena` if not present.
  - Provides three actions: **Lanjutkan Permainan** (`resumeArena()`), **Ulangi dari Awal** (`restartCurrentGame()`), and **Keluar Arena** (`closeArena()`).
  - Accurately tracks `pausedDurationMs` so pause time is subtracted from total session duration.
