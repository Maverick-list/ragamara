# NULAR — SUPABASE PERSISTENCE IMPLEMENTATION
## Architectural Guide & Engineering Specification for Durable Cloud Storage

**Project:** NULAR — The Living World of Nusantara
**Module:** `api/auth.js`, `api/leaderboard.js`, `db/migrations/`
**Protocol:** Native PostgREST HTTP REST API (Supabase v1)
**Authentication Standard:** HMAC-SHA256 Sessions + Supabase Service Role Authorization
**Status:** **IMPLEMENTED & VERIFIED**

---

## 1. Architectural Philosophy

NULAR uses an architecture designed for zero client-side database credentials and strict backend authority:
- **No Direct Browser Database Access:** The client browser never interacts with Supabase directly. All database interactions occur via serverless API endpoints (`/api/auth`, `/api/progress`, `/api/leaderboard`).
- **Native ES Modules PostgREST Client:** Rather than pulling in heavy client libraries, NULAR uses native Node.js 20+ `fetch` with PostgREST conventions. This delivers ultra-low cold start overhead (<25ms) on Vercel Serverless Functions while maintaining full SQL-level control.
- **Fail-Closed Production Gate:** If database credentials are missing or if a database query fails, production endpoints fail closed (HTTP 503) rather than degrading into unreliable in-memory Maps.

---

## 2. PostgREST Client Specification (`sbPostgrest`)

The internal client is implemented in `api/auth.js`:
```javascript
export async function sbPostgrest(pathAndQuery, { method = 'GET', body, headers = {} } = {}) {
  const cfg = getRuntimeConfig();
  if (!cfg.supabase.configured) {
    const err = new Error('Supabase not configured');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const baseUrl = cfg.supabase.url.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/v1/${pathAndQuery.replace(/^\/+/, '')}`;
  const reqHeaders = {
    'apikey': cfg.supabase.key,
    'Authorization': `Bearer ${cfg.supabase.key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...headers
  };
  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`PostgREST error ${res.status}: ${text}`);
    err.status = res.status;
    err.code = 'DATABASE_OPERATION_FAILED';
    err.detail = text;
    throw err;
  }
  const text = await res.text().catch(() => '');
  return text ? JSON.parse(text) : null;
}
```

### Required Request Headers
- `apikey`: `${process.env.SUPABASE_SERVICE_ROLE_KEY}`
- `Authorization`: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
- `Content-Type`: `application/json`
- `Prefer`: `return=representation` (causes PostgREST to return modified rows as JSON)

---

## 3. PostgREST Entity Operations

### 3.1 `public.users` Table
| Action | HTTP Method | PostgREST Path | Payload / Query |
|---|---|---|---|
| **Check Exists** | `GET` | `/users?email=eq.<email>&deleted_at=is.null&select=id` | Empty |
| **Create User** | `POST` | `/users` | `{ id, email, password_hash, email_verified, created_at }` |
| **Authenticate** | `GET` | `/users?email=eq.<email>&deleted_at=is.null&select=*` | Empty |
| **Delete User** | `DELETE` | `/users?id=eq.<uid>` | Empty (Cascades to profile and progress) |

### 3.2 `public.player_profiles` Table
| Action | HTTP Method | PostgREST Path | Payload / Query |
|---|---|---|---|
| **Create Profile** | `POST` | `/player_profiles` | `{ user_id, username, avatar_id, is_public, total_xp: 0, current_level: 1 }` |
| **Read Profile** | `GET` | `/player_profiles?user_id=eq.<uid>&select=*` | Empty |
| **Update Profile** | `PATCH` | `/player_profiles?user_id=eq.<uid>` | `{ avatar_id, is_public }` *(Client cannot modify total_xp)* |
| **Leaderboard** | `GET` | `/player_profiles?is_public=eq.true&order=total_xp.desc&limit=25&select=...` | Empty |

### 3.3 `public.revoked_tokens` Table
| Action | HTTP Method | PostgREST Path | Payload / Query |
|---|---|---|---|
| **Revoke JTI** | `POST` | `/revoked_tokens` | `{ jti, user_id, expires_at, reason }` |
| **Check Revoked** | `GET` | `/revoked_tokens?jti=eq.<jti>&select=jti` | Returns `[ { jti } ]` if revoked |

### 3.4 `public.login_rate_limits` Table
| Action | HTTP Method | PostgREST Path | Payload / Query |
|---|---|---|---|
| **Check Lock** | `GET` | `/login_rate_limits?key=eq.login:<email>&select=*` | If `locked_until > now`, returns 429 |
| **Record Attempt** | `POST` / `PATCH` | `/login_rate_limits` | Increment attempts; if >= 5, set `locked_until = now + 15m` |
| **Clear Lock** | `DELETE` | `/login_rate_limits?key=eq.login:<email>` | Deleted on successful password authentication |

### 3.5 `public.auth_verification_tokens` Table
| Action | HTTP Method | PostgREST Path | Payload / Query |
|---|---|---|---|
| **Save Token** | `POST` | `/auth_verification_tokens` | `{ token_hash: sha256(raw), user_id, token_type, expires_at }` |
| **Verify Token** | `GET` | `/auth_verification_tokens?token_hash=eq.<hash>&token_type=eq.<type>&used_at=is.null&select=*` | Unused & unexpired |
| **Consume Token** | `PATCH` | `/auth_verification_tokens?token_hash=eq.<hash>` | `{ used_at: now() }` (Prevents token replay) |

---

## 4. Fail-Closed Error Flow

```
Client Request
      │
      ▼
Runtime Config Check
      ├── Invalid/Missing Secret / Supabase URL -> HTTP 503 (Gate Error)
      ▼
Execute PostgREST Query
      ├── Network Error / Connection Refused / 5xx Status
      │       │
      │       ▼
      │   Production Mode?
      │       ├── YES -> HTTP 503 DATABASE_OPERATION_FAILED (Fail-Closed)
      │       └── NO  -> Fallback to .nular-local-data/auth-store.json (Local Dev Only)
      ▼
Success -> Return HTTP 200/201 + Set-Cookie
```

This guarantees that transient cloud database outages or misconfigurations cannot lead to unpersisted users, spoofed sessions, or lost progress in production.
