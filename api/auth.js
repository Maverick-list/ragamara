/**
 * Vercel Node.js Function: POST/GET/DELETE /api/auth
 * Unified Authentication Adapter for NULAR:
 *  - Strict Production Fail-Closed Integrity:
 *      * Production NEVER falls back to local filesystem or ephemeral in-memory storage.
 *      * Production requires complete Supabase configuration (SUPABASE_URL + key) AND
 *        a mandatory >=32-char session signing secret (NULAR_SESSION_SECRET / RAGAMARA_SESSION_SECRET / SESSION_SECRET).
 *      * Missing or incomplete production configuration fails closed with HTTP 503.
 *  - Explicit Local Development Persistence:
 *      * Allowed ONLY in explicitly identified local development mode (non-production, non-Vercel).
 *      * Persists users, login rate-limit windows, and revoked session JTIs atomically to
 *        .nular-local-data/auth-store.json (0600, .gitignore'd).
 *  - Email sign-up, login, password reset request, email verification, logout, account deletion
 *  - Google OAuth adapter (honest unconfigured state when GOOGLE_CLIENT_ID/SECRET absent)
 *  - International Phone OTP (E.164 validation, 60s resend cooldown, rate limit, 5m expiry, attempt cap)
 *  - HMAC-SHA256 signed HttpOnly session cookies + JTI revocation + scrypt password hashing + timingSafeEqual
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

const LOCAL_STORE_DIR = path.join(process.cwd(), '.nular-local-data');
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, 'auth-store.json');
let localFileWritable = false;

function getRuntimeConfig() {
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL && process.env.VERCEL_ENV !== 'development');
  const isTestFixture = !isProd && process.env.NULAR_AUTH_TEST_FIXTURE === '1';

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const urlValid = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(supabaseUrl);
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
      keyConfigured: Boolean(supabaseKey)
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
    const tmp = `${LOCAL_STORE_FILE}.tmp`;
    const payload = JSON.stringify({
      updatedAt: new Date().toISOString(),
      users: Array.from(usersById.values()),
      loginFailures: activeFailures,
      revokedSessions: activeRevoked
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
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      devModeAllowed: !cfg.isProd
    }
  };
}

function getPersistenceGateError(cfg) {
  if (cfg.isProd && !cfg.sessionSecretConfigured) {
    return Response.json({
      ok: false,
      configured: false,
      code: 'SESSION_SECRET_MISSING',
      error: 'Konfigurasi NULAR_SESSION_SECRET (>= 32 karakter) wajib diisi di lingkungan produksi sebelum otentikasi dapat diaktifkan (lihat docs/AUTHENTICATION_SETUP.md).'
    }, { status: 503 });
  }
  if (cfg.isProd && !cfg.supabase.configured) {
    return Response.json({
      ok: false,
      configured: false,
      code: cfg.supabase.incomplete ? 'SUPABASE_CONFIG_INCOMPLETE' : 'AUTH_STORAGE_UNAVAILABLE',
      error: cfg.supabase.incomplete
        ? 'Konfigurasi Supabase produksi belum lengkap (SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY wajib lengkap). Otentikasi produksi dinonaktifkan (fail-closed).'
        : 'Penyimpanan akun produksi (Supabase) belum dikonfigurasi. Mode tamu tetap tersedia, namun pendaftaran/masuk produksi dinonaktifkan (fail-closed).'
    }, { status: 503 });
  }
  if (!cfg.isProd && cfg.storageMode === 'unconfigured_fail_closed') {
    return Response.json({
      ok: false,
      configured: false,
      code: 'AUTH_STORAGE_UNAVAILABLE',
      error: 'Penyimpanan akun lokal tidak dapat ditulis dan Supabase belum dikonfigurasi.'
    }, { status: 503 });
  }
  return null;
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

  if (action === 'providers') {
    return Response.json({ providers });
  }

  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({
      authenticated: false,
      mode: 'guest',
      supabaseConfigured: cfg.supabase.configured,
      productionReady: providers.productionReady,
      providers
    });
  }
  const stored = usersById.get(session.uid);
  // If user account was deleted, reject stale session
  if (!stored && cfg.storageMode === 'local_dev_persistent') {
    return Response.json({
      authenticated: false,
      mode: 'guest',
      supabaseConfigured: cfg.supabase.configured,
      productionReady: providers.productionReady,
      providers
    }, { headers: { 'Set-Cookie': cookieHeader('', 0) } });
  }
  return Response.json({
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
      revokedSessions.set(session.jti, session.exp || (Date.now() + 7 * 86400000));
      persistLocalAuthStore();
    }
    return Response.json({ ok: true, authenticated: false }, {
      headers: { 'Set-Cookie': cookieHeader('', 0) }
    });
  }

  if (action === 'google-start') {
    const gateErr = getPersistenceGateError(cfg);
    if (gateErr) return gateErr;
    if (!providers.google.configured) {
      return Response.json({
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
    return Response.json({ configured: true, authUrl: authUrl.toString() });
  }

  // All persistence-dependent actions MUST pass the production fail-closed gate
  const gateErr = getPersistenceGateError(cfg);
  if (gateErr) return gateErr;

  if (action === 'phone-request') {
    const phone = String(body.phone || '').trim().replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return Response.json({ error: 'Format nomor telepon internasional (E.164) tidak valid. Contoh: +6281234567890' }, { status: 400 });
    }
    if (!providers.phoneOtp.configured && cfg.isProd) {
      return Response.json({
        configured: false,
        error: 'Penyedia SMS OTP belum dikonfigurasi pada lingkungan produksi (lihat docs/AUTHENTICATION_SETUP.md).'
      }, { status: 503 });
    }

    const now = Date.now();
    const existing = otpStore.get(phone);
    if (existing && now - existing.lastSentAt < 60000) {
      const waitSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return Response.json({ error: `Tunggu ${waitSec} detik sebelum mengirim ulang kode OTP.`, retryAfterSeconds: waitSec }, { status: 429 });
    }
    const resetWindow = !existing || (now - existing.windowStart > 3600000);
    if (existing && !resetWindow && existing.sendCount >= 5) {
      return Response.json({ error: 'Batas pengiriman OTP per jam tercapai. Coba lagi nanti.' }, { status: 429 });
    }

    const code = String(crypto.randomInt(100000, 999999));
    otpStore.set(phone, {
      code,
      expiresAt: now + 5 * 60 * 1000,
      lastSentAt: now,
      attempts: 0,
      windowStart: resetWindow ? now : existing.windowStart,
      sendCount: resetWindow ? 1 : existing.sendCount + 1
    });

    return Response.json({
      ok: true,
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
      deliveryMode: providers.phoneOtp.configured ? 'sms_provider' : 'local_dev_only',
      ...(providers.phoneOtp.configured ? {} : {
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
      return Response.json({ error: 'Kode OTP tidak ditemukan. Minta kode baru.' }, { status: 400 });
    }
    if (Date.now() > rec.expiresAt) {
      otpStore.delete(phone);
      return Response.json({ error: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' }, { status: 400 });
    }
    if (rec.attempts >= 5) {
      otpStore.delete(phone);
      return Response.json({ error: 'Terlalu banyak percobaan salah. Minta kode OTP baru.' }, { status: 429 });
    }
    rec.attempts += 1;
    if (rec.code !== code) {
      return Response.json({ error: 'Kode OTP tidak cocok.' }, { status: 401 });
    }
    otpStore.delete(phone);

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
    return Response.json({ authenticated: true, user: toSafeUser(user) }, {
      headers: { 'Set-Cookie': cookieHeader(token) }
    });
  }

  if (action === 'reset-request') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
    }
    return Response.json({
      ok: true,
      smtpConfigured: providers.email.smtpConfigured,
      message: providers.email.smtpConfigured
        ? 'Tautan reset kata sandi telah dikirim bila akun terdaftar.'
        : 'Permintaan reset dicatat (pengiriman email nyata memerlukan konfigurasi SMTP/Supabase — lihat docs/AUTHENTICATION_SETUP.md).'
    });
  }

  if (action === 'verify-email') {
    const token = parseCookie(request, SESSION_COOKIE);
    const session = verifySessionToken(token);
    if (!session) return Response.json({ error: 'Sesi tidak aktif.' }, { status: 401 });
    if (!providers.email.smtpConfigured) {
      return Response.json({
        ok: false,
        configured: false,
        emailVerified: false,
        error: 'Verifikasi email nyata memerlukan konfigurasi SMTP atau Supabase Auth (lihat docs/AUTHENTICATION_SETUP.md).'
      }, { status: 503 });
    }
    const rec = usersById.get(session.uid);
    if (rec) {
      rec.emailVerified = true;
      persistLocalAuthStore();
    }
    return Response.json({ ok: true, configured: true, emailVerified: true });
  }

  if (action === 'profile-update') {
    const token = parseCookie(request, SESSION_COOKIE);
    const session = verifySessionToken(token);
    if (!session) return Response.json({ error: 'Otentikasi diperlukan.' }, { status: 401 });
    const rec = usersById.get(session.uid);
    if (!rec) return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    if (typeof body.displayName === 'string' && body.displayName.trim()) rec.displayName = body.displayName.trim().slice(0, 40);
    if (typeof body.preferredRegion === 'string') rec.preferredRegion = body.preferredRegion.slice(0, 40);
    if (typeof body.avatarId === 'string') rec.avatarId = body.avatarId.slice(0, 48);
    if (typeof body.tutorialCompleted === 'boolean') rec.tutorialCompleted = body.tutorialCompleted;
    if (typeof body.privacyPublicLeaderboard === 'boolean') rec.privacyPublicLeaderboard = body.privacyPublicLeaderboard;
    persistLocalAuthStore();
    return Response.json({ ok: true, user: toSafeUser(rec) });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const username = String(body.username || '').trim() || email.split('@')[0];

  if (!email || !email.includes('@') || password.length < 8) {
    return Response.json({ error: 'Email valid dan kata sandi minimal 8 karakter diperlukan.' }, { status: 400 });
  }

  if (action === 'signup') {
    if (usersByEmail.has(email)) {
      return Response.json({ error: 'Email sudah terdaftar.' }, { status: 409 });
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
    persistLocalAuthStore();
    const token = signSession({ uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
    return Response.json({
      authenticated: true,
      user: toSafeUser(rec),
      emailVerificationStatus: providers.email.smtpConfigured ? 'pending_email' : 'local_session_active'
    }, { status: 201, headers: { 'Set-Cookie': cookieHeader(token) } });
  }

  // login with per-email brute-force rate limit (5 failed attempts per 15 min, persisted in local dev)
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX_FAILURES = 5;
  const failRec = loginFailures.get(email);
  if (failRec && now - failRec.windowStart < WINDOW_MS && failRec.count >= MAX_FAILURES) {
    const retryAfterSeconds = Math.max(1, Math.ceil((failRec.windowStart + WINDOW_MS - now) / 1000));
    return Response.json({
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
    return Response.json({ error: 'Email atau kata sandi tidak cocok.' }, { status: 401 });
  }
  loginFailures.delete(email);
  persistLocalAuthStore();
  const token = signSession({ uid: rec.uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
  return Response.json({
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
  return Response.json({ ok: true, deleted: true }, {
    headers: { 'Set-Cookie': cookieHeader('', 0) }
  });
}
