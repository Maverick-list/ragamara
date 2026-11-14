/**
 * RAGAMARA ECOSYSTEM ENGINE (Phase 05)
 * Handles:
 * 1. Culturepedia (Search, 10 OPK Categories, Regional Filtering, Saved Artifacts, Authenticated Article Detail Modal)
 * 2. Regional Cultural Detail Dossier (7 major realms)
 * 3. Mascot Collection Showcase & Expressions
 * 4. Competitive Leaderboard (Podium, Division, Sticky Player HUD)
 * 5. Player Profile & RPG Identity (Customizable Avatar Frames, Dynamic Titles, Learning Activity Chart, Discovery History)
 * 6. Daily Missions Center (Live Countdown Timer, Claim Rewards Loop)
 * 7. Achievements & Badges System
 * 8. Settings & Player Preferences Modal (Audio, Accessibility, Preferences)
 */

window.RagamaraEcosystem = (function() {
  'use strict';

  // =========================================================================
  // 1. DATA CACHE & HELPERS
  // =========================================================================
  const getDbRecords = () => {
    if (window.RAGAMARA_CULTURE_DB && window.RAGAMARA_CULTURE_DB.records) {
      return window.RAGAMARA_CULTURE_DB.records;
    }
    return [];
  };

  // Map province to 7 major geographical regions
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

  // Map DAPOBUD domains to the 10 Objects of Cultural Advancement (OPK)
  const mapToOpkCategory = (domain) => {
    if (!domain) return 'Lainnya';
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

  // =========================================================================
  // 2. CULTUREPEDIA CONTROLLER
  // =========================================================================
  const Culturepedia = {
    searchQuery: '',
    selectedRegion: 'Semua',
    selectedOpk: 'Semua',
    activeTab: 'all', // 'all', 'saved', 'discovered'
    savedIds: new Set([
      'id_dapobud_f31f397c-0647-4667-bbfb-6aa1397ca224', // Rencong
      'id_dapobud_songket_minang_001',
      'id_dapobud_keris_jawa_002'
    ]),

    init() {
      // Load saved bookmarks from localStorage
      try {
        const stored = localStorage.getItem('ragamara_saved_culture');
        if (stored) {
          this.savedIds = new Set(JSON.parse(stored));
        }
      } catch (e) {}
      this.render();
    },

    saveToStorage() {
      try {
        localStorage.setItem('ragamara_saved_culture', JSON.stringify(Array.from(this.savedIds)));
      } catch (e) {}
    },

    toggleBookmark(recordId, e) {
      if (e) e.stopPropagation();
      if (this.savedIds.has(recordId)) {
        this.savedIds.delete(recordId);
        window.showToast?.('Artefak dihapus dari simpanan');
      } else {
        this.savedIds.add(recordId);
        window.showToast?.('❤️ Artefak berhasil disimpan ke Koleksi Pribadi');
        window.playGamelanChime?.();
      }
      this.saveToStorage();
      this.render();
    },

    filterRecords() {
      const all = getDbRecords();
      return all.filter(r => {
        const name = (r.name || '').toLowerCase();
        const prov = r.dapobud?.region?.province || 'Nusantara';
        const region = PROVINCE_TO_REGION[prov] || 'Lainnya';
        const opk = mapToOpkCategory(r.dapobud?.category);
        const desc = (r.dapobud?.official_description || r.wikipedia?.extract || '').toLowerCase();

        // Search match
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          if (!name.includes(q) && !prov.toLowerCase().includes(q) && !desc.includes(q)) {
            return false;
          }
        }

        // Region match
        if (this.selectedRegion !== 'Semua') {
          if (region !== this.selectedRegion) return false;
        }

        // OPK Category match
        if (this.selectedOpk !== 'Semua') {
          if (opk !== this.selectedOpk) return false;
        }

        // Active tab match
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

      const filtered = this.filterRecords();
      if (counterEl) {
        counterEl.innerText = `Menampilkan ${filtered.length} dari ${getDbRecords().length} Entri Kebudayaan Resmi`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-16 text-center bg-[#211B35]/60 rounded-3xl border border-[#8B5CF6]/20 p-8">
            <span class="material-symbols-outlined text-5xl text-[#CCC3DF]">search_off</span>
            <h4 class="text-xl font-bold text-white mt-3">Tidak Ada Entri Budaya Ditemukan</h4>
            <p class="text-xs text-[#CCC3DF] mt-1 max-w-md mx-auto">
              Coba sesuaikan kata kunci pencarian, ubah filter wilayah, atau pilih kategori Objek Pemajuan Kebudayaan lainnya.
            </p>
            <button onclick="RagamaraEcosystem.Culturepedia.resetFilters()" class="btn btn-secondary mt-5 text-xs py-2 px-6">
              Reset Semua Filter
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(r => {
        const prov = r.dapobud?.region?.province || 'Nusantara';
        const regionGroup = PROVINCE_TO_REGION[prov] || 'Nusantara';
        const opk = mapToOpkCategory(r.dapobud?.category);
        const isSaved = this.savedIds.has(r.record_id);
        const imgUrl = r.wikipedia?.image?.thumbnail_url || 'assets/images/mascot_raga_transparent.png';
        const regNumber = r.dapobud?.number || 'WBTb Kemendikbud';
        const snippet = r.wikipedia?.extract || r.dapobud?.official_description || 'Warisan Budaya Takbenda Indonesia terverifikasi resmi oleh Kementerian Kebudayaan RI.';

        return `
          <div class="card-cultural group cursor-pointer flex flex-col justify-between transition-all hover:scale-[1.01]" onclick="RagamaraEcosystem.Culturepedia.openDetail('${r.record_id}')">
            <div>
              <div class="card-cultural-media h-48 relative overflow-hidden" style="background-image: url('${imgUrl}');">
                <div class="absolute inset-0 bg-gradient-to-t from-[#150E22] via-transparent to-black/30"></div>
                <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span class="px-2.5 py-1 rounded-full bg-[#6338D4]/90 text-white font-black text-[10px] tracking-wider uppercase border border-white/20 backdrop-blur-md shadow">
                    ${opk}
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-[#FFCA55] text-[#382400] font-black text-[9px] uppercase tracking-wider">
                    ${regionGroup}
                  </span>
                </div>
                <button onclick="RagamaraEcosystem.Culturepedia.toggleBookmark('${r.record_id}', event)" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#150E22]/80 backdrop-blur-md flex items-center justify-center text-white hover:text-[#FF786B] border border-white/20 transition-all ${isSaved ? 'text-[#FF786B]' : ''}" title="${isSaved ? 'Hapus Simpanan' : 'Simpan Artefak'}">
                  <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">favorite</span>
                </button>
                <div class="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
                  <span class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-[#24CBA2]">verified</span> ${prov}</span>
                  <span class="text-[10px] text-[#FFCA55] bg-black/40 px-2 py-0.5 rounded-full font-mono">${regNumber}</span>
                </div>
              </div>
              <div class="p-5 space-y-2">
                <h4 class="font-extrabold text-base text-[#FFF8EB] group-hover:text-[#FFCA55] transition-colors leading-snug">
                  ${r.name}
                </h4>
                <p class="text-xs text-[#CCC3DF] line-clamp-3 leading-relaxed">
                  ${snippet}
                </p>
              </div>
            </div>
            <div class="px-5 pb-4 pt-3 border-t border-[#8B5CF6]/15 flex items-center justify-between text-xs mt-2">
              <span class="text-[11px] text-[#24CBA2] font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#24CBA2]"></span> DAPOBUD × Wiki
              </span>
              <span class="text-[#FFCA55] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Pelajari Detail <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
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
      const all = getDbRecords();
      const r = all.find(item => item.record_id === recordId);
      if (!r) return;

      const modal = document.getElementById('culturepedia-detail-modal');
      const body = document.getElementById('culturepedia-detail-body');
      if (!modal || !body) return;

      const prov = r.dapobud?.region?.province || 'Nusantara';
      const regionGroup = PROVINCE_TO_REGION[prov] || 'Nusantara';
      const opk = mapToOpkCategory(r.dapobud?.category);
      const imgUrl = r.wikipedia?.image?.original_url || r.wikipedia?.image?.thumbnail_url || 'assets/images/mascot_raga_transparent.png';
      const imgAttribution = r.wikipedia?.image?.attribution || r.wikipedia?.image?.creator || 'Koleksi Dokumentasi Terverifikasi (DAPOBUD RI / Wikimedia Commons)';
      const imgLicense = r.wikipedia?.image?.license || 'Public Domain / CC BY-SA 3.0';
      const officialDesc = r.dapobud?.official_description || 'Deskripsi resmi belum dicatat secara lengkap.';
      const wikiExtract = r.wikipedia?.extract || 'Konteks ensiklopedis tambahan sedang dalam proses penyusunan.';
      const dapobudUrl = r.dapobud?.source_url || 'https://dapobud.kemenbud.go.id';
      const wikiUrl = r.wikipedia?.page_url || 'https://id.wikipedia.org';
      const isSaved = this.savedIds.has(r.record_id);

      body.innerHTML = `
        <div class="space-y-6">
          <!-- Hero Header Image -->
          <div class="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[#8B5CF6]/30 shadow-2xl bg-[#150E22]">
            <img src="${imgUrl}" alt="${r.name}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-[#150E22] via-[#150E22]/30 to-black/40"></div>
            
            <div class="absolute top-4 left-4 flex flex-wrap gap-2">
              <span class="px-3 py-1 rounded-full bg-[#6338D4] text-white font-extrabold text-xs uppercase tracking-wider shadow">
                ${opk}
              </span>
              <span class="px-3 py-1 rounded-full bg-[#FFCA55] text-[#382400] font-black text-xs uppercase tracking-wider shadow">
                ${regionGroup} • ${prov}
              </span>
            </div>

            <button onclick="RagamaraEcosystem.Culturepedia.toggleBookmark('${r.record_id}'); RagamaraEcosystem.Culturepedia.openDetail('${r.record_id}');" class="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-[#150E22]/90 backdrop-blur-md border border-[#8B5CF6]/40 text-xs font-bold flex items-center gap-1.5 text-white hover:text-[#FF786B] transition-colors shadow">
              <span class="material-symbols-outlined text-[18px] text-[#FF786B]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">favorite</span>
              <span>${isSaved ? 'Tersimpan di Koleksi' : 'Simpan ke Koleksi'}</span>
            </button>

            <div class="absolute bottom-4 left-4 right-4">
              <span class="text-xs font-mono text-[#24CBA2] font-bold bg-[#150E22]/80 px-2.5 py-1 rounded-md">
                SK WBTb: ${r.dapobud?.number || 'REK/WBTB Terdaftar'}
              </span>
              <h2 class="text-2xl sm:text-3xl font-black text-[#FFF8EB] mt-2 drop-shadow-md">
                ${r.name}
              </h2>
            </div>
          </div>

          <!-- Attribution & Provenance Meta Bar -->
          <div class="bg-[#2D2445]/80 p-4 rounded-xl border border-[#8B5CF6]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#24CBA2] text-[18px]">verified_user</span>
                <span class="font-extrabold text-white">Sumber Terverifikasi Resmi:</span>
                <span class="text-[#CCC3DF]">DAPOBUD (Ditjen Kebudayaan RI) × Wikipedia Indonesia</span>
              </div>
              <p class="text-[11px] text-[#CCC3DF]/80">
                Atribusi Gambar: <span class="italic text-white">${imgAttribution}</span> (${imgLicense})
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a href="${dapobudUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-[#150E22] hover:bg-[#6338D4] text-[#CCC3DF] hover:text-white transition-colors text-[11px] font-bold flex items-center gap-1 border border-white/10">
                DAPOBUD <span class="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
              <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-[#150E22] hover:bg-[#6338D4] text-[#CCC3DF] hover:text-white transition-colors text-[11px] font-bold flex items-center gap-1 border border-white/10">
                Wikipedia <span class="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
            </div>
          </div>

          <!-- Dual Column Content: Official Records & Encyclopedic Wisdom -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Official Record -->
            <div class="bg-[#211B35] p-5 rounded-2xl border border-[#8B5CF6]/20 space-y-3">
              <div class="flex items-center gap-2 text-[#FFCA55] font-extrabold text-xs uppercase tracking-wider">
                <span class="material-symbols-outlined text-[18px]">account_balance</span>
                <span>Catatan Resmi DAPOBUD</span>
              </div>
              <p class="text-xs text-[#CCC3DF] leading-relaxed text-justify">
                ${officialDesc}
              </p>
              <div class="pt-3 border-t border-white/10 text-[11px] text-[#CCC3DF] space-y-1">
                <div><strong>Tanggal Penetapan:</strong> ${r.dapobud?.assignment_date || '2013-01-01'}</div>
                <div><strong>Kategori Domain:</strong> ${r.dapobud?.category || opk}</div>
              </div>
            </div>

            <!-- Encyclopedic Extract & Cultural Meaning -->
            <div class="bg-[#211B35] p-5 rounded-2xl border border-[#8B5CF6]/20 space-y-3">
              <div class="flex items-center gap-2 text-[#24CBA2] font-extrabold text-xs uppercase tracking-wider">
                <span class="material-symbols-outlined text-[18px]">auto_stories</span>
                <span>Konteks Sosial & Filosofi</span>
              </div>
              <p class="text-xs text-[#CCC3DF] leading-relaxed text-justify">
                ${wikiExtract}
              </p>
              
              <!-- Related Game Challenge Bridge -->
              <div class="p-3.5 rounded-xl bg-gradient-to-r from-[#6338D4]/40 to-[#2D2445] border border-[#8B5CF6]/30 mt-4 flex items-center justify-between">
                <div>
                  <h5 class="text-xs font-black text-white">Tantangan Budaya RAGAMARA</h5>
                  <p class="text-[11px] text-[#CCC3DF]">Uji pengetahuanmu tentang artefak ini di Arena Mini-Game!</p>
                </div>
                <button onclick="RagamaraEcosystem.Culturepedia.launchGameChallenge();" class="btn btn-primary text-xs py-1.5 px-3.5 shrink-0">
                  Mainkan ➔
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Action -->
          <div class="flex justify-between items-center pt-4 border-t border-[#8B5CF6]/20">
            <span class="text-xs text-[#CCC3DF]">
              ID Registrasi: <span class="font-mono text-white">${r.record_id}</span>
            </span>
            <button onclick="RagamaraEcosystem.Culturepedia.closeDetail()" class="btn btn-secondary text-xs py-2 px-6">
              Tutup Artikel
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

    launchGameChallenge() {
      this.closeDetail();
      if (window.MiniGameEngine) {
        window.MiniGameEngine.openArena('A');
      } else {
        window.switchView('belajar');
      }
    }
  };

  // =========================================================================
  // 3. REGIONAL DOSSIER CONTROLLER
  // =========================================================================
  const RegionalDossier = {
    regions: {
      sumatra: {
        title: 'Alam Andalas & Ranah Minang',
        subtitle: 'Pulau Emas, Tradisi Bahari, & Falsafah Luhur',
        desc: 'Sumatra merupakan peradaban agung jalur sutra maritim Nusantara. Dari ketangguhan Rencong Serambi Mekkah di Aceh, kekayaan ulos tanah Batak, hingga falsafah musyawarah Rumah Gadang Minangkabau ("Adat basandi syarak, syarak basandi Kitabullah").',
        bannerImg: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&q=80',
        mascot: {
          name: 'Raga & Harimau Loreng',
          role: 'Sahabat Rimba Sumatera',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '75% Selesai (18/24 Bab)',
        totalArtifacts: 18,
        chapters: [
          'Bab 1: Menara Melengkung Rumah Gadang Minangkabau',
          'Bab 2: Kriya Emas Tenun Songket Pandai Sikek',
          'Bab 3: Pusaka Gagah Rencong Meucugek Aceh',
          'Bab 4: Kearifan Ulos Batak Ragidup & Sigale-gale'
        ]
      },
      jawa: {
        title: 'Wilwatikta & Bumi Pasundan',
        subtitle: 'Pusat Keagungan Keraton, Candi Luhur, & Badak Ujung Kulon',
        desc: 'Jawa mempertemukan harmoni spiritual dan kemahiran kriya adi luhung. Tempat lahirnya Keris Majapahit berpamor suci, Candi Borobudur dan Prambanan, Wayang Kulit purwa, serta habitat asli Badak Jawa bercula satu di Ujung Kulon.',
        bannerImg: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1000&q=80',
        mascot: {
          name: 'Raga si Badak Jawa',
          role: 'Maskot Utama RAGAMARA',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '60% Selesai (12/20 Bab)',
        totalArtifacts: 14,
        chapters: [
          'Bab 1: Rahasia Pamor Keris Pusaka Majapahit',
          'Bab 2: Falsafah Titik Batik Tulis Parang Rusak',
          'Bab 3: Karaton Ngayogyakarta & Tata Ruang Filosofis',
          'Bab 4: Angklung Sunda & Nada Pentatonis Salendro'
        ]
      },
      bali_nt: {
        title: 'Kepulauan Sunda Kecil & Dewata',
        subtitle: 'Lembah Subak Suci, Tenun Ikat Sumba, & Naga Komodo',
        desc: 'Kawasan kepulauan eksotis tempat berpadunya tradisi Tri Hita Karana di Bali, megahnya habitat Komodo di Flores, tenun ikat sakral Sumba, hingga pacuan kuda tradisional di Sumbawa.',
        bannerImg: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1000&q=80',
        mascot: {
          name: 'Jalak & Komo',
          role: 'Penjaga Savana & Pura',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '40% Selesai (8/20 Bab)',
        totalArtifacts: 9,
        chapters: [
          'Bab 1: Sistem Irigasi Demokratis Subak Bali',
          'Bab 2: Pewarnaan Alami Tenun Ikat Pewarna Nila Sumba',
          'Bab 3: Arsitektur Wae Rebo Mbaru Niang di Manggarai',
          'Bab 4: Tari Kecak & Cerita Epos Ramayana'
        ]
      },
      kalimantan: {
        title: 'Bumi Borneo & Rimba Mahakam',
        subtitle: 'Rumah Panjang Betang, Pusaka Mandau, & Mutiara Khatulistiwa',
        desc: 'Jantung zamrud khatulistiwa dengan tradisi komunal Rumah Betang suku Dayak, kriya manik-manik rumit, senjata pusaka Mandau bertatahkan emas, dan festival perahu naga sungai Mahakam.',
        bannerImg: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&q=80',
        mascot: {
          name: 'Bekti si Bekantan',
          role: 'Penjelajah Rimba Bakau',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '50% Selesai (10/20 Bab)',
        totalArtifacts: 8,
        chapters: [
          'Bab 1: Kedamaian Bersama di Rumah Betang Dayak',
          'Bab 2: Anatomi & Makna Filosofis Mandau Dayak',
          'Bab 3: Kriya Anyaman Rotan Anjat Kutai',
          'Bab 4: Musik Sape Sentuhan Jiwa Hutan Kalimantan'
        ]
      },
      sulawesi: {
        title: 'Celebes & Negeri Bahari Phinisi',
        subtitle: 'Megahnya Tongkonan Toraja, Layar Phinisi, & Danau Purba',
        desc: 'Tanah pelaut tangguh suku Bugis-Makassar yang mengarungi samudra dengan perahu layar Phinisi, serta keagungan ritus Rambu Solo dan arsitektur ukir Tongkonan di Tana Toraja.',
        bannerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&q=80',
        mascot: {
          name: 'Maleo si Burung Pasir',
          role: 'Penjaga Geotermal Tompotika',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '35% Selesai (7/20 Bab)',
        totalArtifacts: 6,
        chapters: [
          'Bab 1: Kemahiran Galangan Kapal Layar Phinisi Bulukumba',
          'Bab 2: Filosofi Ukiran Toraja Pa’tedong & Tongkonan',
          'Bab 3: Senjata Pusaka Badik Gecong Bugis',
          'Bab 4: Kuliner Tradisional Coto & Konro Rempah Melimpah'
        ]
      },
      maluku: {
        title: 'Kepulauan Rempah Bersejarah',
        subtitle: 'Pala & Cengkeh Banda, Tifa Gendang, & Benteng Samudra',
        desc: 'Gugusan pulau legendaris yang mengubah peta perdagangan maritim dunia dengan rempah pala dan cengkeh. Diramaikan oleh tabuhan tifa, tari Cakalele yang berani, dan sistem konservasi laut Sasi Adat.',
        bannerImg: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1000&q=80',
        mascot: {
          name: 'Kakatua Seram',
          role: 'Duta Harmoni Kepulauan',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '25% Selesai (5/20 Bab)',
        totalArtifacts: 5,
        chapters: [
          'Bab 1: Sasi Adat: Kearifan Konservasi Laut Tradisional',
          'Bab 2: Irama Tifa Maluku & Lagu Daerah Hela Rotan',
          'Bab 3: Tari Perang Cakalele & Busana Merah Menyala',
          'Bab 4: Benteng Kerajaan Banda Neira & Jalur Rempah'
        ]
      },
      papua: {
        title: 'Tanah Cenderawasih & Puncak Salju',
        subtitle: 'Lembah Baliem, Rumah Honai, Noken UNESCO, & Ukir Asmat',
        desc: 'Ujung timur Nusantara yang memesona dengan pegunungan gletser abadi Puncak Jaya, rajutan tas noken serat kayu yang diakui UNESCO, arsitektur hangat Rumah Honai, dan patung ukir sakral suku Asmat.',
        bannerImg: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1000&q=80',
        mascot: {
          name: 'Cendro si Cenderawasih',
          role: 'Penyanyi Surga Papua',
          avatar: 'assets/images/mascot_raga_avatar.png'
        },
        progress: '45% Selesai (9/20 Bab)',
        totalArtifacts: 7,
        chapters: [
          'Bab 1: Filosofi Tas Noken: Rahim Kehidupan Alam Papua',
          'Bab 2: Struktur Hangat Rumah Honai Lembah Baliem',
          'Bab 3: Ukiran Spiritual Patung Asmat Mbis Pole',
          'Bab 4: Tifa Totobuang & Pesta Bakar Batu Perdamaian'
        ]
      }
    },

    open(regionKey) {
      const data = this.regions[regionKey] || this.regions.sumatra;
      const modal = document.getElementById('regional-dossier-modal');
      const body = document.getElementById('regional-dossier-body');
      if (!modal || !body) return;

      // Extract artifacts in this region from DB
      const allDb = getDbRecords();
      const regionName = regionKey === 'bali_nt' ? 'Bali & Nusa Tenggara' : regionKey.charAt(0).toUpperCase() + regionKey.slice(1);
      const regionalItems = allDb.filter(r => {
        const prov = r.dapobud?.region?.province || '';
        return (PROVINCE_TO_REGION[prov] || '').toLowerCase() === regionName.toLowerCase();
      }).slice(0, 6);

      body.innerHTML = `
        <div class="space-y-6">
          <!-- Regional Hero Banner -->
          <div class="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-[#8B5CF6]/30 shadow-2xl" style="background-image: url('${data.bannerImg}'); background-size: cover; background-position: center;">
            <div class="absolute inset-0 bg-gradient-to-t from-[#150E22] via-[#150E22]/40 to-black/30"></div>
            
            <div class="absolute top-4 left-4 flex gap-2">
              <span class="px-3 py-1 rounded-full bg-[#FFCA55] text-[#382400] font-black text-xs uppercase tracking-wider shadow">
                Wilayah Kebudayaan Terbuka
              </span>
              <span class="px-3 py-1 rounded-full bg-[#6338D4] text-white font-extrabold text-xs uppercase tracking-wider shadow">
                ${data.progress}
              </span>
            </div>

            <div class="absolute bottom-4 left-4 right-4">
              <span class="text-xs uppercase font-extrabold text-[#24CBA2] tracking-wider">${data.subtitle}</span>
              <h2 class="text-2xl sm:text-3xl font-black text-[#FFF8EB] mt-1">${data.title}</h2>
            </div>
          </div>

          <!-- Description & Mascot Companion Info -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div class="md:col-span-2 bg-[#211B35] p-5 rounded-2xl border border-[#8B5CF6]/20 space-y-3">
              <h4 class="text-xs font-black text-[#FFCA55] uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">travel_explore</span>
                <span>Tentang Wilayah Kebudayaan</span>
              </h4>
              <p class="text-xs text-[#CCC3DF] leading-relaxed text-justify">
                ${data.desc}
              </p>
              
              <div class="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span class="text-[#24CBA2] font-bold">Total Artefak Terverifikasi: ${data.totalArtifacts} Objek</span>
                <span class="text-[#FFCA55] font-bold">Tingkat Penjelajahan: 82%</span>
              </div>
            </div>

            <!-- Regional Mascot Card -->
            <div class="bg-gradient-to-b from-[#2D2445] to-[#211B35] p-5 rounded-2xl border border-[#FFCA55]/30 flex flex-col items-center text-center justify-center space-y-2">
              <div class="w-16 h-16 rounded-full bg-[#6338D4] p-1 border-2 border-[#FFCA55] shadow-lg overflow-hidden">
                <img src="${data.mascot.avatar}" alt="${data.mascot.name}" class="w-full h-full object-cover">
              </div>
              <div>
                <h5 class="font-extrabold text-sm text-white">${data.mascot.name}</h5>
                <p class="text-[11px] text-[#24CBA2] font-semibold">${data.mascot.role}</p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-[#FFCA55]/20 text-[#FFCA55] text-[10px] font-extrabold">
                Pemandu Perjalanan
              </span>
            </div>
          </div>

          <!-- Chapters In This Realm -->
          <div class="space-y-3">
            <h4 class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[#8B5CF6] text-[18px]">menu_book</span>
              <span>Bab Pembelajaran Tersedia</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${data.chapters.map((ch, idx) => `
                <div class="p-3.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20 flex items-center justify-between hover:border-[#FFCA55] transition-all cursor-pointer" onclick="RagamaraEcosystem.RegionalDossier.launchChapter(${idx})">
                  <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-[#6338D4] text-white text-[11px] font-black flex items-center justify-center">${idx + 1}</span>
                    <span class="text-xs font-bold text-white">${ch}</span>
                  </div>
                  <span class="material-symbols-outlined text-[16px] text-[#FFCA55]">play_arrow</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Regional Cultural Assets from Database -->
          ${regionalItems.length > 0 ? `
            <div class="space-y-3 pt-2">
              <h4 class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[#24CBA2] text-[18px]">verified</span>
                <span>Pusaka & Warisan Budaya Terdaftar (DAPOBUD)</span>
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                ${regionalItems.map(item => `
                  <div class="p-2.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20 hover:border-[#24CBA2] transition-colors cursor-pointer" onclick="RagamaraEcosystem.RegionalDossier.close(); RagamaraEcosystem.Culturepedia.openDetail('${item.record_id}');">
                    <h5 class="text-xs font-black text-white truncate">${item.name}</h5>
                    <p class="text-[10px] text-[#24CBA2] font-semibold">${item.dapobud?.region?.province || 'Nusantara'}</p>
                    <p class="text-[10px] text-[#CCC3DF] font-mono mt-1">${item.dapobud?.number || 'WBTb Terdaftar'}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Footer Action -->
          <div class="flex justify-between items-center pt-4 border-t border-[#8B5CF6]/20">
            <button onclick="RagamaraEcosystem.RegionalDossier.close()" class="btn btn-secondary text-xs py-2 px-6">
              Kembali ke Peta
            </button>
            <button onclick="RagamaraEcosystem.RegionalDossier.startExploration('${regionKey}')" class="btn btn-primary text-xs py-2 px-6 flex items-center gap-1.5">
              <span>Mulai Ekspedisi Wilayah</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      `;

      modal.classList.add('is-open');
    },

    close() {
      const modal = document.getElementById('regional-dossier-modal');
      if (modal) modal.classList.remove('is-open');
    },

    launchChapter(chapterIdx) {
      this.close();
      window.switchView('belajar');
      if (window.MiniGameEngine) {
        window.MiniGameEngine.openArena('A');
      }
    },

    startExploration(regionKey) {
      this.close();
      window.switchView('belajar');
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
        role: 'Maskot Utama & Pemandu Budaya',
        lore: 'Raga adalah Badak Jawa bercula satu yang ceria, bijaksana, dan penuh rasa ingin tahu terhadap keragaman budaya Nusantara. Ia mengenakan selendang tenun merah bermotif bunga bintang tradisional Indonesia yang melambangkan kebersamaan dan perlindungan pusaka nenek moyang.',
        audioGreeting: 'Halo Sahabat Petualang! Ayo lestarikan budaya Nusantara bersama Raga!',
        unlockedRequirement: 'Tersedia sejak awal petualangan',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_transparent.png'
      },
      {
        id: 'cendro_cenderawasih',
        name: 'Cendro si Cenderawasih',
        origin: 'Lembah Baliem, Papua Pegunungan',
        status: 'unlocked',
        role: 'Penyanyi Nada Tradisional & Noken',
        lore: 'Burung Cenderawasih jantan berbulu kuning keemasan yang mahir menirukan melodi suling bambu dan memandu para penenun serat kulit kayu Noken.',
        audioGreeting: 'Syalom sahabat! Dengarkan simfoni alam Papua yang menyejukkan jiwa.',
        unlockedRequirement: 'Selesaikan Ekspedisi Lembah Baliem (Level 5)',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_avatar.png'
      },
      {
        id: 'bekti_bekantan',
        name: 'Bekti si Bekantan',
        origin: 'Sungai Mahakam, Kalimantan Timur',
        status: 'unlocked',
        role: 'Penjaga Hutan Bakau & Anyaman Rotan',
        lore: 'Bekantan berhidung mancung yang gemar melompat di pucuk pohon bakau sambil membawa tas anyaman rotan Anjat berisi pusaka kriya Dayak.',
        audioGreeting: 'Tabe! Jangan ragu menyeberangi riak sungai Mahakam bersamaku!',
        unlockedRequirement: 'Buka Bab Kriya Anyaman Dayak (Level 8)',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_avatar.png'
      },
      {
        id: 'jalak_curik',
        name: 'Jalak Curik Bali',
        origin: 'Taman Nasional Bali Barat',
        status: 'in_progress',
        role: 'Penjaga Kesucian Tirta & Pura',
        lore: 'Burung putih anggun bertopeng biru laut yang melambangkan keharmonisan Tri Hita Karana dan kelestarian aliran irigasi Subak.',
        audioGreeting: 'Om Swastyastu! Mari jaga kesucian tanah dan batin kita.',
        unlockedRequirement: 'Progres Misi Subak Bali: 70% (Butuh 30 XP lagi)',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_avatar.png'
      },
      {
        id: 'komo_komodo',
        name: 'Komo si Naga Purba',
        origin: 'Pulau Rinca & Komodo, NTT',
        status: 'locked',
        role: 'Penjaga Savana & Cerita Purba',
        lore: 'Kadal raksasa purba yang ramah dan perkasa, saksi sejarah kepulauan Sunda Kecil sejak ribuan tahun silam.',
        audioGreeting: 'Kuk kuk... Keberanian adalah pusaka terhebat yang kau miliki.',
        unlockedRequirement: 'Capai Level 12 & Taklukkan Ekspedisi Savana NTT',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_avatar.png'
      },
      {
        id: 'maleo_sulawesi',
        name: 'Maleo si Burung Pasir',
        origin: 'Gunung Tompotika, Sulawesi Tengah',
        status: 'locked',
        role: 'Penjaga Telur Kehidupan Geotermal',
        lore: 'Burung berkepala jambul hitam mengkilap yang memanfaatkan panas bumi pasir pantai untuk menetaskan telur persaudaraan.',
        audioGreeting: 'Kurr... Mari belajar dari kehangatan bumi Nusantara.',
        unlockedRequirement: 'Capai Level 15 & Buka Misi Celebes',
        badge: 'assets/images/mascot_raga_avatar.png',
        fullImg: 'assets/images/mascot_raga_avatar.png'
      }
    ],

    setExpression(expr) {
      this.currentExpression = expr;
      const preview = document.getElementById('raga-expression-viewer');
      if (preview && window.RagaMascot) {
        preview.innerHTML = window.RagaMascot.render(expr, 'w-48 h-48 sm:w-56 sm:h-56 object-contain drop-shadow-[0_12px_24px_rgba(99,56,212,0.4)] animate-float-gentle');
      }
      
      const speech = document.getElementById('raga-expression-speech');
      const speeches = {
        neutral: 'Aku Raga! Senang sekali bisa menemani petualangan budayamu hari ini!',
        curious: 'Hmm... Tahukah kamu apa filosofi di balik motif kain tradisional ini?',
        happy: 'Hebat sekali! Kamu berhasil menyelesaikan tantangan budaya dengan cermat!',
        celebrating: 'Luar biasa! Seluruh penjuru Nusantara bangga atas ketekunan belajarmu!',
        thinking: 'Mari kita renungkan makna falsafah luhur yang diwariskan para leluhur...',
        encouraging: 'Jangan menyerah! Setiap langkah kecil memperdalam kecintaan kita pada budaya!'
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

      const isUnlocked = m.status === 'unlocked';
      const isInProgress = m.status === 'in_progress';

      body.innerHTML = `
        <div class="text-center space-y-4">
          <div class="w-32 h-32 mx-auto rounded-3xl bg-[#6338D4]/30 p-2 border-2 ${isUnlocked ? 'border-[#FFCA55]' : 'border-[#8B5CF6]/30'} shadow-2xl relative overflow-hidden flex items-center justify-center">
            <img src="${m.fullImg}" alt="${m.name}" class="w-full h-full object-contain ${!isUnlocked && !isInProgress ? 'grayscale opacity-50' : ''}">
            ${!isUnlocked && !isInProgress ? `
              <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span class="material-symbols-outlined text-4xl text-[#FF786B]">lock</span>
              </div>
            ` : ''}
          </div>

          <div>
            <span class="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isUnlocked ? 'bg-[#24CBA2] text-[#0A382C]' : isInProgress ? 'bg-[#FFCA55] text-[#382400]' : 'bg-[#FF786B] text-[#38100C]'}">
              ${isUnlocked ? 'Terbuka & Siap Menemani' : isInProgress ? 'Sedang Berjalan' : 'Terkunci'}
            </span>
            <h3 class="text-2xl font-black text-[#FFF8EB] mt-2">${m.name}</h3>
            <p class="text-xs text-[#24CBA2] font-bold">${m.role} • ${m.origin}</p>
          </div>

          <div class="bg-[#211B35] p-4 rounded-2xl border border-[#8B5CF6]/20 text-xs text-[#CCC3DF] text-justify leading-relaxed">
            ${m.lore}
          </div>

          <div class="p-3 rounded-xl bg-[#2D2445] border border-[#FFCA55]/20 text-xs">
            <span class="text-[#FFCA55] font-bold block mb-1">Syarat Membuka Sahabat:</span>
            <span class="text-white">${m.unlockedRequirement}</span>
          </div>

          <div class="pt-3 flex justify-between items-center border-t border-[#8B5CF6]/20">
            <button onclick="RagamaraEcosystem.MascotCollection.closeDetail()" class="btn btn-secondary text-xs py-2 px-6">
              Tutup
            </button>
            ${isUnlocked ? `
              <button onclick="window.showToast('✨ ${m.name} kini mendampingi profil petualanganmu!'); RagamaraEcosystem.MascotCollection.closeDetail();" class="btn btn-primary text-xs py-2 px-6">
                Jadikan Rekan Aktif
              </button>
            ` : `
              <button onclick="window.switchView('belajar'); RagamaraEcosystem.MascotCollection.closeDetail();" class="btn btn-primary text-xs py-2 px-6">
                Menuju Misi Pembuka
              </button>
            `}
          </div>
        </div>
      `;

      modal.classList.add('is-open');
    },

    closeDetail() {
      const modal = document.getElementById('mascot-detail-modal');
      if (modal) modal.classList.remove('is-open');
    }
  };

  // =========================================================================
  // 5. LEADERBOARD CONTROLLER
  // =========================================================================
  const Leaderboard = {
    activeTab: 'weekly', // 'weekly', 'monthly', 'friends'

    top3Data: [
      { rank: 1, name: 'Dewi Gandawati', xp: 3420, avatar: 'assets/images/mascot_raga_avatar.png', region: 'Jawa', badge: '👑 Emas' },
      { rank: 2, name: 'Gede Arya Swastika', xp: 2910, avatar: 'assets/images/mascot_raga_avatar.png', region: 'Bali', badge: '🥈 Perak' },
      { rank: 3, name: 'Cut Meutia Zahra', xp: 2740, avatar: 'assets/images/mascot_raga_avatar.png', region: 'Aceh', badge: '🥉 Perunggu' }
    ],

    rankingsData: [
      { rank: 4, name: 'Firza Penjelajah (Anda)', xp: 2450, delta: 'up', deltaVal: 2, isMe: true, region: 'Sumatera Barat', title: 'Ahli Warisan Minang' },
      { rank: 5, name: 'Bagus Setyawan', xp: 2280, delta: 'down', deltaVal: 1, isMe: false, region: 'DI Yogyakarta', title: 'Penenun Pamor' },
      { rank: 6, name: 'Nyoman Triadi', xp: 2150, delta: 'same', deltaVal: 0, isMe: false, region: 'Bali', title: 'Penjaga Tirta' },
      { rank: 7, name: 'Dayang Kumala', xp: 2010, delta: 'up', deltaVal: 1, isMe: false, region: 'Kalimantan Timur', title: 'Mutiara Mahakam' },
      { rank: 8, name: 'Ahmad Faisal', xp: 1940, delta: 'down', deltaVal: 2, isMe: false, region: 'Sulawesi Selatan', title: 'Nahkoda Phinisi' },
      { rank: 9, name: 'Yulius Wenda', xp: 1820, delta: 'same', deltaVal: 0, isMe: false, region: 'Papua Pegunungan', title: 'Penjelajah Honai' },
      { rank: 10, name: 'Sarah Christina', xp: 1750, delta: 'down', deltaVal: 1, isMe: false, region: 'Maluku', title: 'Peniup Tifa' }
    ],

    switchTab(tab) {
      this.activeTab = tab;
      document.querySelectorAll('.leaderboard-tab-btn').forEach(btn => {
        btn.classList.toggle('active-lead-tab', btn.dataset.tab === tab);
      });
      window.showToast?.(`Papan peringkat diperbarui: ${tab === 'weekly' ? 'Mingguan' : tab === 'monthly' ? 'Bulanan' : 'Komunitas Teman'}`);
    }
  };

  // =========================================================================
  // 6. DAILY MISSIONS CONTROLLER
  // =========================================================================
  const DailyMissions = {
    missions: [
      {
        id: 'mission_1',
        title: 'Penjelajah Pagi',
        desc: 'Selesaikan 1 sesi Mini-Game Budaya di Arena',
        current: 1,
        total: 1,
        rewardXp: 40,
        rewardGems: 10,
        claimed: false
      },
      {
        id: 'mission_2',
        title: 'Pelajar Tekun',
        desc: 'Buka dan baca 2 artikel ensiklopedia di Culturepedia',
        current: 2,
        total: 2,
        rewardXp: 30,
        rewardGems: 5,
        claimed: false
      },
      {
        id: 'mission_3',
        title: 'Cendekia Sempurna',
        desc: 'Raih akurasi 100% pada Tantangan Filosofi',
        current: 1,
        total: 1,
        rewardXp: 50,
        rewardGems: 15,
        claimed: false
      },
      {
        id: 'mission_4',
        title: 'Kolektor Pusaka',
        desc: 'Simpan 1 artefak baru ke Koleksi Pribadi',
        current: 1,
        total: 1,
        rewardXp: 25,
        rewardGems: 5,
        claimed: true
      }
    ],

    init() {
      this.startCountdown();
      this.render();
    },

    claim(missionId) {
      const m = this.missions.find(item => item.id === missionId);
      if (!m || m.claimed || m.current < m.total) return;

      m.claimed = true;
      if (window.GameState && window.GameState.player) {
        window.GameState.player.xp += m.rewardXp;
        window.GameState.player.gems += m.rewardGems;
        window.updateHud?.();
      }

      window.playGamelanChime?.();
      window.showToast?.(`🎉 Misi "${m.title}" Diklaim! +${m.rewardXp} XP & +${m.rewardGems} Berlian`);
      this.render();
    },

    startCountdown() {
      const timerEl = document.getElementById('daily-missions-timer');
      const update = () => {
        if (!timerEl) return;
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight - now;

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
          <div class="bg-[#211B35] p-4 sm:p-5 rounded-2xl border ${m.claimed ? 'border-[#24CBA2]/30 bg-[#211B35]/50' : isComplete ? 'border-[#FFCA55]/60 bg-[#2D2445]' : 'border-[#8B5CF6]/20'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-sm text-[#FFF8EB]">${m.title}</span>
                ${m.claimed ? `
                  <span class="px-2 py-0.2 rounded-full bg-[#24CBA2]/20 text-[#24CBA2] text-[10px] font-black uppercase">Selesai</span>
                ` : isComplete ? `
                  <span class="px-2 py-0.2 rounded-full bg-[#FFCA55] text-[#382400] text-[10px] font-black uppercase">Siap Klaim</span>
                ` : `
                  <span class="px-2 py-0.2 rounded-full bg-[#6338D4]/40 text-[#CCC3DF] text-[10px] font-bold">${m.current}/${m.total}</span>
                `}
              </div>
              <p class="text-xs text-[#CCC3DF]">${m.desc}</p>
              
              <!-- Progress Bar -->
              <div class="w-full max-w-md h-2 rounded-full bg-[#150E22] overflow-hidden mt-2">
                <div class="h-full bg-gradient-to-r from-[#6338D4] to-[#24CBA2] transition-all duration-500" style="width: ${percent}%;"></div>
              </div>
            </div>

            <!-- Reward & Action -->
            <div class="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <div class="text-right text-xs">
                <span class="text-[#FFCA55] font-black block">+${m.rewardXp} XP</span>
                <span class="text-[#24CBA2] font-bold block">+${m.rewardGems} 💎</span>
              </div>
              
              ${m.claimed ? `
                <button disabled class="btn bg-white/10 text-white/40 text-xs py-2 px-4 cursor-not-allowed">
                  Diklaim
                </button>
              ` : isComplete ? `
                <button onclick="RagamaraEcosystem.DailyMissions.claim('${m.id}')" class="btn btn-accent text-xs py-2 px-5 animate-pulse">
                  Klaim Hadiah
                </button>
              ` : `
                <button onclick="window.switchView('belajar')" class="btn btn-secondary text-xs py-2 px-4">
                  Mulai
                </button>
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
    filter: 'all', // 'all', 'unlocked', 'in_progress', 'locked'

    list: [
      {
        id: 'ach_1',
        title: 'Penjelajah Ranah Minang',
        category: 'Penjelajah Nusantara',
        desc: 'Selesaikan seluruh bab arsitektur Rumah Gadang dan tenun Songket di Sumatera Barat.',
        status: 'unlocked',
        reward: '150 XP & Gelar "Ahli Warisan Minang"',
        date: '10 Nov 2026',
        icon: 'roofing'
      },
      {
        id: 'ach_2',
        title: 'Mpu Pamor Keris',
        category: 'Pengrajin Pusaka',
        desc: 'Identifikasi 5 jenis pamor keris tradisional Jawa tanpa kesalahan.',
        status: 'unlocked',
        reward: '120 XP & Bingkai Pusaka Majapahit',
        date: '12 Nov 2026',
        icon: 'swords'
      },
      {
        id: 'ach_3',
        title: 'Peniup Saluang Luhur',
        category: 'Ahli Filosofi',
        desc: 'Raih skor sempurna pada tantangan melodi tradisional Saluang Minangkabau.',
        status: 'unlocked',
        reward: '100 XP & Koleksi Nada Saluang',
        date: '13 Nov 2026',
        icon: 'music_note'
      },
      {
        id: 'ach_4',
        title: 'Kolektor Noken Papua',
        category: 'Penjaga Adat',
        desc: 'Pelajari proses perajutan serat anggrek dan kayu pada tas Noken UNESCO.',
        status: 'in_progress',
        progress: '2/3 Bab Tuntas',
        reward: '180 XP & Maskot Cendro',
        icon: 'shopping_bag'
      },
      {
        id: 'ach_5',
        title: 'Pengayuh Phinisi Samudra',
        category: 'Penjelajah Nusantara',
        desc: 'Pelajari navigasi tradisional maritim suku Bugis di Bulukumba.',
        status: 'in_progress',
        progress: '1/3 Bab Tuntas',
        reward: '150 XP & Gelar "Nahkoda Phinisi"',
        icon: 'sailing'
      },
      {
        id: 'ach_6',
        title: 'Penjaga Tirta Subak Bali',
        category: 'Penjaga Adat',
        desc: 'Tuntaskan simulasi pembagian air adil sistem irigasi Subak Bali.',
        status: 'locked',
        progress: 'Terkunci (Butuh Level 10)',
        reward: '200 XP & Bingkai Dewata',
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

      const filtered = this.list.filter(item => {
        if (this.filter === 'all') return true;
        return item.status === this.filter;
      });

      container.innerHTML = filtered.map(ach => {
        const isUnlocked = ach.status === 'unlocked';
        const isInProgress = ach.status === 'in_progress';

        return `
          <div class="bg-[#211B35] p-5 rounded-2xl border ${isUnlocked ? 'border-[#FFCA55]/50 shadow-[0_6px_20px_rgba(255,202,85,0.15)]' : isInProgress ? 'border-[#8B5CF6]/30' : 'border-white/5 opacity-60'} flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl ${isUnlocked ? 'bg-[#FFCA55] text-[#382400]' : isInProgress ? 'bg-[#6338D4] text-white' : 'bg-[#150E22] text-[#CCC3DF]'} shrink-0 flex items-center justify-center shadow-lg border border-white/10">
              <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' ${isUnlocked ? 1 : 0};">${ach.icon}</span>
            </div>
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black uppercase tracking-wider text-[#24CBA2]">${ach.category}</span>
                <span class="text-[10px] font-bold ${isUnlocked ? 'text-[#FFCA55]' : 'text-[#CCC3DF]'}">
                  ${isUnlocked ? `Tercapai: ${ach.date}` : isInProgress ? ach.progress : 'Terkunci'}
                </span>
              </div>
              <h4 class="font-extrabold text-sm text-[#FFF8EB]">${ach.title}</h4>
              <p class="text-xs text-[#CCC3DF] leading-relaxed">${ach.desc}</p>
              <div class="pt-2 border-t border-white/10 text-[11px] text-[#FFCA55] font-semibold flex items-center gap-1">
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
  // 8. PLAYER PROFILE & RPG IDENTITY CONTROLLER
  // =========================================================================
  const Profile = {
    selectedFrame: 'frame_gold_minang',
    selectedTitle: 'Ahli Warisan Minang',

    frames: {
      frame_gold_minang: { name: 'Bingkai Emas Minangkabau', class: 'border-[#FFCA55] shadow-[0_0_15px_rgba(255,202,85,0.6)]' },
      frame_majapahit: { name: 'Bingkai Surya Majapahit', class: 'border-[#FF786B] shadow-[0_0_15px_rgba(255,120,107,0.6)]' },
      frame_asmat: { name: 'Bingkai Ukir Asmat Papua', class: 'border-[#24CBA2] shadow-[0_0_15px_rgba(36,203,162,0.6)]' }
    },

    equipFrame(frameKey) {
      this.selectedFrame = frameKey;
      const avatarContainer = document.getElementById('profile-main-avatar');
      if (avatarContainer) {
        avatarContainer.className = `w-28 h-28 rounded-3xl bg-[#6338D4] p-1.5 border-4 overflow-hidden shadow-2xl transition-all ${this.frames[frameKey].class}`;
      }
      window.showToast?.(`✨ Bingkai diubah: ${this.frames[frameKey].name}`);
      window.playGamelanChime?.();
    },

    setTitle(title) {
      this.selectedTitle = title;
      const titleEl = document.getElementById('profile-player-title');
      if (titleEl) titleEl.innerText = `Gelar: ${title} • Bergabung 2026`;
      window.showToast?.(`🎖️ Gelar kehormatan diubah ke "${title}"`);
    }
  };

  // =========================================================================
  // 9. SETTINGS CONTROLLER
  // =========================================================================
  const Settings = {
    sfxEnabled: true,
    notificationsEnabled: true,
    highContrast: false,
    reducedMotion: false,
    dailyGoalMins: 20,

    init() {
      // restore preferences if stored
      try {
        const stored = localStorage.getItem('ragamara_settings');
        if (stored) {
          Object.assign(this, JSON.parse(stored));
        }
      } catch (e) {}
    },

    save() {
      try {
        localStorage.setItem('ragamara_settings', JSON.stringify({
          sfxEnabled: this.sfxEnabled,
          notificationsEnabled: this.notificationsEnabled,
          highContrast: this.highContrast,
          reducedMotion: this.reducedMotion,
          dailyGoalMins: this.dailyGoalMins
        }));
      } catch (e) {}
    },

    toggleSfx() {
      this.sfxEnabled = !this.sfxEnabled;
      this.save();
      const btn = document.getElementById('setting-sfx-toggle');
      if (btn) btn.innerText = this.sfxEnabled ? 'Aktif' : 'Nonaktif';
      window.showToast?.(`Audio SFX: ${this.sfxEnabled ? 'Diaktifkan' : 'Dinonaktifkan'}`);
    },

    toggleHighContrast() {
      this.highContrast = !this.highContrast;
      this.save();
      document.body.classList.toggle('high-contrast-mode', this.highContrast);
      window.showToast?.(`Kontras Tinggi: ${this.highContrast ? 'Aktif' : 'Nonaktif'}`);
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
  // 10. PUBLIC INITIALIZER
  // =========================================================================
  return {
    Culturepedia,
    RegionalDossier,
    MascotCollection,
    Leaderboard,
    DailyMissions,
    Achievements,
    Profile,
    Settings,
    init() {
      Culturepedia.init();
      DailyMissions.init();
      Achievements.render();
      Settings.init();
    }
  };
})();
