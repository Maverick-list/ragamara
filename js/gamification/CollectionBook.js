/**
 * NULAR — Digital Cultural Collection Book (js/gamification/CollectionBook.js)
 * Persists discovered houses, architectural components, textiles, batik, food,
 * musical instruments, crafts, and vehicles with timestamps & verified references.
 */
import { ProgressionEngine } from './ProgressionEngine.js';

const STORAGE_KEY = 'nular_collection_book_v1';

export const CollectionBook = {
  getAll() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  has(id) {
    return this.getAll().some((entry) => entry.id === id);
  },

  collect(item) {
    if (!item || !item.id) return { collected: false, duplicate: true };
    const entries = this.getAll();
    const existing = entries.find((e) => e.id === item.id);
    if (existing) return { collected: false, duplicate: true, entry: existing, total: entries.length };

    const entry = {
      id: item.id,
      name: item.name || item.title || item.houseName || item.id,
      category: item.category || 'heritage',
      region: item.province || item.regionId || item.region || 'Nusantara',
      description: item.description || item.culturalMeaning || '',
      sources: item.sources || [],
      attribution: item.attribution || 'NULAR Cultural Archive',
      discoveredAt: new Date().toISOString(),
      status: 'collected'
    };

    entries.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('nular:collection-updated', { detail: { entry, total: entries.length } }));

    // Award server-authoritative XP (deduplicated via deterministic eventKey)
    ProgressionEngine.recordEvent({
      eventKey: `collect:${entry.id}`,
      activityType: 'discover_item',
      itemId: entry.id,
      label: `Koleksi: ${entry.name}`
    }).catch(() => {});

    return { collected: true, duplicate: false, entry, total: entries.length };
  },

  getSummary() {
    const all = this.getAll();
    const byCategory = {};
    for (const item of all) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    }
    return { total: all.length, byCategory, items: all };
  }
};
