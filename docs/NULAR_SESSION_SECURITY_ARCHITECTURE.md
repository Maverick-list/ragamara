# NULAR — SESSION SECURITY ARCHITECTURE
## Distributed Session Verification, Centralized Revocation, Guest Token Cryptography & Anti-Tampering

**Document Version:** 2.0.0
**Project:** NULAR — The Living World of Nusantara
**Module:** `api/auth.js`, `api/progress.js`
**Author:** Application Security Architect

---

## 1. AUTHENTICATED SESSION LIFECYCLE

NULAR implements a stateless HMAC-signed session architecture combined with a durable PostgreSQL revocation registry, delivering the performance of stateless tokens with the immediate revocation control of stateful sessions.

### 1.1 Token Structure & Cryptographic Signing
Session cookies (`nular_session`) use base64url-encoded JSON payloads signed with HMAC-SHA256:
```
[Base64URL Payload] . [Base64URL HMAC Signature]
```

**Payload Claims:**
- `uid`: Canonical UUID referencing `public.users(id)`.
- `username`: Sanitized public display name.
- `jti`: Cryptographically random UUID uniquely identifying the session instance.
- `exp`: Unix timestamp (milliseconds) enforcing maximum 7-day session lifetime.
- `iat`: Unix timestamp indicating token issuance.

**Signature Generation:**
```js
const sig = crypto.createHmac('sha256', SECRET).update(bodyBase64).digest('base64url');
```

### 1.2 Centralized Distributed Verification (`verifySessionAsync`)
All protected endpoints verify sessions via the shared `verifySessionAsync()` function:

1. **Format Validation:** Ensures token contains header, body, and signature delimited by `.`.
2. **Cryptographic Integrity:** Recomputes HMAC over payload using constant-time comparison (`crypto.timingSafeEqual`).
3. **Expiration Enforcement:** Rejects tokens where `Date.now() > exp`.
4. **Local Memory Cache Check:** Verifies against warm-worker `revokedSessions` Map.
5. **Durable Database Lookup (Multi-Worker Coherence):** In production with Supabase configured, queries `public.revoked_tokens` table for the session's `jti`. If found, caches the revocation in RAM and returns `REVOKED_TOKEN`.
6. **Fail-Closed Gate:** If PostgreSQL is unreachable during revocation lookup in production, the function throws `DATABASE_OPERATION_FAILED`, causing protected endpoints to fail closed with HTTP 503 instead of trusting an unverified session.

### 1.3 Logout & Revocation Persistence
When a user logs out (`POST /api/auth?action=logout`):
1. Injects session `jti` into `public.revoked_tokens` via PostgREST with `expires_at = token.exp`.
2. Registers `jti` in local RAM `revokedSessions` cache.
3. Clears browser cookie via `Set-Cookie: nular_session=; Path=/; HttpOnly; Max-Age=0`.
4. Any serverless instance receiving this token subsequently will reject it upon checking `public.revoked_tokens`.

---

## 2. GUEST SESSION INTEGRITY & ANTI-SPOOFING

### 2.1 Cryptographic Guest Token Structure
Guest cookies (`nular_guest`) enforce explicit versioning, time-to-live (TTL), and tamper resistance:

$$\text{Token Format} = \text{guestId} \,.\, \text{iat} \,.\, \text{exp} \,.\, \text{HMAC}(\text{SECRET}, \text{"v1:"} + \text{guestId} + \text{":"} + \text{iat} + \text{":"} + \text{exp})$$

### 2.2 Rejection of Caller-Supplied Identities
To prevent guest progress hijacking or state pollution:
- **No Client-Defined Guest IDs:** If no verified guest cookie is presented, `api/progress.js` strictly ignores any `body.guestId` payload.
- **Server-Authoritative Minting:** Generates a random UUID `g_${crypto.randomUUID()}` and issues a signed token valid for 30 days (`Max-Age=2592000`).
- **Mismatch Rejection (403):** If a client presents a valid guest cookie but includes a differing `body.guestId`, the request is rejected with HTTP 403 `GUEST_ID_MISMATCH`.
- **Expired Token Rejection (403):** If `Date.now() > exp`, the token is rejected with HTTP 403 `INVALID_GUEST_SIGNATURE`.

---

## 3. COOKIE SECURITY POLICIES

Both `nular_session` and `nular_guest` cookies adhere to modern web security standards:

| Cookie Attribute | Configuration | Rationale |
|---|---|---|
| `HttpOnly` | **Enforced (`true`)** | Prevents XSS scripts from reading session or guest tokens |
| `SameSite` | **`Lax`** | Mitigates CSRF attacks on state-changing requests while permitting top-level navigation |
| `Secure` | **Dynamic (`true` in Prod)** | Enforces HTTPS transport in production deployments |
| `Path` | **`/`** | Accessible across all application routes |
| `Max-Age` | **604,800s (Auth) / 2,592,000s (Guest)** | Strict session lifespan limits |

---

## 4. SENSITIVE AUTHENTICATION CACHE CONTROL

To prevent intermediate proxies, corporate firewalls, and shared browser caches from storing sensitive tokens or user profiles, all authentication and progression endpoints emit:

```http
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
```

This is enforced across:
- `POST /api/auth?action=signup`
- `POST /api/auth?action=login`
- `POST /api/auth?action=logout`
- `GET /api/auth`
- `POST /api/progress`
- `GET /api/progress`
- `GET /api/leaderboard`
