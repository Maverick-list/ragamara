/**
 * NULAR — The Living Archipelago: 38-Province GeoJSON Indonesia Atlas (js/atlas-map.js)
 * Renders geographically accurate boundaries for all 38 Indonesian provinces from
 * data/indonesia-38-provinces.geojson (MIT License), with island zoom, search,
 * architectural typology filters, multi-house provincial dossiers, and discovery progress.
 */

import { escapeHtml } from './museum-shell.js';
import { MuseumStore } from './museum-store.js';

// Canonical mapping between GeoJSON PROVINSI names and provinces.json names
const PROV_ALIAS_TO_CANONICAL = {
  'Daerah Istimewa Yogyakarta': 'DI Yogyakarta',
  'DI Yogyakarta': 'DI Yogyakarta',
  'DKI Jakarta': 'DKI Jakarta',
  'Kepulauan Bangka Belitung': 'Kepulauan Bangka Belitung',
  'Kepulauan Riau': 'Kepulauan Riau'
};

export function canonicalProvinceName(raw) {
  return PROV_ALIAS_TO_CANONICAL[raw] || raw;
}

// Geographic bounding box for Indonesia archipelago projection
const BOUNDS = {
  minLon: 94.6,
  maxLon: 141.4,
  minLat: -11.3,
  maxLat: 6.3
};

const SVG_W = 1120;
const SVG_H = 440;

const ISLAND_VIEWBOXES = {
  all: { x: 0, y: 0, w: SVG_W, h: SVG_H, label: 'Seluruh Nusantara (38 Provinsi)' },
  Sumatra: { x: 0, y: 0, w: 360, h: 340, label: 'Sumatra (10 Provinsi)' },
  Java: { x: 220, y: 270, w: 280, h: 135, label: 'Jawa (6 Provinsi)' },
  Kalimantan: { x: 320, y: 35, w: 275, h: 265, label: 'Kalimantan (5 Provinsi)' },
  Sulawesi: { x: 525, y: 80, w: 230, h: 255, label: 'Sulawesi (6 Provinsi)' },
  'Bali & Nusa Tenggara': { x: 455, y: 315, w: 335, h: 125, label: 'Bali & Nusa Tenggara (3 Provinsi)' },
  Maluku: { x: 705, y: 85, w: 215, h: 285, label: 'Maluku (2 Provinsi)' },
  Papua: { x: 815, y: 125, w: 305, h: 265, label: 'Papua (6 Provinsi)' }
};

function projectPoint(lon, lat) {
  const x = ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * SVG_W;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * SVG_H;
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function ringToPath(ring) {
  if (!ring || ring.length < 3) return '';
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = projectPoint(ring[i][0], ring[i][1]);
    d += (i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  return d + 'Z';
}

function geometryToPathAndCentroid(geometry) {
  let d = '';
  let bestArea = -1;
  let centroid = [SVG_W / 2, SVG_H / 2];

  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    for (let rIdx = 0; rIdx < poly.length; rIdx++) {
      const ring = poly[rIdx];
      d += ringToPath(ring);
      if (rIdx === 0 && ring.length >= 3) {
        // Compute polygon bounding center & area to place label on largest landmass
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        for (const pt of ring) {
          const [px, py] = projectPoint(pt[0], pt[1]);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          sumX += px;
          sumY += py;
        }
        const approxArea = (maxX - minX) * (maxY - minY);
        if (approxArea > bestArea) {
          bestArea = approxArea;
          centroid = [Number((sumX / ring.length).toFixed(1)), Number((sumY / ring.length).toFixed(1))];
        }
      }
    }
  }
  return { path: d, centroid };
}

export async function mountLivingAtlas({
  svgContainer,
  islandControlsEl,
  panelTitleEl,
  panelSubtitleEl,
  panelBodyEl,
  provinceDirectoryEl,
  coverageBarEl,
  searchInputEl,
  typologySelectEl,
  houses,
  provincesData
}) {
  const geoRes = await fetch('./data/indonesia-38-provinces.geojson');
  if (!geoRes.ok) throw new Error(`Gagal memuat GeoJSON 38 provinsi (HTTP ${geoRes.status})`);
  const geojson = await geoRes.json();

  const provinceToIsland = new Map();
  for (const isl of provincesData.islands) {
    for (const p of isl.provinces) {
      provinceToIsland.set(p, isl.id);
    }
  }

  // Group houses by canonical province
  const housesByProvince = new Map();
  for (const h of houses) {
    const prov = canonicalProvinceName(h.province);
    if (!housesByProvince.has(prov)) housesByProvince.set(prov, []);
    housesByProvince.get(prov).push(h);
  }

  // Precompute SVG paths & centroids for all 38 features
  const features = geojson.features.map((f) => {
    const rawName = f.properties.PROVINSI || f.properties.name;
    const provName = canonicalProvinceName(rawName);
    const islandId = provinceToIsland.get(provName) || 'Nusantara';
    const { path, centroid } = geometryToPathAndCentroid(f.geometry);
    const provHouses = housesByProvince.get(provName) || [];
    const has3D = provHouses.some((h) => h.modelStatus === 'available' || h.assetStatus === 'COMPLETE' || h.assetStatus === 'RECONSTRUCTION');
    return {
      code: f.properties.KODE_PROV || f.properties.id,
      rawName,
      provName,
      islandId,
      path,
      centroid,
      houses: provHouses,
      has3D
    };
  });

  let selectedIsland = 'all';
  let selectedProvince = null;
  let searchTerm = '';
  let selectedTypology = 'all';

  function getFilteredHouses(list) {
    const q = searchTerm.trim().toLowerCase();
    return list.filter((h) => {
      if (selectedTypology !== 'all') {
        const hay = `${h.architecturalType || ''} ${h.structuralSystem || ''} ${h.roofConstruction || ''}`.toLowerCase();
        if (!hay.includes(selectedTypology.toLowerCase())) return false;
      }
      if (q) {
        const hay = `${h.houseName} ${h.localName || ''} ${(h.alternativeNames || []).join(' ')} ${h.province} ${h.culturalCommunity || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderCoverageBar() {
    if (!coverageBarEl) return;
    const state = MuseumStore.getState();
    const visitedCount = new Set((state.exploredHistory || []).map((e) => e.houseId)).size;
    const provCovered = features.filter((f) => f.houses.length > 0).length;
    const ready3DCount = houses.filter((h) => h.modelStatus === 'available').length;

    coverageBarEl.innerHTML = `
      <div class="atlas-kpi"><span class="atlas-kpi__val">${provCovered}/38</span><span class="atlas-kpi__lbl">Provinsi Terwakili</span></div>
      <div class="atlas-kpi"><span class="atlas-kpi__val">${houses.length}</span><span class="atlas-kpi__lbl">Rumah Adat Terdokumentasi</span></div>
      <div class="atlas-kpi"><span class="atlas-kpi__val">${ready3DCount}</span><span class="atlas-kpi__lbl">Model 3D Interaktif</span></div>
      <div class="atlas-kpi"><span class="atlas-kpi__val">${visitedCount}/${houses.length}</span><span class="atlas-kpi__lbl">Progres Eksplorasi Anda</span></div>
    `;
  }

  function renderIslandControls() {
    if (!islandControlsEl) return;
    islandControlsEl.innerHTML = Object.entries(ISLAND_VIEWBOXES)
      .map(([id, cfg]) => `
        <button
          type="button"
          class="atlas-island-btn ${selectedIsland === id ? 'is-active' : ''}"
          data-island-zoom="${escapeHtml(id)}"
          aria-pressed="${selectedIsland === id}"
        >
          ${escapeHtml(id === 'all' ? 'Semua Pulau' : id)}
        </button>
      `).join('');
  }

  function renderSvg() {
    const vb = ISLAND_VIEWBOXES[selectedIsland] || ISLAND_VIEWBOXES.all;
    const equatorY = projectPoint(115, 0)[1];
    const q = searchTerm.trim().toLowerCase();

    const polygonsHtml = features.map((f) => {
      const matchedHouses = getFilteredHouses(f.houses);
      const provNameMatches = q && f.provName.toLowerCase().includes(q);
      const isMatch = (!q && selectedTypology === 'all') || matchedHouses.length > 0 || provNameMatches;
      const isIslandFocus = selectedIsland === 'all' || f.islandId === selectedIsland;
      const isSelected = selectedProvince === f.provName;

      let stateClass = 'atlas-prov--documented';
      if (f.houses.length === 0) stateClass = 'atlas-prov--empty';
      else if (f.has3D) stateClass = 'atlas-prov--3d';

      const dimClass = (!isMatch || !isIslandFocus) ? 'is-dimmed' : '';
      const activeClass = isSelected ? 'is-selected' : '';

      return `
        <path
          class="atlas-prov ${stateClass} ${dimClass} ${activeClass}"
          d="${f.path}"
          data-province="${escapeHtml(f.provName)}"
          data-island="${escapeHtml(f.islandId)}"
          tabindex="0"
          role="button"
          aria-label="${escapeHtml(f.provName)} (${f.houses.length} rumah adat terdokumentasi)"
        >
          <title>${escapeHtml(f.provName)} — ${f.houses.map((h) => h.houseName).join(', ') || 'Dalam Penelitian'}</title>
        </path>
      `;
    }).join('');

    const markersHtml = features
      .filter((f) => f.houses.length > 0 && (selectedIsland === 'all' || f.islandId === selectedIsland))
      .map((f) => {
        const matched = getFilteredHouses(f.houses);
        if ((searchTerm || selectedTypology !== 'all') && matched.length === 0 && !f.provName.toLowerCase().includes(q)) {
          return '';
        }
        const isSelected = selectedProvince === f.provName;
        const r = selectedIsland === 'all' ? (isSelected ? 5.5 : 3.6) : (isSelected ? 4.2 : 2.8);
        return `
          <g class="atlas-marker ${f.has3D ? 'is-3d' : ''} ${isSelected ? 'is-selected' : ''}" data-province="${escapeHtml(f.provName)}" style="cursor:pointer;">
            ${isSelected ? `<circle cx="${f.centroid[0]}" cy="${f.centroid[1]}" r="${r * 2.2}" class="atlas-marker__pulse" />` : ''}
            <circle cx="${f.centroid[0]}" cy="${f.centroid[1]}" r="${r}" class="atlas-marker__dot" />
          </g>
        `;
      }).join('');

    const labelsHtml = selectedIsland !== 'all'
      ? features
          .filter((f) => f.islandId === selectedIsland)
          .map((f) => `
            <text
              x="${f.centroid[0]}"
              y="${f.centroid[1] - 5}"
              class="atlas-prov-label"
              text-anchor="middle"
              pointer-events="none"
            >${escapeHtml(f.provName)}</text>
          `).join('')
      : `
        <text x="155" y="195" class="atlas-region-watermark" text-anchor="middle">SUMATRA</text>
        <text x="345" y="370" class="atlas-region-watermark" text-anchor="middle">JAWA</text>
        <text x="455" y="165" class="atlas-region-watermark" text-anchor="middle">KALIMANTAN</text>
        <text x="640" y="185" class="atlas-region-watermark" text-anchor="middle">SULAWESI</text>
        <text x="615" y="405" class="atlas-region-watermark" text-anchor="middle">BALI &amp; NUSA TENGGARA</text>
        <text x="805" y="215" class="atlas-region-watermark" text-anchor="middle">MALUKU</text>
        <text x="985" y="265" class="atlas-region-watermark" text-anchor="middle">PAPUA</text>
      `;

    svgContainer.innerHTML = `
      <svg
        id="indonesia-living-atlas-svg"
        viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
        class="indonesia-svg-map atlas-geojson-svg"
        role="img"
        aria-label="Peta GeoJSON interaktif 38 provinsi Indonesia — NULAR Living Archipelago Atlas"
      >
        <defs>
          <filter id="archipelago-relief" x="-4%" y="-4%" width="108%" height="108%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#050a08" flood-opacity="0.55" />
          </filter>
        </defs>

        <!-- Cartographic Graticule -->
        <g stroke="rgba(246,242,234,0.07)" stroke-width="0.8">
          <line x1="0" y1="${equatorY}" x2="${SVG_W}" y2="${equatorY}" stroke="rgba(198,162,116,0.28)" stroke-dasharray="5 5" />
          <line x1="0" y1="${equatorY - 110}" x2="${SVG_W}" y2="${equatorY - 110}" />
          <line x1="0" y1="${equatorY + 110}" x2="${SVG_W}" y2="${equatorY + 110}" />
          <line x1="224" y1="0" x2="224" y2="${SVG_H}" />
          <line x1="448" y1="0" x2="448" y2="${SVG_H}" />
          <line x1="672" y1="0" x2="672" y2="${SVG_H}" />
          <line x1="896" y1="0" x2="896" y2="${SVG_H}" />
        </g>
        <text x="14" y="${equatorY - 6}" fill="rgba(198,162,116,0.55)" font-family="IBM Plex Mono, monospace" font-size="9">0° KHATULISTIWA</text>

        <!-- 38-Province GeoJSON Polygons -->
        <g filter="url(#archipelago-relief)">
          ${polygonsHtml}
        </g>

        <!-- Cultural House Markers -->
        <g>${markersHtml}</g>

        <!-- Labels -->
        <g>${labelsHtml}</g>
      </svg>
    `;
  }

  function renderPanel() {
    if (!panelBodyEl) return;
    if (selectedProvince) {
      const feat = features.find((f) => f.provName === selectedProvince);
      const list = feat ? getFilteredHouses(feat.houses) : [];
      const allInProv = feat ? feat.houses : [];

      if (panelTitleEl) panelTitleEl.textContent = selectedProvince;
      if (panelSubtitleEl) {
        panelSubtitleEl.textContent = `${feat?.islandId || 'Nusantara'} · ${allInProv.length} Tradisi Arsitektur Terdokumentasi`;
      }

      if (!list.length) {
        panelBodyEl.innerHTML = `
          <div style="padding:18px;background:var(--bg-ivory);border:1px solid var(--border-hairline);">
            <p style="margin:0;font-size:0.88rem;color:var(--ink-secondary);line-height:1.6;">
              ${allInProv.length > 0
                ? 'Tidak ada rumah di provinsi ini yang cocok dengan filter pencarian/tipologi saat ini. Atur ulang filter untuk melihat koleksi provinsi ini.'
                : 'Provinsi ini sedang dalam tahap riset dan kurasi arsip arsitektur.'}
            </p>
          </div>
        `;
        return;
      }

      panelBodyEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${list.map((h) => {
            const photo = h.referenceImages?.[0];
            const has3D = h.modelStatus === 'available';
            return `
              <article class="atlas-dossier-card">
                ${photo ? `<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(h.houseName)}" class="atlas-dossier-card__img" loading="lazy" />` : ''}
                <div class="atlas-dossier-card__body">
                  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
                    <span class="badge-pill ${has3D ? 'badge-pill--3d' : ''}">${has3D ? '3D Interaktif Siap' : 'Arsip & Rekonstruksi'}</span>
                    <span class="badge-pill">${escapeHtml(h.culturalCommunity)}</span>
                  </div>
                  <h3 style="font-family:var(--font-serif);font-size:1.25rem;margin:0 0 4px;">${escapeHtml(h.houseName)}</h3>
                  <div class="mono-caption" style="color:var(--bronze);margin-bottom:8px;">${escapeHtml(h.localName)} · ${escapeHtml(h.architecturalType)}</div>
                  <p style="font-size:0.85rem;color:var(--ink-secondary);line-height:1.6;margin:0 0 12px;">${escapeHtml(h.introduction)}</p>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="house.html?id=${encodeURIComponent(h.id)}" class="btn-museum btn-museum--primary btn-museum--sm">Inspeksi 3D &amp; Artikel</a>
                    <a href="world.html?house=${encodeURIComponent(h.id)}" class="btn-museum btn-museum--bronze btn-museum--sm">Masuk Dunia 3D</a>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `;
      return;
    }

    // Island or nationwide overview
    const activeHouses = getFilteredHouses(
      selectedIsland === 'all' ? houses : houses.filter((h) => h.island === selectedIsland)
    );
    const titleLabel = ISLAND_VIEWBOXES[selectedIsland]?.label || selectedIsland;
    if (panelTitleEl) panelTitleEl.textContent = titleLabel;
    if (panelSubtitleEl) panelSubtitleEl.textContent = `${activeHouses.length} rumah adat cocok · Klik provinsi di peta untuk dossier terperinci`;

    panelBodyEl.innerHTML = `
      <div class="atlas-house-mini-list">
        ${activeHouses.slice(0, 14).map((h) => `
          <a href="house.html?id=${encodeURIComponent(h.id)}" class="atlas-house-mini-item">
            <div>
              <div class="mono-caption" style="color:var(--bronze);">${escapeHtml(h.province)}</div>
              <div style="font-weight:600;font-size:0.9rem;color:var(--ink-primary);">${escapeHtml(h.houseName)}</div>
              <div style="font-size:0.78rem;color:var(--ink-muted);">${escapeHtml(h.localName)}</div>
            </div>
            <span class="badge-pill ${h.modelStatus === 'available' ? 'badge-pill--3d' : ''}">
              ${h.modelStatus === 'available' ? '3D' : 'Arsip'}
            </span>
          </a>
        `).join('')}
        ${activeHouses.length > 14 ? `<p class="mono-caption" style="margin:6px 0 0;color:var(--ink-muted);">+ ${activeHouses.length - 14} rumah lainnya — pilih pulau atau provinsi spesifik di peta.</p>` : ''}
      </div>
    `;
  }

  function renderDirectory() {
    if (!provinceDirectoryEl) return;
    provinceDirectoryEl.innerHTML = provincesData.islands.map((isl) => `
      <div class="atlas-dir-island">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;border-bottom:1px solid var(--border-hairline);padding-bottom:6px;">
          <h3 style="font-family:var(--font-serif);font-size:1.1rem;margin:0;">${escapeHtml(isl.name)}</h3>
          <span class="mono-caption">${isl.provinces.length} Provinsi</span>
        </div>
        <div class="atlas-dir-grid">
          ${isl.provinces.map((prov) => {
            const pHouses = housesByProvince.get(prov) || [];
            const has3D = pHouses.some((h) => h.modelStatus === 'available');
            const isActive = selectedProvince === prov;
            return `
              <button
                type="button"
                class="atlas-dir-chip ${isActive ? 'is-selected' : ''} ${has3D ? 'has-3d' : ''}"
                data-select-province="${escapeHtml(prov)}"
              >
                <span class="dot-indicator ${has3D ? 'dot-indicator--3d' : (pHouses.length ? 'dot-indicator--doc' : 'dot-indicator--research')}"></span>
                <span>${escapeHtml(prov)}</span>
                <span class="mono-caption" style="margin-left:auto;opacity:0.7;">${pHouses.length}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderAll() {
    renderCoverageBar();
    renderIslandControls();
    renderSvg();
    renderPanel();
    renderDirectory();
  }

  // Interactions
  svgContainer.addEventListener('click', (e) => {
    const target = e.target.closest('[data-province]');
    if (!target) return;
    selectedProvince = target.getAttribute('data-province');
    const isl = target.getAttribute('data-island');
    if (isl && ISLAND_VIEWBOXES[isl] && selectedIsland === 'all') {
      // Keep overview or let user zoom explicitly; highlight province cleanly
    }
    renderAll();
  });

  svgContainer.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-province]');
    if (!target) return;
    e.preventDefault();
    selectedProvince = target.getAttribute('data-province');
    renderAll();
  });

  islandControlsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-island-zoom]');
    if (!btn) return;
    selectedIsland = btn.getAttribute('data-island-zoom');
    selectedProvince = null;
    renderAll();
  });

  provinceDirectoryEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-province]');
    if (!btn) return;
    selectedProvince = btn.getAttribute('data-select-province');
    const isl = provinceToIsland.get(selectedProvince);
    if (isl && ISLAND_VIEWBOXES[isl]) selectedIsland = isl;
    renderAll();
    svgContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  searchInputEl?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderAll();
  });

  typologySelectEl?.addEventListener('change', (e) => {
    selectedTypology = e.target.value;
    renderAll();
  });

  // Expose helper for deep linking ?province=... or ?island=...
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('island') && ISLAND_VIEWBOXES[urlParams.get('island')]) {
    selectedIsland = urlParams.get('island');
  }
  if (urlParams.get('province')) {
    const reqProv = canonicalProvinceName(urlParams.get('province'));
    if (provinceToIsland.has(reqProv)) {
      selectedProvince = reqProv;
      selectedIsland = provinceToIsland.get(reqProv);
    }
  }

  renderAll();
}
