# NULAR — AUTHENTICATION & ACCOUNT SETUP GUIDE
**Module:** `api/auth.js` + `js/auth-client.js` + `auth.html` + `db/migrations/001_nular_cultural_world.sql`  
**Security Architecture:** Provider-agnostic adapter, HMAC-SHA256 signed `HttpOnly; SameSite=Lax` cookies, `scrypt` salted password hashing, constant-time comparison (`crypto.timingSafeEqual`).

---

## 1. Supported Authentication Methods & Current Status

| Method | Implementation Status | Production Configuration Required |
| :--- | :--- | :--- |
| **Email + Password (Sign-up / Login / Logout / Delete)** | Implemented (`api/auth.js`) | Set `NULAR_SESSION_SECRET` + `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for persistent cloud storage. |
| **Password Reset & Email Verification** | Endpoint & UI implemented | Set `SMTP_HOST` / `RESEND_API_KEY` or enable Supabase Auth Email Templates. |
| **Google OAuth 2.0** | Adapter & honest state implemented | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Returns HTTP 503 with explicit configuration message when unset (never fakes production login). |
| **Phone Number OTP (International E.164)** | Implemented with E.164 validation, 60s resend cooldown, 15-min rate cap, 5-min TTL, max 5 attempts | Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. In local development only (`NODE_ENV !== 'production'`), displays an explicitly labeled local test preview code. |

---

## 2. Manual Configuration Steps for Project Owner

### A. Session Secret & Database (Supabase PostgreSQL)
1. Generate a 64-character random hex secret: `openssl rand -hex 32`.
2. Add `NULAR_SESSION_SECRET` to Vercel Environment Variables (Production & Preview). *Note: `RAGAMARA_SESSION_SECRET` is automatically recognized as an alias for seamless backward compatibility with existing deployments.*
3. Create a Supabase project, run `db/migrations/001_nular_cultural_world.sql` in the SQL Editor, and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only).

### B. Google OAuth 2.0
1. Open Google Cloud Console → **APIs & Services → Credentials → Create OAuth Client ID (Web Application)**.
2. Add Authorized Redirect URIs:
   - Local: `http://localhost:3000/api/auth?action=google-callback`
   - Production: `https://<your-domain>/api/auth?action=google-callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Vercel Environment Variables.

### C. Phone OTP (SMS Provider — Twilio)
1. Provision a Twilio Messaging Service or E.164 sender number.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` in Vercel Environment Variables.

### D. Email Delivery (Verification & Password Reset)
1. Configure Supabase Auth SMTP or Resend (`RESEND_API_KEY`) / SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

---

## 3. Protected Routes & Leaderboard Privacy

- Interactive experiences (`world.html`, `quests.html`, `profile.html`) check session state via `AuthClient.getSession()`.
- When unauthenticated, visitors are guided to `auth.html?next=<intended_route>` and automatically returned to their intended destination after signing in.
- Public leaderboard responses (`/api/leaderboard`) expose only user-approved `displayName` / `username`, `avatar`, `xp`, `level`, and achievement badges — never email addresses, phone numbers, or private user IDs.

---

## Production Fail-Closed Gate & Required Owner Environment Variables

Starting with the Completion Phase (`docs/NULAR_AUTHENTICATION_PRODUCTION_GATE.md`), production deployments enforce strict fail-closed integrity:

| Variable | Required in Production? | Purpose |
|---|---|---|
| `NULAR_SESSION_SECRET` (or `RAGAMARA_SESSION_SECRET` / `SESSION_SECRET`) | **Mandatory (`>= 32` chars)** | HMAC-SHA256 signing for `HttpOnly` session cookies (`nular_session`). Missing/short secret fails closed with HTTP `503 SESSION_SECRET_MISSING`. |
| `SUPABASE_URL` | **Mandatory (`https://...`)** | Durable cloud account persistence. Missing fails closed with HTTP `503 AUTH_STORAGE_UNAVAILABLE`. |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) | **Mandatory** | Paired credential for Supabase. Incomplete pair fails closed with HTTP `503 SUPABASE_CONFIG_INCOMPLETE`. |
| `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` | Optional | Enables Google OAuth 2.0 (otherwise returns honest HTTP `503`). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Optional | Enables production SMS OTP delivery (otherwise returns honest HTTP `503` in production). |
| `SMTP_HOST` or `RESEND_API_KEY` | Optional | Enables real verification & reset emails (otherwise `verify-email` returns honest HTTP `503`). |

Local development persistence (`.nular-local-data/auth-store.json`, `0600`, `.gitignore`d) is strictly disabled in production.
