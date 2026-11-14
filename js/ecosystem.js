/**
 * RAGAMARA ECOSYSTEM & VERSIONED PERSISTENCE ENGINE (js/ecosystem.js)
 * Phase 5 & Phase 6 Architecture:
 * - RagamaraStore: Versioned schema v2.0.0 localStorage persistence, corruption recovery, idempotent reward ledger
 * - Culturepedia: Digital Cultural Museum grounded in canonical `entities` & `records` from Schema v2.0.0
 * - RegionalDossier: 10-Part Regional Cultural Dossiers for all 7 Indonesian realms
 * - MascotCollection: Interactive Raga expression studio & 6 regional companions
 * - DailyMissions: Live progress tracking, date-boundary reset, idempotent claims
 * - Leaderboard: Explicitly labeled "Papan Peringkat Simulasi Lokal" with dynamic player ranking
 * - Achievements: Real milestone auto-unlocking & filtering
 * - Profile & Settings: Customizable frames, titles, accessibility toggles, and discovery log
 */

window.RagamaraEcosystem = (function() {
  'use strict';

  // =========================================================================
  // 0. VERSIONED STATE & PERSISTENCE MANAGER (RagamaraStore v2.0.0)
  // =========================================================================
  const STORAGE_KEY_V2 = 'ragamara_state_v2';

  const DEFAULT_STATE_V2 = {
    schemaVersion: '2.0.0',
    player: {
      name: 'Firza Penjelajah',
      title: 'Ahli Warisan Minang',
      frame: 'frame_gold_minang',
      activeCompanion: 'raga_badak',
      level: 8,
      xp: 2450,
      xpToNext: 3000,
      gems: 480,
      streakDays: 7
    },
    savedCultureIds: [
      'ragamara_cult_rencong',
      'ragamara_cult_songket_pandai_sikek',
      'ragamara_cult_batik_indonesia'
    ],
    readCultureIds: [
      'ragamara_cult_rencong',
      'ragamara_cult_rumah_gadang'
    ],
    claimedRewardLedger: [], // Idempotent ledger of sessionIds, missionIds, chestIds
    claimedMissionsDate: new Date().toISOString().slice(0, 10),
    claimedMissionIds: ['mission_4'],
    missionCounters: {
      minigamesCompletedToday: 1,
      articlesReadToday: 2,
      perfectScoreToday: 1,
      bookmarksSavedToday: 1
    },
    completedSessions: [],
    unlockedAchievements: ['ach_1', 'ach_2', 'ach_3'],
    settings: {
      sfxEnabled: true,
      notificationsEnabled: true,
      highContrast: false,
      reducedMotion: false,
      dailyGoalMins: 20
    }
  };

  const Store = {
    state: JSON.parse(JSON.stringify(DEFAULT_STATE_V2)),

    init() {
      try {
        const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
        if (rawV2) {
          const parsed = JSON.parse(rawV2);
          if (parsed && typeof parsed === 'object' && parsed.schemaVersion === '2.0.0' && parsed.player && typeof parsed.player.xp === 'number') {
            this.state = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_STATE_V2)), parsed);
            this.state.player = Object.assign({}, DEFAULT_STATE_V2.player, parsed.player);
            this.state.settings = Object.assign({}, DEFAULT_STATE_V2.settings, parsed.settings || {});
            this.state.missionCounters = Object.assign({}, DEFAULT_STATE_V2.missionCounters, parsed.missionCounters || {});
          } else {
            // Corrupted v2 payload -> reset safely
            console.warn('RagamaraStore: Invalid v2 payload detected, restoring safe defaults.');
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE_V2));
          }
        } else {
          // Migrate legacy v1 keys if valid
          this.migrateFromLegacy();
        }
      } catch (err) {
        console.warn('RagamaraStore: Corrupted localStorage detected, recovering gracefully.', err);
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE_V2));
      }

      // Check daily mission date boundary
      const todayStr = new Date().toISOString().slice(0, 10);
      if (this.state.claimedMissionsDate !== todayStr) {
        this.state.claimedMissionsDate = todayStr;
        this.state.claimedMissionIds = [];
      }

      this.syncLegacyGlobals();
      this.save();
    },

    migrateFromLegacy() {
      try {
        const legacyPlayer = JSON.parse(localStorage.getItem('ragamara_player_state') || 'null');
        if (legacyPlayer && typeof legacyPlayer === 'object' && typeof legacyPlayer.xp === 'number' && !isNaN(legacyPlayer.xp)) {
          this.state.player.xp = Math.max(0, legacyPlayer.xp);
          if (typeof legacyPlayer.gems === 'number' && !isNaN(legacyPlayer.gems)) {
            this.state.player.gems = Math.max(0, legacyPlayer.gems);
          }
          if (typeof legacyPlayer.level === 'number') {
            this.state.player.level = legacyPlayer.level;
          }
        }
      } catch (e) {}

      try {
        const legacySaved = JSON.parse(localStorage.getItem('ragamara_saved_culture') || 'null');
        if (Array.isArray(legacySaved) && legacySaved.length > 0) {
          this.state.savedCultureIds = legacySaved;
        }
      } catch (e) {}

      try {
        const legacyMissions = JSON.parse(localStorage.getItem('ragamara_claimed_missions') || 'null');
        if (Array.isArray(legacyMissions)) {
          this.state.claimedMissionIds = legacyMissions;
        }
      } catch (e) {}

      try {
        if (localStorage.getItem('ragamara_chest_claimed') === 'true') {
          if (!this.state.claimedRewardLedger.includes('chest_bab2_minang')) {
            this.state.claimedRewardLedger.push('chest_bab2_minang');
          }
        }
      } catch (e) {}
    },

    syncLegacyGlobals() {
      if (window.GameState) {
        window.GameState.player = Object.assign(window.GameState.player || {}, this.state.player);
        window.GameState.chestClaimed = this.state.claimedRewardLedger.includes('chest_bab2_minang');
      }
      if (typeof window.updateHud === 'function') {
        window.updateHud();
      }
    },

    save() {
      try {
        // Compute dynamic level from XP (every 300 XP = 1 level)
        this.state.player.level = Math.max(8, Math.floor(this.state.player.xp / 300));
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(this.state));
        localStorage.setItem('ragamara_player_state', JSON.stringify(this.state.player));
        localStorage.setItem('ragamara_saved_culture', JSON.stringify(this.state.savedCultureIds));
        localStorage.setItem('ragamara_claimed_missions', JSON.stringify(this.state.claimedMissionIds));
      } catch (e) {}
      this.syncLegacyGlobals();
      const lvlBadge = document.getElementById('hud-level-badge');
      if (lvlBadge) lvlBadge.innerText = `Lv.${this.state.player.level}`;
    },

    awardIdempotent(ledgerKey, xpDelta = 0, gemsDelta = 0) {
      if (ledgerKey && this.state.claimedRewardLedger.includes(ledgerKey)) {
        return false; // Already claimed!
      }
      if (ledgerKey) {
        this.state.claimedRewardLedger.push(ledgerKey);
      }
      this.state.player.xp = Math.max(0, (this.state.player.xp || 0) + xpDelta);
      this.state.player.gems = Math.max(0, (this.state.player.gems || 0) + gemsDelta);
      this.save();
      return true;
    }
  };

  // =========================================================================
  // 1. CULTURAL DATABASE ADAPTER (CANONICAL ENTITIES + SOURCE RECORDS)
  // =========================================================================
  const PROVINCE_TO_REGION = {
    'Aceh': 'Sumatra',
    'Sumatera Utara': 'Sumatra',
    'Sumatera Barat': 'Sumatra',
    'Riau': 'Sumatra',
    'Kepulauan Riau': 'Sumatra',
    'Jambi': 'Sumatra',
    'Sumatera Selatan': 'Sumatra',
    'Kepulauan Bangka Belitung': 'Sumatra',
    'Bengkulu': 'Sumatra',
    'Lampung': 'Sumatra',
    'DKI Jakarta': 'Jawa',
    'Jawa Barat': 'Jawa',
    'Banten': 'Jawa',
    'Jawa Tengah': 'Jawa',
    'Daerah Istimewa Yogyakarta': 'Jawa',
    'Jawa Timur': 'Jawa',
    'Bali': 'Bali & Nusa Tenggara',
    'Nusa Tenggara Barat': 'Bali & Nusa Tenggara',
    'Nusa Tenggara Timur': 'Bali & Nusa Tenggara',
    'Kalimantan Barat': 'Kalimantan',
    'Kalimantan Tengah': 'Kalimantan',
    'Kalimantan Selatan': 'Kalimantan',
    'Kalimantan Timur': 'Kalimantan',
    'Kalimantan Utara': 'Kalimantan',
    'Sulawesi Utara': 'Sulawesi',
    'Gorontalo': 'Sulawesi',
    'Sulawesi Tengah': 'Sulawesi',
    'Sulawesi Barat': 'Sulawesi',
    'Sulawesi Selatan': 'Sulawesi',
    'Sulawesi Tenggara': 'Sulawesi',
    'Maluku': 'Maluku',
    'Maluku Utara': 'Maluku',
    'Papua': 'Papua',
    'Papua Barat': 'Papua',
    'Papua Pegunungan': 'Papua',
    'Papua Tengah': 'Papua',
    'Papua Selatan': 'Papua',
    'Papua Barat Daya': 'Papua'
  };

  const mapToOpkCategory = (domain) => {
    if (!domain) return 'Pengetahuan Tradisional';
    const d = domain.toLowerCase();
    if (d.includes('kemahiran') || d.includes('kerajinan') || d.includes('arsitektur') || d.includes('teknologi')) return 'Teknologi Tradisional';
    if (d.includes('manuskrip') || d.includes('naskah')) return 'Manuskrip';
    if (d.includes('lisan') || d.includes('cerita rakyat')) return 'Tradisi Lisan';
    if (d.includes('ritus') || d.includes('upacara') || d.includes('perayaan')) return 'Ritus';
    if (d.includes('adat')) return 'Adat Istiadat';
    if (d.includes('pengetahuan') || d.includes('alam') || d.includes('kebiasaan')) return 'Pengetahuan Tradisional';
    if (d.includes('seni') || d.includes('pertunjukan') || d.includes('tari') || d.includes('musik')) return 'Seni';
    if (d.includes('bahasa') || d.includes('aksara')) return 'Bahasa';
    if (d.includes('permainan') || d.includes('mainan')) return 'Permainan Rakyat';
    if (d.includes('olahraga') || d.includes('beladiri') || d.includes('pencak')) return 'Olahraga Tradisional';
    return 'Pengetahuan Tradisional';
  };

  const getCanonicalEntities = () => {
    const db = window.RAGAMARA_CULTURE_DB;
    if (!db) return [];
    if (Array.isArray(db.entities) && db.entities.length > 0) {
      return db.entities.map(ent => {
        const primarySource = (ent.source_records && ent.source_records[0]) || {};
        const primaryMedia = (ent.media && ent.media[0]) || {};
        const provList = ent.regional_scope?.provinces || (primarySource.registered_province ? [primarySource.registered_province] : []);
        const provLabel = provList.length > 0 ? provList.join(', ') : (ent.regional_scope?.is_nationwide ? 'Warisan Nasional (Lintas Provinsi)' : 'Nusantara');
        const gameRegion = ent.regional_scope?.primary_game_region || PROVINCE_TO_REGION[provList[0]] || 'Jawa';

        return {
          record_id: ent.entity_id,
          name: ent.canonical_name,
          opk_category: mapToOpkCategory(ent.cultural_domain || ent.dapobud_category_raw),
          raw_category: ent.dapobud_category_raw || ent.cultural_domain,
          province_label: provLabel,
          provinces: provList,
          game_region: gameRegion,
          scope_type: ent.regional_scope?.scope_type || 'single_province',
          source_records: ent.source_records || [],
          dapobud: {
            official_id: primarySource.official_uuid || '',
            number: primarySource.registration_number || 'Terdaftar DAPOBUD',
            entity_type: primarySource.entity_type || 'WBTB',
            category: ent.dapobud_category_raw || ent.cultural_domain,
            region: { province: provLabel, regency_city: primarySource.registered_regency || null },
            official_description: ent.canonical_description || primarySource.official_description || '',
            assignment_date: primarySource.assignment_date || 'Terdaftar Resmi',
            source_url: primarySource.source_url || 'https://dapobud.kemenbud.go.id'
          },
          wikipedia: {
            status: ent.enrichment?.status || 'unmatched',
            page_title: ent.enrichment?.page_title || null,
            page_url: ent.enrichment?.page_url || null,
            extract: ent.enrichment?.summary_extract || null,
            confidence: ent.enrichment?.matching_metadata?.confidence_score || 0,
            review_status: ent.enrichment?.matching_metadata?.review_status || 'not_required',
            image: {
              thumbnail_url: primaryMedia.thumbnail_url || null,
              original_url: primaryMedia.original_url || null,
              creator: primaryMedia.creator || null,
              license: primaryMedia.license || null,
              attribution: primaryMedia.attribution_text || null
            }
          }
        };
      });
    }
    return db.records || [];
  };

  // =========================================================================
  // 2. CULTUREPEDIA CONTROLLER (DIGITAL CULTURAL MUSEUM)
  // =========================================================================
  const Culturepedia = {
    searchQuery: '',
    selectedRegion: 'Semua',
    selectedOpk: 'Semua',
    activeTab: 'all',
    savedIds: new Set(),

    init() {
      this.savedIds = new Set(Store.state.savedCultureIds || []);
      this.render();
    },

    saveToStorage() {
      Store.state.savedCultureIds = Array.from(this.savedIds);
      Store.save();
    },

    toggleBookmark(recordId, e) {
      if (e) e.stopPropagation();
      if (this.savedIds.has(recordId)) {
        this.savedIds.delete(recordId);
        window.showToast?.('Artefak dihapus dari koleksi tersimpan');
      } else {
        this.savedIds.add(recordId);
        Store.state.missionCounters.bookmarksSavedToday = (Store.state.missionCounters.bookmarksSavedToday || 0) + 1;
        window.showToast?.('❤️ Pusaka berhasil disimpan ke Koleksi Pribadi');
        window.playGamelanChime?.();
      }
      this.saveToStorage();
      DailyMissions.syncFromStore();
      this.render();
    },

    filterRecords() {
      const all = getCanonicalEntities();
      return all.filter(r => {
        const name = (r.name || '').toLowerCase();
        const prov = (r.province_label || '').toLowerCase();
        const region = r.game_region || 'Lainnya';
        const opk = r.opk_category;
        const desc = ((r.dapobud?.official_description || '') + ' ' + (r.wikipedia?.extract || '')).toLowerCase();

        if (this.searchQuery) {
          const q = this.searchQuery.trim().toLowerCase();
          if (!name.includes(q) && !prov.includes(q) && !desc.includes(q) && !opk.toLowerCase().includes(q)) {
            return false;
          }
        }

        if (this.selectedRegion !== 'Semua') {
          if (region !== this.selectedRegion) return false;
        }

        if (this.selectedOpk !== 'Semua') {
          if (opk !== this.selectedOpk) return false;
        }

        if (this.activeTab === 'saved') {
          if (!this.savedIds.has(r.record_id)) return false;
        }

        return true;
      });
    },

    render() {
      const container = document.getElementById('culturepedia-grid');
      const counterEl = document.getElementById('culturepedia-count');
      if (!container) return;

      const allEntities = getCanonicalEntities();
      const filtered = this.filterRecords();

      if (counterEl) {
        counterEl.innerText = `Menampilkan ${filtered.length} dari ${allEntities.length} Entitas Kanonis (50 Rekaman Resmi DAPOBUD RI)`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-14 text-center bg-[#173F32]/80 rounded-3xl border border-[#D4A447]/30 p-8">
            <span class="material-symbols-outlined text-5xl text-[#F2C45A]">search_off</span>
            <h4 class="text-xl font-bold text-[#FAF6EF] mt-3">Tidak Ada Entri Budaya yang Cocok</h4>
            <p class="text-xs text-[#DFD5C3] mt-1 max-w-md mx-auto">
              Tidak ditemukan pusaka untuk kata kunci atau kombinasi filter tersebut. Klik tombol di bawah untuk menampilkan kembali seluruh arsip.
            </p>
            <button onclick="RagamaraEcosystem.Culturepedia.resetFilters()" class="btn btn-primary mt-5 text-xs py-2.5 px-6">
              Reset Semua Filter
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(r => {
        const isSaved = this.savedIds.has(r.record_id);
        const fallbackImg = r.game_region === 'Sumatra' ? 'assets/images/rumah_gadang.png' :
                            r.game_region === 'Jawa' ? 'assets/images/batik_keraton.jpg' :
                            r.game_region === 'Kalimantan' ? 'assets/images/alam_kalimantan.jpg' :
                            r.game_region === 'Sulawesi' ? 'assets/images/alam_sulawesi.jpg' :
                            r.game_region === 'Maluku' ? 'assets/images/alam_maluku.jpg' :
                            r.game_region === 'Papua' ? 'assets/images/alam_papua.jpg' :
                            'assets/images/alam_bali_nt.jpg';
        const imgUrl = r.wikipedia?.image?.thumbnail_url || fallbackImg;
        const hasWiki = r.wikipedia?.status === 'matched' && r.wikipedia?.extract;
        const officialDesc = r.dapobud?.official_description;
        const snippet = officialDesc || r.wikipedia?.extract || 'Tercatat secara resmi dalam pangkalan Data Pokok Kebudayaan (DAPOBUD) Kementerian Kebudayaan RI.';
        const sourceCount = (r.source_records && r.source_records.length) || 1;

        return `
          <div class="card-cultural group cursor-pointer flex flex-col justify-between transition-all hover:scale-[1.01]" onclick="RagamaraEcosystem.Culturepedia.openDetail('${r.record_id}')">
            <div>
              <div class="card-cultural-media h-48 relative overflow-hidden" style="background-image: url('${imgUrl}');">
                <div class="absolute inset-0 bg-gradient-to-t from-[#102B25] via-transparent to-black/35"></div>
                <div class="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                  <span class="px-2.5 py-1 rounded-full bg-[#102B25]/90 text-[#F2C45A] font-black text-[10px] tracking-wider uppercase border border-[#D4A447]/40 backdrop-blur-md">
                    ${r.opk_category}
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-[#B65F45] text-white font-black text-[9px] uppercase tracking-wider">
                    ${r.game_region}
                  </span>
                </div>
                <button type="button" onclick="RagamaraEcosystem.Culturepedia.toggleBookmark('${r.record_id}', event)" class="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-[#102B25]/85 backdrop-blur-md flex items-center justify-center text-white hover:text-[#D96B4E] border border-[#D4A447]/35 transition-all ${isSaved ? 'text-[#D96B4E]' : ''}" title="${isSaved ? 'Hapus Simpanan' : 'Simpan Artefak'}">
                  <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">favorite</span>
                </button>
                <div class="absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-white/95">
                  <span class="font-bold flex items-center gap-1 truncate max-w-[60%]"><span class="material-symbols-outlined text-[14px] text-[#34A59F]">location_on</span> ${r.province_label}</span>
                  <span class="text-[10px] text-[#F2C45A] bg-[#102B25]/90 px-2 py-0.5 rounded-full font-mono border border-[#D4A447]/30">${r.dapobud.number}</span>
                </div>
              </div>
              <div class="p-5 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="font-extrabold text-base text-[#FAF6EF] group-hover:text-[#F2C45A] transition-colors leading-snug">
                    ${r.name}
                  </h4>
                  ${sourceCount > 1 ? `<span class="text-[10px] px-2 py-0.5 rounded bg-[#287E7A]/40 text-[#34A59F] font-mono shrink-0">${sourceCount} Rekaman</span>` : ''}
                </div>
                <p class="text-xs text-[#DFD5C3] line-clamp-3 leading-relaxed">
                  ${snippet}
                </p>
              </div>
            </div>
            <div class="px-5 pb-4 pt-3 border-t border-[#D4A447]/20 flex items-center justify-between text-xs mt-2">
              <span class="text-[10px] font-bold flex items-center gap-1 ${hasWiki ? 'text-[#34A59F]' : 'text-[#F2C45A]'}">
                <span class="w-1.5 h-1.5 rounded-full ${hasWiki ? 'bg-[#34A59F]' : 'bg-[#F2C45A]'}"></span>
                ${hasWiki ? 'DAPOBUD + Wikipedia Terverifikasi' : 'Sumber Resmi DAPOBUD RI'}
              </span>
              <span class="text-[#F2C45A] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Buka Arsip <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </span>
            </div>
          </div>
        `;
      }).join('');
    },

    resetFilters() {
      this.searchQuery = '';
      this.selectedRegion = 'Semua';
      this.selectedOpk = 'Semua';
      this.activeTab = 'all';
      const searchInput = document.getElementById('culturepedia-search');
      if (searchInput) searchInput.value = '';
      document.querySelectorAll('.opk-filter-btn').forEach(b => b.classList.remove('active-filter'));
      document.querySelector('.opk-filter-btn[data-cat="Semua"]')?.classList.add('active-filter');
      document.querySelectorAll('.region-filter-btn').forEach(b => b.classList.remove('active-filter'));
      document.querySelector('.region-filter-btn[data-reg="Semua"]')?.classList.add('active-filter');
      this.render();
    },

    openDetail(recordId) {
      const all = getCanonicalEntities();
      const r = all.find(item => item.record_id === recordId || item.dapobud?.official_id === recordId);
      if (!r) return;

      // Track article read for Daily Missions & Profile
      if (!Store.state.readCultureIds.includes(r.record_id)) {
        Store.state.readCultureIds.push(r.record_id);
        Store.state.missionCounters.articlesReadToday = (Store.state.missionCounters.articlesReadToday || 0) + 1;
        Store.save();
        DailyMissions.syncFromStore();
      }

      const modal = document.getElementById('culturepedia-detail-modal');
      const body = document.getElementById('culturepedia-detail-body');
      if (!modal || !body) return;

      const fallbackImg = r.game_region === 'Sumatra' ? 'assets/images/rumah_gadang.png' : 'assets/images/batik_keraton.jpg';
      const imgUrl = r.wikipedia?.image?.original_url || r.wikipedia?.image?.thumbnail_url || fallbackImg;
      const imgAttribution = r.wikipedia?.image?.creator || r.wikipedia?.image?.attribution || 'Dokumentasi Katalog Budaya Nusantara';
      const imgLicense = r.wikipedia?.image?.license || 'CC BY-SA / Domain Publik';
      const officialDesc = r.dapobud?.official_description
        ? r.dapobud.official_description
        : 'Entri ini tercatat resmi dalam pangkalan Data Pokok Kebudayaan (DAPOBUD) sebagai Objek Pemajuan Kebudayaan (OPK), namun teks deskripsi naratif pada sumber asal masih berupa metadata administratif singkat.';
      const wikiExtract = r.wikipedia?.extract
        ? r.wikipedia.extract
        : 'Entitas budaya spesifik daerah ini belum memiliki artikel terpisah yang terverifikasi semantik di Wikipedia Bahasa Indonesia. Sistem NULAR (Nusa Learn) tidak memfabrikasi ringkasan demi menjaga kejujuran sumber.';
      const isSaved = this.savedIds.has(r.record_id);

      // Find related cultural items from same region
      const relatedItems = all.filter(item => item.record_id !== r.record_id && item.game_region === r.game_region).slice(0, 3);

      body.innerHTML = `
        <div class="space-y-6">
          <div class="relative w-full h-60 sm:h-72 rounded-2xl overflow-hidden border border-[#D4A447]/40 shadow-2xl bg-[#102B25]">
            <img src="${imgUrl}" alt="${r.name}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-[#102B25] via-[#102B25]/35 to-black/40"></div>
            
            <div class="absolute top-4 left-4 flex flex-wrap gap-2">
              <span class="px-3 py-1 rounded-full bg-[#102B25]/90 text-[#F2C45A] font-extrabold text-xs uppercase tracking-wider border border-[#D4A447]/40">
                ${r.opk_category}
              </span>
              <span class="px-3 py-1 rounded-full bg-[#B65F45] text-white font-black text-xs uppercase tracking-wider">
                ${r.game_region} • ${r.province_label}
              </span>
            </div>

            <button type="button" onclick="RagamaraEcosystem.Culturepedia.toggleBookmark('${r.record_id}'); RagamaraEcosystem.Culturepedia.openDetail('${r.record_id}');" class="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-[#102B25]/90 backdrop-blur-md border border-[#D4A447]/40 text-xs font-bold flex items-center gap-1.5 text-white hover:text-[#F2C45A] transition-colors">
              <span class="material-symbols-outlined text-[18px] text-[#D96B4E]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">favorite</span>
              <span>${isSaved ? 'Tersimpan di Koleksi' : 'Simpan ke Koleksi'}</span>
            </button>

            <div class="absolute bottom-4 left-4 right-4">
              <span class="text-xs font-mono text-[#34A59F] font-bold bg-[#102B25]/90 px-2.5 py-1 rounded-md border border-[#34A59F]/30">
                Registrasi DAPOBUD: ${r.dapobud.number} (${r.dapobud.entity_type})
              </span>
              <h2 class="text-2xl sm:text-3xl font-black text-[#FAF6EF] mt-2 drop-shadow-md">
                ${r.name}
              </h2>
            </div>
          </div>

          <!-- Provenance & Source Transparency Bar -->
          <div class="bg-[#102B25] p-4 rounded-2xl border border-[#D4A447]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#34A59F] text-[18px]">verified_user</span>
                <span class="font-extrabold text-[#FAF6EF]">Transparansi Provenans Data v2.0.0:</span>
                <span class="text-[#F2C45A] font-mono">UUID: ${r.dapobud.official_id || r.record_id}</span>
              </div>
              <p class="text-[11px] text-[#DFD5C3]">
                Atribusi Visual: <span class="italic text-white">${imgAttribution}</span> (${imgLicense})
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a href="${r.dapobud.source_url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-[#173F32] hover:bg-[#B65F45] text-[#FAF6EF] transition-colors text-[11px] font-bold flex items-center gap-1 border border-[#D4A447]/30">
                Sumber DAPOBUD <span class="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
              ${r.wikipedia.page_url ? `
                <a href="${r.wikipedia.page_url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-[#173F32] hover:bg-[#287E7A] text-[#FAF6EF] transition-colors text-[11px] font-bold flex items-center gap-1 border border-[#34A59F]/30">
                  Artikel Wikipedia <span class="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Dual-Layer Museum Presentation: Official DAPOBUD vs Wikipedia Enrichment -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="surface-parchment p-5 rounded-2xl border-2 border-[#D6C3A5] space-y-3">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-[#8A422D] font-extrabold text-xs uppercase tracking-wider">
                  <span class="material-symbols-outlined text-[18px]">account_balance</span>
                  Lapisan 1: Arsip Resmi DAPOBUD RI
                </span>
                <span class="px-2 py-0.5 rounded bg-[#8A422D] text-white text-[10px] font-bold">${r.dapobud.entity_type}</span>
              </div>
              <p class="text-xs text-[#292820] leading-relaxed text-justify font-medium">
                ${officialDesc}
              </p>
              <div class="pt-3 border-t border-[#D6C3A5] text-[11px] text-[#5C5849] space-y-1">
                <div><strong>Wilayah Administratif:</strong> ${r.province_label} ${r.dapobud.region?.regency_city ? `(${r.dapobud.region.regency_city})` : ''}</div>
                <div><strong>Domain Asli:</strong> ${r.raw_category}</div>
                <div><strong>Jumlah Rekaman Sumber:</strong> ${(r.source_records && r.source_records.length) || 1} Rekaman Terhubung</div>
              </div>
            </div>

            <div class="bg-[#102B25] p-5 rounded-2xl border border-[#D4A447]/30 space-y-3 flex flex-col justify-between">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="flex items-center gap-1.5 text-[#34A59F] font-extrabold text-xs uppercase tracking-wider">
                    <span class="material-symbols-outlined text-[18px]">auto_stories</span>
                    Lapisan 2: Pengayaan Ensiklopedia
                  </span>
                  <span class="px-2 py-0.5 rounded bg-[#173F32] text-[#F2C45A] text-[10px] font-mono">
                    Status: ${r.wikipedia.status === 'matched' ? `Terverifikasi (${Math.round((r.wikipedia.confidence || 1) * 100)}%)` : 'Hanya DAPOBUD'}
                  </span>
                </div>
                <p class="text-xs text-[#DFD5C3] leading-relaxed text-justify">
                  ${wikiExtract}
                </p>
              </div>

              <div class="p-3.5 rounded-xl bg-[#173F32] border border-[#F2C45A]/35 mt-4 flex items-center justify-between gap-3">
                <div>
                  <h5 class="text-xs font-black text-[#FAF6EF]">Uji Pemahaman di Arena Mini-Game</h5>
                  <p class="text-[11px] text-[#DFD5C3]">Mainkan tantangan interaktif terkait kategori ${r.opk_category}!</p>
                </div>
                <button type="button" onclick="RagamaraEcosystem.Culturepedia.launchGameChallenge('${r.record_id}');" class="btn btn-primary text-xs py-2 px-4 shrink-0">
                  Mainkan ➔
                </button>
              </div>
            </div>
          </div>

          ${relatedItems.length > 0 ? `
            <div class="space-y-2.5 pt-2">
              <h4 class="text-xs font-black uppercase text-[#F2C45A] tracking-wider">Pusaka Terkait di Wilayah ${r.game_region}:</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${relatedItems.map(rel => `
                  <button type="button" onclick="RagamaraEcosystem.Culturepedia.openDetail('${rel.record_id}')" class="text-left p-3 rounded-xl bg-[#102B25] hover:bg-[#1E4E3E] border border-[#D4A447]/30 transition-all">
                    <span class="text-[10px] font-bold text-[#34A59F] uppercase">${rel.opk_category}</span>
                    <p class="text-xs font-extrabold text-[#FAF6EF] truncate mt-0.5">${rel.name}</p>
                    <p class="text-[10px] text-[#DFD5C3] truncate">${rel.province_label}</p>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="flex justify-between items-center pt-4 border-t border-[#D4A447]/25">
            <span class="text-xs text-[#DFD5C3]">
              ID Kanonis: <span class="font-mono text-[#F2C45A]">${r.record_id}</span>
            </span>
            <button type="button" onclick="RagamaraEcosystem.Culturepedia.closeDetail()" class="btn btn-secondary text-xs py-2 px-6">
              Tutup Arsip
            </button>
          </div>
        </div>
      `;

      modal.classList.add('is-open');
    },

    closeDetail() {
      const modal = document.getElementById('culturepedia-detail-modal');
      if (modal) modal.classList.remove('is-open');
    },

    launchGameChallenge(recordId) {
      this.closeDetail();
      const all = getCanonicalEntities();
      const r = all.find(item => item.record_id === recordId);
      const cat = ((r?.raw_category || '') + ' ' + (r?.opk_category || '')).toLowerCase();
      const name = (r?.name || '').toLowerCase();

      let targetArena = 'A';
      if (cat.includes('teknologi') || name.includes('rumah') || name.includes('rencong') || name.includes('keris')) {
        targetArena = 'C';
      } else if (cat.includes('seni') || name.includes('tor-tor') || name.includes('gordang') || name.includes('dambus')) {
        targetArena = 'D';
      } else if (name.includes('batik') || name.includes('songket') || name.includes('ulap') || name.includes('kain')) {
        targetArena = 'F';
      } else if (cat.includes('adat') || cat.includes('ritus') || name.includes('tabot')) {
        targetArena = 'E';
      } else {
        targetArena = 'B';
      }

      window.switchView?.('belajar');
      if (window.MiniGameEngine) {
        window.MiniGameEngine.openArena(targetArena);
      }
    }
  };

  // =========================================================================
  // 3. REGIONAL DOSSIER CONTROLLER (10-PART FULL CULTURAL DOSSIERS)
  // =========================================================================
  const RegionalDossier = {
    regions: {
      sumatra: {
        title: 'Alam Andalas & Ranah Minang (Sumatera)',
        subtitle: 'Jalur Rempah Samudra, Arsitektur Bagonjong & Aksara Ulu',
        desc: 'Sumatera adalah gerbang barat peradaban maritim Nusantara. Dari tradisi kesultanan di Aceh dengan pusaka Rencong, ritus Gordang Sambilan dan Tor-Tor di Sumatera Utara, arsitektur tahan gempa Rumah Gadang dan tenun Songket Pandai Sikek di Sumatera Barat, hingga koridor Aksara Ka Ga Nga di Bengkulu, Jambi, Sumatera Selatan, dan Lampung.',
        geography: 'Membentang sepanjang Bukit Barisan dan pesisir Selat Malaka (10 Provinsi: Aceh, Sumut, Sumbar, Riau, Kepri, Jambi, Sumsel, Babel, Bengkulu, Lampung).',
        architecture: 'Rumah Gadang Bagonjong (Sumbar) dengan sistem pasak kayu tahan gempa & batu sandi; Rumoh Aceh; Rumah Limas Palembang.',
        attire: 'Tenun Songket Pandai Sikek benang emas, Kain Ulos Ragidup Batak, dan kain Tapis Lampung.',
        performingArts: 'Tari Tor-Tor & Gordang Sambilan (Sumut), Tari Piring & Randai (Sumbar), Musik Dambus (Bangka Belitung), Dulmuluk (Sumsel).',
        rituals: 'Upacara Tabot (Bengkulu) & Tabuik (Pariaman, Sumbar), kenduri adat Nagari, dan Makyong (Kepulauan Riau).',
        craftsmanship: 'Tempa besi pusaka Rencong Aceh, kriya tenun Songket, dan manuskrip kulit kayu (gelumpai) Aksara Ka Ga Nga.',
        culinary: 'Rendang Minangkabau (Warisan Budaya Takbenda), Gajeboh, dan olahan rempah pesisir.',
        bannerImg: 'assets/images/rumah_gadang.png',
        mascot: {
          name: 'Raga Deta Minang',
          role: 'Pemandu Ekspedisi Andalas',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '75% Selesai (Bab 1 & 2 Aktif)',
        recommendedArena: 'A',
        chapters: [
          'Bab 1: Serambi Mekkah & Pusaka Rencong Aceh',
          'Bab 2: Ranah Minang — Rumah Gadang & Songket Pandai Sikek',
          'Bab 3: Koridor Aksara Ka Ga Nga & Bumi Sriwijaya',
          'Bab 4: Ritus Pesisir Tabot Bengkulu & Tabuik Pariaman'
        ]
      },
      jawa: {
        title: 'Bumi Pasundan, Mataram & Wilwatikta (Jawa)',
        subtitle: 'Harmoni Gamelan, Batik Keraton, Wayang & Ujung Kulon',
        desc: 'Pulau Jawa memadukan tradisi agraris vulkanik, kesusastraan keraton, dan seni pertunjukan rakyat pesisir. Dari seni bela diri Debus Banten dan Angklung Jawa Barat, mahakarya Batik Tulis dan Wayang Kulit di Jawa Tengah dan Yogyakarta, hingga Reog Ponorogo dan teater Ludruk di Jawa Timur.',
        geography: 'Enam provinsi (Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, Jawa Timur) dengan rangkaian gunung berapi subur dan pesisir Laut Jawa.',
        architecture: 'Pendopo Joglo Keraton dengan struktur empatoko guru tumpangsari, Kampung Naga Tasikmalaya, dan gapura bata merah Majapahit.',
        attire: 'Batik Tulis & Cap (Warisan Kemanusiaan UNESCO), Kebaya, Beskap, dan ikat kepala Blangkon / Udeng.',
        performingArts: 'Wayang Kulit Purwa, Angklung Sunda, Reog Ponorogo, Kuda Lumping, Topeng Cirebon, Sintren, dan Ludruk.',
        rituals: 'Debus Banten, Sekaten Keraton, dan tradisi syukuran panen masyarakat agraris.',
        craftsmanship: 'Seni membatik dengan canting & malam, tempa pamor Keris Jawa, dan tatah sungging kulit wayang.',
        culinary: 'Tumpeng filosofis syukuran, olahan tempe kedelai tradisional, dan jamu rempah Nusantara.',
        bannerImg: 'assets/images/alam_jawa.jpg',
        mascot: {
          name: 'Raga si Badak Jawa',
          role: 'Pelindung Pusaka Ujung Kulon',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '60% Selesai (Tersedia)',
        recommendedArena: 'F',
        chapters: [
          'Bab 1: Mahakarya Batik Tulis & Filosofi Canting Malam',
          'Bab 2: Seni Pertunjukan Wayang Kulit, Angklung & Reog Ponorogo',
          'Bab 3: Ketangkasan Debus Banten & Topeng Cirebon',
          'Bab 4: Panggung Rakyat Ludruk & Kuda Lumping'
        ]
      },
      bali_nt: {
        title: 'Pulau Dewata & Kepulauan Sunda Kecil (Bali & Nusa Tenggara)',
        subtitle: 'Falsafah Tri Hita Karana, Subak, Tenun Ikat & Savana',
        desc: 'Gugusan Bali, Nusa Tenggara Barat, dan Nusa Tenggara Timur memelihara keseimbangan sakral antara manusia, alam, dan Sang Pencipta. Wilayah ini terkenal dengan sistem irigasi Subak, teater Topeng Prembon Bali, serta tradisi lisan dan tenun ikat di kepulauan Nusa Tenggara.',
        geography: 'Meliputi Provinsi Bali, Nusa Tenggara Barat (Lombok-Sumbawa), dan Nusa Tenggara Timur (Flores, Sumba, Timor, Rote).',
        architecture: 'Kompleks bangunan Bali berpedoman Asta Kosala Kosali, Candi Bentar, serta arsitektur kerucut Mbaru Niang di Flores.',
        attire: 'Kain Tenun Ikat Sumba dan Flores dengan pewarna alami akar mengkudu dan daun tarum (indigo), serta kain Songket Subahnale.',
        performingArts: 'Topeng Prembon Bali, Tari Kecak, dan musik dawai lontar Sasando dari Pulau Rote.',
        rituals: 'Upacara adat Adat Buantak (Sumbawa, NTB), sistem pembagian air Subak di Bali, serta ritus panen kepulauan.',
        craftsmanship: 'Kriya ukir topeng kayu Bali, tenun ikat ganda, dan anyaman daun lontar.',
        culinary: 'Olahan rempah basa genep Bali dan pangan lokal jagung bose Nusa Tenggara.',
        bannerImg: 'assets/images/alam_bali_nt.jpg',
        mascot: {
          name: 'Jalak Curik & Komo',
          role: 'Penjaga Tirta & Savana',
          avatar: 'assets/images/mascot_jalak_avatar.svg'
        },
        progress: '40% Selesai (Tersedia)',
        recommendedArena: 'E',
        chapters: [
          'Bab 1: Harmoni Tri Hita Karana & Sistem Irigasi Subak Bali',
          'Bab 2: Seni Pertunjukan Topeng Prembon Bali',
          'Bab 3: Tradisi Adat Buantak Sumbawa (NTB)',
          'Bab 4: Warisan Tenun Ikat & Sasando Nusa Tenggara'
        ]
      },
      kalimantan: {
        title: 'Bumi Borneo & Rimba Sungai Raya (Kalimantan)',
        subtitle: 'Rumah Panjang Dayak, Tenun Ulap Doyo & Sungai Mahakam',
        desc: 'Kalimantan adalah tanah sungai-sungai raksasa dan hutan hujan tropis tempat berkembangnya peradaban suku Dayak, Melayu, Banjar, dan Kutai. Kehidupan komunal terwujud dalam arsitektur Rumah Panjang (Betang/Radakng/Lamin) dan kriya serat daun Ulap Doyo.',
        geography: 'Lima provinsi di Pulau Kalimantan (Kalbar, Kalteng, Kalsel, Kaltim, Kaltara) yang dihubungkan oleh jaringan sungai Kapuas, Barito, dan Mahakam.',
        architecture: 'Rumah Panjang Dayak (Rumah Betang / Radakng / Lamin) berbahan kayu ulin tahan banjir dan Rumah Bubungan Tinggi Banjar.',
        attire: 'Kain Tenun Ulap Doyo dari serat daun tanaman doyo (Curculigo latifolia) khas suku Dayak Benuaq Kalimantan Timur, serta kain Sasirangan.',
        performingArts: 'Alunan petikan alat musik dawai Sape (Sampeq) dan tarian Hudoq penolak bala.',
        rituals: 'Musyawarah komunal Huma Betang dan upacara syukuran panen Gawai Dayak / Naik Dango.',
        craftsmanship: 'Tenun serat alam Ulap Doyo, anyaman rotan Anjat, serta ukiran tameng kayu Talawang.',
        culinary: 'Olahan ikan sungai segar, bubur pedas Sambas, dan Soto Banjar berempah.',
        bannerImg: 'assets/images/alam_kalimantan.jpg',
        mascot: {
          name: 'Bekti si Bekantan',
          role: 'Penjelajah Rimba Mahakam',
          avatar: 'assets/images/mascot_bekti_avatar.svg'
        },
        progress: '50% Selesai (Tersedia)',
        recommendedArena: 'C',
        chapters: [
          'Bab 1: Solidaritas Komunal Rumah Panjang Dayak (Betang / Radakng)',
          'Bab 2: Kriya Serat Alam Tenun Ulap Doyo Kalimantan Timur',
          'Bab 3: Harmoni Dawai Sape & Tradisi Sungai Borneo',
          'Bab 4: Kearifan Konservasi Hutan Adat Kalimantan'
        ]
      },
      sulawesi: {
        title: 'Celebes, Tanah Toraja & Pelaut Bahari (Sulawesi)',
        subtitle: 'Layar Phinisi, Rumah Tongkonan, Saiyyang Pattu’du & Tari Raigo',
        desc: 'Sulawesi memadukan ketangguhan maritim pelaut Bugis-Makassar-Mandar dengan kekayaan ritual dataran tinggi Toraja, Sulawesi Tengah, dan Minahasa. Dalam pangkalan DAPOBUD, wilayah ini mencakup tradisi kuda menari Saiyyang Pattu’du di Sulawesi Barat, Tari Raigo di Sulawesi Tengah, hingga Karia di Sulawesi Tenggara.',
        geography: 'Enam provinsi berbentuk huruf K (Sulawesi Selatan, Sulawesi Barat, Sulawesi Tengah, Sulawesi Tenggara, Gorontalo, Sulawesi Utara).',
        architecture: 'Rumah Adat Tongkonan Toraja beratap lengkung perahu dan rumah panggung Sao Raja Bugis.',
        attire: 'Baju Bodo tenun sutra Sengkang dan busana adat Karawo Gorontalo.',
        performingArts: 'Atraksi kuda menari Saiyyang Pattu’du (Mandar, Sulbar), Tari Raigo (Sulteng), dan Tari Maengket (Sulut).',
        rituals: 'Upacara adat Karia (Muna, Sulawesi Tenggara), ritus syukuran panen, dan tradisi pelayaran bahari.',
        craftsmanship: 'Teknologi pembuatan perahu layar Phinisi tanpa cetak biru tertulis dan ukiran kayu Pa’tedong Toraja.',
        culinary: 'Kuliner rempah pesisir dan dataran tinggi Sulawesi (kategorisasi khusus kuliner dalam sampel 50 entri DAPOBUD masih terbatas pada metadata umum).',
        bannerImg: 'assets/images/alam_sulawesi.jpg',
        mascot: {
          name: 'Maleo si Burung Pasir',
          role: 'Penjaga Pesisir & Pegunungan',
          avatar: 'assets/images/mascot_maleo_avatar.svg'
        },
        progress: '35% Selesai (Tersedia)',
        recommendedArena: 'B',
        chapters: [
          'Bab 1: Tradisi Kuda Menari Saiyyang Pattu’du (Sulawesi Barat)',
          'Bab 2: Tari Raigo & Kearifan Komunal Sulawesi Tengah',
          'Bab 3: Ritus Adat Karia di Sulawesi Tenggara',
          'Bab 4: Warisan Maritim Phinisi & Ukiran Tongkonan'
        ]
      },
      maluku: {
        title: 'Kepulauan Rempah & Samudra Timur (Maluku)',
        subtitle: 'Konservasi Sasi Adat, Kaligrafi Kalwedo & Bambu Gila',
        desc: 'Kepulauan Maluku dan Maluku Utara adalah pusat rempah pala dan cengkih dunia sekaligus rumah bagi ikatan persaudaraan adat Pela Gandong dan Kalwedo. Masyarakatnya merawat laut dengan hukum adat Sasi dan melestarikan seni pertunjukan Bambu Gila (Baramaswen).',
        geography: 'Gugusan kepulauan vulkanik dan atol karang di Provinsi Maluku dan Maluku Utara (Ambon, Seram, Banda, Halmahera, Ternate, Tidore, Maluku Barat Daya).',
        architecture: 'Baileo (Balai Musyawarah Adat terbuka tanpa dinding) dan Rumah Sasadu di Halmahera Barat.',
        attire: 'Busana Baju Cele motif kotak merah-putih dan tenun ikat kepulauan Maluku Barat Daya.',
        performingArts: 'Atraksi tradisional Bambu Gila (Baramaswen), tabuhan perkusi Tifa Totobuang, dan Tari Cakalele.',
        rituals: 'Ikatan persaudaraan adat Kalwedo (Maluku Barat Daya) dan konservasi ekologi laut Sasi Adat.',
        craftsmanship: 'Kriya ukir perahu kora-kora, pembuatan instrumen Tifa kayu lenggua, dan pengolahan sagu tradisional.',
        culinary: 'Papeda sagu dengan kuah ikan kuning rempah kenari dan pala.',
        bannerImg: 'assets/images/alam_maluku.jpg',
        mascot: {
          name: 'Kakatua Seram',
          role: 'Duta Kepulauan Rempah',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '25% Selesai (Tersedia)',
        recommendedArena: 'E',
        chapters: [
          'Bab 1: Falsafah Persaudaraan Kalwedo (Maluku Barat Daya)',
          'Bab 2: Tradisi Permainan Rakyat Bambu Gila (Baramaswen)',
          'Bab 3: Kearifan Ekologi Laut Sasi Adat Maluku',
          'Bab 4: Irama Tifa & Sejarah Jalur Rempah Nusantara'
        ]
      },
      papua: {
        title: 'Tanah Cenderawasih & Pegunungan Tengah (Papua)',
        subtitle: 'Tas Noken UNESCO, Tradisi Bakar Batu Barapen & Ukiran Asmat',
        desc: 'Tanah Papua menyimpan keanekaragaman bahasa, ekologis, dan teknologi tradisional yang luar biasa—mulai dari pesisir Raja Ampat dan Teluk Cenderawasih hingga Lembah Baliem di Papua Pegunungan. Warisan utamanya mencakup tas rajut serat kulit kayu Noken (UNESCO), tradisi masak bersama Barapen (Bakar Batu), hingga pengetahuan pengobatan dan teknologi tradisional seperti Aek Soap.',
        geography: 'Enam provinsi di Tanah Papua (Papua, Papua Barat, Papua Pegunungan, Papua Tengah, Papua Selatan, Papua Barat Daya).',
        architecture: 'Rumah Honai berbentuk bundar beratap jerami di Lembah Baliem untuk menahan dingin pegunungan, serta Rumah Kariwari di pesisir.',
        attire: 'Tas rajut serat pohon Noken yang dikenakan di kepala sebagai simbol kemandirian dan kesuburan.',
        performingArts: 'Tabuhan Tifa Papua, tarian Yospan (Yosim Pancar) yang penuh semangat persahabatan, dan nyanyian lisan Wor.',
        rituals: 'Upacara kebersamaan dan perdamaian Barapen (Bakar Batu) serta ekspresi budaya syukuran panen.',
        craftsmanship: 'Pemintalan serat kulit kayu Noken, seni pahat kayu Asmat, dan teknologi tradisional Aek Soap (Kab. Yalimo, Papua Pegunungan).',
        culinary: 'Hidangan ubi hipere dan sayur pakis yang dimasak di atas batu panas dalam tradisi Barapen, serta papeda sagu.',
        bannerImg: 'assets/images/alam_papua.jpg',
        mascot: {
          name: 'Cendro si Cenderawasih',
          role: 'Penyanyi Surga Papua',
          avatar: 'assets/images/mascot_cendro_avatar.svg'
        },
        progress: '45% Selesai (Tersedia)',
        recommendedArena: 'D',
        chapters: [
          'Bab 1: Filosofi Tas Rajut Serat Kayu Noken (Warisan UNESCO)',
          'Bab 2: Kebersamaan Upacara Barapen (Bakar Batu) Papua',
          'Bab 3: Pengetahuan & Teknologi Tradisional Aek Soap (Papua Pegunungan)',
          'Bab 4: Arsitektur Hangat Rumah Honai & Seni Ukir Asmat'
        ]
      }
    },

    open(regionKey) {
      const key = (regionKey || 'sumatra').toLowerCase();
      const data = this.regions[key] || this.regions.sumatra;
      const modal = document.getElementById('regional-dossier-modal');
      const body = document.getElementById('regional-dossier-body');
      if (!modal || !body) return;

      const allEntities = getCanonicalEntities();
      const regionNameMap = {
        sumatra: 'Sumatra',
        jawa: 'Jawa',
        bali_nt: 'Bali & Nusa Tenggara',
        kalimantan: 'Kalimantan',
        sulawesi: 'Sulawesi',
        maluku: 'Maluku',
        papua: 'Papua'
      };
      const targetRegionName = regionNameMap[key] || 'Sumatra';
      const regionalItems = allEntities.filter(r => r.game_region === targetRegionName || r.scope_type === 'national_heritage');

      body.innerHTML = `
        <div class="space-y-6">
          <!-- 1. Regional Hero Banner -->
          <div class="relative w-full h-56 sm:h-68 rounded-2xl overflow-hidden border-2 border-[#D4A447]/45 shadow-2xl" style="background-image: url('${data.bannerImg}'); background-size: cover; background-position: center;">
            <div class="absolute inset-0 bg-gradient-to-t from-[#102B25] via-[#102B25]/45 to-black/30"></div>
            <div class="absolute top-4 left-4 flex flex-wrap gap-2">
              <span class="px-3 py-1 rounded-full bg-[#F2C45A] text-[#292820] font-black text-xs uppercase tracking-wider shadow">
                Dossier Wilayah Nusantara
              </span>
              <span class="px-3 py-1 rounded-full bg-[#173F32]/90 text-[#34A59F] border border-[#34A59F]/40 font-extrabold text-xs uppercase">
                ${data.progress}
              </span>
            </div>
            <button type="button" onclick="RagamaraEcosystem.RegionalDossier.close()" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#102B25]/90 text-white hover:text-[#F2C45A] flex items-center justify-center border border-[#D4A447]/40">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div class="absolute bottom-4 left-4 right-4">
              <span class="text-xs uppercase font-extrabold text-[#F2C45A] tracking-wider">${data.subtitle}</span>
              <h2 class="text-2xl sm:text-3xl font-black text-[#FAF6EF] mt-0.5">${data.title}</h2>
            </div>
          </div>

          <!-- 2. Cultural Identity Overview & Regional Mascot Companion -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div class="md:col-span-2 surface-parchment p-5 rounded-2xl border-2 border-[#D6C3A5] space-y-2.5">
              <h4 class="text-xs font-black text-[#8A422D] uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">travel_explore</span>
                <span>1. Ikhtisar Identitas & Konteks Geografis</span>
              </h4>
              <p class="text-xs text-[#292820] leading-relaxed text-justify font-medium">${data.desc}</p>
              <p class="text-[11px] text-[#5C5849] pt-2 border-t border-[#D6C3A5]">
                <strong>Bentang Geografis:</strong> ${data.geography}
              </p>
            </div>

            <div class="bg-[#102B25] p-5 rounded-2xl border border-[#D4A447]/35 flex flex-col items-center text-center justify-center space-y-2">
              <div class="w-16 h-16 rounded-2xl bg-[#173F32] p-1.5 border-2 border-[#F2C45A] shadow-lg overflow-hidden">
                <img src="${data.mascot.avatar}" alt="${data.mascot.name}" class="w-full h-full object-contain">
              </div>
              <div>
                <h5 class="font-extrabold text-sm text-[#FAF6EF]">${data.mascot.name}</h5>
                <p class="text-[11px] text-[#34A59F] font-semibold">${data.mascot.role}</p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-[#F2C45A]/20 text-[#F2C45A] text-[10px] font-extrabold">
                ${regionalItems.length} Entitas DAPOBUD Terkait
              </span>
            </div>
          </div>

          <!-- 3-8. Six Structured Cultural Pillars (10-Part Dossier Requirement) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#F2C45A] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">roofing</span> Arsitektur Vernakular</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.architecture}</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#34A59F] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">checkroom</span> Busana & Tekstil Adat</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.attire}</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#D96B4E] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">theater_comedy</span> Seni Pertunjukan & Musik</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.performingArts}</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#F2C45A] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">Groups</span> Ritus & Adat Istiadat</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.rituals}</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#34A59F] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">handyman</span> Kriya, Senjata & Aksara</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.craftsmanship}</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#102B25] border border-[#D4A447]/25 space-y-1">
              <span class="text-[#D96B4E] font-black uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">restaurant</span> Tradisi Kuliner & Pangan</span>
              <p class="text-[#DFD5C3] leading-relaxed">${data.culinary}</p>
            </div>
          </div>

          <!-- 9. Connected Learning Journey Chapters -->
          <div class="space-y-2.5">
            <h4 class="text-xs font-black text-[#FAF6EF] uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[#F2C45A] text-[18px]">map</span>
              <span>Bab Jalur Belajar & Tantangan Wilayah</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${data.chapters.map((ch, idx) => `
                <button type="button" onclick="RagamaraEcosystem.RegionalDossier.launchChapter('${data.recommendedArena}')" class="text-left p-3.5 rounded-xl bg-[#102B25] border border-[#D4A447]/30 flex items-center justify-between hover:border-[#F2C45A] transition-all cursor-pointer">
                  <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-[#B65F45] text-white text-[11px] font-black flex items-center justify-center shrink-0">${idx + 1}</span>
                    <span class="text-xs font-bold text-[#FAF6EF]">${ch}</span>
                  </div>
                  <span class="material-symbols-outlined text-[16px] text-[#F2C45A]">play_arrow</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 10. Verified Database Entities in this Region -->
          <div class="space-y-2.5 pt-1">
            <h4 class="text-xs font-black text-[#FAF6EF] uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[#34A59F] text-[18px]">verified</span>
              <span>Entitas Budaya Terverifikasi DAPOBUD di Wilayah Ini (${regionalItems.length} Entitas)</span>
            </h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              ${regionalItems.slice(0, 6).map(item => `
                <button type="button" onclick="RagamaraEcosystem.RegionalDossier.close(); RagamaraEcosystem.Culturepedia.openDetail('${item.record_id}');" class="text-left p-3 rounded-xl bg-[#102B25] border border-[#D4A447]/25 hover:border-[#34A59F] transition-colors cursor-pointer">
                  <span class="text-[9px] font-black uppercase text-[#F2C45A]">${item.opk_category}</span>
                  <h5 class="text-xs font-black text-[#FAF6EF] truncate mt-0.5">${item.name}</h5>
                  <p class="text-[10px] text-[#34A59F] font-semibold truncate">${item.province_label}</p>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-[#D4A447]/25">
            <button type="button" onclick="RagamaraEcosystem.RegionalDossier.close()" class="btn btn-secondary text-xs py-2.5 px-6 w-full sm:w-auto">
              Kembali ke Peta Kepulauan
            </button>
            <div class="flex items-center gap-2.5 w-full sm:w-auto">
              <button type="button" onclick="RagamaraEcosystem.RegionalDossier.launchChapter('${data.recommendedArena}')" class="btn btn-gold text-xs py-2.5 px-5 flex-1 sm:flex-initial">
                Mainkan Mini-Game Wilayah (${data.recommendedArena})
              </button>
              <button type="button" onclick="RagamaraEcosystem.RegionalDossier.startExploration('${key}')" class="btn btn-primary text-xs py-2.5 px-6 flex-1 sm:flex-initial">
                Masuk Jalur Belajar ➔
              </button>
            </div>
          </div>
        </div>
      `;

      modal.classList.add('is-open');
    },

    close() {
      const modal = document.getElementById('regional-dossier-modal');
      if (modal) modal.classList.remove('is-open');
    },

    launchChapter(arenaMode = 'A') {
      this.close();
      window.switchView?.('belajar');
      if (window.MiniGameEngine) {
        window.MiniGameEngine.openArena(arenaMode || 'A');
      }
    },

    startExploration(regionKey) {
      this.close();
      window.switchView?.('belajar');
    }
  };

  // =========================================================================
  // 4. MASCOT COLLECTION CONTROLLER
  // =========================================================================
  const MascotCollection = {
    currentExpression: 'neutral',

    mascots: [
      {
        id: 'raga_badak',
        name: 'Raga si Badak Jawa',
        origin: 'Ujung Kulon, Banten (Jawa)',
        status: 'unlocked',
        role: 'Maskot Utama & Pemandu Ekspedisi Nusantara',
        lore: 'Raga adalah Badak Jawa bercula satu (Rhinoceros sondaicus) yang ceria, santun, dan penuh rasa ingin tahu terhadap keragaman budaya Nusantara. Ia mengenakan selempang tenun bermotif bunga bintang serta ikat kepala Deta tradisional.',
        unlockedRequirement: 'Tersedia sejak awal petualangan',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_transparent.png'
      },
      {
        id: 'cendro_cenderawasih',
        name: 'Cendro si Cenderawasih',
        origin: 'Lembah Baliem & Pegunungan Papua',
        status: 'unlocked',
        role: 'Sahabat Musik Tradisi & Noken Papua',
        lore: 'Burung Cenderawasih berbulu keemasan yang mahir menirukan ritme Tifa dan mendampingi penjelajah mempelajari rajutan serat kayu Noken warisan UNESCO.',
        unlockedRequirement: 'Terbuka pada Ekspedisi Papua',
        badge: 'assets/images/mascot_cendro_avatar.svg',
        fullImg: 'assets/images/mascot_cendro_avatar.svg'
      },
      {
        id: 'bekti_bekantan',
        name: 'Bekti si Bekantan',
        origin: 'Sungai Mahakam, Kalimantan Timur',
        status: 'unlocked',
        role: 'Penjaga Hutan Tropis & Tenun Ulap Doyo',
        lore: 'Bekantan ramah penjelajah tepian sungai Kalimantan yang membawa tas anyaman rotan Anjat dan menjaga kearifan Rumah Panjang Dayak.',
        unlockedRequirement: 'Terbuka pada Ekspedisi Kalimantan',
        badge: 'assets/images/mascot_bekti_avatar.svg',
        fullImg: 'assets/images/mascot_bekti_avatar.svg'
      },
      {
        id: 'jalak_curik',
        name: 'Jalak Curik Bali',
        origin: 'Taman Nasional Bali Barat',
        status: 'in_progress',
        role: 'Penjaga Kesucian Tirta & Subak Bali',
        lore: 'Burung Jalak Bali berbulu putih bersih dengan lingkar mata biru laut yang melambangkan harmoni Tri Hita Karana dan keadilan irigasi Subak.',
        unlockedRequirement: 'Progres Misi Bali & Nusa Tenggara: 70%',
        badge: 'assets/images/mascot_jalak_avatar.svg',
        fullImg: 'assets/images/mascot_jalak_avatar.svg'
      },
      {
        id: 'komo_komodo',
        name: 'Komo si Naga Purba',
        origin: 'Pulau Komodo & Rinca, NTT',
        status: 'locked',
        role: 'Penjaga Kepulauan Sunda Kecil',
        lore: 'Satwa endemik purba kebanggaan Nusa Tenggara Timur yang tenang dan tangguh menjaga kelestarian alam kepulauan.',
        unlockedRequirement: 'Capai Level 12 (3.600 XP)',
        badge: 'assets/images/mascot_komo_avatar.svg',
        fullImg: 'assets/images/mascot_komo_avatar.svg'
      },
      {
        id: 'maleo_sulawesi',
        name: 'Maleo si Burung Pasir',
        origin: 'Sulawesi Tengah & Sulawesi Barat',
        status: 'locked',
        role: 'Penjaga Warisan Bahari Celebes',
        lore: 'Burung endemik Sulawesi berjambul khas yang menemani penjelajahan tradisi Saiyyang Pattu’du dan Tari Raigo.',
        unlockedRequirement: 'Capai Level 15 (4.500 XP)',
        badge: 'assets/images/mascot_maleo_avatar.svg',
        fullImg: 'assets/images/mascot_maleo_avatar.svg'
      }
    ],

    setExpression(expr) {
      this.currentExpression = expr;
      const preview = document.getElementById('raga-expression-viewer');
      if (preview && window.RagaMascot) {
        preview.innerHTML = window.RagaMascot.render(expr, { size: 190, withHeadpiece: true });
      }

      const speech = document.getElementById('raga-expression-speech');
      const speeches = {
        neutral: 'Aku Raga! Senang sekali bisa menemani ekspedisi budayamu melintasi tujuh wilayah Nusantara!',
        curious: 'Tahukah kamu? Setiap motif ukiran dan tenun tradisional menyimpan pesan moral dari leluhur kita.',
        happy: 'Kerja bagus! Semakin banyak pusaka yang kita pelajari, semakin lestari warisan bangsa.',
        celebrating: 'Luar biasa! Kamu berhasil menuntaskan tantangan budaya dengan ketelitian seorang Maestro!',
        thinking: 'Mari kita cermati hubungan antara kondisi geografis pulau dan bentuk arsitektur rumah adatnya.',
        encouraging: 'Jangan menyerah! Belajar budaya adalah perjalanan panjang yang penuh kejutan indah.'
      };
      if (speech) speech.innerText = speeches[expr] || speeches.neutral;

      document.querySelectorAll('.expression-pill-btn').forEach(btn => {
        btn.classList.toggle('active-expr', btn.dataset.expr === expr);
      });

      window.playGamelanChime?.();
    },

    openDetail(mascotId) {
      const m = this.mascots.find(item => item.id === mascotId);
      if (!m) return;

      const modal = document.getElementById('mascot-detail-modal');
      const body = document.getElementById('mascot-detail-body');
      if (!modal || !body) return;

      const isUnlocked = m.status === 'unlocked' || (m.id === 'komo_komodo' && Store.state.player.level >= 12);
      const isInProgress = m.status === 'in_progress';

      body.innerHTML = `
        <div class="text-center space-y-4">
          <div class="w-32 h-32 mx-auto rounded-3xl bg-[#102B25] p-3 border-2 ${isUnlocked ? 'border-[#F2C45A]' : 'border-[#D4A447]/30'} shadow-2xl relative overflow-hidden flex items-center justify-center">
            <img src="${m.fullImg}" alt="${m.name}" class="w-full h-full object-contain ${!isUnlocked && !isInProgress ? 'grayscale opacity-50' : ''}">
          </div>

          <div>
            <span class="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isUnlocked ? 'bg-[#34A59F] text-[#072624]' : isInProgress ? 'bg-[#F2C45A] text-[#292820]' : 'bg-[#D96B4E] text-white'}">
              ${isUnlocked ? 'Terbuka & Siap Menemani' : isInProgress ? 'Sedang Berjalan' : 'Terkunci'}
            </span>
            <h3 class="text-2xl font-black text-[#FAF6EF] mt-2">${m.name}</h3>
            <p class="text-xs text-[#34A59F] font-bold">${m.role} • ${m.origin}</p>
          </div>

          <div class="bg-[#102B25] p-4 rounded-2xl border border-[#D4A447]/25 text-xs text-[#DFD5C3] text-justify leading-relaxed">
            ${m.lore}
          </div>

          <div class="p-3 rounded-xl bg-[#173F32] border border-[#F2C45A]/30 text-xs">
            <span class="text-[#F2C45A] font-bold block mb-0.5">Status Pembukaan:</span>
            <span class="text-white">${m.unlockedRequirement}</span>
          </div>

          <div class="pt-3 flex justify-between items-center border-t border-[#D4A447]/25">
            <button type="button" onclick="RagamaraEcosystem.MascotCollection.closeDetail()" class="btn btn-secondary text-xs py-2 px-6">
              Tutup
            </button>
            ${isUnlocked ? `
              <button type="button" onclick="RagamaraEcosystem.MascotCollection.equipCompanion('${m.id}')" class="btn btn-primary text-xs py-2 px-6">
                Jadikan Rekan Aktif
              </button>
            ` : `
              <button type="button" onclick="window.switchView('belajar'); RagamaraEcosystem.MascotCollection.closeDetail();" class="btn btn-primary text-xs py-2 px-6">
                Ke Jalur Belajar ➔
              </button>
            `}
          </div>
        </div>
      `;

      modal.classList.add('is-open');
    },

    equipCompanion(mascotId) {
      const m = this.mascots.find(item => item.id === mascotId);
      if (!m) return;
      Store.state.player.activeCompanion = mascotId;
      Store.save();
      window.showToast?.(`✨ ${m.name} kini menjadi rekan pendamping petualanganmu!`);
      this.closeDetail();
    },

    closeDetail() {
      const modal = document.getElementById('mascot-detail-modal');
      if (modal) modal.classList.remove('is-open');
    }
  };

  // =========================================================================
  // 5. LEADERBOARD CONTROLLER (HONEST LOCAL SIMULATION RANKING)
  // =========================================================================
  const Leaderboard = {
    activeTab: 'weekly',

    peerProfiles: [
      { name: 'Dewi Gandawati (Simulasi)', xp: 3420, region: 'Jawa Tengah', title: 'Maestro Batik' },
      { name: 'Gede Arya Swastika (Simulasi)', xp: 2910, region: 'Bali', title: 'Penjaga Subak' },
      { name: 'Cut Meutia Zahra (Simulasi)', xp: 2740, region: 'Aceh', title: 'Srikandi Rencong' },
      { name: 'Bagus Setyawan (Simulasi)', xp: 2280, region: 'DI Yogyakarta', title: 'Penenun Pamor' },
      { name: 'Nyoman Triadi (Simulasi)', xp: 2150, region: 'Bali', title: 'Penjaga Tirta' },
      { name: 'Dayang Kumala (Simulasi)', xp: 2010, region: 'Kalimantan Timur', title: 'Mutiara Mahakam' }
    ],

    getDynamicStandings() {
      const playerEntry = {
        name: `${Store.state.player.name} (Anda)`,
        xp: Store.state.player.xp || 2450,
        region: 'Sumatera Barat',
        title: Store.state.player.title || 'Ahli Warisan Minang',
        isMe: true
      };
      const combined = [...this.peerProfiles.map(p => ({ ...p, isMe: false })), playerEntry];
      combined.sort((a, b) => b.xp - a.xp);
      return combined.map((item, idx) => ({ ...item, rank: idx + 1 }));
    },

    render() {
      const listEl = document.getElementById('leaderboard-dynamic-list');
      const playerXpEl = document.getElementById('leaderboard-player-xp');
      const standings = this.getDynamicStandings();
      if (playerXpEl) {
        playerXpEl.innerText = `${(Store.state.player.xp || 2450).toLocaleString('id-ID')} XP`;
      }
      if (!listEl) return;

      listEl.innerHTML = standings.map(row => `
        <div class="p-3 rounded-xl ${row.isMe ? 'bg-[#1E4E3E] border-2 border-[#F2C45A]' : 'bg-[#102B25] border border-[#D4A447]/20'} flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <span class="font-black text-sm ${row.rank <= 3 ? 'text-[#F2C45A]' : 'text-[#DFD5C3]'} w-6 text-center">#${row.rank}</span>
            <div class="w-8 h-8 rounded-full bg-[#173F32] p-0.5 border border-[#F2C45A]/50 overflow-hidden shrink-0">
              <img src="assets/images/mascot_raga_avatar.png" alt="${row.name}" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-bold text-[#FAF6EF]">${row.name}</span>
              <span class="text-[10px] text-[#34A59F] block">${row.region} • ${row.title}</span>
            </div>
          </div>
          <span class="font-black ${row.isMe ? 'text-[#F2C45A]' : 'text-[#DFD5C3]'} font-mono">${row.xp.toLocaleString('id-ID')} XP</span>
        </div>
      `).join('');
    },

    switchTab(tab) {
      this.activeTab = tab;
      document.querySelectorAll('.leaderboard-tab-btn').forEach(btn => {
        btn.classList.toggle('active-lead-tab', btn.dataset.tab === tab);
      });
      this.render();
      window.showToast?.(`Papan Peringkat Simulasi Lokal: Mode ${tab === 'weekly' ? 'Mingguan' : tab === 'monthly' ? 'Bulanan' : 'Rekan Belajar'}`);
    }
  };

  // =========================================================================
  // 6. DAILY MISSIONS CONTROLLER (IDEMPOTENT & REACTIVE)
  // =========================================================================
  const DailyMissions = {
    missions: [
      {
        id: 'mission_1',
        title: 'Penjelajah Arena Budaya',
        desc: 'Selesaikan minimal 1 sesi Mini-Game Budaya di Arena',
        counterKey: 'minigamesCompletedToday',
        current: 1,
        total: 1,
        rewardXp: 40,
        rewardGems: 10,
        claimed: false
      },
      {
        id: 'mission_2',
        title: 'Kurator Arsip Tekun',
        desc: 'Buka dan pelajari 2 entitas budaya di Culturepedia',
        counterKey: 'articlesReadToday',
        current: 2,
        total: 2,
        rewardXp: 30,
        rewardGems: 10,
        claimed: false
      },
      {
        id: 'mission_3',
        title: 'Cendekia Akurasi Tinggi',
        desc: 'Raih akurasi >= 80% pada sesi Mini-Game apa pun',
        counterKey: 'perfectScoreToday',
        current: 1,
        total: 1,
        rewardXp: 50,
        rewardGems: 15,
        claimed: false
      },
      {
        id: 'mission_4',
        title: 'Kolektor Pusaka Nusantara',
        desc: 'Simpan 1 entitas budaya ke daftar Tersimpan',
        counterKey: 'bookmarksSavedToday',
        current: 1,
        total: 1,
        rewardXp: 25,
        rewardGems: 5,
        claimed: true
      }
    ],

    init() {
      this.syncFromStore();
      this.startCountdown();
      this.render();
    },

    syncFromStore() {
      const counters = Store.state.missionCounters || {};
      const claimedIds = Store.state.claimedMissionIds || [];
      this.missions.forEach(m => {
        if (m.counterKey && typeof counters[m.counterKey] === 'number') {
          m.current = Math.min(m.total, counters[m.counterKey]);
        }
        m.claimed = claimedIds.includes(m.id);
      });
      this.render();
    },

    claim(missionId) {
      const m = this.missions.find(item => item.id === missionId);
      if (!m || m.claimed || m.current < m.total) return;

      const ledgerKey = `daily_${Store.state.claimedMissionsDate}_${missionId}`;
      const awarded = Store.awardIdempotent(ledgerKey, m.rewardXp, m.rewardGems);
      if (!awarded) {
        m.claimed = true;
        this.render();
        return;
      }

      m.claimed = true;
      if (!Store.state.claimedMissionIds.includes(m.id)) {
        Store.state.claimedMissionIds.push(m.id);
      }
      Store.save();

      if (window.RagamaraMotion) {
        window.RagamaraMotion.spawnXpBurst(window.innerWidth / 2, window.innerHeight / 2, m.rewardXp);
      }
      window.playGamelanChime?.();
      window.showToast?.(`🎁 Misi "${m.title}" Diklaim: +${m.rewardXp} XP & +${m.rewardGems} 💎!`);
      Leaderboard.render();
      this.render();
    },

    startCountdown() {
      const timerEl = document.getElementById('daily-missions-timer');
      const update = () => {
        if (!timerEl) return;
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = Math.max(0, midnight - now);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        timerEl.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
      update();
      setInterval(update, 1000);
    },

    render() {
      const container = document.getElementById('daily-missions-list');
      if (!container) return;

      container.innerHTML = this.missions.map(m => {
        const isComplete = m.current >= m.total;
        const percent = Math.min(100, Math.round((m.current / m.total) * 100));

        return `
          <div class="bg-[#102B25] p-4 rounded-2xl border ${m.claimed ? 'border-[#34A59F]/30 opacity-75' : isComplete ? 'border-[#F2C45A]' : 'border-[#D4A447]/25'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1 w-full">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-sm text-[#FAF6EF]">${m.title}</span>
                ${m.claimed ? `
                  <span class="px-2 py-0.5 rounded-full bg-[#34A59F]/20 text-[#34A59F] text-[10px] font-black uppercase">Tuntas ✓</span>
                ` : isComplete ? `
                  <span class="px-2 py-0.5 rounded-full bg-[#F2C45A] text-[#292820] text-[10px] font-black uppercase">Siap Klaim</span>
                ` : `
                  <span class="px-2 py-0.5 rounded-full bg-[#173F32] text-[#DFD5C3] text-[10px] font-bold">${m.current}/${m.total}</span>
                `}
              </div>
              <p class="text-xs text-[#DFD5C3]">${m.desc}</p>
              <div class="w-full max-w-md h-2 rounded-full bg-[#0A1D18] overflow-hidden mt-1.5">
                <div class="h-full bg-gradient-to-r from-[#B65F45] to-[#F2C45A] transition-all duration-500" style="width: ${percent}%;"></div>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <div class="text-right text-xs">
                <span class="text-[#F2C45A] font-black block">+${m.rewardXp} XP</span>
                <span class="text-[#34A59F] font-bold block">+${m.rewardGems} 💎</span>
              </div>
              ${m.claimed ? `
                <button type="button" disabled class="btn btn-surface text-xs py-2 px-4 opacity-50 cursor-not-allowed">Diklaim ✓</button>
              ` : isComplete ? `
                <button type="button" data-mission-claim="${m.id}" onclick="RagamaraEcosystem.DailyMissions.claim('${m.id}')" class="btn btn-gold text-xs py-2 px-5">Klaim 🎁</button>
              ` : `
                <button type="button" onclick="closeDailyMissionsModal(); window.switchView('belajar');" class="btn btn-primary text-xs py-2 px-4">Mulai</button>
              `}
            </div>
          </div>
        `;
      }).join('');
    }
  };

  // =========================================================================
  // 7. ACHIEVEMENTS & BADGES CONTROLLER
  // =========================================================================
  const Achievements = {
    filter: 'all',

    list: [
      {
        id: 'ach_1',
        title: 'Penakluk Atap Bagonjong',
        category: 'Arsitektur Nusantara',
        desc: 'Memahami struktur pasak kayu tahan gempa Rumah Gadang dan ragam hias Minangkabau.',
        status: 'unlocked',
        reward: '+150 XP & Gelar "Ahli Warisan Minang"',
        date: 'Terverifikasi',
        icon: 'roofing'
      },
      {
        id: 'ach_2',
        title: 'Penjaga Pusaka Rencong & Keris',
        category: 'Teknologi Tradisional',
        desc: 'Mempelajari filosofi senjata pusaka Rencong Aceh dan pamor logam Nusantara.',
        status: 'unlocked',
        reward: '+120 XP & Bingkai Surya Majapahit',
        date: 'Terverifikasi',
        icon: 'swords'
      },
      {
        id: 'ach_3',
        title: 'Peniup Harmoni Saluang',
        category: 'Seni Musik Tradisi',
        desc: 'Menyelesaikan simulasi tangga nada dan pola ketukan instrumen tradisional.',
        status: 'unlocked',
        reward: '+100 XP & Lencana Laras Tradisi',
        date: 'Terverifikasi',
        icon: 'music_note'
      },
      {
        id: 'ach_4',
        title: 'Sahabat Noken & Barapen Papua',
        category: 'Warisan UNESCO',
        desc: 'Menjelajahi Dossier Wilayah Papua atau menyimpan artefak Papua di Culturepedia.',
        status: 'in_progress',
        progress: '2/3 Tahap Tuntas',
        reward: '+180 XP & Sahabat Cendro',
        icon: 'shopping_bag'
      },
      {
        id: 'ach_5',
        title: 'Penjelajah Lintas 7 Wilayah',
        category: 'Ekspedisi Kepulauan',
        desc: 'Membuka Dossier Kebudayaan dari ketujuh gugusan wilayah Nusantara.',
        status: 'in_progress',
        progress: '5/7 Wilayah Dijelajahi',
        reward: '+200 XP & Gelar "Maestro Nusantara"',
        icon: 'public'
      },
      {
        id: 'ach_6',
        title: 'Penjaga Tirta Subak & Sasi Laut',
        category: 'Kearifan Ekologis',
        desc: 'Menuntaskan seluruh babak musyawarah adat di Arena Mode E dengan akurasi sempurna.',
        status: 'locked',
        progress: 'Selesaikan Arena Mode E',
        reward: '+200 XP & Bingkai Ukir Asmat',
        icon: 'water_drop'
      }
    ],

    setFilter(filter) {
      this.filter = filter;
      document.querySelectorAll('.ach-filter-btn').forEach(btn => {
        btn.classList.toggle('active-filter', btn.dataset.filter === filter);
      });
      this.render();
    },

    render() {
      const container = document.getElementById('achievements-grid');
      if (!container) return;

      const unlockedSet = new Set(Store.state.unlockedAchievements || []);
      this.list.forEach(item => {
        if (unlockedSet.has(item.id)) item.status = 'unlocked';
      });

      const filtered = this.list.filter(item => {
        if (this.filter === 'all') return true;
        return item.status === this.filter;
      });

      container.innerHTML = filtered.map(ach => {
        const isUnlocked = ach.status === 'unlocked';
        const isInProgress = ach.status === 'in_progress';

        return `
          <div class="bg-[#173F32] p-5 rounded-2xl border ${isUnlocked ? 'border-[#F2C45A]' : isInProgress ? 'border-[#34A59F]/40' : 'border-white/10 opacity-65'} flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl ${isUnlocked ? 'bg-[#F2C45A] text-[#292820]' : isInProgress ? 'bg-[#B65F45] text-white' : 'bg-[#102B25] text-[#DFD5C3]'} shrink-0 flex items-center justify-center shadow-lg">
              <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' ${isUnlocked ? 1 : 0};">${ach.icon}</span>
            </div>
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black uppercase tracking-wider text-[#34A59F]">${ach.category}</span>
                <span class="text-[10px] font-bold ${isUnlocked ? 'text-[#F2C45A]' : 'text-[#DFD5C3]'}">
                  ${isUnlocked ? `Terbuka ✓` : isInProgress ? ach.progress : ach.progress}
                </span>
              </div>
              <h4 class="font-extrabold text-sm text-[#FAF6EF]">${ach.title}</h4>
              <p class="text-xs text-[#DFD5C3] leading-relaxed">${ach.desc}</p>
              <div class="pt-2 border-t border-[#D4A447]/20 text-[11px] text-[#F2C45A] font-semibold flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">military_tech</span>
                <span>${ach.reward}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  };

  // =========================================================================
  // 8. PLAYER PROFILE CONTROLLER
  // =========================================================================
  const Profile = {
    frames: {
      frame_gold_minang: { name: 'Bingkai Emas Minangkabau', class: 'border-[#F2C45A] shadow-[0_0_18px_rgba(242,196,90,0.55)]' },
      frame_majapahit: { name: 'Bingkai Terakota Majapahit', class: 'border-[#B65F45] shadow-[0_0_18px_rgba(182,95,69,0.55)]' },
      frame_asmat: { name: 'Bingkai Zamrud Asmat Papua', class: 'border-[#34A59F] shadow-[0_0_18px_rgba(52,165,159,0.55)]' }
    },

    equipFrame(frameKey) {
      if (!this.frames[frameKey]) return;
      Store.state.player.frame = frameKey;
      Store.save();
      const avatarContainer = document.getElementById('profile-main-avatar');
      if (avatarContainer) {
        avatarContainer.className = `w-28 h-28 rounded-3xl bg-[#173F32] p-1.5 border-4 overflow-hidden transition-all ${this.frames[frameKey].class}`;
      }
      window.showToast?.(`✨ Bingkai profil diperbarui: ${this.frames[frameKey].name}`);
      window.playGamelanChime?.();
    },

    setTitle(title) {
      Store.state.player.title = title;
      Store.save();
      const titleEl = document.getElementById('profile-player-title');
      if (titleEl) titleEl.innerText = `Gelar: ${title} • Penjelajah Aktif`;
      Leaderboard.render();
      window.showToast?.(`🎖️ Gelar kehormatan diubah menjadi "${title}"`);
    }
  };

  // =========================================================================
  // 9. SETTINGS & ACCESSIBILITY CONTROLLER
  // =========================================================================
  const Settings = {
    sfxEnabled: true,
    notificationsEnabled: true,
    highContrast: false,
    reducedMotion: false,
    dailyGoalMins: 20,

    init() {
      Object.assign(this, Store.state.settings || {});
      document.body.classList.toggle('high-contrast-mode', !!this.highContrast);
      document.body.classList.toggle('reduced-motion', !!this.reducedMotion);
      const btn = document.getElementById('setting-sfx-toggle');
      if (btn) btn.innerText = this.sfxEnabled ? 'Aktif' : 'Nonaktif';
    },

    save() {
      Store.state.settings = {
        sfxEnabled: this.sfxEnabled,
        notificationsEnabled: this.notificationsEnabled,
        highContrast: this.highContrast,
        reducedMotion: this.reducedMotion,
        dailyGoalMins: this.dailyGoalMins
      };
      Store.save();
    },

    toggleSfx() {
      this.sfxEnabled = !this.sfxEnabled;
      this.save();
      const btn = document.getElementById('setting-sfx-toggle');
      if (btn) btn.innerText = this.sfxEnabled ? 'Aktif' : 'Nonaktif';
      window.showToast?.(`Audio Efek Suara: ${this.sfxEnabled ? 'Diaktifkan' : 'Dinonaktifkan'}`);
    },

    toggleHighContrast() {
      this.highContrast = !this.highContrast;
      this.save();
      document.body.classList.toggle('high-contrast-mode', this.highContrast);
      window.showToast?.(`Mode Kontras Tinggi: ${this.highContrast ? 'Aktif' : 'Standar'}`);
    },

    toggleReducedMotion() {
      this.reducedMotion = !this.reducedMotion;
      this.save();
      document.body.classList.toggle('reduced-motion', this.reducedMotion);
      window.showToast?.(`Mode Animasi Halus: ${this.reducedMotion ? 'Aktif' : 'Standar'}`);
    },

    openModal() {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.add('is-open');
    },

    closeModal() {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.remove('is-open');
    }
  };

  // =========================================================================
  // 10. MINI-GAME SESSION REWARD BRIDGE
  // =========================================================================
  function recordMiniGameSession(session) {
    if (!session || !session.sessionId) return;
    const awarded = Store.awardIdempotent(session.sessionId, session.xpEarned || 0, session.gemsEarned || 0);
    if (!awarded) return;

    Store.state.completedSessions.unshift({
      sessionId: session.sessionId,
      gameId: session.gameId,
      title: session.title,
      accuracy: session.accuracy,
      xpEarned: session.xpEarned,
      gemsEarned: session.gemsEarned,
      timestamp: new Date().toISOString()
    });
    if (Store.state.completedSessions.length > 25) {
      Store.state.completedSessions.length = 25;
    }

    Store.state.missionCounters.minigamesCompletedToday = (Store.state.missionCounters.minigamesCompletedToday || 0) + 1;
    if (session.accuracy >= 80) {
      Store.state.missionCounters.perfectScoreToday = (Store.state.missionCounters.perfectScoreToday || 0) + 1;
    }
    if (session.gameId === 'E' && session.accuracy === 100 && !Store.state.unlockedAchievements.includes('ach_6')) {
      Store.state.unlockedAchievements.push('ach_6');
    }

    Store.save();
    DailyMissions.syncFromStore();
    Achievements.render();
    Leaderboard.render();
  }

  return {
    Store,
    Culturepedia,
    RegionalDossier,
    MascotCollection,
    Leaderboard,
    DailyMissions,
    Achievements,
    Profile,
    Settings,
    recordMiniGameSession,
    getCanonicalEntities,
    init() {
      Store.init();
      Culturepedia.init();
      DailyMissions.init();
      Achievements.render();
      Leaderboard.render();
      Settings.init();
    }
  };
})();
window.NularEcosystem = window.RagamaraEcosystem;
if (window.RAGAMARA_CULTURE_DB) {
  window.NULAR_CULTURE_DB = window.RAGAMARA_CULTURE_DB;
}
