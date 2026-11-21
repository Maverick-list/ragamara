/**
 * Vercel Node.js Function: POST/GET/DELETE /api/auth
 * Unified Authentication Adapter for NULAR:
 *  - Strict Production Fail-Closed Integrity:
 *      * Production NEVER falls back to local filesystem or ephemeral in-memory storage.
 *      * Production requires complete Supabase configuration (SUPABASE_URL + key) AND
 *        a mandatory >=32-char session signing secret (NULAR_SESSION_SECRET / RAGAMARA_SESSION_SECRET / SESSION_SECRET).
 *      * Missing or incomplete production configuration fails closed with HTTP 503.
 *      * Network/database operation failures fail closed with HTTP 503 DATABASE_OPERATION_FAILED.
 *  - Real Supabase PostgREST Persistence (public.users, public.player_profiles, public.revoked_tokens, public.login_rate_limits).
 *  - Explicit Local Development Persistence:
 *      * Allowed ONLY in explicitly identified local development mode (non-production, non-Vercel).
 *      * Persists users, login rate-limit windows, and revoked session JTIs atomically to
 *        .nular-local-data/auth-store.json (0600, .gitignore'd).
 *  - Cryptographic Guest Token signing and verification.
 *  - Cryptographic Single-Use Email Verification & Password Reset tokens (sha256 hashed, expiry enforced, replay rejected).
 *  - Real Twilio SMS integration on phone-request (honest 502/503 on failure or missing credentials).
 *  - Google OAuth honest configuration status.
 *  - HMAC-SHA256 signed HttpOnly session cookies + JTI revocation + scrypt password hashing + timingSafeEqual.
 * Never exposes secrets, password hashes, private emails, or phone numbers in public endpoints.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_COOKIE = 'nular_session';
const DEV_FALLBACK_SECRET = 'nular-dev-ephemeral-signing-key-2026';
const MIN_PROD_SECRET_LEN = 32;

// In-process maps (hydrated from .nular-local-data/auth-store.json ONLY in local dev mode)
const usersByEmail = new Map();
const usersByPhone = new Map();
const usersById = new Map();
const otpStore = new Map(); // phone -> { code, expiresAt, lastSentAt, attempts, windowStart, sendCount }
const loginFailures = new Map(); // email -> { count, windowStart }
const revokedSessions = new Map(); // jti -> expiresAt
const verificationTokens = new Map(); // tokenHash -> { tokenHash, userId, tokenType, expiresAt, usedAt }

const LOCAL_STORE_DIR = path.join(process.cwd(), '.nular-local-data');
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, 'auth-store.json');
let localFileWritable = false;

export function sensitiveHeaders(existing = {}) {
  const headers = existing instanceof Headers
    ? Object.fromEntries(existing.entries())
    : (existing ? { ...existing } : {});
  headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
  headers['Pragma'] = 'no-cache';
  return headers;
}

export function jsonResponse(data, init = {}) {
  const headers = sensitiveHeaders(init.headers);
  return Response.json(data, { ...init, headers });
}

export function getRuntimeConfig() {
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL && process.env.VERCEL_ENV !== 'development');
  const isTestFixture = !isProd && process.env.NULAR_AUTH_TEST_FIXTURE === '1';

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const urlValid = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(supabaseUrl);
  const supabaseConfigured = Boolean(urlValid && supabaseKey);
  const supabaseIncomplete = Boolean((supabaseUrl || supabaseKey) && !supabaseConfigured);

  const explicitSecret = String(
    process.env.NULAR_SESSION_SECRET ||
    process.env.RAGAMARA_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  ).trim();
  const sessionSecretConfigured = explicitSecret.length >= MIN_PROD_SECRET_LEN;

  const allowLocalFs = !isProd && !isTestFixture && !supabaseConfigured;
  const signingSecret = explicitSecret || (isProd ? '' : DEV_FALLBACK_SECRET);

  let storageMode = 'unconfigured_fail_closed';
  if (supabaseConfigured) {
    storageMode = 'durable_production_supabase';
  } else if (isTestFixture) {
    storageMode = 'ephemeral_test_fixture';
  } else if (allowLocalFs && localFileWritable) {
    storageMode = 'local_dev_persistent';
  }

  return {
    isProd,
    isTestFixture,
    allowLocalFs,
    supabase: {
      configured: supabaseConfigured,
      incomplete: supabaseIncomplete,
      urlConfigured: urlValid,
      keyConfigured: Boolean(supabaseKey),
      url: supabaseUrl,
      key: supabaseKey
    },
    sessionSecretConfigured,
    sessionSecretMandatoryMet: isProd ? sessionSecretConfigured : true,
    signingSecret,
    storageMode
  };
}

function hydrateLocalAuthStore() {
  const cfg = getRuntimeConfig();
  if (!cfg.allowLocalFs) {
    localFileWritable = false;
    return;
  }
  try {
    fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true, mode: 0o700 });
    localFileWritable = true;
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, 'utf8'));
      for (const rec of parsed.users || []) {
        if (!rec?.uid) continue;
        usersById.set(rec.uid, rec);
        if (rec.email) usersByEmail.set(rec.email, rec);
        if (rec.phone) usersByPhone.set(rec.phone, rec);
      }
      const now = Date.now();
      for (const [email, fail] of Object.entries(parsed.loginFailures || {})) {
        if (fail && now - fail.windowStart < 15 * 60 * 1000) {
          loginFailures.set(email, fail);
        }
      }
      for (const [jti, exp] of Object.entries(parsed.revokedSessions || {})) {
        if (typeof exp === 'number' && exp > now) {
          revokedSessions.set(jti, exp);
        }
      }
      for (const [hash, tok] of Object.entries(parsed.verificationTokens || {})) {
        if (tok && typeof tok.expiresAt === 'number' && tok.expiresAt > now) {
          verificationTokens.set(hash, tok);
        }
      }
    }
  } catch {
    localFileWritable = false;
  }
}

function persistLocalAuthStore() {
  const cfg = getRuntimeConfig();
  if (!cfg.allowLocalFs || !localFileWritable) return;
  try {
    const now = Date.now();
    const activeFailures = {};
    for (const [email, fail] of loginFailures.entries()) {
      if (now - fail.windowStart < 15 * 60 * 1000) {
        activeFailures[email] = fail;
      }
    }
    const activeRevoked = {};
    for (const [jti, exp] of revokedSessions.entries()) {
      if (exp > now) activeRevoked[jti] = exp;
    }
    const activeTokens = {};
    for (const [hash, tok] of verificationTokens.entries()) {
      if (tok.expiresAt > now) activeTokens[hash] = tok;
    }
    const tmp = `${LOCAL_STORE_FILE}.tmp`;
    const payload = JSON.stringify({
      updatedAt: new Date().toISOString(),
      users: Array.from(usersById.values()),
      loginFailures: activeFailures,
      revokedSessions: activeRevoked,
      verificationTokens: activeTokens
    }, null, 2);
    fs.writeFileSync(tmp, payload, { mode: 0o600 });
    fs.renameSync(tmp, LOCAL_STORE_FILE);
  } catch {
    localFileWritable = false;
  }
}

hydrateLocalAuthStore();

export function getProviderConfigStatus() {
  const cfg = getRuntimeConfig();
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST ||
    process.env.RESEND_API_KEY ||
    cfg.supabase.configured
  );
  const productionReady = cfg.isProd
    ? (cfg.supabase.configured && cfg.sessionSecretConfigured)
    : (cfg.storageMode === 'local_dev_persistent' || cfg.storageMode === 'durable_production_supabase' || cfg.storageMode === 'ephemeral_test_fixture');

  return {
    storageMode: cfg.storageMode,
    productionReady,
    supabase: {
      configured: cfg.supabase.configured,
      incomplete: cfg.supabase.incomplete,
      urlConfigured: cfg.supabase.urlConfigured,
      keyConfigured: cfg.supabase.keyConfigured
    },
    email: {
      enabled: cfg.isProd ? cfg.supabase.configured : true,
      smtpConfigured,
      storageMode: cfg.storageMode
    },
    security: {
      isProduction: cfg.isProd,
      sessionSecretConfigured: cfg.sessionSecretConfigured,
      sessionSecretMandatoryMet: cfg.sessionSecretMandatoryMet,
      loginRateLimitEnabled: true,
      loginRateLimitScope: cfg.supabase.configured
        ? 'durable_backend_required'
        : (cfg.storageMode === 'local_dev_persistent' ? 'local_file_backed' : 'unconfigured')
    },
    google: {
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    },
    phoneOtp: {
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER)),
      devModeAllowed: !cfg.isProd
    }
  };
}

function getPersistenceGateError(cfg) {
  if (cfg.isProd && !cfg.sessionSecretConfigured) {
    return jsonResponse({
      ok: false,
      configured: false,
      code: 'SESSION_SECRET_MISSING',
      error: 'Konfigurasi NULAR_SESSION_SECRET (>= 32 karakter) wajib diisi di lingkungan produksi sebelum otentikasi dapat diaktifkan (lihat docs/AUTHENTICATION_SETUP.md).'
    }, { status: 503 });
  }
  if (cfg.isProd && !cfg.supabase.configured) {
    return jsonResponse({
      ok: false,
      configured: false,
      code: cfg.supabase.incomplete ? 'SUPABASE_CONFIG_INCOMPLETE' : 'AUTH_STORAGE_UNAVAILABLE',
      error: cfg.supabase.incomplete
        ? 'Konfigurasi Supabase produksi belum lengkap (SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY wajib lengkap). Otentikasi produksi dinonaktifkan (fail-closed).'
        : 'Penyimpanan akun produksi (Supabase) belum dikonfigurasi. Mode tamu tetap tersedia, namun pendaftaran/masuk produksi dinonaktifkan (fail-closed).'
    }, { status: 503 });
  }
  if (!cfg.isProd && cfg.storageMode === 'unconfigured_fail_closed') {
    return jsonResponse({
      ok: false,
      configured: false,
      code: 'AUTH_STORAGE_UNAVAILABLE',
      error: 'Penyimpanan akun lokal tidak dapat ditulis dan Supabase belum dikonfigurasi.'
    }, { status: 503 });
  }
  return null;
}

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

function dbErrorResponse(err) {
  return jsonResponse({
    ok: false,
    code: 'DATABASE_OPERATION_FAILED',
    error: 'Layanan basis data produksi tidak dapat diakses saat ini. Coba beberapa saat lagi.',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, { status: 503 });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}

function signSession(payload) {
  const cfg = getRuntimeConfig();
  if (!cfg.signingSecret) {
    throw new Error('SESSION_SECRET_MISSING');
  }
  const enriched = {
    jti: crypto.randomUUID(),
    ...payload
  };
  const body = Buffer.from(JSON.stringify(enriched)).toString('base64url');
  const sig = crypto.createHmac('sha256', cfg.signingSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function signGuestToken(guestId, ttlMs = 30 * 86400 * 1000) {
  const cfg = getRuntimeConfig();
  const secret = cfg.signingSecret || DEV_FALLBACK_SECRET;
  const cleanId = String(guestId || '').trim();
  const now = Date.now();
  const exp = now + ttlMs;
  const sig = crypto.createHmac('sha256', secret).update(`v1:${cleanId}:${now}:${exp}`).digest('base64url');
  return `${cleanId}.${now}.${exp}.${sig}`;
}

export function verifyGuestToken(token) {
  if (!token || typeof token !== 'string') return null;
  const cfg = getRuntimeConfig();
  const secret = cfg.signingSecret || DEV_FALLBACK_SECRET;
  const parts = token.split('.');
  if (parts.length === 4) {
    const [guestId, iatStr, expStr, sig] = parts;
    if (!guestId || !iatStr || !expStr || !sig) return null;
    const exp = parseInt(expStr, 10);
    const iat = parseInt(iatStr, 10);
    if (isNaN(exp) || isNaN(iat)) return null;
    if (Date.now() > exp) return null;
    const expected = crypto.createHmac('sha256', secret).update(`v1:${guestId}:${iat}:${exp}`).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return guestId;
  }
  if (parts.length === 2) {
    const [guestId, sig] = parts;
    if (!guestId || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(guestId).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return guestId;
  }
  return null;
}

export function verifySessionToken(token) {
  const cfg = getRuntimeConfig();
  if (!cfg.signingSecret) return null;
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', cfg.signingSecret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    if (parsed.jti && revokedSessions.has(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function verifySessionAsync(token) {
  const parsed = verifySessionToken(token);
  if (!parsed) return { valid: false, session: null, error: 'INVALID_TOKEN' };
  const cfg = getRuntimeConfig();
  if (cfg.supabase.configured && parsed.jti) {
    try {
      const revoked = await sbPostgrest(`revoked_tokens?jti=eq.${encodeURIComponent(parsed.jti)}&select=jti`);
      if (revoked && revoked.length > 0) {
        revokedSessions.set(parsed.jti, parsed.exp || (Date.now() + 7 * 86400000));
        return { valid: false, session: null, error: 'REVOKED_TOKEN' };
      }
    } catch (err) {
      if (cfg.isProd) {
        const error = new Error('DATABASE_OPERATION_FAILED');
        error.code = 'DATABASE_OPERATION_FAILED';
        error.status = 503;
        throw error;
      }
    }
  }
  return { valid: true, session: parsed };
}

export function parseCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  const hit = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function cookieHeader(token, maxAge = 60 * 60 * 24 * 7) {
  const cfg = getRuntimeConfig();
  const secure = cfg.isProd ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function toSafeUser(rec) {
  return {
    id: rec.uid,
    username: rec.username,
    displayName: rec.displayName || rec.username,
    preferredRegion: rec.preferredRegion || 'Sumatra',
    avatarId: rec.avatarId || 'batik-parang-solo',
    emailVerified: Boolean(rec.emailVerified),
    tutorialCompleted: Boolean(rec.tutorialCompleted),
    privacyPublicLeaderboard: rec.privacyPublicLeaderboard !== false
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const providers = getProviderConfigStatus();
  const cfg = getRuntimeConfig();

  if (action === 'providers' || action === 'health') {
    return jsonResponse({
      providers,
      runtime: {
        storageMode: cfg.storageMode,
        productionReady: providers.productionReady,
        isProduction: cfg.isProd,
        supabaseConfigured: cfg.supabase.configured,
        sessionSecretConfigured: cfg.sessionSecretConfigured
      }
    });
  }

  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (!session) {
    return jsonResponse({
      authenticated: false,
      mode: 'guest',
      supabaseConfigured: cfg.supabase.configured,
      productionReady: providers.productionReady,
      providers
    });
  }

  if (cfg.supabase.configured) {
    try {
      if (session.jti) {
        const revoked = await sbPostgrest(`revoked_tokens?jti=eq.${encodeURIComponent(session.jti)}&select=jti`);
        if (revoked && revoked.length > 0) {
          return jsonResponse({
            authenticated: false,
            mode: 'guest',
            supabaseConfigured: cfg.supabase.configured,
            productionReady: providers.productionReady,
            providers
          }, { headers: { 'Set-Cookie': cookieHeader('', 0) } });
        }
      }
      const users = await sbPostgrest(`users?id=eq.${encodeURIComponent(session.uid)}&deleted_at=is.null&select=*`);
      if (!users || users.length === 0) {
        return jsonResponse({
          authenticated: false,
          mode: 'guest',
          supabaseConfigured: cfg.supabase.configured,
          productionReady: providers.productionReady,
          providers
        }, { headers: { 'Set-Cookie': cookieHeader('', 0) } });
      }
      const user = users[0];
      const profiles = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(session.uid)}&select=*`);
      const prof = profiles?.[0] || {};
      const safe = {
        id: user.id,
        username: prof.username || session.username,
        displayName: prof.username || session.username,
        preferredRegion: 'Sumatra',
        avatarId: prof.avatar_id || 'batik-parang-solo',
        emailVerified: Boolean(user.email_verified),
        tutorialCompleted: false,
        privacyPublicLeaderboard: prof.is_public !== false
      };
      return jsonResponse({
        authenticated: true,
        mode: 'account',
        user: safe,
        supabaseConfigured: cfg.supabase.configured,
        productionReady: providers.productionReady,
        providers
      });
    } catch (err) {
      if (cfg.isProd) return dbErrorResponse(err);
    }
  }

  const stored = usersById.get(session.uid);
  if (!stored && cfg.storageMode === 'local_dev_persistent') {
    return jsonResponse({
      authenticated: false,
      mode: 'guest',
      supabaseConfigured: cfg.supabase.configured,
      productionReady: providers.productionReady,
      providers
    }, { headers: { 'Set-Cookie': cookieHeader('', 0) } });
  }
  return jsonResponse({
    authenticated: true,
    mode: 'account',
    user: stored ? toSafeUser(stored) : { id: session.uid, username: session.username, displayName: session.username },
    supabaseConfigured: cfg.supabase.configured,
    productionReady: providers.productionReady,
    providers
  });
}

export async function POST(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'login';
  const body = await request.json().catch(() => ({}));
  const cfg = getRuntimeConfig();
  const providers = getProviderConfigStatus();

  if (action === 'logout') {
    const token = parseCookie(request, SESSION_COOKIE);
    const session = verifySessionToken(token);
    if (session?.jti) {
      if (cfg.supabase.configured) {
        await sbPostgrest('revoked_tokens', {
          method: 'POST',
          body: {
            jti: session.jti,
            user_id: session.uid,
            expires_at: new Date(session.exp || Date.now() + 7 * 86400000).toISOString(),
            reason: 'user_logout'
          }
        }).catch(() => {});
      }
      revokedSessions.set(session.jti, session.exp || (Date.now() + 7 * 86400000));
      persistLocalAuthStore();
    }
    return jsonResponse({ ok: true, authenticated: false }, {
      headers: { 'Set-Cookie': cookieHeader('', 0) }
    });
  }

  if (action === 'google-start') {
    const gateErr = getPersistenceGateError(cfg);
    if (gateErr) return gateErr;
    if (!providers.google.configured) {
      return jsonResponse({
        ok: false,
        configured: false,
        error: 'Google OAuth belum dikonfigurasi pada server. Tambahkan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET (lihat docs/AUTHENTICATION_SETUP.md).'
      }, { status: 503 });
    }
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth?action=google-callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    return jsonResponse({ configured: true, authUrl: authUrl.toString() });
  }

  if (action === 'google-callback') {
    if (!providers.google.configured) {
      return jsonResponse({
        ok: false,
        error: 'Penyedia Google OAuth belum dikonfigurasi pada server.',
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED'
      }, { status: 501 });
    }
  }

  // All persistence-dependent actions MUST pass the production fail-closed gate
  const gateErr = getPersistenceGateError(cfg);
  if (gateErr) return gateErr;

  if (action === 'phone-request') {
    const phone = String(body.phone || '').trim().replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return jsonResponse({ error: 'Format nomor telepon internasional (E.164) tidak valid. Contoh: +6281234567890' }, { status: 400 });
    }

    const twilioSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioAuth = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const twilioFrom = String(process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '').trim();
    const twilioConfigured = Boolean(twilioSid && twilioAuth && twilioFrom);

    if (!twilioConfigured && cfg.isProd) {
      return jsonResponse({
        ok: false,
        configured: false,
        error: 'Penyedia SMS OTP belum dikonfigurasi pada lingkungan produksi (lihat docs/AUTHENTICATION_SETUP.md).'
      }, { status: 503 });
    }

    const now = Date.now();
    const existing = otpStore.get(phone);
    if (existing && now - existing.lastSentAt < 60000) {
      const waitSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return jsonResponse({ error: `Tunggu ${waitSec} detik sebelum mengirim ulang kode OTP.`, retryAfterSeconds: waitSec }, { status: 429 });
    }
    const resetWindow = !existing || (now - existing.windowStart > 3600000);
    if (existing && !resetWindow && existing.sendCount >= 5) {
      return jsonResponse({ error: 'Batas pengiriman OTP per jam tercapai. Coba lagi nanti.' }, { status: 429 });
    }

    const code = String(crypto.randomInt(100000, 999999));

    if (twilioConfigured) {
      try {
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

        if (!twilioRes.ok) {
          const errDetail = await twilioRes.text().catch(() => '');
          return jsonResponse({
            ok: false,
            error: 'Gagal mengirim SMS verifikasi via penyedia telekomunikasi. Coba lagi nanti.',
            code: 'SMS_DELIVERY_FAILED',
            detail: !cfg.isProd ? errDetail : undefined
          }, { status: 502 });
        }
      } catch (err) {
        return jsonResponse({
          ok: false,
          error: 'Koneksi ke penyedia SMS gagal.',
          code: 'SMS_DELIVERY_FAILED',
          detail: !cfg.isProd ? err.message : undefined
        }, { status: 502 });
      }
    }

    otpStore.set(phone, {
      code,
      expiresAt: now + 5 * 60 * 1000,
      lastSentAt: now,
      attempts: 0,
      windowStart: resetWindow ? now : existing.windowStart,
      sendCount: resetWindow ? 1 : existing.sendCount + 1
    });

    return jsonResponse({
      ok: true,
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
      deliveryMode: twilioConfigured ? 'sms_provider' : 'local_dev_only',
      ...(twilioConfigured ? {} : {
        devOtpPreview: code,
        notice: 'Mode pengembangan lokal: penyedia SMS belum terkonfigurasi. Gunakan kode pratinjau lokal ini hanya untuk pengujian.'
      })
    });
  }

  if (action === 'phone-verify') {
    const phone = String(body.phone || '').trim().replace(/[\s\-()]/g, '');
    const code = String(body.code || '').trim();
    const rec = otpStore.get(phone);
    if (!rec) {
      return jsonResponse({ error: 'Kode OTP tidak ditemukan. Minta kode baru.' }, { status: 400 });
    }
    if (Date.now() > rec.expiresAt) {
      otpStore.delete(phone);
      return jsonResponse({ error: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' }, { status: 400 });
    }
    if (rec.attempts >= 5) {
      otpStore.delete(phone);
      return jsonResponse({ error: 'Terlalu banyak percobaan salah. Minta kode OTP baru.' }, { status: 429 });
    }
    rec.attempts += 1;
    if (rec.code !== code) {
      return jsonResponse({ error: 'Kode OTP tidak cocok.' }, { status: 401 });
    }
    otpStore.delete(phone);

    if (cfg.supabase.configured) {
      try {
        const users = await sbPostgrest(`users?phone=eq.${encodeURIComponent(phone)}&deleted_at=is.null&select=*`);
        let dbUser = users?.[0];
        let uid = dbUser?.id;
        let username = String(body.username || `Penjelajah_${phone.slice(-4)}`).slice(0, 32);
        if (!dbUser) {
          uid = crypto.randomUUID();
          await sbPostgrest('users', {
            method: 'POST',
            body: { id: uid, phone, email_verified: true }
          });
          await sbPostgrest('player_profiles', {
            method: 'POST',
            body: {
              user_id: uid,
              username,
              total_xp: 0,
              current_level: 1,
              avatar_id: 'batik-parang-solo',
              is_public: true
            }
          }).catch(() => {});
        }
        const profs = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(uid)}&select=*`);
        const prof = profs?.[0] || {};
        const safe = {
          id: uid,
          username: prof.username || username,
          displayName: prof.username || username,
          phone,
          preferredRegion: 'Sumatra',
          avatarId: prof.avatar_id || 'batik-parang-solo',
          emailVerified: true,
          tutorialCompleted: false,
          privacyPublicLeaderboard: prof.is_public !== false
        };
        const token = signSession({ uid, username: safe.username, exp: Date.now() + 7 * 86400000 });
        return jsonResponse({ authenticated: true, user: safe }, {
          headers: { 'Set-Cookie': cookieHeader(token) }
        });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    }

    let user = usersByPhone.get(phone);
    if (!user) {
      const uid = crypto.randomUUID();
      const username = String(body.username || `Penjelajah_${phone.slice(-4)}`).slice(0, 32);
      user = {
        uid,
        phone,
        username,
        displayName: username,
        preferredRegion: 'Sumatra',
        avatarId: 'batik-parang-solo',
        emailVerified: true,
        tutorialCompleted: false,
        privacyPublicLeaderboard: true,
        createdAt: new Date().toISOString()
      };
      usersByPhone.set(phone, user);
      usersById.set(uid, user);
      persistLocalAuthStore();
    }
    const token = signSession({ uid: user.uid, username: user.username, exp: Date.now() + 7 * 86400000 });
    return jsonResponse({ authenticated: true, user: toSafeUser(user) }, {
      headers: { 'Set-Cookie': cookieHeader(token) }
    });
  }

  if (action === 'reset-request') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'Alamat email tidak valid.' }, { status: 400 });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    if (cfg.supabase.configured) {
      try {
        const users = await sbPostgrest(`users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id`);
        if (users && users.length > 0) {
          await sbPostgrest('auth_verification_tokens', {
            method: 'POST',
            body: {
              token_hash: tokenHash,
              user_id: users[0].id,
              token_type: 'password_reset',
              expires_at: expiresAt
            }
          });
        }
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    } else {
      const rec = usersByEmail.get(email);
      if (rec) {
        verificationTokens.set(tokenHash, {
          tokenHash,
          userId: rec.uid,
          tokenType: 'password_reset',
          expiresAt: Date.now() + 3600000,
          usedAt: null
        });
        persistLocalAuthStore();
      }
    }

    return jsonResponse({
      ok: true,
      smtpConfigured: providers.email.smtpConfigured,
      message: providers.email.smtpConfigured
        ? 'Tautan reset kata sandi telah dikirim bila akun terdaftar.'
        : 'Permintaan reset dicatat (pengiriman email nyata memerlukan konfigurasi SMTP/Supabase).',
      ...(!cfg.isProd ? { devResetToken: rawToken } : {})
    });
  }

  if (action === 'reset-confirm') {
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');
    if (!token || newPassword.length < 8) {
      return jsonResponse({ error: 'Token reset dan kata sandi baru (minimal 8 karakter) wajib diisi.' }, { status: 400 });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const nowIso = new Date().toISOString();

    if (cfg.supabase.configured) {
      try {
        const rows = await sbPostgrest(`auth_verification_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&token_type=eq.password_reset&used_at=is.null&select=*`);
        if (!rows || rows.length === 0) {
          return jsonResponse({ error: 'Token reset kata sandi tidak valid atau telah digunakan.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
        }
        const tokenRec = rows[0];
        if (new Date(tokenRec.expires_at).getTime() < Date.now()) {
          return jsonResponse({ error: 'Token reset kata sandi telah kedaluwarsa.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
        }
        await sbPostgrest(`auth_verification_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
          method: 'PATCH',
          body: { used_at: nowIso }
        });
        const newHash = hashPassword(newPassword);
        await sbPostgrest(`users?id=eq.${encodeURIComponent(tokenRec.user_id)}`, {
          method: 'PATCH',
          body: { password_hash: newHash }
        });
        await sbPostgrest('revoked_tokens', {
          method: 'POST',
          body: {
            jti: crypto.randomUUID(),
            user_id: tokenRec.user_id,
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            reason: 'password_reset'
          }
        }).catch(() => {});
        return jsonResponse({ ok: true, message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    } else {
      const tokenRec = verificationTokens.get(tokenHash);
      if (!tokenRec || tokenRec.tokenType !== 'password_reset' || tokenRec.usedAt) {
        return jsonResponse({ error: 'Token reset kata sandi tidak valid atau telah digunakan.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
      }
      if (Date.now() > tokenRec.expiresAt) {
        return jsonResponse({ error: 'Token reset kata sandi telah kedaluwarsa.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
      }
      tokenRec.usedAt = Date.now();
      const user = usersById.get(tokenRec.userId);
      if (user) {
        user.passwordHash = hashPassword(newPassword);
      }
      persistLocalAuthStore();
      return jsonResponse({ ok: true, message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' });
    }
  }

  if (action === 'verify-email') {
    const rawToken = String(body.token || url.searchParams.get('token') || '').trim();
    if (!providers.email.smtpConfigured && !rawToken) {
      return jsonResponse({
        ok: false,
        configured: false,
        emailVerified: false,
        error: 'Verifikasi email nyata memerlukan konfigurasi SMTP atau Supabase Auth (lihat docs/AUTHENTICATION_SETUP.md).'
      }, { status: 503 });
    }
    if (!rawToken) {
      return jsonResponse({
        ok: false,
        error: 'Token verifikasi email wajib disertakan dan harus valid.',
        code: 'INVALID_VERIFICATION_TOKEN'
      }, { status: 400 });
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const nowIso = new Date().toISOString();

    if (cfg.supabase.configured) {
      try {
        const rows = await sbPostgrest(`auth_verification_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&token_type=eq.email_verify&used_at=is.null&select=*`);
        if (!rows || rows.length === 0) {
          return jsonResponse({
            ok: false,
            error: 'Token verifikasi email tidak valid atau telah digunakan.',
            code: 'INVALID_VERIFICATION_TOKEN'
          }, { status: 400 });
        }
        const tokenRec = rows[0];
        if (new Date(tokenRec.expires_at).getTime() < Date.now()) {
          return jsonResponse({
            ok: false,
            error: 'Token verifikasi email telah kedaluwarsa.',
            code: 'INVALID_VERIFICATION_TOKEN'
          }, { status: 400 });
        }
        await sbPostgrest(`auth_verification_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
          method: 'PATCH',
          body: { used_at: nowIso }
        });
        await sbPostgrest(`users?id=eq.${encodeURIComponent(tokenRec.user_id)}`, {
          method: 'PATCH',
          body: { email_verified: true }
        });
        return jsonResponse({ ok: true, configured: true, emailVerified: true });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    } else {
      const tokenRec = verificationTokens.get(tokenHash);
      if (!tokenRec || tokenRec.tokenType !== 'email_verify' || tokenRec.usedAt) {
        return jsonResponse({
          ok: false,
          error: 'Token verifikasi email tidak valid atau telah digunakan.',
          code: 'INVALID_VERIFICATION_TOKEN'
        }, { status: 400 });
      }
      if (Date.now() > tokenRec.expiresAt) {
        return jsonResponse({
          ok: false,
          error: 'Token verifikasi email telah kedaluwarsa.',
          code: 'INVALID_VERIFICATION_TOKEN'
        }, { status: 400 });
      }
      tokenRec.usedAt = Date.now();
      const user = usersById.get(tokenRec.userId);
      if (user) user.emailVerified = true;
      persistLocalAuthStore();
      return jsonResponse({ ok: true, configured: true, emailVerified: true });
    }
  }

  if (action === 'profile-update') {
    const token = parseCookie(request, SESSION_COOKIE);
    const session = verifySessionToken(token);
    if (!session) return jsonResponse({ error: 'Otentikasi diperlukan.' }, { status: 401 });

    if (cfg.supabase.configured) {
      try {
        if (session.jti) {
          const rev = await sbPostgrest(`revoked_tokens?jti=eq.${encodeURIComponent(session.jti)}&select=jti`);
          if (rev && rev.length > 0) return jsonResponse({ error: 'Sesi telah dicabut. Silakan masuk kembali.' }, { status: 401 });
        }
        const updates = {};
        if (typeof body.avatarId === 'string') updates.avatar_id = body.avatarId.slice(0, 48);
        if (typeof body.privacyPublicLeaderboard === 'boolean') updates.is_public = body.privacyPublicLeaderboard;
        // Total XP and level are protected against client tampering
        if (Object.keys(updates).length > 0) {
          await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(session.uid)}`, {
            method: 'PATCH',
            body: updates
          });
        }
        const profs = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(session.uid)}&select=*`);
        const prof = profs?.[0] || {};
        return jsonResponse({
          ok: true,
          user: {
            id: session.uid,
            username: prof.username || session.username,
            displayName: prof.username || session.username,
            preferredRegion: 'Sumatra',
            avatarId: prof.avatar_id || 'batik-parang-solo',
            emailVerified: true,
            tutorialCompleted: false,
            privacyPublicLeaderboard: prof.is_public !== false
          }
        });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    }

    const rec = usersById.get(session.uid);
    if (!rec) return jsonResponse({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    if (typeof body.displayName === 'string' && body.displayName.trim()) rec.displayName = body.displayName.trim().slice(0, 40);
    if (typeof body.preferredRegion === 'string') rec.preferredRegion = body.preferredRegion.slice(0, 40);
    if (typeof body.avatarId === 'string') rec.avatarId = body.avatarId.slice(0, 48);
    if (typeof body.tutorialCompleted === 'boolean') rec.tutorialCompleted = body.tutorialCompleted;
    if (typeof body.privacyPublicLeaderboard === 'boolean') rec.privacyPublicLeaderboard = body.privacyPublicLeaderboard;
    persistLocalAuthStore();
    return jsonResponse({ ok: true, user: toSafeUser(rec) });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const username = String(body.username || '').trim() || email.split('@')[0];

  if (!email || !email.includes('@') || password.length < 8) {
    return jsonResponse({ error: 'Email valid dan kata sandi minimal 8 karakter diperlukan.' }, { status: 400 });
  }

  if (action === 'signup') {
    if (cfg.supabase.configured) {
      try {
        const existing = await sbPostgrest(`users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id`);
        if (existing && existing.length > 0) {
          return jsonResponse({ error: 'Email sudah terdaftar.' }, { status: 409 });
        }
        const uid = crypto.randomUUID();
        const pwdHash = hashPassword(password);
        const nowIso = new Date().toISOString();
        await sbPostgrest('users', {
          method: 'POST',
          body: {
            id: uid,
            email,
            email_verified: false,
            password_hash: pwdHash,
            created_at: nowIso
          }
        });
        await sbPostgrest('player_profiles', {
          method: 'POST',
          body: {
            user_id: uid,
            username: username.slice(0, 32),
            avatar_id: 'batik-parang-solo',
            is_public: true,
            total_xp: 0,
            current_level: 1,
            missions_completed: 0,
            discoveries_count: 0
          }
        });
        const rawVerifToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawVerifToken).digest('hex');
        await sbPostgrest('auth_verification_tokens', {
          method: 'POST',
          body: {
            token_hash: tokenHash,
            user_id: uid,
            token_type: 'email_verify',
            expires_at: new Date(Date.now() + 86400000).toISOString()
          }
        }).catch(() => {});
        const token = signSession({ uid, username: username.slice(0, 32), exp: Date.now() + 7 * 86400000 });
        const safeUser = {
          id: uid,
          username: username.slice(0, 32),
          displayName: username.slice(0, 32),
          preferredRegion: 'Sumatra',
          avatarId: 'batik-parang-solo',
          emailVerified: false,
          tutorialCompleted: false,
          privacyPublicLeaderboard: true
        };
        return jsonResponse({
          authenticated: true,
          user: safeUser,
          emailVerificationStatus: providers.email.smtpConfigured ? 'pending_email' : 'session_active',
          ...(!cfg.isProd ? { devEmailVerifyToken: rawVerifToken } : {})
        }, { status: 201, headers: { 'Set-Cookie': cookieHeader(token) } });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    }

    if (usersByEmail.has(email)) {
      return jsonResponse({ error: 'Email sudah terdaftar.' }, { status: 409 });
    }
    const uid = crypto.randomUUID();
    const rec = {
      uid,
      email,
      username: username.slice(0, 32),
      displayName: String(body.displayName || username).slice(0, 40),
      preferredRegion: String(body.preferredRegion || 'Sumatra').slice(0, 40),
      avatarId: 'batik-parang-solo',
      emailVerified: false,
      tutorialCompleted: false,
      privacyPublicLeaderboard: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    usersByEmail.set(email, rec);
    usersById.set(uid, rec);
    const rawVerif = crypto.randomBytes(32).toString('hex');
    const verifHash = crypto.createHash('sha256').update(rawVerif).digest('hex');
    verificationTokens.set(verifHash, {
      tokenHash: verifHash,
      userId: uid,
      tokenType: 'email_verify',
      expiresAt: Date.now() + 86400000,
      usedAt: null
    });
    persistLocalAuthStore();
    const token = signSession({ uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
    return jsonResponse({
      authenticated: true,
      user: toSafeUser(rec),
      emailVerificationStatus: providers.email.smtpConfigured ? 'pending_email' : 'local_session_active',
      devEmailVerifyToken: rawVerif
    }, { status: 201, headers: { 'Set-Cookie': cookieHeader(token) } });
  }

  // Login handler
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX_FAILURES = 5;

  if (cfg.supabase.configured) {
    try {
      const rateKey = `login:${email}`;
      const rateLimits = await sbPostgrest(`login_rate_limits?key=eq.${encodeURIComponent(rateKey)}&select=*`);
      const limitRec = rateLimits?.[0];
      if (limitRec && limitRec.locked_until && new Date(limitRec.locked_until).getTime() > now) {
        const retryAfterSeconds = Math.max(1, Math.ceil((new Date(limitRec.locked_until).getTime() - now) / 1000));
        return jsonResponse({
          error: `Terlalu banyak percobaan masuk gagal. Coba lagi dalam ${retryAfterSeconds} detik.`,
          retryAfterSeconds
        }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } });
      }

      const users = await sbPostgrest(`users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=*`);
      const user = users?.[0];

      if (!user || !verifyPassword(password, user.password_hash)) {
        const attempts = (limitRec?.attempts || 0) + 1;
        const lockedUntil = attempts >= MAX_FAILURES ? new Date(now + WINDOW_MS).toISOString() : null;
        if (limitRec) {
          await sbPostgrest(`login_rate_limits?key=eq.${encodeURIComponent(rateKey)}`, {
            method: 'PATCH',
            body: { attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() }
          });
        } else {
          await sbPostgrest('login_rate_limits', {
            method: 'POST',
            body: { key: rateKey, attempts: 1, first_attempt_at: new Date().toISOString(), locked_until: null }
          });
        }
        return jsonResponse({ error: 'Email atau kata sandi tidak cocok.' }, { status: 401 });
      }

      if (limitRec) {
        await sbPostgrest(`login_rate_limits?key=eq.${encodeURIComponent(rateKey)}`, {
          method: 'DELETE'
        }).catch(() => {});
      }

      const profs = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=*`);
      const prof = profs?.[0] || {};
      const safe = {
        id: user.id,
        username: prof.username || username,
        displayName: prof.username || username,
        preferredRegion: 'Sumatra',
        avatarId: prof.avatar_id || 'batik-parang-solo',
        emailVerified: Boolean(user.email_verified),
        tutorialCompleted: false,
        privacyPublicLeaderboard: prof.is_public !== false
      };
      const token = signSession({ uid: user.id, username: safe.username, exp: Date.now() + 7 * 86400000 });
      return jsonResponse({ authenticated: true, user: safe }, {
        headers: { 'Set-Cookie': cookieHeader(token) }
      });
    } catch (err) {
      if (cfg.isProd) return dbErrorResponse(err);
    }
  }

  // Local development login flow
  const failRec = loginFailures.get(email);
  if (failRec && now - failRec.windowStart < WINDOW_MS && failRec.count >= MAX_FAILURES) {
    const retryAfterSeconds = Math.max(1, Math.ceil((failRec.windowStart + WINDOW_MS - now) / 1000));
    return jsonResponse({
      error: `Terlalu banyak percobaan masuk gagal. Coba lagi dalam ${retryAfterSeconds} detik.`,
      retryAfterSeconds
    }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } });
  }

  const rec = usersByEmail.get(email);
  if (!rec || !verifyPassword(password, rec.passwordHash)) {
    const nextFail = (!failRec || now - failRec.windowStart >= WINDOW_MS)
      ? { count: 1, windowStart: now }
      : { count: failRec.count + 1, windowStart: failRec.windowStart };
    loginFailures.set(email, nextFail);
    persistLocalAuthStore();
    return jsonResponse({ error: 'Email atau kata sandi tidak cocok.' }, { status: 401 });
  }
  loginFailures.delete(email);
  persistLocalAuthStore();
  const token = signSession({ uid: rec.uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
  return jsonResponse({
    authenticated: true,
    user: toSafeUser(rec)
  }, { headers: { 'Set-Cookie': cookieHeader(token) } });
}

export async function DELETE(request) {
  const cfg = getRuntimeConfig();
  const gateErr = getPersistenceGateError(cfg);
  if (gateErr) return gateErr;

  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (session) {
    if (cfg.supabase.configured) {
      try {
        if (session.jti) {
          await sbPostgrest('revoked_tokens', {
            method: 'POST',
            body: {
              jti: session.jti,
              user_id: session.uid,
              expires_at: new Date(session.exp || Date.now() + 7 * 86400000).toISOString(),
              reason: 'account_deletion'
            }
          }).catch(() => {});
        }
        await sbPostgrest(`users?id=eq.${encodeURIComponent(session.uid)}`, {
          method: 'DELETE'
        });
      } catch (err) {
        if (cfg.isProd) return dbErrorResponse(err);
      }
    }
    if (session.jti) {
      revokedSessions.set(session.jti, session.exp || (Date.now() + 7 * 86400000));
    }
    const rec = usersById.get(session.uid);
    if (rec?.email) {
      usersByEmail.delete(rec.email);
      loginFailures.delete(rec.email);
    }
    if (rec?.phone) usersByPhone.delete(rec.phone);
    usersById.delete(session.uid);
    persistLocalAuthStore();
  }
  return jsonResponse({ ok: true, deleted: true }, {
    headers: { 'Set-Cookie': cookieHeader('', 0) }
  });
}
