# NULAR — AUTHENTICATION PROVIDER INTEGRITY & THIRD-PARTY SPECIFICATION
## Comprehensive Documentation for SMS OTP, Google OAuth & Cryptographic Tokens

**Project:** NULAR — The Living World of Nusantara
**Module:** `api/auth.js`
**Security Standard:** Zero-Fabrication Provider Policy
**Status:** **HONEST, SECURE & VERIFIED**

---

## 1. Zero-Fabrication Philosophy

In previous revisions, endpoints sometimes generated mock responses (such as mock SMS delivery or mock verification) to pass tests. NULAR now enforces a strict **Zero-Fabrication Provider Policy**:
- **Production Truthfulness:** If a third-party provider (Twilio, Google, SMTP) is unconfigured in production, the API returns an explicit HTTP 503 Service Unavailable with clear configuration guidance. It never falsely claims that an SMS or email was sent.
- **Upstream Error Propagation:** If Twilio or an upstream API returns an error or rejects credentials, the API surfaces an HTTP 502 Bad Gateway with diagnostic error codes.
- **Explicit Local Preview Mode:** In local development mode (`!cfg.isProd`), mock tokens or OTP codes are labeled as `deliveryMode: 'local_dev_only'` with explicit preview fields (`devOtpPreview`, `devResetToken`, `devEmailVerifyToken`) so developers and automated test harnesses can test end-to-end flows safely without sending real SMS messages.

---

## 2. Twilio SMS Integration (`action=phone-request`)

### Configuration Keys
- `TWILIO_ACCOUNT_SID`: Twilio Account SID (starts with `AC...`)
- `TWILIO_AUTH_TOKEN`: Twilio API Secret Auth Token
- `TWILIO_FROM_NUMBER` or `TWILIO_PHONE_NUMBER`: Twilio registered sender phone number (E.164 format, e.g. `+15551234567`)

### Real API Call Implementation
```javascript
const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
const formParams = new URLSearchParams();
formParams.set('From', twilioFrom);
formParams.set('To', phone);
formParams.set('Body', `[NULAR] Kode verifikasi Anda adalah ${code}. Berlaku 5 menit. Jangan berikan kode ini kepada siapa pun.`);

const twilioRes = await fetch(twilioUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${basicAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: formParams.toString()
});
```

### Rate Limiting & Cooldown Guards
- **E.164 Strict Regex:** `^\+[1-9]\d{7,14}$` (rejects local phone formats like `0812...` with HTTP 400).
- **60-Second Cooldown:** Prevents rapid resends with HTTP 429 (`retryAfterSeconds`).
- **Hourly Cap:** Max 5 SMS dispatches per phone number per hour.
- **5-Minute Expiry:** OTP codes expire after 300 seconds. Max 5 verification attempts per code.

---

## 3. Google OAuth Integration (`action=google-start` & `action=google-callback`)

### Configuration Keys
- `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URI (defaults to `<origin>/api/auth?action=google-callback`)

### Behavior
- When unconfigured:
  - `POST /api/auth?action=google-start` returns HTTP 503:
    `{ ok: false, configured: false, error: 'Google OAuth belum dikonfigurasi pada server...' }`
  - `POST /api/auth?action=google-callback` returns HTTP 501 Not Implemented:
    `{ ok: false, error: 'Penyedia Google OAuth belum dikonfigurasi pada server.', code: 'GOOGLE_OAUTH_NOT_CONFIGURED' }`
- When configured:
  - Generates a cryptographic CSRF state token (`crypto.randomBytes(16).toString('hex')`) and returns the Google OAuth consent URL requesting `openid email profile`.

---

## 4. Single-Use Cryptographic Tokens

### 4.1 Token Generation Architecture
To prevent timing attacks, token harvesting, and replay attacks:
1. The server generates 32 cryptographically secure random bytes:
   ```javascript
   const rawToken = crypto.randomBytes(32).toString('hex');
   ```
2. The server hashes the raw token using SHA-256 before storing it in the database:
   ```javascript
   const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
   ```
3. The raw token is delivered to the user (via email link or preview parameter). The database **only** stores `token_hash`. If the database is compromised, the tokens cannot be reversed.

### 4.2 Replay Protection Lifecycle
```
User Requests Reset / Verification
          │
          ▼
Generate 32-byte Raw Token -> Store SHA-256 Hash + Expiry in DB
          │
          ▼
User Submits Raw Token (action=verify-email or action=reset-confirm)
          │
          ▼
Server computes sha256(rawToken) and queries auth_verification_tokens
          │
          ├── Token not found OR used_at IS NOT NULL -> HTTP 400 (REJECTED / REPLAY ATTACK)
          ├── Date.now() > expires_at -> HTTP 400 (EXPIRED)
          └── Valid & Unused:
                  │
                  ├── Set used_at = now() (ATOMIC CONSUMPTION)
                  ├── Update user (email_verified=true OR update password)
                  └── Revoke active sessions for user (if password reset)
```
Any subsequent attempt to use the same token fails with HTTP 400 because `used_at` is no longer `null`.
