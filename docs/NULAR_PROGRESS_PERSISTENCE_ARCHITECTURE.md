# NULAR — PROGRESSION PERSISTENCE ARCHITECTURE
## Server-Authoritative Gamification, Database Schemas, PostgREST Sync & Idempotency Guarantees

**Document Version:** 2.0.0
**Project:** NULAR — The Living World of Nusantara
**Module:** `api/progress.js`, `api/leaderboard.js`, `db/migrations/003_progression_integrity.sql`
**Author:** Principal Backend Architect & Database Specialist

---

## 1. ARCHITECTURAL OVERVIEW

NULAR employs a **Server-Authoritative, Multi-Tiered Progression System** designed to eliminate client-side score manipulation, provide tamper-proof cultural exploration records, and guarantee data durability across serverless container cold starts.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT REQUEST                                     |
|  POST /api/progress { activityType: 'discover_item', eventKey: 'discover:ulos' }  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                             ACTOR RESOLUTION                                      |
|  1. Authenticated: verifySessionAsync(cookie) -> checks public.revoked_tokens     |
|  2. Guest: verifyGuestToken(cookie) -> validates HMAC & expiration TTL            |
|  3. Fresh Guest: generates server UUID g_${uuid} -> issues signed cookie          |
+-----------------------------------------------------------------------------------+
                   |                                           |
                   v (Authenticated)                           v (Guest Session)
+--------------------------------------+     +--------------------------------------+
|       DURABLE POSTGRESQL TIER        |     |          ISOLATED LOCAL TIER         |
|  1. award_player_xp RPC (Atomic)     |     |  1. In-Memory playerProgressStore    |
|     - Check player_xp_events         |     |  2. .nular-local-data/progress.json  |
|     - Apply authoritative XP table   |     |  3. Bound strictly to signed cookie  |
|     - Update player_profiles         |     |  4. Fail-safe isolation              |
|     - Calculate daily streak         |     +--------------------------------------+
|  2. Fail-Closed on DB Outage (503)   |
+--------------------------------------+
                   |                                           |
                   +---------------------+---------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                               HTTP RESPONSE                                       |
|  { duplicate: false, xpAwarded: 10, xp: 40, level: 1, title: 'New Explorer' }     |
|  Headers: Cache-Control: no-store, private; Pragma: no-cache; Set-Cookie: ...     |
+-----------------------------------------------------------------------------------+
```

---

## 2. RELATIONAL DATA MODEL

The progression system maps directly onto four core relational tables in PostgreSQL:

### 2.1 `public.player_profiles`
Maintains user-facing progression totals and leaderboard attributes:
```sql
CREATE TABLE public.player_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 2 AND 32),
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level >= 1),
  missions_completed INTEGER NOT NULL DEFAULT 0 CHECK (missions_completed >= 0),
  discoveries_count INTEGER NOT NULL DEFAULT 0 CHECK (discoveries_count >= 0),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 `public.player_xp_events` (Audit Trail & Idempotency Key)
Stores every earned reward event. The composite unique constraint `UNIQUE(user_id, event_key)` strictly prevents duplicate XP exploitation:
```sql
CREATE TABLE public.player_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL CHECK (xp_awarded > 0 AND xp_awarded <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_key)
);
```

### 2.3 `public.daily_streaks`
Provides timezone-consistent exploration streak tracking:
```sql
CREATE TABLE public.daily_streaks (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta'
);
```

### 2.4 `public.player_collections` (Collection Book)
Records discovered cultural artifacts:
```sql
CREATE TABLE public.player_collections (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.cultural_items(id) ON DELETE CASCADE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
```

---

## 3. SERVER-AUTHORITATIVE XP ENGINE

Clients cannot supply custom XP values. Any client-submitted `xp`, `amount`, `totalXp`, or `level` field is discarded.

### 3.1 XP Reference Table
| Activity Key | Base XP | Description |
|---|:---:|---|
| `discover_item` | `+10 XP` | Discovered a verified cultural artifact in world or atlas |
| `read_article` | `+15 XP` | Completed in-depth reading of cultural documentation |
| `complete_mission`| `+30 XP` | Fulfilled all requirements for an active archipelago mission |
| `complete_collection` | `+100 XP` | Completed a curated exhibition collection (e.g., textiles, houses) |
| `finish_quiz` | `+20 XP` | Answered cultural assessment questions successfully |
| `inspect_detail` | `+10 XP` | Inspected architectural hotspot or textile weave detail |

### 3.2 Power-Curve Level Calculation
Level requirements scale geometrically using the formula:
$$\text{XP Required for Level } L = \text{round}(100 \times L^{1.5})$$

| Level | Title | Cumulative XP |
|:---:|---|:---:|
| **1** | New Explorer | 0 – 99 |
| **2** | Cultural Seeker | 100 – 382 |
| **3** | Heritage Adventurer | 383 – 902 |
| **4** | Nusantara Discoverer | 903 – 1,702 |
| **5** | Cultural Scholar | 1,703 – 2,820 |
| **6** | Master Nusantara Archivist | 2,821+ |

---

## 4. ATOMIC POSTGRESQL TRANSACTION (`award_player_xp`)

To prevent race conditions during rapid concurrent requests, `db/migrations/003_progression_integrity.sql` implements an atomic stored procedure:

```sql
CREATE OR REPLACE FUNCTION public.award_player_xp(
  p_user_id UUID,
  p_activity_type TEXT,
  p_event_key TEXT,
  p_item_id TEXT DEFAULT NULL,
  p_mission_id TEXT DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Jakarta'
)
RETURNS TABLE(...)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

### Invariants Enforced in Procedure:
1. **Row-Level Locking:** Acquires `FOR UPDATE` lock on `public.player_profiles` and `public.daily_streaks`.
2. **Idempotency Guarantee:** Checks `player_xp_events` before making changes. If duplicate, immediately returns `duplicate: true, xp_awarded: 0`.
3. **Audit Immutability:** Inserts audit record into `player_xp_events`.
4. **Authoritative Calculation:** Computes level from `total_xp + xp_awarded` inside the database engine.
5. **Atomic Streak Sync:** Updates `current_streak` and `longest_streak` based on Indonesian or user timezone date boundaries.

---

## 5. LOCAL DEVELOPMENT PERSISTENCE

In non-production environments where Supabase is unconfigured, progression is persisted atomically to `.nular-local-data/progress-store.json`:
- Written with `0600` file permissions.
- Atomic file write via temporary file rename (`fs.renameSync`).
- Persists user events, discoveries, completed missions, and streak dates across development server restarts.
- Completely isolated from production data.
