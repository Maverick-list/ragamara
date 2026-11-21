/**
 * Vercel Node.js Function: POST/GET /api/progress
 * Server-authoritative XP, level, daily streak, and anti-abuse idempotency engine.
 * Cryptographically signed guest sessions (nular_guest HMAC token with TTL) preventing guest ID spoofing.
 * Durable PostgreSQL / Supabase persistence for authenticated progression in production.
 * Atomic idempotency via public.player_xp_events and stored procedure award_player_xp.
 * NEVER trusts client-submitted XP amounts; always computes XP from server XP_TABLE.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCookie,
  verifySessionToken,
  verifySessionAsync,
  signGuestToken,
  verifyGuestToken,
  getRuntimeConfig,
  sbPostgrest,
  sensitiveHeaders,
  jsonResponse
} from './auth.js';

export const XP_TABLE = {
  discover_item: 10,
  read_article: 15,
  complete_mission: 30,
  complete_collection: 100,
  finish_quiz: 20,
  inspect_detail: 10
};

export const LEVEL_TITLES = [
  'New Explorer',
  'Cultural Seeker',
  'Heritage Adventurer',
  'Nusantara Discoverer',
  'Cultural Scholar',
  'Master Nusantara Archivist'
];

export function computeLevelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (remaining >= Math.round(100 * Math.pow(level, 1.5))) {
    remaining -= Math.round(100 * Math.pow(level, 1.5));
    level++;
  }
  const nextReq = Math.round(100 * Math.pow(level, 1.5));
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xpIntoLevel: remaining,
    xpForNextLevel: nextReq
  };
}

// In-memory store per warm serverless instance (hydrated from disk in local dev, cloud-backed in production)
export const playerProgressStore = new Map();

const LOCAL_STORE_DIR = path.join(process.cwd(), '.nular-local-data');
const LOCAL_PROG_FILE = path.join(LOCAL_STORE_DIR, 'progress-store.json');
let localProgWritable = false;

function hydrateLocalProgressStore() {
  const cfg = getRuntimeConfig();
  if (!cfg.allowLocalFs) {
    localProgWritable = false;
    return;
  }
  try {
    fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true, mode: 0o700 });
    localProgWritable = true;
    if (fs.existsSync(LOCAL_PROG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_PROG_FILE, 'utf8'));
      for (const [key, rec] of Object.entries(parsed.progress || {})) {
        if (!key || !rec) continue;
        playerProgressStore.set(key, {
          username: rec.username,
          xp: rec.xp || 0,
          events: new Set(rec.events || []),
          missionsCompleted: rec.missionsCompleted || 0,
          discoveriesCount: rec.discoveriesCount || 0,
          streakDays: rec.streakDays || 0,
          lastActiveDate: rec.lastActiveDate || null,
          updatedAt: rec.updatedAt || Date.now()
        });
      }
    }
  } catch {
    localProgWritable = false;
  }
}

function persistLocalProgressStore() {
  const cfg = getRuntimeConfig();
  if (!cfg.allowLocalFs || !localProgWritable) return;
  try {
    const raw = {};
    for (const [key, rec] of playerProgressStore.entries()) {
      raw[key] = {
        username: rec.username,
        xp: rec.xp,
        events: Array.from(rec.events || []),
        missionsCompleted: rec.missionsCompleted,
        discoveriesCount: rec.discoveriesCount,
        streakDays: rec.streakDays,
        lastActiveDate: rec.lastActiveDate,
        updatedAt: rec.updatedAt
      };
    }
    const tmp = `${LOCAL_PROG_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), progress: raw }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, LOCAL_PROG_FILE);
  } catch {
    localProgWritable = false;
  }
}

hydrateLocalProgressStore();

const GUEST_COOKIE = 'nular_guest';

async function resolveActor(request, body = {}) {
  // 1. Authenticated session takes absolute precedence
  const sessionToken = parseCookie(request, 'nular_session');
  if (sessionToken) {
    try {
      const { valid, session, error } = await verifySessionAsync(sessionToken);
      if (valid && session) {
        return {
          key: `user:${session.uid}`,
          uid: session.uid,
          username: session.username,
          authenticated: true,
          guestCookieHeader: null
        };
      }
      if (error === 'REVOKED_TOKEN') {
        return {
          error: 'Sesi telah dicabut. Silakan masuk kembali.',
          code: 'SESSION_REVOKED',
          status: 401
        };
      }
    } catch (err) {
      if (err.code === 'DATABASE_OPERATION_FAILED') {
        return {
          error: 'Layanan basis data tidak dapat diakses untuk memvalidasi sesi.',
          code: 'DATABASE_OPERATION_FAILED',
          status: 503
        };
      }
    }
  }

  // 2. Guest identity resolution with HMAC signature verification & expiration check
  const cfg = getRuntimeConfig();
  const rawCookieToken = parseCookie(request, GUEST_COOKIE);
  const rawHeaderToken = request.headers.get('x-nular-guest') || request.headers.get('x-ragamara-guest');
  const candidateToken = rawCookieToken || rawHeaderToken;

  let guestId = null;
  let newGuestToken = null;

  if (candidateToken) {
    const verifiedId = verifyGuestToken(candidateToken);
    if (!verifiedId) {
      return {
        error: 'Token sesi tamu tidak valid atau telah kedaluwarsa.',
        code: 'INVALID_GUEST_SIGNATURE',
        status: 403
      };
    }

    if (body.guestId && String(body.guestId).trim() !== verifiedId) {
      return {
        error: 'Identitas tamu tidak cocok dengan token sesi terverifikasi.',
        code: 'GUEST_ID_MISMATCH',
        status: 403
      };
    }
    guestId = verifiedId;
  } else {
    // SECURITY ENFORCEMENT: Never derive or adopt caller-supplied body.guestId when unauthenticated.
    // Always mint a fresh server-authoritative UUID with signed TTL and set HttpOnly cookie.
    guestId = `g_${crypto.randomUUID()}`;
    newGuestToken = signGuestToken(guestId);
  }

  const secure = cfg.isProd ? '; Secure' : '';
  const guestCookieHeader = newGuestToken
    ? `${GUEST_COOKIE}=${encodeURIComponent(newGuestToken)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=2592000`
    : null;

  return {
    key: `guest:${guestId}`,
    username: 'Tamu Nusantara',
    authenticated: false,
    guestId,
    newGuestToken,
    guestCookieHeader
  };
}

function getDateKey(tz = 'Asia/Jakarta') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function GET(request) {
  const actor = await resolveActor(request);
  if (actor.error) {
    return jsonResponse({ ok: false, error: actor.error, code: actor.code }, { status: actor.status });
  }

  const cfg = getRuntimeConfig();
  const headers = {};
  if (actor.guestCookieHeader) {
    headers['Set-Cookie'] = actor.guestCookieHeader;
  }

  // 1. Authenticated user profile retrieval from PostgreSQL / Supabase
  if (actor.authenticated && cfg.supabase.configured) {
    try {
      const profs = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(actor.uid)}&select=*`);
      const streaks = await sbPostgrest(`daily_streaks?user_id=eq.${encodeURIComponent(actor.uid)}&select=*`).catch(() => []);
      const prof = profs?.[0] || { total_xp: 0, current_level: 1, discoveries_count: 0, missions_completed: 0 };
      const streak = streaks?.[0] || { current_streak: 0 };
      const currentXp = prof.total_xp || 0;
      const lvl = computeLevelFromXp(currentXp);

      return jsonResponse({
        authenticated: true,
        username: prof.username || actor.username,
        xp: currentXp,
        ...lvl,
        missionsCompleted: prof.missions_completed || 0,
        discoveriesCount: prof.discoveries_count || 0,
        streakDays: streak.current_streak || 0
      }, { headers });
    } catch (err) {
      if (cfg.isProd) {
        return jsonResponse({
          ok: false,
          code: 'DATABASE_OPERATION_FAILED',
          error: 'Gagal memuat progres penjelajah dari basis data produksi.'
        }, { status: 503 });
      }
    }
  }

  // 2. Local development / Guest progress retrieval
  const rec = playerProgressStore.get(actor.key) || {
    username: actor.username,
    xp: 0,
    events: new Set(),
    missionsCompleted: 0,
    discoveriesCount: 0,
    streakDays: 0,
    lastActiveDate: null
  };
  const lvl = computeLevelFromXp(rec.xp);

  return jsonResponse({
    authenticated: actor.authenticated,
    username: rec.username,
    xp: rec.xp,
    ...lvl,
    missionsCompleted: rec.missionsCompleted,
    discoveriesCount: rec.discoveriesCount,
    streakDays: rec.streakDays,
    ...(actor.guestId ? { guestId: actor.guestId } : {})
  }, { headers });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const actor = await resolveActor(request, body);
  if (actor.error) {
    return jsonResponse({ ok: false, error: actor.error, code: actor.code }, { status: actor.status });
  }

  const activityType = String(body.activityType || '');
  const eventKey = String(body.eventKey || '').trim().slice(0, 120);
  const tz = String(body.timezone || 'Asia/Jakarta');

  if (!Object.prototype.hasOwnProperty.call(XP_TABLE, activityType)) {
    return jsonResponse({ error: 'Jenis aktivitas XP tidak valid.' }, { status: 400 });
  }
  if (!eventKey) {
    return jsonResponse({ error: 'eventKey idempotensi wajib disertakan.' }, { status: 400 });
  }

  const headers = {};
  if (actor.guestCookieHeader) {
    headers['Set-Cookie'] = actor.guestCookieHeader;
  }

  const cfg = getRuntimeConfig();

  // 1. AUTHENTICATED USER PROGRESSION PERSISTENCE (PostgreSQL / Supabase)
  if (actor.authenticated && cfg.supabase.configured) {
    try {
      // 1.1 Attempt atomic RPC award_player_xp
      let rpcSuccess = false;
      let rpcData = null;
      try {
        const rpcRes = await sbPostgrest('rpc/award_player_xp', {
          method: 'POST',
          body: {
            p_user_id: actor.uid,
            p_activity_type: activityType,
            p_event_key: eventKey,
            p_item_id: body.itemId ? String(body.itemId) : null,
            p_mission_id: body.missionId ? String(body.missionId) : null,
            p_tz: tz
          }
        });
        if (Array.isArray(rpcRes) && rpcRes.length > 0) {
          rpcSuccess = true;
          rpcData = rpcRes[0];
        }
      } catch {
        // Fallback to direct PostgREST table operations if RPC not deployed
      }

      if (rpcSuccess && rpcData) {
        const lvl = computeLevelFromXp(rpcData.total_xp);
        return jsonResponse({
          duplicate: Boolean(rpcData.duplicate),
          xpAwarded: rpcData.xp_awarded,
          xp: rpcData.total_xp,
          ...lvl,
          missionsCompleted: rpcData.missions_completed,
          discoveriesCount: rpcData.discoveries_count,
          streakDays: rpcData.streak_days
        }, { headers });
      }

      // 1.2 Fallback: Direct PostgREST queries
      const existingEvents = await sbPostgrest(`player_xp_events?user_id=eq.${encodeURIComponent(actor.uid)}&event_key=eq.${encodeURIComponent(eventKey)}&select=id`);
      const profs = await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(actor.uid)}&select=*`);
      const prof = profs?.[0] || { total_xp: 0, current_level: 1, discoveries_count: 0, missions_completed: 0 };
      const currentXp = prof.total_xp || 0;
      const lvl = computeLevelFromXp(currentXp);

      if (existingEvents && existingEvents.length > 0) {
        return jsonResponse({
          duplicate: true,
          xpAwarded: 0,
          xp: currentXp,
          ...lvl,
          missionsCompleted: prof.missions_completed || 0,
          discoveriesCount: prof.discoveries_count || 0,
          streakDays: 0
        }, { headers });
      }

      const xpAwarded = XP_TABLE[activityType];
      await sbPostgrest('player_xp_events', {
        method: 'POST',
        body: {
          user_id: actor.uid,
          event_key: eventKey,
          activity_type: activityType,
          xp_awarded: xpAwarded
        }
      });

      const newTotalXp = currentXp + xpAwarded;
      const newLvl = computeLevelFromXp(newTotalXp);
      const discInc = activityType === 'discover_item' ? 1 : 0;
      const missInc = activityType === 'complete_mission' ? 1 : 0;

      await sbPostgrest(`player_profiles?user_id=eq.${encodeURIComponent(actor.uid)}`, {
        method: 'PATCH',
        body: {
          total_xp: newTotalXp,
          current_level: newLvl.level,
          discoveries_count: (prof.discoveries_count || 0) + discInc,
          missions_completed: (prof.missions_completed || 0) + missInc,
          updated_at: new Date().toISOString()
        }
      });

      return jsonResponse({
        duplicate: false,
        xpAwarded,
        xp: newTotalXp,
        ...newLvl,
        missionsCompleted: (prof.missions_completed || 0) + missInc,
        discoveriesCount: (prof.discoveries_count || 0) + discInc,
        streakDays: 1
      }, { headers });
    } catch (err) {
      if (cfg.isProd) {
        return jsonResponse({
          ok: false,
          code: 'DATABASE_OPERATION_FAILED',
          error: 'Gagal memperbarui progres penjelajah ke basis data produksi.'
        }, { status: 503 });
      }
    }
  }

  // 2. LOCAL DEV / TEST FIXTURE PROGRESSION (Local File-Backed or Memory)
  let rec = playerProgressStore.get(actor.key);
  if (!rec) {
    rec = {
      username: actor.username,
      xp: 0,
      events: new Set(),
      missionsCompleted: 0,
      discoveriesCount: 0,
      streakDays: 0,
      lastActiveDate: null,
      updatedAt: Date.now()
    };
    playerProgressStore.set(actor.key, rec);
  }

  // Idempotent anti-farming guard: never award duplicate XP for the same eventKey
  if (rec.events.has(eventKey)) {
    const lvl = computeLevelFromXp(rec.xp);
    return jsonResponse({
      duplicate: true,
      xpAwarded: 0,
      xp: rec.xp,
      ...lvl,
      streakDays: rec.streakDays,
      ...(actor.guestId ? { guestId: actor.guestId } : {})
    }, { headers });
  }

  // Server-authoritative XP lookup (ignores any client-submitted xp field!)
  const xpAwarded = XP_TABLE[activityType];
  rec.events.add(eventKey);
  rec.xp += xpAwarded;
  if (activityType === 'complete_mission') rec.missionsCompleted++;
  if (activityType === 'discover_item') rec.discoveriesCount++;

  // Timezone-consistent daily streak update
  const today = getDateKey(tz);
  if (rec.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    rec.streakDays = rec.lastActiveDate === yesterday ? rec.streakDays + 1 : 1;
    rec.lastActiveDate = today;
  }
  rec.updatedAt = Date.now();
  persistLocalProgressStore();

  const lvl = computeLevelFromXp(rec.xp);
  return jsonResponse({
    duplicate: false,
    xpAwarded,
    xp: rec.xp,
    ...lvl,
    missionsCompleted: rec.missionsCompleted,
    discoveriesCount: rec.discoveriesCount,
    streakDays: rec.streakDays,
    ...(actor.guestId ? { guestId: actor.guestId } : {})
  }, { headers });
}
