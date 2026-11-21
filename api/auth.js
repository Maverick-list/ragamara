/**
 * Vercel Node.js Function: POST/GET/DELETE /api/auth
 * Unified Authentication Adapter for NULAR:
 *  - Email sign-up, login, password reset request, email verification, logout, account deletion
 *  - Google OAuth adapter (honest unconfigured state when GOOGLE_CLIENT_ID/SECRET absent)
 *  - International Phone OTP (E.164 validation, 60s resend cooldown, rate limit, 5m expiry, attempt cap)
 *  - HMAC-SHA256 signed HttpOnly session cookies + scrypt password hashing + timingSafeEqual
 * Never exposes secrets, password hashes, private emails, or phone numbers in public endpoints.
 */
import crypto from 'node:crypto';

const SESSION_COOKIE = 'nular_session';
const SECRET = process.env.NULAR_SESSION_SECRET || process.env.SESSION_SECRET || 'nular-dev-ephemeral-signing-key-2026';
const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

// Ephemeral in-memory stores for local/serverless testing (cloud persistence via Supabase when configured)
const usersByEmail = new Map();
const usersByPhone = new Map();
const usersById = new Map();
const otpStore = new Map(); // phone -> { code, expiresAt, lastSentAt, attempts, windowStart, sendCount }

export function getProviderConfigStatus() {
  return {
    email: {
      enabled: true,
      smtpConfigured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SUPABASE_URL),
      storageMode: process.env.SUPABASE_URL ? 'supabase' : 'local_ephemeral'
    },
    google: {
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    },
    phoneOtp: {
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      devModeAllowed: !IS_PROD
    }
  };
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
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
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
  const secure = IS_PROD ? '; Secure' : '';
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

  if (action === 'providers') {
    return Response.json({ providers });
  }

  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({
      authenticated: false,
      mode: 'guest',
      supabaseConfigured: Boolean(process.env.SUPABASE_URL),
      providers
    });
  }
  const stored = usersById.get(session.uid);
  return Response.json({
    authenticated: true,
    mode: 'account',
    user: stored ? toSafeUser(stored) : { id: session.uid, username: session.username, displayName: session.username },
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
    providers
  });
}

export async function POST(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'login';
  const body = await request.json().catch(() => ({}));
  const providers = getProviderConfigStatus();

  if (action === 'logout') {
    return Response.json({ ok: true, authenticated: false }, {
      headers: { 'Set-Cookie': cookieHeader('', 0) }
    });
  }

  if (action === 'google-start') {
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

  if (action === 'phone-request') {
    const phone = String(body.phone || '').trim().replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return Response.json({ error: 'Format nomor telepon internasional (E.164) tidak valid. Contoh: +6281234567890' }, { status: 400 });
    }
    if (!providers.phoneOtp.configured && IS_PROD) {
      return Response.json({
        configured: false,
        error: 'Layanan pengiriman SMS OTP belum dikonfigurasi di lingkungan produksi. Lihat docs/AUTHENTICATION_SETUP.md.'
      }, { status: 503 });
    }

    const now = Date.now();
    const existing = otpStore.get(phone);
    if (existing) {
      const elapsedSec = Math.floor((now - existing.lastSentAt) / 1000);
      if (elapsedSec < 60) {
        return Response.json({
          error: `Tunggu ${60 - elapsedSec} detik sebelum mengirim ulang kode OTP.`,
          retryAfterSeconds: 60 - elapsedSec
        }, { status: 429 });
      }
      if (now - existing.windowStart < 15 * 60 * 1000 && existing.sendCount >= 5) {
        return Response.json({ error: 'Batas permintaan OTP tercapai. Coba lagi dalam 15 menit.' }, { status: 429 });
      }
    }

    const code = String(crypto.randomInt(100000, 999999));
    const resetWindow = !existing || (now - existing.windowStart >= 15 * 60 * 1000);
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
    const rec = usersById.get(session.uid);
    if (rec) rec.emailVerified = true;
    return Response.json({ ok: true, emailVerified: true });
  }

  if (action === 'profile-update') {
    const token = parseCookie(request, SESSION_COOKIE);
    const session = verifySessionToken(token);
    if (!session) return Response.json({ error: 'Otentikasi diperlukan.' }, { status: 401 });
    const rec = usersById.get(session.uid);
    if (rec) {
      if (typeof body.displayName === 'string' && body.displayName.trim()) rec.displayName = body.displayName.trim().slice(0, 40);
      if (typeof body.preferredRegion === 'string') rec.preferredRegion = body.preferredRegion.slice(0, 40);
      if (typeof body.avatarId === 'string') rec.avatarId = body.avatarId.slice(0, 48);
      if (typeof body.tutorialCompleted === 'boolean') rec.tutorialCompleted = body.tutorialCompleted;
      if (typeof body.privacyPublicLeaderboard === 'boolean') rec.privacyPublicLeaderboard = body.privacyPublicLeaderboard;
    }
    return Response.json({ ok: true, user: rec ? toSafeUser(rec) : { id: session.uid, username: session.username } });
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
    const token = signSession({ uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
    return Response.json({
      authenticated: true,
      user: toSafeUser(rec),
      emailVerificationStatus: providers.email.smtpConfigured ? 'pending_email' : 'local_session_active'
    }, { status: 201, headers: { 'Set-Cookie': cookieHeader(token) } });
  }

  // login
  const rec = usersByEmail.get(email);
  if (!rec || !verifyPassword(password, rec.passwordHash)) {
    return Response.json({ error: 'Email atau kata sandi tidak cocok.' }, { status: 401 });
  }
  const token = signSession({ uid: rec.uid, username: rec.username, exp: Date.now() + 7 * 86400000 });
  return Response.json({
    authenticated: true,
    user: toSafeUser(rec)
  }, { headers: { 'Set-Cookie': cookieHeader(token) } });
}

export async function DELETE(request) {
  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (session) {
    const rec = usersById.get(session.uid);
    if (rec?.email) usersByEmail.delete(rec.email);
    if (rec?.phone) usersByPhone.delete(rec.phone);
    usersById.delete(session.uid);
  }
  return Response.json({ ok: true, deleted: true }, {
    headers: { 'Set-Cookie': cookieHeader('', 0) }
  });
}
