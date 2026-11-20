/**
 * NULAR Living Archipelago — ExplorationState (js/world/ExplorationState.js)
 * Non-gamified cultural world exploration state synchronized with MuseumStore (localStorage).
 * Tracks selected avatar outfit, visited houses, discovered interior rooms, inspected components,
 * and optional educational discovery missions.
 */
import { MuseumStore } from '../museum-store.js';

const WORLD_KEY = 'nular_world_v1';

function loadWorldRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(WORLD_KEY) || 'null');
    return {
      selectedAvatarId: raw?.selectedAvatarId || 'batik-parang-solo',
      visitedRooms: raw?.visitedRooms || {},       // { houseId: [roomId] }
      discoveredComponents: raw?.discoveredComponents || {}, // { houseId: [compId] }
      completedMissions: raw?.completedMissions || []
    };
  } catch {
    return { selectedAvatarId: 'batik-parang-solo', visitedRooms: {}, discoveredComponents: {}, completedMissions: [] };
  }
}

function saveWorldRaw(data) {
  try { localStorage.setItem(WORLD_KEY, JSON.stringify(data)); } catch { /* quota fallback */ }
}

export class ExplorationState {
  constructor() {
    this.state = loadWorldRaw();
  }

  getSelectedAvatar() {
    return this.state.selectedAvatarId;
  }

  setSelectedAvatar(avatarId) {
    this.state.selectedAvatarId = avatarId;
    saveWorldRaw(this.state);
  }

  recordHouseVisit(houseId) {
    MuseumStore.recordHouseVisit(houseId);
  }

  recordRoomVisit(houseId, roomId) {
    if (!houseId || !roomId) return false;
    const list = this.state.visitedRooms[houseId] || [];
    if (list.includes(roomId)) return false;
    list.push(roomId);
    this.state.visitedRooms[houseId] = list;
    saveWorldRaw(this.state);
    return true;
  }

  recordComponentInspected(houseId, compId) {
    if (!houseId || !compId) return false;
    const list = this.state.discoveredComponents[houseId] || [];
    if (!list.includes(compId)) {
      list.push(compId);
      this.state.discoveredComponents[houseId] = list;
      saveWorldRaw(this.state);
    }
    MuseumStore.recordComponentInspection(houseId, compId);
    return true;
  }

  getMissionStatus(houseId, totalComponents = 3) {
    const visitedRooms = (this.state.visitedRooms[houseId] || []).length;
    const inspected = (this.state.discoveredComponents[houseId] || []).length;
    const targetComp = Math.min(3, Math.max(1, totalComponents));
    return {
      enteredInterior: visitedRooms > 0,
      inspectedCount: inspected,
      targetComponents: targetComp,
      completed: visitedRooms > 0 && inspected >= targetComp
    };
  }
}
