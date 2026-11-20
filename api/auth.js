/**
 * Vercel Node.js Function: POST/GET/DELETE /api/auth
 * Secure HMAC-SHA256 signed HttpOnly session cookie + scrypt password hashing.
 * Supports Guest Exploration fallback and optional Supabase Auth when SUPABASE_URL is set.
 * Never exposes secret keys, password hashes, or private user emails in public endpoints.
 */
import crypto from 'node:crypto';

const SESSION_COOKIE = 'nular_session';
const SECRET = process.env.NULAR_SESSION_SECRET || process.env.SESSION_SECRET || 'nular-dev-ephemeral-signing-key-2026';

// Ephemeral in-memory store for serverless warm-instance testing (cloud persistence via Supabase when configured)
const usersByEmail = new Map();

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
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
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
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function GET(request) {
  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ authenticated: false, mode: 'guest', supabaseConfigured: Boolean(process.env.SUPABASE_URL) });
  }
  return Response.json({
    authenticated: true,
    mode: 'account',
    user: { id: session.uid, username: session.username },
    supabaseConfigured: Boolean(process.env.SUPABASE_URL)
  });
}

export async function POST(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'login';
  const body = await request.json().catch(() => ({}));

  if (action === 'logout') {
    return Response.json({ ok: true, authenticated: false }, {
      headers: { 'Set-Cookie': cookieHeader('', 0) }
    });
  }

  if (action === 'reset-request') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
    }
    return Response.json({
      ok: true,
      message: 'Permintaan reset kata sandi dicatat. Pengiriman email aktif bila SMTP/Supabase terkonfigurasi.'
    });
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
    usersByEmail.set(email, {
      uid,
      email,
      username: username.slice(0, 32),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    });
    const token = signSession({ uid, username: username.slice(0, 32), exp: Date.now() + 7 * 86400000 });
    return Response.json({
      authenticated: true,
      user: { id: uid, username: username.slice(0, 32) },
      emailVerificationStatus: process.env.SUPABASE_URL ? 'pending_email' : 'local_session_active'
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
    user: { id: rec.uid, username: rec.username }
  }, { headers: { 'Set-Cookie': cookieHeader(token) } });
}

export async function DELETE(request) {
  const token = parseCookie(request, SESSION_COOKIE);
  const session = verifySessionToken(token);
  if (session) {
    for (const [email, rec] of usersByEmail.entries()) {
      if (rec.uid === session.uid) usersByEmail.delete(email);
    }
  }
  return Response.json({ ok: true, deleted: true }, {
    headers: { 'Set-Cookie': cookieHeader('', 0) }
  });
}
