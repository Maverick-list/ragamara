# NULAR — MANUAL CONFIGURATION CHECKLIST (PROJECT OWNER)
Complete these items before deploying `feat/nular-world-experience` to a public production environment. Reference `.env.example`, `docs/AUTHENTICATION_SETUP.md`, and `docs/AI_GUIDE_SETUP.md`.

---

## 1. Security & Database (Required for Durable Production Accounts)
- [ ] Generate a 64-character random hex secret (`openssl rand -hex 32`) and set `NULAR_SESSION_SECRET` in Vercel Environment Variables.
- [ ] Create a Supabase PostgreSQL project and execute `db/migrations/001_nular_cultural_world.sql`.
- [ ] Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-side only) in Vercel Environment Variables.

## 2. Authentication Providers (Optional until Enabled)
- [ ] **Google OAuth 2.0:** Create Web OAuth Client in Google Cloud Console, whitelist `https://<your-domain>/api/auth?action=google-callback`, and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- [ ] **Phone OTP (SMS):** Provision a Twilio Messaging Service / E.164 sender and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- [ ] **Email Verification & Password Reset:** Configure Supabase Auth SMTP or set `RESEND_API_KEY` / `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

## 3. AI Cultural Guide & Neural Indonesian Voice (Optional)
- [ ] **Gemini Cultural Guide:** Set `GEMINI_API_KEY` in Vercel server environment variables to enable live conversational AI responses (replaces local grounded fallback).
- [ ] **Neural Indonesian TTS:** Set `GOOGLE_TTS_API_KEY` (Google Cloud TTS `id-ID-Wavenet-A`) or `ELEVENLABS_API_KEY` to enable neural speech narration (replaces browser `SpeechSynthesis` fallback).

## 4. Release Approval Gate
- [ ] Review local commits on `feat/nular-world-experience`.
- [ ] Perform physical iOS/Android touch & audio check on a Preview deployment.
- [ ] Provide explicit owner authorization before pushing `feat/nular-world-experience`, merging into `main`, or deploying to `nularin.vercel.app`.
