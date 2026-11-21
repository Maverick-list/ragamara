/**
 * Vercel Node.js Function: GET /api/leaderboard
 * Returns privacy-safe public explorer rankings (no emails, no private user IDs).
 * Never fabricates fake live players; queries real Supabase profiles or verified session records.
 */
import { computeLevelFromXp, playerProgressStore } from './progress.js';
import { getRuntimeConfig, sbPostgrest, jsonResponse } from './auth.js';

export async function GET(request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'global';
  const cfg = getRuntimeConfig();

  if (cfg.supabase.configured) {
    try {
      let orderClause = 'total_xp.desc';
      if (scope === 'discoveries') orderClause = 'discoveries_count.desc,total_xp.desc';
      else if (scope === 'missions') orderClause = 'missions_completed.desc,total_xp.desc';

      const rows = await sbPostgrest(`player_profiles?is_public=eq.true&order=${orderClause}&limit=25&select=username,current_level,total_xp,discoveries_count,missions_completed`);
      if (Array.isArray(rows)) {
        const entries = rows.map((r, idx) => {
          const lvl = computeLevelFromXp(r.total_xp || 0);
          return {
            rank: idx + 1,
            username: r.username || 'Penjelajah Nusantara',
            level: r.current_level || lvl.level,
            title: lvl.title,
            xp: r.total_xp || 0,
            discoveriesCount: r.discoveries_count || 0,
            missionsCompleted: r.missions_completed || 0,
            streakDays: 0
          };
        });
        return jsonResponse({
          scope,
          source: 'supabase_postgres',
          entries
        });
      }
    } catch (err) {
      if (cfg.isProd) {
        return jsonResponse({
          ok: false,
          code: 'DATABASE_OPERATION_FAILED',
          error: 'Gagal memuat papan peringkat dari basis data produksi.'
        }, { status: 503 });
      }
    }
  }

  // Local development / session store aggregation
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

  return jsonResponse({
    scope,
    source: 'session_verified',
    entries: entries.slice(0, 25).map((e, idx) => ({ rank: idx + 1, ...e }))
  });
}
