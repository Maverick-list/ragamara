/**
 * NULAR — Client Gamification & Progression Engine (js/gamification/ProgressionEngine.js)
 * Coordinates server-validated XP events via /api/progress, local fallback persistence,
 * achievement unlocking, mission completion tracking, and cinematic XP/Achievement toasts.
 */
const PROG_KEY = 'nular_progression_v1';
const GUEST_ID_KEY = 'nular_guest_id_v1';

const XP_TABLE = {
  discover_item: 10,
  read_article: 15,
  complete_mission: 30,
  complete_collection: 100,
  finish_quiz: 20,
  inspect_detail: 10
};

const LEVEL_TITLES = [
  'New Explorer',
  'Cultural Seeker',
  'Heritage Adventurer',
  'Nusantara Discoverer',
  'Cultural Scholar',
  'Master Nusantara Archivist'
];

function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `g_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function computeLevel(xp) {
  let level = 1;
  let rem = Math.max(0, xp);
  while (rem >= Math.round(100 * Math.pow(level, 1.5))) {
    rem -= Math.round(100 * Math.pow(level, 1.5));
    level++;
  }
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xpIntoLevel: rem,
    xpForNextLevel: Math.round(100 * Math.pow(level, 1.5))
  };
}

function showToast(html) {
  let stack = document.querySelector('.nular-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'nular-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = 'nular-toast';
  toast.innerHTML = html;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

export const ProgressionEngine = {
  getState() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROG_KEY) || 'null');
      if (raw) return raw;
    } catch {}
    return {
      xp: 0,
      level: 1,
      title: 'New Explorer',
      xpIntoLevel: 0,
      xpForNextLevel: 100,
      streakDays: 0,
      lastActiveDate: null,
      eventKeys: [],
      discoveredIds: [],
      completedMissionIds: [],
      unlockedAchievementIds: [],
      missionsCompleted: 0
    };
  },

  saveState(st) {
    localStorage.setItem(PROG_KEY, JSON.stringify(st));
    window.dispatchEvent(new CustomEvent('nular:progression-updated', { detail: st }));
  },

  async recordEvent({ eventKey, activityType, itemId = null, missionId = null, label = '' }) {
    const st = this.getState();
    if (!eventKey || st.eventKeys.includes(eventKey)) {
      return { duplicate: true, xpAwarded: 0, state: st };
    }

    const prevLevel = st.level || 1;
    let xpAwarded = XP_TABLE[activityType] || 0;

    // Attempt server-authoritative validation via /api/progress
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
      const res = await fetch('./api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey, activityType, guestId: getGuestId(), timezone: tz })
      });
      if (res.ok) {
        const srv = await res.json();
        if (srv.duplicate) return { duplicate: true, xpAwarded: 0, state: st };
        xpAwarded = srv.xpAwarded;
      }
    } catch {}

    st.eventKeys.push(eventKey);
    st.xp += xpAwarded;
    if (itemId && !st.discoveredIds.includes(itemId)) st.discoveredIds.push(itemId);
    if (missionId && !st.completedMissionIds.includes(missionId)) {
      st.completedMissionIds.push(missionId);
      st.missionsCompleted = st.completedMissionIds.length;
    }

    // Timezone-safe local streak sync
    const today = new Date().toISOString().slice(0, 10);
    if (st.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      st.streakDays = st.lastActiveDate === yesterday ? (st.streakDays || 0) + 1 : 1;
      st.lastActiveDate = today;
    }

    const lvl = computeLevel(st.xp);
    st.level = lvl.level;
    st.title = lvl.title;
    st.xpIntoLevel = lvl.xpIntoLevel;
    st.xpForNextLevel = lvl.xpForNextLevel;

    // Evaluate achievements
    await this._evaluateAchievements(st);
    this.saveState(st);

    if (xpAwarded > 0) {
      showToast(`<strong>+${xpAwarded} XP</strong> · ${label || activityType}`);
    }
    if (st.level > prevLevel) {
      showToast(`<strong>Naik Level ${st.level}!</strong> Gelar baru: ${st.title}`);
    }

    return { duplicate: false, xpAwarded, state: st };
  },

  async _evaluateAchievements(st) {
    try {
      const achData = await fetch('./data/achievements.json').then((r) => r.json());
      const store = JSON.parse(localStorage.getItem('nular_museum_v1') || '{}');
      const housesVisited = (store.exploredHistory || []).length;
      const componentsInspected = (store.exploredHistory || []).reduce((acc, h) => acc + (h.inspectedComponents?.length || 0), 0);

      for (const a of achData.achievements || []) {
        if (st.unlockedAchievementIds.includes(a.id)) continue;
        let met = false;
        if (a.rule.type === 'discoveries') met = st.discoveredIds.length >= a.rule.min;
        if (a.rule.type === 'housesVisited') met = housesVisited >= a.rule.min;
        if (a.rule.type === 'componentsInspected') met = componentsInspected >= a.rule.min;
        if (a.rule.type === 'missionsCompleted') met = st.missionsCompleted >= a.rule.min;
        if (a.rule.type === 'xp') met = st.xp >= a.rule.min;
        if (a.rule.type === 'streak') met = (st.streakDays || 0) >= a.rule.min;
        if (met) {
          st.unlockedAchievementIds.push(a.id);
          showToast(`<strong>Pencapaian Terbuka:</strong> ${a.title}`);
        }
      }
    } catch {}
  }
};

window.NularProgression = ProgressionEngine;
