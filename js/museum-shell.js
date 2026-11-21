/**
 * NULAR — Nusa Learn Shared Museum Shell & UI Components (js/museum-shell.js)
 * Renders consistent primary navigation, mobile drawer, editorial house cards, and footer.
 */

import { MuseumStore } from './museum-store.js';
import { I18nManager, SUPPORTED_LOCALES } from './i18n/I18nManager.js';
import './pwa.js';

const NAV_ITEMS = [
  { id: 'home', i18nKey: 'nav.home', label: 'Beranda', subtitle: 'The Living World', href: 'index.html' },
  { id: 'world', i18nKey: 'nav.world', label: 'Nusantara World', subtitle: '3D Open World', href: 'world.html' },
  { id: 'explore', i18nKey: 'nav.explore', label: 'Eksplorasi', subtitle: 'Cultural Discovery', href: 'explore.html' },
  { id: 'map', i18nKey: 'nav.map', label: 'Peta 38 Provinsi', subtitle: 'Living Atlas', href: 'map.html' },
  { id: 'learn', i18nKey: 'nav.learn', label: 'Koleksi Budaya', subtitle: 'Collection Book', href: 'learn.html' },
  { id: 'quests', i18nKey: 'nav.quests', label: 'Misi & Peringkat', subtitle: 'Quests & Ranks', href: 'quests.html' },
  { id: 'about', i18nKey: 'nav.about', label: 'Tentang', subtitle: 'Sources & Policy', href: 'about.html' }
];

function ensureDesignSystemCss() {
  if (!document.querySelector('link[href*="design-system.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/design-system.css';
    document.head.appendChild(link);
  }
}

function getPlayerProgressSummary() {
  try {
    const raw = JSON.parse(localStorage.getItem('nular_progression_v1') || 'null');
    return {
      level: raw?.level || 1,
      xp: raw?.xp || 0
    };
  } catch {
    return { level: 1, xp: 0 };
  }
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initMuseumShell(activePageId) {
  ensureDesignSystemCss();
  const headerMount = document.getElementById('museum-header-mount');
  const footerMount = document.getElementById('museum-footer-mount');
  const currentLang = I18nManager.getLanguage();
  const prog = getPlayerProgressSummary();

  const updateSavedBadge = () => {
    const count = MuseumStore.getState().savedHouseIds.length;
    document.querySelectorAll('[data-saved-count]').forEach((el) => {
      el.textContent = String(count);
    });
    const p = getPlayerProgressSummary();
    document.querySelectorAll('[data-header-level]').forEach((el) => {
      el.textContent = `Lv.${p.level}`;
    });
    document.querySelectorAll('[data-header-xp]').forEach((el) => {
      el.textContent = `${p.xp} XP`;
    });
  };

  const renderLangOptions = (selected) => SUPPORTED_LOCALES.map((l) => `
    <option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${escapeHtml(l.label)}</option>
  `).join('');

  if (headerMount) {
    const savedCount = MuseumStore.getState().savedHouseIds.length;
    headerMount.innerHTML = `
      <a class="skip-link" href="#main-content" data-i18n="nav.skip">Lompat ke konten utama</a>
      <header class="museum-header" role="banner">
        <div class="museum-container museum-header__inner">
          <a href="index.html" class="brand-mark" aria-label="NULAR — Nusa Learn Home">
            <span class="brand-mark__emblem" aria-hidden="true">N</span>
            <span class="brand-mark__text">
              <span class="brand-mark__name">NULAR</span>
              <span class="brand-mark__sub">Living Heritage World</span>
            </span>
          </a>

          <nav class="museum-nav" aria-label="Navigasi Utama">
            ${NAV_ITEMS.map((item) => `
              <a
                href="${item.href}"
                class="museum-nav__link"
                data-i18n="${item.i18nKey}"
                ${item.id === activePageId ? 'aria-current="page"' : ''}
              >${escapeHtml(item.label)}</a>
            `).join('')}
          </nav>

          <div class="header-actions">
            <select
              class="lang-select"
              data-lang-selector
              aria-label="Pilih Bahasa Antarmuka"
            >${renderLangOptions(currentLang)}</select>
            <a
              href="profile.html"
              class="player-mini-pill"
              ${activePageId === 'profile' ? 'aria-current="page"' : ''}
              aria-label="Profil Penjelajah & Level"
            >
              <span data-header-level>Lv.${prog.level}</span>
              <span class="player-mini-pill__text" data-header-xp>${prog.xp} XP</span>
            </a>
            <a
              href="world.html"
              class="btn-museum btn-museum--bronze btn-museum--sm header-world-btn"
              ${activePageId === 'world' ? 'aria-current="page"' : ''}
              aria-label="Masuk Dunia 3D Nusantara yang dapat dimainkan"
            >
              <span class="material-symbols-outlined" style="font-size:17px" aria-hidden="true">directions_walk</span>
              <span class="header-world-btn__label" data-i18n="nav.world">Masuk Dunia 3D</span>
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
                  <span data-i18n="${item.i18nKey}">${escapeHtml(item.label)}</span>
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
                <span data-i18n="nav.journal">Profil & Jurnal</span>
                <span class="mono-caption">Lv.${prog.level} · <span data-saved-count>${savedCount}</span> tersimpan</span>
              </a>
            </li>
            <li>
              <a
                href="auth.html"
                class="mobile-drawer__link"
                ${activePageId === 'auth' ? 'aria-current="page"' : ''}
              >
                <span data-i18n="nav.auth">Akun & Pengaturan</span>
                <span class="mono-caption">Sync & Aksesibilitas</span>
              </a>
            </li>
            <li>
              <button
                type="button"
                class="mobile-drawer__link"
                data-pwa-install-btn
                hidden
                style="background:none;border:none;width:100%;text-align:left;cursor:pointer;font-family:inherit;"
              >
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span class="material-symbols-outlined" style="font-size:18px;color:var(--bronze);" aria-hidden="true">install_mobile</span>
                  <span>Pasang Aplikasi NULAR</span>
                </span>
                <span class="mono-caption">PWA Install</span>
              </button>
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

    // Handheld / Smartphone Bottom Navigation Bar
    const BOTTOM_NAV_ITEMS = [
      { id: 'home', label: 'Beranda', icon: 'home', href: 'index.html' },
      { id: 'world', label: 'Dunia 3D', icon: 'directions_walk', href: 'world.html' },
      { id: 'explore', label: 'Koleksi', icon: 'grid_view', href: 'explore.html' },
      { id: 'map', label: 'Atlas', icon: 'public', href: 'map.html' },
      { id: 'profile', label: 'Jurnal', icon: 'menu_book', href: 'profile.html' }
    ];

    if (activePageId !== 'world' && !document.getElementById('mobile-bottom-nav')) {
      const bottomNav = document.createElement('nav');
      bottomNav.id = 'mobile-bottom-nav';
      bottomNav.className = 'mobile-bottom-nav';
      bottomNav.setAttribute('aria-label', 'Navigasi Cepat Mobile');
      bottomNav.innerHTML = BOTTOM_NAV_ITEMS.map((item) => `
        <a
          href="${item.href}"
          class="mobile-bottom-nav__item ${item.id === activePageId ? 'is-active' : ''}"
          ${item.id === activePageId ? 'aria-current="page"' : ''}
        >
          <span class="material-symbols-outlined mobile-bottom-nav__icon" aria-hidden="true">${item.icon}</span>
          <span class="mobile-bottom-nav__label">${escapeHtml(item.label)}</span>
        </a>
      `).join('');
      document.body.appendChild(bottomNav);
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
                  <div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;color:var(--bronze-light);text-transform:uppercase;">Explore the Living Heritage of Indonesia</div>
                </div>
              </div>
              <p style="font-size:0.87rem;color:var(--ink-on-dark-muted);line-height:1.7;max-width:44ch;margin:0 0 14px;" data-i18n="footer.tagline">
                Museum digital &amp; dunia budaya 3D Indonesia — melestarikan arsitektur, wastra, pusaka, dan pengetahuan Nusantara secara terbuka dan akurat.
              </p>
              <label style="display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:0.72rem;color:var(--bronze-light);">
                <span data-i18n="footer.languageLabel">Bahasa Antarmuka</span>
                <select class="lang-select" data-lang-selector aria-label="Footer Language Selector">${renderLangOptions(currentLang)}</select>
              </label>
            </div>

            <div>
              <h3 class="footer-heading">Ekosistem NULAR</h3>
              <ul class="footer-links">
                <li><a href="portal.html">Portal Eksplorasi 3D</a></li>
                <li><a href="explore.html">Penemuan Budaya (38 Provinsi)</a></li>
                <li><a href="map.html">Peta Nusantara Interaktif</a></li>
                <li><a href="learn.html">Pusat Belajar &amp; Koleksi</a></li>
                <li><a href="quests.html">Misi, Pencapaian &amp; Peringkat</a></li>
              </ul>
            </div>

            <div>
              <h3 class="footer-heading">Dunia &amp; Identitas</h3>
              <ul class="footer-links">
                <li><a href="world.html">Masuk Dunia Budaya 3D</a></li>
                <li><a href="anatomy.html">Anatomi &amp; Perbandingan</a></li>
                <li><a href="profile.html">Profil Penjelajah &amp; Jurnal</a></li>
                <li><a href="auth.html">Masuk / Daftar &amp; Pengaturan</a></li>
              </ul>
            </div>

            <div>
              <h3 class="footer-heading">Tata Kelola &amp; Referensi</h3>
              <ul class="footer-links">
                <li><a href="about.html#mission">Misi Pelestarian Budaya</a></li>
                <li><a href="about.html#sources">Sumber DAPOBUD &amp; Standar Riset</a></li>
                <li><a href="about.html#attribution">Registri Lisensi 3D &amp; Foto</a></li>
              </ul>
            </div>
          </div>

          <div class="museum-footer__bottom">
            <span>© 2026 NULAR (Nusa Learn) — Explore the Living Heritage of Indonesia.</span>
            <span data-i18n="footer.rights">Konten budaya terverifikasi DAPOBUD Kemendikbud RI, UNESCO &amp; dokumentasi ilmiah.</span>
          </div>
        </div>
      </footer>
    `;
  }

  document.querySelectorAll('[data-lang-selector]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      I18nManager.setLanguage(e.target.value);
    });
  });

  I18nManager.init();
  window.addEventListener('nular:store-updated', updateSavedBadge);
  window.addEventListener('nular:progression-updated', updateSavedBadge);
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
