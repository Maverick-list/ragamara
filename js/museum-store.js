/**
 * NULAR — Nusa Learn Exploration Journal Store (js/museum-store.js)
 * Non-gamified personal cultural exploration persistence.
 *
 * Preserves legacy display name & bio from `ragamara_ecosystem_v2` or `ragamara_player_state`
 * on first visit without deleting legacy keys or introducing XP, gems, streaks, or leaderboards.
 */

const STORAGE_KEY = 'nular_museum_v1';

function createDefaultState() {
  let migratedName = 'Penjelajah Arsitektur';
  let migratedBio = 'Mendokumentasikan dan mempelajari arsitektur vernakular tradisional Nusantara.';

  try {
    const legacyV2 = JSON.parse(localStorage.getItem('ragamara_ecosystem_v2') || 'null');
    const legacyPlayer = legacyV2?.player || JSON.parse(localStorage.getItem('ragamara_player_state') || 'null');
    if (legacyPlayer?.name && typeof legacyPlayer.name === 'string') {
      migratedName = legacyPlayer.name;
    }
    if (legacyPlayer?.bio && typeof legacyPlayer.bio === 'string') {
      migratedBio = legacyPlayer.bio;
    }
  } catch {
    // Ignore unreadable legacy state safely
  }

  return {
    schemaVersion: '1.0.0',
    profile: {
      name: migratedName,
      bio: migratedBio,
      favoriteRegions: []
    },
    savedHouseIds: [],
    savedExhibits: [], // [{ id, type, title, subtitle, href, savedAt }]
    exhibitionProgress: {}, // { [exhibitionId]: { visitedChapters: [], completed: false, completedAt: null, xpClaimed: false } }
    exploredHistory: [], // [{ houseId, visitedAt, inspectedComponents: [] }]
    comparedPairsCount: 0,
    personalNotes: {}, // { [houseId]: { text, updatedAt } }
    comparisonIds: ['rumah-gadang', 'tongkonan-toraja']
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      saveState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultState(),
      ...parsed,
      profile: { ...createDefaultState().profile, ...(parsed.profile || {}) }
    };
  } catch {
    const fallback = createDefaultState();
    saveState(fallback);
    return fallback;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or private mode fallback
  }
}

export const MuseumStore = {
  getState() {
    return loadState();
  },

  updateProfile({ name, bio }) {
    const state = loadState();
    if (typeof name === 'string' && name.trim()) state.profile.name = name.trim().slice(0, 80);
    if (typeof bio === 'string') state.profile.bio = bio.trim().slice(0, 280);
    saveState(state);
    return state;
  },

  toggleSavedHouse(houseId) {
    const state = loadState();
    const idx = state.savedHouseIds.indexOf(houseId);
    let saved = false;
    if (idx === -1) {
      state.savedHouseIds.unshift(houseId);
      saved = true;
    } else {
      state.savedHouseIds.splice(idx, 1);
      saved = false;
    }
    saveState(state);
    window.dispatchEvent(new CustomEvent('nular:store-updated', { detail: state }));
    return saved;
  },

  isHouseSaved(houseId) {
    return loadState().savedHouseIds.includes(houseId);
  },

  toggleSavedExhibit(exhibit) {
    if (!exhibit?.id) return false;
    const state = loadState();
    if (!Array.isArray(state.savedExhibits)) state.savedExhibits = [];
    const idx = state.savedExhibits.findIndex((item) => item.id === exhibit.id);
    let saved = false;
    if (idx === -1) {
      state.savedExhibits.unshift({
        id: String(exhibit.id),
        type: String(exhibit.type || 'exhibit'),
        title: String(exhibit.title || exhibit.id),
        subtitle: String(exhibit.subtitle || ''),
        href: String(exhibit.href || 'exhibitions.html'),
        savedAt: new Date().toISOString()
      });
      saved = true;
    } else {
      state.savedExhibits.splice(idx, 1);
      saved = false;
    }
    saveState(state);
    window.dispatchEvent(new CustomEvent('nular:store-updated', { detail: state }));
    return saved;
  },

  isExhibitSaved(id) {
    const state = loadState();
    return Array.isArray(state.savedExhibits) && state.savedExhibits.some((item) => item.id === id);
  },

  getSavedExhibits() {
    const state = loadState();
    return Array.isArray(state.savedExhibits) ? state.savedExhibits : [];
  },

  recordExhibitionChapter(exhibitionId, chapterId) {
    if (!exhibitionId || !chapterId) return null;
    const state = loadState();
    if (!state.exhibitionProgress || typeof state.exhibitionProgress !== 'object') {
      state.exhibitionProgress = {};
    }
    const entry = state.exhibitionProgress[exhibitionId] || {
      visitedChapters: [],
      completed: false,
      completedAt: null,
      xpClaimed: false
    };
    if (!entry.visitedChapters.includes(chapterId)) {
      entry.visitedChapters.push(chapterId);
    }
    state.exhibitionProgress[exhibitionId] = entry;
    saveState(state);
    return entry;
  },

  markExhibitionCompleted(exhibitionId, xpClaimed = false) {
    if (!exhibitionId) return null;
    const state = loadState();
    if (!state.exhibitionProgress || typeof state.exhibitionProgress !== 'object') {
      state.exhibitionProgress = {};
    }
    const entry = state.exhibitionProgress[exhibitionId] || {
      visitedChapters: [],
      completed: false,
      completedAt: null,
      xpClaimed: false
    };
    entry.completed = true;
    entry.completedAt = entry.completedAt || new Date().toISOString();
    if (xpClaimed) entry.xpClaimed = true;
    state.exhibitionProgress[exhibitionId] = entry;
    saveState(state);
    window.dispatchEvent(new CustomEvent('nular:store-updated', { detail: state }));
    return entry;
  },

  getExhibitionProgress(exhibitionId) {
    const state = loadState();
    return (state.exhibitionProgress && state.exhibitionProgress[exhibitionId]) || {
      visitedChapters: [],
      completed: false,
      completedAt: null,
      xpClaimed: false
    };
  },

  toggleFavoriteRegion(islandName) {
    const state = loadState();
    const idx = state.profile.favoriteRegions.indexOf(islandName);
    if (idx === -1) state.profile.favoriteRegions.push(islandName);
    else state.profile.favoriteRegions.splice(idx, 1);
    saveState(state);
    return state.profile.favoriteRegions;
  },

  recordHouseVisit(houseId) {
    if (!houseId) return;
    const state = loadState();
    const existing = state.exploredHistory.find((entry) => entry.houseId === houseId);
    const now = new Date().toISOString();
    if (existing) {
      existing.visitedAt = now;
      state.exploredHistory = [
        existing,
        ...state.exploredHistory.filter((entry) => entry.houseId !== houseId)
      ];
    } else {
      state.exploredHistory.unshift({
        houseId,
        visitedAt: now,
        inspectedComponents: []
      });
    }
    state.exploredHistory = state.exploredHistory.slice(0, 50);
    saveState(state);
    window.dispatchEvent(new CustomEvent('nular:store-updated', { detail: state }));
  },

  recordComponentInspection(houseId, componentId) {
    if (!houseId || !componentId) return;
    const state = loadState();
    let entry = state.exploredHistory.find((e) => e.houseId === houseId);
    if (!entry) {
      entry = { houseId, visitedAt: new Date().toISOString(), inspectedComponents: [] };
      state.exploredHistory.unshift(entry);
    }
    if (!entry.inspectedComponents.includes(componentId)) {
      entry.inspectedComponents.push(componentId);
    }
    saveState(state);
  },

  saveNote(houseId, text) {
    const state = loadState();
    const trimmed = (text || '').trim();
    if (!trimmed) {
      delete state.personalNotes[houseId];
    } else {
      state.personalNotes[houseId] = {
        text: trimmed.slice(0, 1200),
        updatedAt: new Date().toISOString()
      };
    }
    saveState(state);
    return state.personalNotes[houseId] || null;
  },

  getNote(houseId) {
    return loadState().personalNotes[houseId]?.text || '';
  },

  setComparisonIds(idA, idB) {
    const state = loadState();
    state.comparisonIds = [idA, idB];
    state.comparedPairsCount = (state.comparedPairsCount || 0) + 1;
    saveState(state);
  },

  /**
   * Meaningful non-gamified discovery milestones derived purely from cultural exploration.
   */
  getDiscoveryMilestones(houses) {
    const state = loadState();
    const houseMap = new Map(houses.map((h) => [h.id, h]));
    const visitedHouses = state.exploredHistory
      .map((e) => houseMap.get(e.houseId))
      .filter(Boolean);

    const visitedIslands = new Set(visitedHouses.map((h) => h.island));
    const inspected3DComponents = state.exploredHistory.reduce(
      (sum, e) => sum + (e.inspectedComponents?.length || 0),
      0
    );
    const notesCount = Object.keys(state.personalNotes || {}).length;

    return [
      {
        id: 'first-visit',
        title: 'Langkah Pertama di Atlas Arsitektur',
        description: 'Mengunjungi dan mempelajari entri rumah tradisional pertama di NULAR.',
        achieved: visitedHouses.length >= 1,
        progressLabel: `${Math.min(visitedHouses.length, 1)} / 1 bangunan`
      },
      {
        id: 'three-islands',
        title: 'Menjelajahi Tiga Wilayah Kepulauan',
        description: 'Mempelajari tradisi arsitektur dari sedikitnya tiga pulau besar Nusantara.',
        achieved: visitedIslands.size >= 3,
        progressLabel: `${visitedIslands.size} / 3 pulau`
      },
      {
        id: 'five-islands',
        title: 'Penjelajah Lima Pulau Nusantara',
        description: 'Menelusuri keragaman rumah tradisional melintasi lima wilayah kepulauan Indonesia.',
        achieved: visitedIslands.size >= 5,
        progressLabel: `${visitedIslands.size} / 5 pulau`
      },
      {
        id: 'anatomy-3d',
        title: 'Pengamat Anatomi Bangunan 3D',
        description: 'Menginspeksi minimal 3 komponen struktural secara langsung pada penampil 3D.',
        achieved: inspected3DComponents >= 3,
        progressLabel: `${inspected3DComponents} / 3 komponen`
      },
      {
        id: 'saved-curator',
        title: 'Kurator Koleksi Pribadi',
        description: 'Menyimpan minimal 2 rumah tradisional atau menulis catatan studi arsitektur.',
        achieved: state.savedHouseIds.length >= 2 || notesCount >= 1,
        progressLabel: `${state.savedHouseIds.length} tersimpan · ${notesCount} catatan`
      }
    ];
  }
};
