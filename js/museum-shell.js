/**
 * NULAR — Nusa Learn Shared Museum Shell & UI Components (js/museum-shell.js)
 * Renders consistent primary navigation, mobile drawer, editorial house cards, and footer.
 */

import { MuseumStore } from './museum-store.js';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', subtitle: 'The Living Atlas', href: 'index.html' },
  { id: 'explore', label: 'Explore', subtitle: 'House Collection', href: 'explore.html' },
  { id: 'map', label: 'Architecture Map', subtitle: 'Indonesia Atlas', href: 'map.html' },
  { id: 'anatomy', label: 'Architectural Details', subtitle: 'Building Anatomy', href: 'anatomy.html' },
  { id: 'about', label: 'About NULAR', subtitle: 'Mission & Sources', href: 'about.html' }
];

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initMuseumShell(activePageId) {
  const headerMount = document.getElementById('museum-header-mount');
  const footerMount = document.getElementById('museum-footer-mount');

  const updateSavedBadge = () => {
    const count = MuseumStore.getState().savedHouseIds.length;
    document.querySelectorAll('[data-saved-count]').forEach((el) => {
      el.textContent = String(count);
    });
  };

  if (headerMount) {
    const savedCount = MuseumStore.getState().savedHouseIds.length;
    headerMount.innerHTML = `
      <a class="skip-link" href="#main-content">Lompat ke konten utama</a>
      <header class="museum-header" role="banner">
        <div class="museum-container museum-header__inner">
          <a href="index.html" class="brand-mark" aria-label="NULAR — Nusa Learn Home">
            <span class="brand-mark__emblem" aria-hidden="true">N</span>
            <span class="brand-mark__text">
              <span class="brand-mark__name">NULAR</span>
              <span class="brand-mark__sub">Nusa Learn · Architecture Museum</span>
            </span>
          </a>

          <nav class="museum-nav" aria-label="Navigasi Utama">
            ${NAV_ITEMS.map((item) => `
              <a
                href="${item.href}"
                class="museum-nav__link"
                ${item.id === activePageId ? 'aria-current="page"' : ''}
              >${escapeHtml(item.label)}</a>
            `).join('')}
          </nav>

          <div class="header-actions">
            <a
              href="world.html"
              class="btn-museum btn-museum--bronze btn-museum--sm"
              ${activePageId === 'world' ? 'aria-current="page"' : ''}
              aria-label="Masuk Dunia 3D Nusantara yang dapat dimainkan"
            >
              <span class="material-symbols-outlined" style="font-size:17px" aria-hidden="true">directions_walk</span>
              <span>Dunia 3D</span>
            </a>
            <a
              href="profile.html"
              class="journal-pill"
              ${activePageId === 'profile' ? 'aria-current="page"' : ''}
              aria-label="Jurnal Eksplorasi dan Rumah Tersimpan"
            >
              <span class="material-symbols-outlined" style="font-size:17px" aria-hidden="true">bookmarks</span>
              <span>Jurnal</span>
              <span class="journal-pill__count" data-saved-count>${savedCount}</span>
            </a>
            <button
              type="button"
              id="mobile-menu-toggle"
              class="mobile-menu-btn"
              aria-expanded="false"
              aria-controls="mobile-nav-drawer"
              aria-label="Buka menu navigasi"
            >
              <span class="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>
          </div>
        </div>

        <nav id="mobile-nav-drawer" class="mobile-drawer" aria-label="Navigasi Mobile">
          <ul class="mobile-drawer__list">
            ${NAV_ITEMS.map((item) => `
              <li>
                <a
                  href="${item.href}"
                  class="mobile-drawer__link"
                  ${item.id === activePageId ? 'aria-current="page"' : ''}
                >
                  <span>${escapeHtml(item.label)}</span>
                  <span class="mono-caption">${escapeHtml(item.subtitle)}</span>
                </a>
              </li>
            `).join('')}
            <li>
              <a
                href="profile.html"
                class="mobile-drawer__link"
                ${activePageId === 'profile' ? 'aria-current="page"' : ''}
              >
                <span>Jurnal Eksplorasi Saya</span>
                <span class="mono-caption"><span data-saved-count>${savedCount}</span> tersimpan</span>
              </a>
            </li>
          </ul>
        </nav>
      </header>
    `;

    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = drawer.classList.toggle('is-open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        toggleBtn.querySelector('.material-symbols-outlined').textContent = isOpen ? 'close' : 'menu';
      });
    }
  }

  if (footerMount) {
    footerMount.innerHTML = `
      <footer class="museum-footer" role="contentinfo">
        <div class="museum-container">
          <div class="museum-footer__grid">
            <div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span class="brand-mark__emblem" style="background:#1E4236" aria-hidden="true">N</span>
                <div>
                  <div style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;letter-spacing:0.06em;">NULAR — NUSA LEARN</div>
                  <div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;color:var(--bronze-light);text-transform:uppercase;">Explore the Living Architecture of Nusantara</div>
                </div>
              </div>
              <p style="font-size:0.87rem;color:var(--ink-on-dark-muted);line-height:1.7;max-width:44ch;margin:0;">
                Museum digital arsitektur vernakular Indonesia. Mendokumentasikan rumah tradisional Nusantara secara terbuka, akurat, dan dapat dijelajahi melalui model 3D interaktif serta rujukan ilmiah yang transparan.
              </p>
            </div>

            <div>
              <h3 class="footer-heading">Navigasi Museum</h3>
              <ul class="footer-links">
                <li><a href="index.html">Home — The Living Atlas</a></li>
                <li><a href="explore.html">Explore — Koleksi Rumah Adat</a></li>
                <li><a href="map.html">Architecture Map — Peta Indonesia</a></li>
                <li><a href="anatomy.html">Architectural Details — Anatomi</a></li>
                <li><a href="profile.html">Jurnal Eksplorasi Pribadi</a></li>
              </ul>
            </div>

            <div>
              <h3 class="footer-heading">Model 3D Interaktif</h3>
              <ul class="footer-links">
                <li><a href="house.html?id=rumah-gadang">Rumah Gadang (Sumatera Barat)</a></li>
                <li><a href="house.html?id=tongkonan-toraja">Tongkonan (Sulawesi Selatan)</a></li>
                <li><a href="house.html?id=rumah-joglo">Rumah Joglo (Jawa Tengah)</a></li>
                <li><a href="house.html?id=honai-papua">Honai (Papua Pegunungan)</a></li>
              </ul>
            </div>

            <div>
              <h3 class="footer-heading">Tata Kelola & Atribusi</h3>
              <ul class="footer-links">
                <li><a href="about.html#mission">Misi Pelestarian Arsitektur</a></li>
                <li><a href="about.html#sources">Sumber & Standar Verifikasi</a></li>
                <li><a href="about.html#attribution">Registri Lisensi 3D & Foto</a></li>
                <li><a href="about.html#cms-workflow">Skema Data & Kontribusi</a></li>
              </ul>
            </div>
          </div>

          <div class="museum-footer__bottom">
            <span>© 2026 NULAR (Nusa Learn) — Museum Digital Arsitektur Tradisional Nusantara.</span>
            <span>Seluruh foto referensi berlisensi terbuka (Wikimedia Commons CC BY-SA 4.0) · Model 3D orisinal CC BY 4.0.</span>
          </div>
        </div>
      </footer>
    `;
  }

  window.addEventListener('nular:store-updated', updateSavedBadge);
}

/**
 * Renders an editorial House Specimen Card consistently across Home, Explore, Map, and Profile.
 */
export function renderHouseCard(house, options = {}) {
  const is3D = house.modelStatus === 'available';
  const isSaved = MuseumStore.isHouseSaved(house.id);
  const photo = house.referenceImages?.[0];
  const materials = (house.constructionMaterials || []).slice(0, 3);

  return `
    <article class="house-card" data-house-id="${escapeHtml(house.id)}">
      <div class="house-card__media">
        <a href="house.html?id=${encodeURIComponent(house.id)}" aria-label="Buka detail ${escapeHtml(house.houseName)}">
          <img
            class="house-card__img"
            src="${escapeHtml(photo?.url || '')}"
            alt="${escapeHtml(photo?.caption || house.houseName)}"
            loading="lazy"
          />
        </a>
        <div class="house-card__badges">
          <span class="status-badge ${is3D ? 'status-badge--3d' : 'status-badge--prep'}">
            ${is3D ? 'Model 3D Tersedia' : 'Model 3D Sedang Disiapkan'}
          </span>
          <button
            type="button"
            class="house-card__save-btn ${isSaved ? 'is-saved' : ''}"
            data-toggle-save="${escapeHtml(house.id)}"
            aria-pressed="${isSaved}"
            aria-label="${isSaved ? 'Hapus dari rumah tersimpan' : 'Simpan rumah ke jurnal'}: ${escapeHtml(house.houseName)}"
            title="${isSaved ? 'Tersimpan di Jurnal' : 'Simpan ke Jurnal'}"
          >
            <span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">
              ${isSaved ? 'bookmark' : 'bookmark_border'}
            </span>
          </button>
        </div>
      </div>

      <div class="house-card__body">
        <div class="house-card__region">
          ${escapeHtml(house.island)} · ${escapeHtml(house.province)}
        </div>
        <h3 class="card-title">
          <a href="house.html?id=${encodeURIComponent(house.id)}">${escapeHtml(house.houseName)}</a>
        </h3>
        <div class="house-card__local">
          ${escapeHtml(house.localName)} — ${escapeHtml(house.culturalCommunity)}
        </div>
        <p class="house-card__intro">${escapeHtml(house.introduction)}</p>

        <div class="house-card__meta-row">
          ${materials.map((m) => `<span class="meta-chip">${escapeHtml(m)}</span>`).join('')}
        </div>

        <div class="house-card__footer">
          <a
            href="house.html?id=${encodeURIComponent(house.id)}"
            class="btn-museum ${is3D ? 'btn-museum--primary' : 'btn-museum--secondary'} btn-museum--sm"
          >
            <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">
              ${is3D ? 'view_in_ar' : 'menu_book'}
            </span>
            <span>${is3D ? 'Jelajahi dalam 3D' : 'Pelajari Arsitektur'}</span>
          </a>

          ${options.showCompare ? `
            <a
              href="anatomy.html?a=${encodeURIComponent(house.id)}&b=${encodeURIComponent(house.id === 'rumah-gadang' ? 'tongkonan-toraja' : 'rumah-gadang')}#comparator"
              class="mono-caption"
              style="text-decoration:underline;text-underline-offset:4px;"
            >Bandingkan</a>
          ` : `
            <span class="mono-caption">${is3D ? `${house.hotspots.length} komponen` : 'Arsip Foto'}</span>
          `}
        </div>
      </div>
    </article>
  `;
}

export function bindSaveButtons(root = document) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-save]');
    if (!btn) return;
    e.preventDefault();
    const houseId = btn.getAttribute('data-toggle-save');
    const saved = MuseumStore.toggleSavedHouse(houseId);
    document.querySelectorAll(`[data-toggle-save="${CSS.escape(houseId)}"]`).forEach((b) => {
      b.classList.toggle('is-saved', saved);
      b.setAttribute('aria-pressed', String(saved));
      const icon = b.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = saved ? 'bookmark' : 'bookmark_border';
    });
  });
}
