/**
 * Vercel Node.js Function: POST/GET /api/progress
 * Server-authoritative XP, level, daily streak, and anti-abuse idempotency engine.
 * NEVER trusts client-submitted XP amounts; always computes XP from server XP_TABLE.
 */
import { parseCookie, verifySessionToken } from './auth.js';

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

// In-memory store per warm serverless instance (cloud-backed when Supabase is configured)
export const playerProgressStore = new Map();

function getActorKey(request, body = {}) {
  const token = parseCookie(request, 'nular_session');
  const session = verifySessionToken(token);
  if (session) return { key: `user:${session.uid}`, username: session.username, authenticated: true };
  const guestId = String(body.guestId || request.headers.get('x-nular-guest') || 'guest-local').slice(0, 48);
  return { key: `guest:${guestId}`, username: 'Tamu Nusantara', authenticated: false };
}

function getDateKey(tz = 'Asia/Jakarta') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function GET(request) {
  const actor = getActorKey(request);
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
  return Response.json({
    authenticated: actor.authenticated,
    username: rec.username,
    xp: rec.xp,
    ...lvl,
    missionsCompleted: rec.missionsCompleted,
    discoveriesCount: rec.discoveriesCount,
    streakDays: rec.streakDays
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const actor = getActorKey(request, body);
  const activityType = String(body.activityType || '');
  const eventKey = String(body.eventKey || '').trim().slice(0, 120);
  const tz = String(body.timezone || 'Asia/Jakarta');

  if (!Object.prototype.hasOwnProperty.call(XP_TABLE, activityType)) {
    return Response.json({ error: 'Jenis aktivitas XP tidak valid.' }, { status: 400 });
  }
  if (!eventKey) {
    return Response.json({ error: 'eventKey idempotensi wajib disertakan.' }, { status: 400 });
  }

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
    return Response.json({
      duplicate: true,
      xpAwarded: 0,
      xp: rec.xp,
      ...lvl,
      streakDays: rec.streakDays
    });
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

  const lvl = computeLevelFromXp(rec.xp);
  return Response.json({
    duplicate: false,
    xpAwarded,
    xp: rec.xp,
    ...lvl,
    missionsCompleted: rec.missionsCompleted,
    discoveriesCount: rec.discoveriesCount,
    streakDays: rec.streakDays
  });
}
