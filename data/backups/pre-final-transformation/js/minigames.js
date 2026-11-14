/**
 * RAGAMARA INTERACTIVE MINI-GAMES ENGINE (PHASE 04)
 * Genuine educational gameplay across 6 distinct cultural mechanics:
 *  A. Multiple Choice (Teka-Teki Motif Songket)
 *  B. Matching Pairs (Pasangan Pusaka Nusantara)
 *  C. Drag & Drop / Tap-to-Place (Arsitektur Rumah Gadang)
 *  D. Listening Challenge (Tebak Irama & Melodi Tradisional)
 *  E. Cultural Story Challenge (Dilema Musyawarah Adat)
 *  F. Visual Puzzle (Restorasi Ragam Hias Saik Kalamai)
 */

const MiniGameEngine = {
  // Game States Enum (Section 8)
  STATES: {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    ANSWER_SELECTED: 'ANSWER_SELECTED',
    ANSWER_SUBMITTED: 'ANSWER_SUBMITTED',
    CORRECT: 'CORRECT',
    INCORRECT: 'INCORRECT',
    HINT_DISPLAYED: 'HINT_DISPLAYED',
    COMPLETED: 'COMPLETED',
    RETRY: 'RETRY',
    PAUSED: 'PAUSED'
  },

  currentState: 'NOT_STARTED',
  activeGameType: 'A', // 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  score: {
    xpEarned: 0,
    gemsEarned: 0,
    accuracy: 100,
    errorsCount: 0,
    completedGames: new Set()
  },

  // Audio Context for Sound Effects
  audioCtx: null,

  init() {
    this.bindKeyboardNavigation();
  },

  getAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  playTone(freq, type = 'sine', duration = 0.4, gainLevel = 0.15) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainLevel, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  },

  playSuccessChime() {
    // Slendro / Pentatonic arpeggio: C5 -> E5 -> G5 -> C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.6, 0.12), idx * 90);
    });
  },

  playErrorSound() {
    this.playTone(220, 'sawtooth', 0.35, 0.08);
  },

  playSaluangSample() {
    // Gentle flute-like pentatonic breath
    const notes = [440, 495, 550, 660, 550, 440];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.5, 0.1), idx * 250);
    });
  },

  // Open the dedicated Arena
  openArena(gameType = 'A') {
    this.activeGameType = gameType;
    this.currentState = this.STATES.IN_PROGRESS;
    const arenaEl = document.getElementById('gameplay-arena');
    if (!arenaEl) return;
    arenaEl.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    this.renderActiveGame();
  },

  closeArena() {
    const arenaEl = document.getElementById('gameplay-arena');
    if (arenaEl) arenaEl.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    this.currentState = this.STATES.NOT_STARTED;
  },

  pauseGame() {
    this.currentState = this.STATES.PAUSED;
    const pauseModal = document.getElementById('arena-pause-modal');
    if (pauseModal) pauseModal.classList.add('is-open');
  },

  resumeGame() {
    this.currentState = this.STATES.IN_PROGRESS;
    const pauseModal = document.getElementById('arena-pause-modal');
    if (pauseModal) pauseModal.classList.remove('is-open');
  },

  setMascotReaction(emotion = 'happy', quote = '') {
    const mascotContainer = document.getElementById('arena-mascot-container');
    const quoteEl = document.getElementById('arena-mascot-speech');
    if (mascotContainer && typeof RagaMascot !== 'undefined') {
      mascotContainer.innerHTML = RagaMascot.render(emotion, { size: 100, withHeadpiece: true });
    }
    if (quoteEl && quote) {
      quoteEl.innerHTML = quote;
    }
  },

  renderActiveGame() {
    // Update Mode Selector Tabs
    document.querySelectorAll('.arena-game-tab').forEach(tab => {
      if (tab.getAttribute('data-type') === this.activeGameType) {
        tab.classList.add('bg-[#6338D4]', 'text-white', 'border-[#FFCA55]');
        tab.classList.remove('bg-[#2D2445]', 'text-[#CCC3DF]');
      } else {
        tab.classList.remove('bg-[#6338D4]', 'text-white', 'border-[#FFCA55]');
        tab.classList.add('bg-[#2D2445]', 'text-[#CCC3DF]');
      }
    });

    const stage = document.getElementById('arena-stage-container');
    if (!stage) return;

    switch (this.activeGameType) {
      case 'A': this.renderMiniGameA(stage); break;
      case 'B': this.renderMiniGameB(stage); break;
      case 'C': this.renderMiniGameC(stage); break;
      case 'D': this.renderMiniGameD(stage); break;
      case 'E': this.renderMiniGameE(stage); break;
      case 'F': this.renderMiniGameF(stage); break;
    }
  },

  // =========================================================================
  // MINI-GAME A: MULTIPLE CHOICE (FILOSOFI ITIK PULANG PATANG)
  // =========================================================================
  renderMiniGameA(stage) {
    this.setMascotReaction('thinking', '“Cermati perilaku itik yang berbaris rapi. Keteraturan apa yang ingin disampaikan nenek moyang kita?”');

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game A • Pilihan Ganda Filosofis
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Makna Luhur Ukiran Songket "Itik Pulang Patang"
          </h2>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Motif geometris khas Minangkabau yang terpahat di dinding Rumah Gadang dan ditenun pada kain songket Pandai Sikek.
          </p>
        </div>

        <!-- Question Card -->
        <div class="bg-[#211B35] p-6 rounded-3xl border-2 border-[#8B5CF6]/30 shadow-[0_12px_32px_rgba(10,5,18,0.8)] space-y-4">
          <p class="font-bold text-sm sm:text-base text-white leading-relaxed">
            Dalam tatanan adat Minangkabau, apa pesan moral utama yang diajarkan melalui ornamen <em>Itik Pulang Patang</em>?
          </p>

          <div class="space-y-3" id="minigame-a-options">
            <button onclick="MiniGameEngine.handleChoiceA(this, true)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 transition-all flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFCA55]">
              <div class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-[#1A1228] flex items-center justify-center text-xs font-black text-[#FFCA55] border border-[#FFCA55]/30">1</span>
                <span class="text-xs sm:text-sm font-bold text-[#FFF8EB]">Keteraturan, kebersamaan, dan kepatuhan bermusyawarah mufakat</span>
              </div>
              <span class="material-symbols-outlined text-[#24CBA2] opacity-0 group-hover:opacity-40 icon-check">check_circle</span>
            </button>

            <button onclick="MiniGameEngine.handleChoiceA(this, false)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 transition-all flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFCA55]">
              <div class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-[#1A1228] flex items-center justify-center text-xs font-black text-[#CCC3DF] border border-[#8B5CF6]/20">2</span>
                <span class="text-xs sm:text-sm font-bold text-[#FFF8EB]">Keberanian menyerang lawan dalam pertempuran laut</span>
              </div>
              <span class="material-symbols-outlined text-[#FF786B] opacity-0 icon-check">cancel</span>
            </button>

            <button onclick="MiniGameEngine.handleChoiceA(this, false)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 transition-all flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFCA55]">
              <div class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-[#1A1228] flex items-center justify-center text-xs font-black text-[#CCC3DF] border border-[#8B5CF6]/20">3</span>
                <span class="text-xs sm:text-sm font-bold text-[#FFF8EB]">Kecepatan menimbun kekayaan berniaga antar-pulau</span>
              </div>
              <span class="material-symbols-outlined text-[#FF786B] opacity-0 icon-check">cancel</span>
            </button>
          </div>
        </div>

        <!-- Explanation Container (Hidden initially) -->
        <div id="explanation-box-a" class="hidden p-5 rounded-2xl bg-[#1A1228] border-2 border-[#24CBA2]/40 text-left space-y-2 animate-pop">
          <div class="flex items-center gap-2 text-[#24CBA2] font-black text-xs uppercase">
            <span class="material-symbols-outlined text-[18px]">verified</span>
            <span>Penjelasan Adat Luhur</span>
          </div>
          <p class="text-xs sm:text-sm text-[#CCC3DF] leading-relaxed">
            Itik selalu berjalan beriringan ke kandang saat senja tanpa saling mendahului atau memperebutkan jalan. Adat Minang memetik filosofi ini agar masyarakat senantiasa menjaga kerukunan, mematuhi kesepakatan musyawarah, dan hidup selaras dengan aturan adat.
          </p>
          <div class="pt-2 flex justify-end">
            <button onclick="MiniGameEngine.progressToCelebration(40, 15, 'Teka-Teki Motif Songket')" class="btn btn-primary text-xs py-2 px-6">
              Selesai & Lanjutkan ➔
            </button>
          </div>
        </div>
      </div>
    `;
  },

  handleChoiceA(btn, isCorrect) {
    const opts = document.querySelectorAll('#minigame-a-options button');
    opts.forEach(b => {
      b.disabled = true;
      b.classList.remove('hover:bg-[#3A3057]');
    });

    if (isCorrect) {
      this.playSuccessChime();
      btn.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]');
      btn.querySelector('.icon-check').classList.remove('opacity-0', 'group-hover:opacity-40');
      this.setMascotReaction('celebrating', '“Luar biasa! Benar sekali, kerukunan dan ketaatan musyawarah adalah mahkota adat Minang!”');
      document.getElementById('explanation-box-a')?.classList.remove('hidden');
    } else {
      this.playErrorSound();
      btn.classList.add('bg-[#FF786B]', 'text-white', 'animate-wiggle');
      btn.querySelector('.icon-check').classList.remove('opacity-0');
      this.score.errorsCount++;
      this.setMascotReaction('encouraging', '“Jangan berkecil hati! Ingat filosofi itik: mereka berjalan teratur dan damai tanpa berselisih.”');
      setTimeout(() => {
        opts.forEach(b => {
          b.disabled = false;
          b.classList.remove('bg-[#FF786B]', 'text-white', 'animate-wiggle');
          b.classList.add('hover:bg-[#3A3057]');
        });
      }, 1400);
    }
  },

  // =========================================================================
  // MINI-GAME B: MATCHING GAME (PASANGAN PUSAKA NUSANTARA)
  // =========================================================================
  renderMiniGameB(stage) {
    this.setMascotReaction('curious', '“Pasangkan setiap pusaka warisan budaya dengan daerah asalnya. Klik dua kartu yang cocok!”');

    const pairs = [
      { id: 1, text: "Rencong", pairId: "A", category: "Senjata" },
      { id: 2, text: "Aceh", pairId: "A", category: "Daerah Asal" },
      { id: 3, text: "Rumah Gadang", pairId: "B", category: "Arsitektur" },
      { id: 4, text: "Minangkabau", pairId: "B", category: "Daerah Asal" },
      { id: 5, text: "Sasando", pairId: "C", category: "Alat Musik" },
      { id: 6, text: "Pulau Rote NTT", pairId: "C", category: "Daerah Asal" },
      { id: 7, text: "Gamelan Slendro", pairId: "D", category: "Seni Musik" },
      { id: 8, text: "Jawa", pairId: "D", category: "Daerah Asal" }
    ];

    // Shuffle pairs
    const shuffled = [...pairs].sort(() => Math.random() - 0.5);

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game B • Pasangan Pusaka Budaya
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Hubungkan Pusaka & Daerah Asalnya
          </h2>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Pilih 2 kartu yang memiliki relasi sejarah atau wilayah yang tepat.
          </p>
          <div class="text-xs font-bold text-[#FFCA55] pt-1">
            <span id="pairs-left-counter">4 Pasang Tersisa</span>
          </div>
        </div>

        <!-- Matching Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5" id="matching-grid">
          ${shuffled.map(item => `
            <button onclick="MiniGameEngine.handleCardMatch(this, '${item.pairId}')" class="match-card p-4 rounded-2xl bg-[#211B35] border-2 border-[#8B5CF6]/30 text-center flex flex-col items-center justify-center min-h-[96px] cursor-pointer hover:border-[#FFCA55] transition-all focus:outline-none" data-pair="${item.pairId}">
              <span class="text-[10px] uppercase font-bold text-[#24CBA2]">${item.category}</span>
              <span class="text-sm font-black text-white mt-1 leading-snug">${item.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.matchingState = {
      selectedCard: null,
      matchedPairs: 0,
      totalPairs: 4
    };
  },

  handleCardMatch(btn, pairId) {
    if (btn.classList.contains('is-matched') || btn === this.matchingState.selectedCard) return;

    this.playTone(392, 'sine', 0.2, 0.1);
    btn.classList.add('border-[#FFCA55]', 'bg-[#3A3057]');

    if (!this.matchingState.selectedCard) {
      this.matchingState.selectedCard = btn;
      this.setMascotReaction('thinking', '“Satu kartu terpilih. Sekarang cari pasangannya yang sesuai!”');
      return;
    }

    const firstCard = this.matchingState.selectedCard;
    const firstPair = firstCard.getAttribute('data-pair');

    if (firstPair === pairId) {
      // MATCH!
      this.playSuccessChime();
      firstCard.classList.remove('bg-[#3A3057]');
      btn.classList.remove('bg-[#3A3057]');
      firstCard.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]', 'is-matched', 'animate-pop');
      btn.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]', 'is-matched', 'animate-pop');
      firstCard.disabled = true;
      btn.disabled = true;

      this.matchingState.matchedPairs++;
      this.matchingState.selectedCard = null;

      const remaining = this.matchingState.totalPairs - this.matchingState.matchedPairs;
      const counterEl = document.getElementById('pairs-left-counter');
      if (counterEl) {
        counterEl.innerText = remaining > 0 ? `${remaining} Pasang Tersisa` : '🎉 Semua Pasangan Berhasil Dihubungkan!';
      }

      this.setMascotReaction('excited', '“Tepat sekali! Keduanya adalah pasangan pusaka yang tak terpisahkan.”');

      if (this.matchingState.matchedPairs === this.matchingState.totalPairs) {
        setTimeout(() => {
          this.progressToCelebration(45, 15, 'Penyelaras Pusaka Nusantara');
        }, 800);
      }
    } else {
      // MISMATCH
      this.playErrorSound();
      firstCard.classList.add('bg-[#FF786B]', 'border-[#FF786B]', 'animate-wiggle');
      btn.classList.add('bg-[#FF786B]', 'border-[#FF786B]', 'animate-wiggle');
      this.score.errorsCount++;

      this.setMascotReaction('encouraging', '“Belum cocok. Coba ingat kembali daerah pusaka tersebut.”');

      setTimeout(() => {
        firstCard.classList.remove('border-[#FFCA55]', 'bg-[#3A3057]', 'bg-[#FF786B]', 'border-[#FF786B]', 'animate-wiggle');
        btn.classList.remove('border-[#FFCA55]', 'bg-[#3A3057]', 'bg-[#FF786B]', 'border-[#FF786B]', 'animate-wiggle');
        this.matchingState.selectedCard = null;
      }, 700);
    }
  },

  // =========================================================================
  // MINI-GAME C: DRAG & DROP / TAP-TO-PLACE (ARSITEKTUR RUMAH GADANG)
  // =========================================================================
  renderMiniGameC(stage) {
    this.setMascotReaction('curious', '“Susunlah komponen Rumah Gadang ke zona posisi yang benar. Klik atau seret bagian tersebut!”');

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game C • Susun Struktur Arsitektur
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Rangkai Struktur Rumah Gadang Tahan Gempa
          </h2>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Tempatkan 3 elemen arsitektur berikut ke zona yang tepat pada konstruksi vernakular Minang.
          </p>
        </div>

        <!-- Available Parts (Draggable or Tap-to-Select) -->
        <div class="p-4 rounded-2xl bg-[#1A1228] border border-[#8B5CF6]/30 flex flex-wrap gap-3 justify-center" id="source-parts">
          <button onclick="MiniGameEngine.selectPartC(this, 'gonjong')" class="part-btn px-4 py-3 rounded-2xl bg-[#2D2445] border-2 border-[#FFCA55]/50 text-xs font-black text-white hover:bg-[#3A3057] transition-all cursor-pointer shadow" data-part="gonjong">
            🦏 Atap Gonjong Tanduk Kerbau
          </button>
          <button onclick="MiniGameEngine.selectPartC(this, 'pasak')" class="part-btn px-4 py-3 rounded-2xl bg-[#2D2445] border-2 border-[#FFCA55]/50 text-xs font-black text-white hover:bg-[#3A3057] transition-all cursor-pointer shadow" data-part="pasak">
            🪵 Pasak Kayu Elastis (Tanpa Paku)
          </button>
          <button onclick="MiniGameEngine.selectPartC(this, 'rangkiang')" class="part-btn px-4 py-3 rounded-2xl bg-[#2D2445] border-2 border-[#FFCA55]/50 text-xs font-black text-white hover:bg-[#3A3057] transition-all cursor-pointer shadow" data-part="rangkiang">
            🌾 Rangkiang Lumbung Padi
          </button>
        </div>

        <!-- Target Placement Drop Zones -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4" id="target-zones">
          <div onclick="MiniGameEngine.dropPartC(this, 'gonjong')" class="drop-zone p-5 rounded-3xl bg-[#211B35] border-2 border-dashed border-[#8B5CF6]/40 text-center flex flex-col items-center justify-center min-h-[130px] cursor-pointer hover:border-[#24CBA2] transition-colors" data-accept="gonjong">
            <span class="material-symbols-outlined text-3xl text-[#FFCA55]">roofing</span>
            <span class="text-xs font-extrabold text-white mt-2">Zona 1: Puncak Atap</span>
            <span class="text-[11px] text-[#CCC3DF] zone-status">Klik zona ini untuk memasang</span>
          </div>

          <div onclick="MiniGameEngine.dropPartC(this, 'pasak')" class="drop-zone p-5 rounded-3xl bg-[#211B35] border-2 border-dashed border-[#8B5CF6]/40 text-center flex flex-col items-center justify-center min-h-[130px] cursor-pointer hover:border-[#24CBA2] transition-colors" data-accept="pasak">
            <span class="material-symbols-outlined text-3xl text-[#FFCA55]">foundation</span>
            <span class="text-xs font-extrabold text-white mt-2">Zona 2: Sendi Rangka Bawah</span>
            <span class="text-[11px] text-[#CCC3DF] zone-status">Klik zona ini untuk memasang</span>
          </div>

          <div onclick="MiniGameEngine.dropPartC(this, 'rangkiang')" class="drop-zone p-5 rounded-3xl bg-[#211B35] border-2 border-dashed border-[#8B5CF6]/40 text-center flex flex-col items-center justify-center min-h-[130px] cursor-pointer hover:border-[#24CBA2] transition-colors" data-accept="rangkiang">
            <span class="material-symbols-outlined text-3xl text-[#FFCA55]">storefront</span>
            <span class="text-xs font-extrabold text-white mt-2">Zona 3: Halaman Depan</span>
            <span class="text-[11px] text-[#CCC3DF] zone-status">Klik zona ini untuk memasang</span>
          </div>
        </div>
      </div>
    `;

    this.dragState = {
      selectedPartId: null,
      selectedPartBtn: null,
      placedCount: 0
    };
  },

  selectPartC(btn, partId) {
    document.querySelectorAll('.part-btn').forEach(b => b.classList.remove('ring-4', 'ring-[#24CBA2]', 'bg-[#3A3057]'));
    btn.classList.add('ring-4', 'ring-[#24CBA2]', 'bg-[#3A3057]');
    this.dragState.selectedPartId = partId;
    this.dragState.selectedPartBtn = btn;
    this.playTone(440, 'sine', 0.15, 0.1);
    this.setMascotReaction('thinking', '“Elemen terpilih! Sekarang klik zona yang paling tepat pada denah konstruksi.”');
  },

  dropPartC(zoneEl, expectedId) {
    if (!this.dragState.selectedPartId) {
      this.setMascotReaction('confused', '“Pilih dulu komponen di atas, lalu klik zona penempatannya!”');
      return;
    }

    if (this.dragState.selectedPartId === expectedId) {
      // SUCCESSFUL PLACEMENT
      this.playSuccessChime();
      zoneEl.classList.remove('border-dashed', 'border-[#8B5CF6]/40');
      zoneEl.classList.add('border-solid', 'border-[#24CBA2]', 'bg-[#1E3A36]', 'animate-pop');
      zoneEl.querySelector('.zone-status').innerText = '✓ Terpasang Sempurna!';
      zoneEl.querySelector('.zone-status').classList.add('text-[#24CBA2]', 'font-bold');

      this.dragState.selectedPartBtn.remove();
      this.dragState.selectedPartId = null;
      this.dragState.placedCount++;

      this.setMascotReaction('celebrating', '“Bagus sekali! Konstruksi kian kokoh menahan guncangan gempa.”');

      if (this.dragState.placedCount >= 3) {
        setTimeout(() => {
          this.progressToCelebration(50, 20, 'Arsitek Vernakular Minang');
        }, 800);
      }
    } else {
      // REJECTED PLACEMENT
      this.playErrorSound();
      zoneEl.classList.add('animate-wiggle', 'border-[#FF786B]');
      this.setMascotReaction('encouraging', '“Zona ini kurang tepat. Coba bayangkan posisi fisik atap, pasak bawah, dan lumbung rangkiang.”');
      setTimeout(() => zoneEl.classList.remove('animate-wiggle', 'border-[#FF786B]'), 600);
    }
  },

  // =========================================================================
  // MINI-GAME D: LISTENING CHALLENGE (TEBAK IRAMA SALUANG & GAMELAN)
  // =========================================================================
  renderMiniGameD(stage) {
    this.setMascotReaction('happy', '“Pasang telingamu baik-baik! Tekan tombol dengarkan untuk memutar alunan melodi tradisional.”');

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game D • Tantangan Pendengaran Musik Tradisi
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Tebak Alat Musik Dari Petikan Irama
          </h2>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Dengarkan melodi bambu tiup melankolis berikut menggunakan synthesizer instrumen Nusantara.
          </p>
        </div>

        <!-- Audio Player Card -->
        <div class="bg-[#211B35] p-6 rounded-3xl border-2 border-[#8B5CF6]/30 text-center space-y-4 shadow-[0_12px_32px_rgba(10,5,18,0.8)]">
          <div class="flex items-center justify-center gap-1.5 h-12 py-2">
            <div class="soundwave-bar"></div>
            <div class="soundwave-bar"></div>
            <div class="soundwave-bar"></div>
            <div class="soundwave-bar"></div>
            <div class="soundwave-bar"></div>
          </div>

          <button onclick="MiniGameEngine.playListeningSample()" class="btn btn-gold text-sm py-3 px-8 rounded-full flex items-center justify-center gap-2 mx-auto shadow-[0_6px_0_#9E7B1E]">
            <span class="material-symbols-outlined text-[24px]">volume_up</span>
            <span id="listening-btn-text">Putar Alunan Melodi (Audio Asli)</span>
          </button>
          <p class="text-[11px] text-[#CCC3DF]">Tekan untuk memutar ulang instrumen.</p>

          <div class="pt-4 border-t border-[#8B5CF6]/20 grid grid-cols-1 gap-3 text-left">
            <button onclick="MiniGameEngine.handleChoiceD(this, true)" class="w-full p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs font-bold transition-all flex items-center justify-between cursor-pointer">
              <span>A. Alunan Saluang Minangkabau (Bambu Talang Tiup)</span>
              <span class="material-symbols-outlined text-[#24CBA2] opacity-0 check-d">check_circle</span>
            </button>
            <button onclick="MiniGameEngine.handleChoiceD(this, false)" class="w-full p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs font-bold transition-all flex items-center justify-between cursor-pointer">
              <span>B. Gesekan Rebab Tehyan Betawi</span>
              <span class="material-symbols-outlined text-[#FF786B] opacity-0 check-d">cancel</span>
            </button>
            <button onclick="MiniGameEngine.handleChoiceD(this, false)" class="w-full p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs font-bold transition-all flex items-center justify-between cursor-pointer">
              <span>C. Denting Senar Sasando Rote</span>
              <span class="material-symbols-outlined text-[#FF786B] opacity-0 check-d">cancel</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  playListeningSample() {
    this.playSaluangSample();
    const btnText = document.getElementById('listening-btn-text');
    if (btnText) {
      btnText.innerText = 'Mengalunkan Saluang...';
      setTimeout(() => btnText.innerText = 'Putar Ulang Melodi', 1600);
    }
    this.setMascotReaction('happy', '“Mendengarkan nada talang bambu yang ditiup dengan teknik pernapasan tanpa henti...”');
  },

  handleChoiceD(btn, isCorrect) {
    if (isCorrect) {
      this.playSuccessChime();
      btn.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]');
      btn.querySelector('.check-d').classList.remove('opacity-0');
      this.setMascotReaction('celebrating', '“Tepat! Saluang Minang memiliki ciri khas alunan merdu nan melankolis yang ditiup miring.”');
      setTimeout(() => this.progressToCelebration(45, 15, 'Penikmat Harmoni Tradisi'), 900);
    } else {
      this.playErrorSound();
      btn.classList.add('bg-[#FF786B]', 'text-white', 'animate-wiggle');
      btn.querySelector('.check-d').classList.remove('opacity-0');
      this.setMascotReaction('encouraging', '“Bukan alat gesek atau petik, perhatikan desah tiupan udara pada bambu.”');
      setTimeout(() => btn.classList.remove('bg-[#FF786B]', 'text-white', 'animate-wiggle'), 800);
    }
  },

  // =========================================================================
  // MINI-GAME E: CULTURAL STORY CHALLENGE (DILEMA MUSYAWARAH ADAT)
  // =========================================================================
  renderMiniGameE(stage) {
    this.setMascotReaction('curious', '“Kamu menjadi penasihat ninik mamak. Selesaikan sengketa kaum sesuai prinsip adat Minang!”');

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game E • Kisah Interaktif & Dilema Adat
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Sengketa Batas Tanah Pusaka Tinggi
          </h2>
        </div>

        <div class="bg-[#211B35] p-6 rounded-3xl border-2 border-[#8B5CF6]/30 space-y-4 text-left shadow-[0_12px_32px_rgba(10,5,18,0.8)]">
          <!-- Story Card -->
          <div class="p-4 rounded-2xl bg-[#1A1228] border border-[#8B5CF6]/20 space-y-2">
            <span class="text-[10px] font-black uppercase text-[#FFCA55]">Kisah Nagari</span>
            <p class="text-xs sm:text-sm text-[#FFF8EB] leading-relaxed">
              Dua kaum bersaudara di sebuah nagari berselisih paham mengenai batas sawah pusaka peninggalan nenek moyang. Masing-masing merasa memiliki hak kelola atas batas pematang. Sesuai pepatah: <em>“Kusuik bulu paruah manyalasaian, kusuik banang cari ujuangnyo”</em>, keputusan apa yang harus diambil?
            </p>
          </div>

          <div class="space-y-3 pt-2">
            <button onclick="MiniGameEngine.handleChoiceE(this, true)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs sm:text-sm font-bold transition-all cursor-pointer">
              A. Menggelar musyawarah mufakat di Balai Adat bersama tetua ninik mamak hingga mencapai titik temu damai
            </button>
            <button onclick="MiniGameEngine.handleChoiceE(this, false)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs sm:text-sm font-bold transition-all cursor-pointer">
              B. Memutuskan secara sepihak oleh yang berusia paling muda
            </button>
            <button onclick="MiniGameEngine.handleChoiceE(this, false)" class="w-full text-left p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border border-[#8B5CF6]/30 text-xs sm:text-sm font-bold transition-all cursor-pointer">
              C. Membagi tanah dengan cara bertarung fisik
            </button>
          </div>
        </div>
      </div>
    `;
  },

  handleChoiceE(btn, isCorrect) {
    if (isCorrect) {
      this.playSuccessChime();
      btn.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]');
      this.setMascotReaction('celebrating', '“Keputusan bijak! Pepatah Minang menegaskan: kusut benang dicari ujungnya melalui musyawarah mufakat.”');
      setTimeout(() => this.progressToCelebration(50, 20, 'Penegak Mufakat Adat'), 900);
    } else {
      this.playErrorSound();
      btn.classList.add('bg-[#FF786B]', 'text-white', 'animate-wiggle');
      this.setMascotReaction('encouraging', '“Adat Minang menjunjung tinggi musyawarah dan kebijaksanaan tetua, bukan kekuatan fisik atau sepihak.”');
      setTimeout(() => btn.classList.remove('bg-[#FF786B]', 'text-white', 'animate-wiggle'), 800);
    }
  },

  // =========================================================================
  // MINI-GAME F: VISUAL PUZZLE (TEKA-TEKI RAGAM HIAS SAIK KALAMAI)
  // =========================================================================
  renderMiniGameF(stage) {
    this.setMascotReaction('curious', '“Ada kepingan ragam hias songket yang hilang. Pilih potongan yang simetris sempurna!”');

    stage.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 animate-pop">
        <div class="text-center space-y-2">
          <span class="px-3 py-1 rounded-full bg-[#6338D4] text-[#FFCA55] text-xs font-black uppercase tracking-wider border border-[#FFCA55]/30">
            Mini-Game F • Teka-Teki Visual Ukiran
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-[#FFF8EB]">
            Restorasi Ragam Hias Saik Kalamai
          </h2>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Motif belah ketupat manis (wajik) yang melambangkan kehati-hatian dalam bertindak.
          </p>
        </div>

        <div class="bg-[#211B35] p-6 rounded-3xl border-2 border-[#8B5CF6]/30 text-center space-y-6 shadow-[0_12px_32px_rgba(10,5,18,0.8)]">
          <!-- Geometric Pattern Display with Missing Center -->
          <div class="w-48 h-48 mx-auto bg-[#1A1228] p-4 rounded-3xl border-2 border-[#FFCA55] flex items-center justify-center relative shadow-inner">
            <div class="w-32 h-32 border-4 border-dashed border-[#FF786B] rounded-2xl flex items-center justify-center bg-[#2D2445]/60" id="puzzle-slot">
              <span class="text-xs font-extrabold text-[#FF786B]">Kepingan Hilang (?)</span>
            </div>
          </div>

          <!-- Options -->
          <div class="grid grid-cols-3 gap-3">
            <button onclick="MiniGameEngine.handleChoiceF(this, true)" class="p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border-2 border-[#8B5CF6]/30 flex flex-col items-center justify-center cursor-pointer transition-all">
              <span class="text-3xl text-[#FFCA55]">◆</span>
              <span class="text-[11px] font-bold text-white mt-1">Belah Ketupat Emas</span>
            </button>
            <button onclick="MiniGameEngine.handleChoiceF(this, false)" class="p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border-2 border-[#8B5CF6]/30 flex flex-col items-center justify-center cursor-pointer transition-all">
              <span class="text-3xl text-[#CCC3DF]">●</span>
              <span class="text-[11px] font-bold text-[#CCC3DF] mt-1">Lingkaran Polos</span>
            </button>
            <button onclick="MiniGameEngine.handleChoiceF(this, false)" class="p-4 rounded-2xl bg-[#2D2445] hover:bg-[#3A3057] border-2 border-[#8B5CF6]/30 flex flex-col items-center justify-center cursor-pointer transition-all">
              <span class="text-3xl text-[#CCC3DF]">▲</span>
              <span class="text-[11px] font-bold text-[#CCC3DF] mt-1">Segitiga Runcing</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  handleChoiceF(btn, isCorrect) {
    if (isCorrect) {
      this.playSuccessChime();
      btn.classList.add('bg-[#24CBA2]', 'text-[#06382B]', 'border-[#24CBA2]');
      const slot = document.getElementById('puzzle-slot');
      if (slot) {
        slot.innerHTML = '<span class="text-5xl text-[#FFCA55] animate-pop">◆</span>';
        slot.classList.remove('border-dashed', 'border-[#FF786B]');
        slot.classList.add('border-solid', 'border-[#24CBA2]', 'bg-[#1E3A36]');
      }
      this.setMascotReaction('celebrating', '“Ragam hias Saik Kalamai telah pulih dengan bentuk wajik belah ketupat yang manis nan agung!”');
      setTimeout(() => this.progressToCelebration(50, 20, 'Pemulih Ragam Hias Minang'), 900);
    } else {
      this.playErrorSound();
      btn.classList.add('bg-[#FF786B]', 'text-white', 'animate-wiggle');
      this.setMascotReaction('encouraging', '“Saik Kalamai berbentuk potongan wajik belah ketupat, perhatikan sudut simetrisnya.”');
      setTimeout(() => btn.classList.remove('bg-[#FF786B]', 'text-white', 'animate-wiggle'), 800);
    }
  },

  // =========================================================================
  // SECTION 9: CINEMATIC CELEBRATION SCREEN
  // =========================================================================
  progressToCelebration(xp, gems, achievementTitle) {
    this.currentState = this.STATES.COMPLETED;
    this.score.xpEarned += xp;
    this.score.gemsEarned += gems;

    // Apply reward to global GameState
    if (typeof GameState !== 'undefined') {
      GameState.player.xp += xp;
      GameState.player.gems += gems;
      if (typeof updateHud === 'function') updateHud();
    }

    const arenaEl = document.getElementById('gameplay-arena');
    if (!arenaEl) return;

    arenaEl.innerHTML = `
      <!-- Confetti Canvas -->
      <canvas id="confetti-canvas" class="absolute inset-0 pointer-events-none z-0"></canvas>

      <div class="relative z-10 max-w-xl mx-auto text-center space-y-6 py-8 px-4 animate-pop">
        
        <!-- Large Expressive Celebrating Mascot -->
        <div class="w-36 h-36 sm:w-44 sm:h-44 mx-auto rounded-3xl bg-gradient-to-tr from-[#6338D4] to-[#8B5CF6] p-2 border-4 border-[#FFCA55] shadow-[0_16px_48px_rgba(255,202,85,0.4)] relative flex items-center justify-center">
          <img src="assets/images/mascot_raga_transparent.png" alt="Raga Merayakan Kemenangan" class="w-full h-full object-contain filter drop-shadow animate-bounce">
          <span class="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-[#24CBA2] text-[#06382B] text-xs font-black uppercase shadow">
            SEMPURNA! ★★★
          </span>
        </div>

        <div class="space-y-1">
          <span class="text-xs uppercase font-black text-[#FFCA55] tracking-widest">
            Tantangan Adat Berhasil Dikuasai
          </span>
          <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Selamat, Penjelajah Firza!
          </h1>
          <p class="text-xs sm:text-sm text-[#CCC3DF]">
            Kearifan budaya Nusantara telah terpatri dalam petualanganmu hari ini.
          </p>
        </div>

        <!-- Reward Chips Grid -->
        <div class="grid grid-cols-3 gap-3">
          <div class="p-3.5 rounded-2xl bg-[#211B35] border border-[#FFCA55]/40 shadow">
            <span class="material-symbols-outlined text-[#FFCA55] text-2xl">bolt</span>
            <p class="text-lg font-black text-[#FFCA55]">+${xp} XP</p>
            <span class="text-[10px] text-[#CCC3DF]">Pengalaman</span>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#211B35] border border-[#24CBA2]/40 shadow">
            <span class="material-symbols-outlined text-[#24CBA2] text-2xl">diamond</span>
            <p class="text-lg font-black text-[#24CBA2]">+${gems} Permata</p>
            <span class="text-[10px] text-[#CCC3DF]">Harta Budaya</span>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#211B35] border border-[#FF786B]/40 shadow">
            <span class="material-symbols-outlined text-[#FF786B] text-2xl">verified</span>
            <p class="text-lg font-black text-[#FF786B]">100%</p>
            <span class="text-[10px] text-[#CCC3DF]">Akurasi Jawaban</span>
          </div>
        </div>

        <!-- Unlocked Achievement Badge -->
        <div class="p-4 rounded-2xl bg-gradient-to-r from-[#211B35] via-[#2A1E4A] to-[#211B35] border-2 border-[#FFCA55]/50 flex items-center gap-3.5 text-left shadow">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#FFCA55] to-[#FF786B] flex items-center justify-center text-[#382400] shrink-0 font-black shadow">
            <span class="material-symbols-outlined text-[28px]">military_tech</span>
          </div>
          <div>
            <span class="text-[10px] uppercase font-black text-[#24CBA2]">Gelar Baru Terbuka</span>
            <h4 class="font-extrabold text-sm text-white">${achievementTitle}</h4>
            <p class="text-[11px] text-[#CCC3DF]">Tercatat permanen dalam arsip profil kebudayaanmu.</p>
          </div>
        </div>

        <!-- Action CTAs -->
        <div class="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button onclick="location.reload()" class="btn btn-primary w-full py-3.5 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_6px_0_#3F1D91]">
            <span class="material-symbols-outlined text-[20px]">explore</span>
            <span>Lanjutkan Petualangan (Ke Peta)</span>
          </button>
          <button onclick="MiniGameEngine.openArena('A')" class="btn btn-surface w-full sm:w-auto py-3.5 px-6 text-xs uppercase tracking-wider">
            Mainkan Lagi ↻
          </button>
        </div>

      </div>
    `;

    this.startConfetti();
  },

  // Lightweight Confetti Particle Canvas Engine
  startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FFCA55', '#6338D4', '#24CBA2', '#FF786B', '#8B5CF6', '#FFFFFF'];
    const particles = [];

    for (let i = 0; i < 75; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 8 - 4
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });
      requestAnimationFrame(animate);
    }
    animate();
  },

  // Keyboard accessibility
  bindKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      if (this.currentState === this.STATES.NOT_STARTED) return;
      if (e.key === 'Escape') {
        this.closeArena();
      }
      if (['1', '2', '3'].includes(e.key) && this.activeGameType === 'A') {
        const idx = parseInt(e.key, 10) - 1;
        const btns = document.querySelectorAll('#minigame-a-options button');
        if (btns[idx]) btns[idx].click();
      }
    });
  }
};

// Initialize MiniGameEngine on DOM load
window.addEventListener('DOMContentLoaded', () => {
  MiniGameEngine.init();
});
