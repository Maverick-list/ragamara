/**
 * NULAR — Curated Exhibition Catalog & Reference Resolver (js/exhibition-data.js)
 * Resolves exhibition chapters against real data/houses.json & data/cultural-items.json records.
 * Never fabricates item IDs, photographs, or 3D GLB paths.
 */

let cachedCatalogPromise = null;

function inferIslandFromProvince(province = '') {
  const p = String(province).toLowerCase();
  if (/aceh|sumatera|sumatra|riau|jambi|bengkulu|lampung|bangka/.test(p)) return 'Sumatra';
  if (/jawa|jakarta|yogyakarta|banten/.test(p)) return 'Java';
  if (/kalimantan/.test(p)) return 'Kalimantan';
  if (/sulawesi|gorontalo/.test(p)) return 'Sulawesi';
  if (/bali|nusa tenggara/.test(p)) return 'Bali & Nusa Tenggara';
  if (/maluku/.test(p)) return 'Maluku';
  if (/papua/.test(p)) return 'Papua';
  return 'Nusantara';
}

function normalizeHouseExhibit(house) {
  const refImg = house.referenceImages?.[0] || null;
  return {
    id: house.id,
    type: 'house',
    typeLabel: 'Arsitektur 3D',
    name: house.houseName || house.localName || house.id,
    subtitle: house.localName && house.localName !== house.houseName ? house.localName : (house.architecturalType || 'Rumah Tradisional'),
    province: house.province || 'Nusantara',
    region: house.island || inferIslandFromProvince(house.province),
    culturalCommunity: house.culturalCommunity || '',
    description: house.introduction || '',
    historicalContext: house.historicalContext || '',
    culturalSignificance: house.culturalSignificance || '',
    materials: Array.isArray(house.constructionMaterials) ? house.constructionMaterials : [],
    components: Array.isArray(house.architecturalFeatures) ? house.architecturalFeatures : [],
    image: refImg?.url || null,
    imageCaption: refImg?.caption || house.houseName || '',
    imageAttribution: refImg?.attribution || house.attribution || 'Arsip Museum NULAR',
    gallery: Array.isArray(house.referenceImages) ? house.referenceImages : [],
    model3DUrl: house.modelStatus === 'available' && house.model3DUrl ? house.model3DUrl : null,
    sources: Array.isArray(house.sources) ? house.sources : [],
    verificationStatus: house.verificationStatus || 'verified',
    detailHref: `house.html?id=${encodeURIComponent(house.id)}`
  };
}

function normalizeCulturalExhibit(item) {
  const localImg = item.imageUrl || item.image || item.referenceImage || null;
  return {
    id: item.id,
    type: 'cultural_item',
    typeLabel: item.categoryLabel || item.category || 'Koleksi Budaya',
    name: item.name || item.id,
    subtitle: item.culturalAssociation || item.categoryLabel || '',
    province: item.province || item.regionId || 'Nusantara',
    region: inferIslandFromProvince(item.province || item.regionId),
    culturalCommunity: item.culturalAssociation || '',
    description: item.description || '',
    historicalContext: item.historicalContext || '',
    culturalSignificance: item.culturalSignificance || '',
    materials: Array.isArray(item.materials) ? item.materials : [],
    components: Array.isArray(item.components) ? item.components : [],
    image: localImg,
    imageCaption: item.name || '',
    imageAttribution: 'Dokumentasi Kuratorial NULAR & DAPOBUD',
    gallery: localImg ? [{ url: localImg, caption: item.name }] : [],
    model3DUrl: item.model3D || null,
    isGenericSilhouette: Boolean(item.isGenericSilhouette),
    model3DNote: item.model3DNote || null,
    sources: Array.isArray(item.sources) ? item.sources : [],
    verificationStatus: item.verificationStatus || 'verified',
    detailHref: `learn.html#${encodeURIComponent(item.category || 'clothing')}`
  };
}

export async function loadExhibitionCatalog() {
  if (!cachedCatalogPromise) {
    cachedCatalogPromise = Promise.all([
      fetch('data/exhibitions.json').then((r) => {
        if (!r.ok) throw new Error('Gagal memuat data/exhibitions.json');
        return r.json();
      }),
      fetch('data/houses.json').then((r) => {
        if (!r.ok) throw new Error('Gagal memuat data/houses.json');
        return r.json();
      }),
      fetch('data/cultural-items.json').then((r) => {
        if (!r.ok) throw new Error('Gagal memuat data/cultural-items.json');
        return r.json();
      })
    ]).then(([exhJson, housesJson, itemsJson]) => {
      const housesArr = Array.isArray(housesJson) ? housesJson : (housesJson.houses || []);
      const itemsArr = Array.isArray(itemsJson) ? itemsJson : (itemsJson.items || []);
      const houseMap = new Map(housesArr.map((h) => [h.id, h]));
      const itemMap = new Map(itemsArr.map((i) => [i.id, i]));

      const exhibitions = (exhJson.exhibitions || []).map((exh) => {
        const allExhibits = [];
        const resolvedChapters = (exh.chapters || []).map((ch) => {
          const exhibits = (ch.exhibitRefs || []).map((ref) => {
            if (ref.type === 'house') {
              const found = houseMap.get(ref.id);
              return found ? normalizeHouseExhibit(found) : null;
            }
            const found = itemMap.get(ref.id);
            return found ? normalizeCulturalExhibit(found) : null;
          }).filter(Boolean);
          allExhibits.push(...exhibits);
          return { ...ch, exhibits };
        });

        const models3DCount = allExhibits.filter((e) => Boolean(e.model3DUrl)).length;
        return {
          ...exh,
          chapters: resolvedChapters,
          exhibits: allExhibits,
          exhibitCount: allExhibits.length,
          models3DCount
        };
      });

      return {
        schemaVersion: exhJson.schemaVersion,
        lastReviewedAt: exhJson.lastReviewedAt,
        exhibitions,
        totalExhibits: exhibitions.reduce((sum, e) => sum + e.exhibitCount, 0),
        totalModels3D: exhibitions.reduce((sum, e) => sum + e.models3DCount, 0)
      };
    });
  }
  return cachedCatalogPromise;
}

export async function resolveExhibitionById(id) {
  const catalog = await loadExhibitionCatalog();
  const target = catalog.exhibitions.find((e) => e.id === id) || null;
  if (!target) return { catalog, exhibition: null, related: [] };
  const related = (target.relatedExhibitionIds || [])
    .map((rid) => catalog.exhibitions.find((e) => e.id === rid))
    .filter(Boolean);
  return { catalog, exhibition: target, related };
}
