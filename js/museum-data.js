/**
 * NULAR — Nusa Learn Architectural Data Layer (js/museum-data.js)
 * Loads structured JSON datasets (houses, provinces, architectural stories)
 * and provides search, multi-facet filtering, and relational discovery queries.
 */

let _housesPromise = null;
let _provincesPromise = null;
let _storiesPromise = null;

export async function loadHouses() {
  if (!_housesPromise) {
    _housesPromise = fetch('./data/houses.json').then((res) => {
      if (!res.ok) throw new Error(`Gagal memuat katalog rumah tradisional (HTTP ${res.status})`);
      return res.json();
    });
  }
  return _housesPromise;
}

export async function loadProvinces() {
  if (!_provincesPromise) {
    _provincesPromise = fetch('./data/provinces.json').then((res) => {
      if (!res.ok) throw new Error(`Gagal memuat data wilayah Nusantara (HTTP ${res.status})`);
      return res.json();
    });
  }
  return _provincesPromise;
}

export async function loadStories() {
  if (!_storiesPromise) {
    _storiesPromise = fetch('./data/stories.json').then((res) => {
      if (!res.ok) throw new Error(`Gagal memuat esai arsitektur (HTTP ${res.status})`);
      return res.json();
    });
  }
  return _storiesPromise;
}

export function normalizeQuery(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterHouses(houses, filters = {}) {
  const q = normalizeQuery(filters.search || '');
  return houses.filter((h) => {
    if (filters.island && filters.island !== 'all' && h.island !== filters.island) return false;
    if (filters.province && filters.province !== 'all' && h.province !== filters.province) return false;
    if (filters.community && filters.community !== 'all' && h.culturalCommunity !== filters.community) return false;
    if (filters.type && filters.type !== 'all' && !h.architecturalType.toLowerCase().includes(filters.type.toLowerCase())) return false;
    if (filters.material && filters.material !== 'all') {
      const hasMat = (h.constructionMaterials || []).some((m) =>
        m.toLowerCase().includes(filters.material.toLowerCase())
      );
      if (!hasMat) return false;
    }
    if (filters.modelStatus && filters.modelStatus !== 'all' && h.modelStatus !== filters.modelStatus) return false;

    if (q) {
      const haystack = normalizeQuery([
        h.houseName,
        h.localName,
        ...(h.alternativeNames || []),
        h.province,
        h.island,
        h.districtOrRegion,
        h.culturalCommunity,
        h.architecturalType,
        ...(h.constructionMaterials || []),
        h.introduction
      ].join(' '));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function getRelatedHouses(house, allHouses) {
  const others = allHouses.filter((h) => h.id !== house.id);
  const sameIsland = others.filter((h) => h.island === house.island);
  const similarStructure = others.filter((h) => {
    const isStiltA = /panggung/i.test(house.architecturalType + ' ' + house.structuralSystem);
    const isStiltB = /panggung/i.test(h.architecturalType + ' ' + h.structuralSystem);
    return isStiltA === isStiltB && h.island !== house.island;
  });
  const contrasting = others.filter((h) => {
    const isStiltA = /panggung/i.test(house.architecturalType + ' ' + house.structuralSystem);
    const isStiltB = /panggung/i.test(h.architecturalType + ' ' + h.structuralSystem);
    return isStiltA !== isStiltB;
  });

  return {
    sameIsland: sameIsland.slice(0, 3),
    similarStructure: similarStructure.slice(0, 2),
    contrasting: contrasting.slice(0, 2)
  };
}

export function getCatalogMetrics(houses, provincesData) {
  const documentedProvinces = new Set(houses.map((h) => h.province));
  const totalProvinces = (provincesData?.islands || []).reduce((acc, isl) => acc + isl.provinces.length, 0);
  const modelsAvailable = houses.filter((h) => h.modelStatus === 'available').length;
  const modelsInProgress = houses.filter((h) => h.modelStatus !== 'available').length;
  const documentedIslands = new Set(houses.map((h) => h.island)).size;
  return {
    totalHouses: houses.length,
    modelsAvailable,
    modelsInProgress,
    documentedProvincesCount: documentedProvinces.size,
    totalProvinces,
    documentedIslands
  };
}
