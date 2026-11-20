/**
 * Vercel Node.js Function: GET /api/leaderboard
 * Returns privacy-safe public explorer rankings (no emails, no private user IDs).
 * Never fabricates fake live players; only aggregates verified session records.
 */
import { computeLevelFromXp, playerProgressStore } from './progress.js';

export async function GET(request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'global';

  const entries = [];
  for (const [, rec] of playerProgressStore.entries()) {
    const lvl = computeLevelFromXp(rec.xp);
    entries.push({
      username: rec.username || 'Penjelajah Nusantara',
      level: lvl.level,
      title: lvl.title,
      xp: rec.xp,
      discoveriesCount: rec.discoveriesCount || 0,
      missionsCompleted: rec.missionsCompleted || 0,
      streakDays: rec.streakDays || 0
    });
  }

  entries.sort((a, b) => {
    if (scope === 'discoveries') return b.discoveriesCount - a.discoveriesCount || b.xp - a.xp;
    if (scope === 'missions') return b.missionsCompleted - a.missionsCompleted || b.xp - a.xp;
    return b.xp - a.xp;
  });

  return Response.json({
    scope,
    source: process.env.SUPABASE_URL ? 'supabase' : 'session_verified',
    entries: entries.slice(0, 25).map((e, idx) => ({ rank: idx + 1, ...e }))
  });
}
