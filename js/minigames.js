/**
 * RAGAMARA MINI-GAME ENGINE (js/minigames.js)
 * Phase 3 & 4 Transformation:
 * - Formal State Machine: IDLE -> LOADING -> READY -> PLAYING -> FEEDBACK -> PAUSED -> COMPLETED -> ERROR
 * - Full Lifecycle & Resource Registry (Timers, Intervals, RAF, Web Audio Nodes)
 * - Preserves #gameplay-arena shell (Never overwrites #gameplay-arena.innerHTML)
 * - Idempotent Session Ledger & Real LocalStorage Persistence (No location.reload() data loss)
 * - 6 Multi-Round Interactive Cultural Mini-Games (A–F) with Keyboard + Touch Accessibility
 */

const MiniGameEngine = {
  // Formal State Machine
  STATES: {
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    PLAYING: 'PLAYING',
    FEEDBACK: 'FEEDBACK',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  },

  currentState: 'IDLE',
  activeGameType: null,
  currentSession: null,

  // Resource Registry for deterministic cleanup
  _timers: [],
  _intervals: [],
  _rafs: [],
  _audioCtx: null,
  _keyHandler: null,

  // Game Mode Metadata
  MODES: {
    A: {
      id: 'A',
      title: 'Kuis Cendekia Budaya',
      subtitle: 'Pilihan Ganda Multi-Babak',
      category: 'Falsafah & Ragam Hias',
      xpBase: 60,
      gemsBase: 20,
      icon: 'quiz'
    },
    B: {
      id: 'B',
      title: 'Pasangan Pusaka Nusantara',
      subtitle: 'Pencocokan Kartu Artefak & Daerah',
      category: 'Lintas 7 Wilayah',
      xpBase: 70,
      gemsBase: 25,
      icon: 'link'
    },
    C: {
      id: 'C',
      title: 'Konstruksi Vernakular & Kriya',
      subtitle: 'Susun Urutan Struktur & Tahapan',
      category: 'Arsitektur & Teknologi Tradisional',
      xpBase: 80,
      gemsBase: 25,
      icon: 'architecture'
    },
    D: {
      id: 'D',
      title: 'Simulasi Ritme & Laras Tradisi',
      subtitle: 'Memori Pola Nada Pentatonik & Ketukan',
      category: 'Seni Musik Tradisional',
      xpBase: 75,
      gemsBase: 25,
      icon: 'music_note'
    },
    E: {
      id: 'E',
      title: 'Musyawarah & Kearifan Adat',
      subtitle: 'Simulasi Keputusan Dilema Budaya',
      category: 'Adat Istiadat & Konservasi',
      xpBase: 85,
      gemsBase: 30,
      icon: 'auto_stories'
    },
    F: {
      id: 'F',
      title: 'Restorasi Ragam Hias Pusaka',
      subtitle: 'Teka-Teki Susun & Rotasi Keping Motif',
      category: 'Kriya Ukir & Tenun',
      xpBase: 90,
      gemsBase: 35,
      icon: 'extension'
    }
  },

  // =========================================================================
  // 1. LIFECYCLE, TIMERS & STATE MANAGEMENT
  // =========================================================================

  registerTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      if (this.currentState !== this.STATES.PAUSED && this.currentState !== this.STATES.IDLE) {
        fn();
      }
    }, delay);
    this._timers.push(id);
    return id;
  },

  registerInterval(fn, delay) {
    const id = setInterval(() => {
      if (this.currentState === this.STATES.PLAYING || this.currentState === this.STATES.FEEDBACK) {
        fn();
      }
    }, delay);
    this._intervals.push(id);
    return id;
  },

  registerRaf(fn) {
    const id = requestAnimationFrame(fn);
    this._rafs.push(id);
    return id;
  },

  cleanupResources() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];
    this._rafs.forEach(id => cancelAnimationFrame(id));
    this._rafs = [];
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    const existingPause = document.getElementById('arena-pause-overlay');
    if (existingPause) existingPause.remove();
  },

  transitionState(nextState) {
    this.currentState = nextState;
    const arena = document.getElementById('gameplay-arena');
    if (arena) {
      arena.setAttribute('data-engine-state', nextState);
    }
  },

  initAudio() {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }
    } catch (e) {}
  },

  isSfxEnabled() {
    if (window.RagamaraEcosystem && window.RagamaraEcosystem.Settings) {
      return window.RagamaraEcosystem.Settings.sfxEnabled !== false;
    }
    return true;
  },

  playTone(freq, duration = 0.28, type = 'sine', gainVal = 0.14) {
    if (!this.isSfxEnabled()) return;
    try {
      this.initAudio();
      if (!this._audioCtx) return;
      const osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this._audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this._audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this._audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start();
      osc.stop(this._audioCtx.currentTime + duration);
    } catch (e) {}
  },

  playSuccessChime() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.registerTimeout(() => this.playTone(n, 0.25, 'triangle', 0.14), idx * 95);
    });
  },

  playErrorBuzz() {
    this.playTone(195.0, 0.25, 'sawtooth', 0.1);
  },

  // =========================================================================
  // 2. ARENA SHELL & SESSION INITIALIZATION
  // =========================================================================

  openArena(gameType = 'A', options = {}) {
    this.cleanupResources();
    this.transitionState(this.STATES.LOADING);

    const mode = this.MODES[gameType];
    const arena = document.getElementById('gameplay-arena');
    const stage = document.getElementById('arena-stage-container');

    if (!arena || !stage) {
      console.error('MiniGameEngine: #gameplay-arena or #arena-stage-container missing');
      return;
    }

    arena.classList.remove('hidden');

    if (!mode) {
      this.renderErrorState(stage, `Mode permainan "${gameType}" tidak ditemukan.`);
      return;
    }

    this.activeGameType = gameType;
    this.currentSession = {
      sessionId: `sess_${gameType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      gameId: gameType,
      title: mode.title,
      startTime: Date.now(),
      endTime: null,
      pausedDurationMs: 0,
      pauseStartedAt: null,
      roundIndex: 0,
      totalRounds: 1,
      correctActions: 0,
      totalActions: 0,
      mistakes: 0,
      score: 0,
      accuracy: 100,
      xpEarned: 0,
      gemsEarned: 0,
      rewardClaimed: false
    };

    // Update top mode selector tabs
    document.querySelectorAll('.arena-game-tab').forEach(btn => {
      const t = btn.getAttribute('data-type');
      if (t === gameType) {
        btn.classList.add('bg-[#B65F45]', 'text-white', 'shadow');
        btn.classList.remove('text-[#DFD5C3]');
      } else {
        btn.classList.remove('bg-[#B65F45]', 'text-white', 'shadow');
        btn.classList.add('text-[#DFD5C3]');
      }
    });

    this.transitionState(this.STATES.READY);
    this.bindGlobalArenaKeys();

    try {
      this.transitionState(this.STATES.PLAYING);
      switch (gameType) {
        case 'A': this.initGameA(stage); break;
        case 'B': this.initGameB(stage); break;
        case 'C': this.initGameC(stage); break;
        case 'D': this.initGameD(stage); break;
        case 'E': this.initGameE(stage); break;
        case 'F': this.initGameF(stage); break;
      }
    } catch (err) {
      console.error('MiniGameEngine Error:', err);
      this.renderErrorState(stage, 'Terjadi kendala saat memuat data permainan budaya.');
    }
  },

  bindGlobalArenaKeys() {
    this._keyHandler = (e) => {
      const arena = document.getElementById('gameplay-arena');
      if (!arena || arena.classList.contains('hidden')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.currentState === this.STATES.PAUSED) {
          this.resumeGame();
        } else if (this.currentState === this.STATES.PLAYING || this.currentState === this.STATES.FEEDBACK) {
          this.pauseGame();
        } else {
          this.closeArena(true);
        }
        return;
      }

      // Mode A numeric shortcuts 1-4
      if (this.activeGameType === 'A' && this.currentState === this.STATES.PLAYING) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          const btn = document.querySelector(`#game-a-options button[data-opt-idx="${idx}"]`);
          if (btn && !btn.disabled) btn.click();
        }
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  },

  pauseGame() {
    if (this.currentState !== this.STATES.PLAYING && this.currentState !== this.STATES.FEEDBACK) return;
    this.currentSession.pauseStartedAt = Date.now();
    this.transitionState(this.STATES.PAUSED);

    const arena = document.getElementById('gameplay-arena');
    if (!arena) return;

    let overlay = document.getElementById('arena-pause-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'arena-pause-overlay';
      overlay.className = 'fixed inset-0 z-50 bg-[#0A1D18]/90 backdrop-blur-md flex items-center justify-center p-4';
      overlay.innerHTML = `
        <div class="bg-[#173F32] border-2 border-[#F2C45A] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div class="w-16 h-16 rounded-2xl bg-[#102B25] border border-[#F2C45A]/40 mx-auto flex items-center justify-center text-[#F2C45A]">
            <span class="material-symbols-outlined text-4xl">pause_circle</span>
          </div>
          <div>
            <span class="text-xs font-black uppercase tracking-wider text-[#F2C45A]">Permainan Dijeda</span>
            <h3 class="text-2xl font-black text-[#FAF6EF] mt-1">${this.currentSession ? this.currentSession.title : 'Arena Budaya'}</h3>
            <p class="text-xs text-[#DFD5C3] mt-2">Progres babak Anda saat ini tetap aman. Apakah Anda ingin melanjutkan atau keluar ke peta?</p>
          </div>
          <div class="flex flex-col gap-2.5">
            <button onclick="MiniGameEngine.resumeGame()" class="btn btn-primary w-full py-3 text-xs uppercase tracking-wider">
              <span class="material-symbols-outlined text-[18px]">play_arrow</span>
              Lanjutkan Permainan
            </button>
            <button onclick="MiniGameEngine.restartGame()" class="btn btn-surface w-full py-2.5 text-xs">
              <span class="material-symbols-outlined text-[18px]">replay</span>
              Ulangi dari Babak 1
            </button>
            <button onclick="MiniGameEngine.closeArena(true)" class="btn btn-outline w-full py-2.5 text-xs">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              Keluar dari Arena
            </button>
          </div>
        </div>
      `;
      arena.appendChild(overlay);
    }
  },

  resumeGame() {
    if (this.currentState !== this.STATES.PAUSED) return;
    if (this.currentSession && this.currentSession.pauseStartedAt) {
      this.currentSession.pausedDurationMs += (Date.now() - this.currentSession.pauseStartedAt);
      this.currentSession.pauseStartedAt = null;
    }
    const overlay = document.getElementById('arena-pause-overlay');
    if (overlay) overlay.remove();
    this.transitionState(this.STATES.PLAYING);
  },

  restartGame() {
    const type = this.activeGameType || 'A';
    this.openArena(type);
  },

  closeArena(force = false) {
    // If mid-session and player has already taken actions, show pause/exit confirmation unless forced
    if (
      !force &&
      (this.currentState === this.STATES.PLAYING || this.currentState === this.STATES.FEEDBACK) &&
      this.currentSession &&
      this.currentSession.totalActions > 0 &&
      this.currentSession.roundIndex < this.currentSession.totalRounds
    ) {
      this.pauseGame();
      return;
    }

    this.cleanupResources();
    this.transitionState(this.STATES.IDLE);
    const arena = document.getElementById('gameplay-arena');
    if (arena) {
      arena.classList.add('hidden');
    }
  },

  renderErrorState(stage, message) {
    this.transitionState(this.STATES.ERROR);
    stage.innerHTML = `
      <div class="bg-[#173F32] border-2 border-[#D96B4E] rounded-3xl p-8 max-w-lg mx-auto text-center space-y-4 shadow-2xl">
        <span class="material-symbols-outlined text-5xl text-[#D96B4E]">error</span>
        <h3 class="text-xl font-black text-[#FAF6EF]">Kendala Pemuatan Arena</h3>
        <p class="text-xs sm:text-sm text-[#DFD5C3]">${message}</p>
        <div class="flex justify-center gap-3 pt-2">
          <button onclick="MiniGameEngine.openArena('A')" class="btn btn-primary text-xs py-2.5 px-5">Muat Mode A</button>
          <button onclick="MiniGameEngine.closeArena(true)" class="btn btn-surface text-xs py-2.5 px-5">Kembali</button>
        </div>
      </div>
    `;
  },

  setMascotReaction(emotion, speechText) {
    const speechEl = document.getElementById('arena-mascot-speech');
    const mascotEl = document.getElementById('arena-mascot-container');
    if (speechEl && speechText) {
      speechEl.innerText = `“${speechText}”`;
    }
    if (mascotEl && window.RagaMascot) {
      mascotEl.innerHTML = window.RagaMascot.render(emotion, { size: 52, withHeadpiece: true });
    }
  },

  renderArenaSubheader(stepLabel, progressPercent) {
    const mode = this.MODES[this.activeGameType] || this.MODES.A;
    return `
      <div class="mb-5 bg-[#173F32]/90 border border-[#D4A447]/35 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#B65F45] text-white flex items-center justify-center shrink-0 shadow">
            <span class="material-symbols-outlined text-[22px]">${mode.icon}</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-[#F2C45A]">Mode ${mode.id} • ${mode.category}</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#102B25] text-[#34A59F] border border-[#34A59F]/30">${stepLabel}</span>
            </div>
            <h3 class="text-sm sm:text-base font-black text-[#FAF6EF]">${mode.title}</h3>
          </div>
        </div>
        <div class="flex items-center gap-3 sm:w-56">
          <div class="progress-track h-3 flex-1">
            <div class="progress-fill progress-fill-gold" style="width: ${Math.max(8, Math.min(100, progressPercent))}%;"></div>
          </div>
          <button onclick="MiniGameEngine.pauseGame()" class="px-2.5 py-1.5 rounded-xl bg-[#102B25] border border-[#D4A447]/30 text-xs font-bold text-[#FAF6EF] hover:border-[#F2C45A] flex items-center gap-1 shrink-0" title="Jeda Permainan (Esc)">
            <span class="material-symbols-outlined text-[16px]">pause</span>
            <span class="hidden sm:inline">Jeda</span>
          </button>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // 3. MINI-GAME A: KUIS CENDEKIA BUDAYA (4-QUESTION MULTI-ROUND QUIZ)
  // =========================================================================

  gameAQuestions: [
    {
      badge: 'Babak 1/4 • Ragam Hias Minangkabau',
      category: 'Arsitektur & Ukiran Tradisional (Sumatera Barat)',
      dapobudRef: 'DAPOBUD WBTb: REK/WBTB/2013/01/00006 • Ragam Hias Rumah Gadang',
      question: 'Apa makna filosofis luhur di balik motif ukiran dan tenun tradisional "Itik Pulang Patang" pada masyarakat adat Minangkabau?',
      options: [
        { text: 'Keteraturan sosial, kerukunan bersama, dan keselarasan hidup bermusyawarah', isCorrect: true },
        { text: 'Keunggulan kekuatan militer kerajaan dalam menaklukkan wilayah seberang', isCorrect: false },
        { text: 'Simbol kekuasaan mutlak seorang raja tanpa perlu mufakat penghulu', isCorrect: false },
        { text: 'Teknik pelayaran samudra menggunakan pedoman rasi bintang selatan', isCorrect: false }
      ],
      explanation: 'Motif Itik Pulang Patang menggambarkan barisan itik yang berjalan tertib kembali ke kandang saat senja—melambangkan kerukunan, ketertiban sosial, dan kesepakatan musyawarah mufakat.'
    },
    {
      badge: 'Babak 2/4 • Senjata Pusaka Nusantara',
      category: 'Teknologi Tradisional (Aceh)',
      dapobudRef: 'DAPOBUD ID: id_dapobud_f31f397c • Rencong Aceh',
      question: 'Bentuk gagang hingga ujung bilah senjata pusaka Rencong dari Aceh dirancang menyerupai kaligrafi aksara...',
      options: [
        { text: 'Kaligrafi ucapan "Bismillahirrahmanirrahim" sebagai lambang pengabdian & keberanian', isCorrect: true },
        { text: 'Rangkaian prasasti Palawa dari masa Kerajaan Tarumanagara', isCorrect: false },
        { text: 'Pola mahkota tanduk kerbau aduan dari dataran tinggi', isCorrect: false },
        { text: 'Bentuk haluan kapal dagang Portugis pada abad ke-16', isCorrect: false }
      ],
      explanation: 'Secara filosofis, gagang meucugek, badan bilah, hingga warangka Rencong melambangkan rangkaian aksara Arab "Bismillah", menyatukan nilai spiritual dan keberanian membela tanah air.'
    },
    {
      badge: 'Babak 3/4 • Aksara Leluhur Nusantara',
      category: 'Bahasa & Manuskrip (Sumatera Bagian Selatan)',
      dapobudRef: 'DAPOBUD WBTb • Aksara Ka Ga Nga (Ulu / Rencong)',
      question: 'Rumpun aksara tradisional "Ka Ga Nga" (Aksara Ulu) secara historis digunakan oleh masyarakat adat di wilayah...',
      options: [
        { text: 'Bengkulu, Sumatera Selatan, Jambi, dan Lampung untuk menulis naskah kulit kayu (gelumpai) dan bambu', isCorrect: true },
        { text: 'Pesisir utara Pulau Jawa untuk penulisan babad keraton di atas kertas Eropa', isCorrect: false },
        { text: 'Kepulauan Maluku Utara untuk mencatat perjanjian dagang cengkih', isCorrect: false },
        { text: 'Lembah Baliem Papua untuk memahat silsilah kepala suku pada batu', isCorrect: false }
      ],
      explanation: 'Aksara Ka Ga Nga (dikenal sebagai Aksara Ulu/Incung/Rejang/Lampung) berkembang di koridor sungai dan dataran tinggi Sumatera bagian selatan pada media bambu, tanduk, dan kulit kayu.'
    },
    {
      badge: 'Babak 4/4 • Arsitektur Lintas Pulau',
      category: 'Arsitektur Vernakular (Kalimantan)',
      dapobudRef: 'DAPOBUD WBTb • Rumah Panjang Dayak (Betang / Lamin / Radakng)',
      question: 'Mengapa Rumah Panjang masyarakat Dayak (Rumah Betang/Radakng) dibangun dengan tiang panggung kayu ulin yang tinggi dan memanjang?',
      options: [
        { text: 'Melindungi warga dari banjir sungai & binatang buas sekaligus mempererat solidaritas komunal', isCorrect: true },
        { text: 'Agar bangunan mudah dibongkar-pasang setiap pekan mengikuti arah angin laut', isCorrect: false },
        { text: 'Untuk memisahkan setiap keluarga agar tidak pernah berinteraksi satu sama lain', isCorrect: false },
        { text: 'Sebagai gudang penyimpanan rempah pala di tengah gurun pasir', isCorrect: false }
      ],
      explanation: 'Rumah Panjang Dayak menggunakan kayu ulin (kayu besi) tahan air dan mencerminkan falsafah Huma Betang: hidup rukun berdampingan dalam satu atap komunal.'
    }
  ],

  initGameA(stage) {
    this.currentSession.totalRounds = this.gameAQuestions.length;
    this.currentSession.roundIndex = 0;
    this.renderGameARound(stage);
  },

  renderGameARound(stage) {
    const qIdx = this.currentSession.roundIndex;
    const q = this.gameAQuestions[qIdx];
    const progress = Math.round(((qIdx) / this.currentSession.totalRounds) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`Soal ${qIdx + 1} / ${this.currentSession.totalRounds}`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-1 rounded-full bg-[#B65F45] text-white text-xs font-extrabold uppercase">${q.badge}</span>
          <span class="text-[11px] font-mono text-[#F2C45A] bg-[#102B25] px-3 py-1 rounded-full border border-[#D4A447]/30">${q.dapobudRef}</span>
        </div>

        <h3 class="text-lg sm:text-2xl font-extrabold text-[#FAF6EF] leading-snug">${q.question}</h3>

        <div id="game-a-options" class="grid grid-cols-1 gap-3 pt-1">
          ${q.options.map((opt, idx) => `
            <button
              type="button"
              data-opt-idx="${idx}"
              onclick="MiniGameEngine.handleGameAAnswer(${idx})"
              class="w-full text-left p-4 rounded-2xl bg-[#102B25] hover:bg-[#1E4E3E] border-2 border-[#D4A447]/30 text-xs sm:text-sm font-bold text-[#FAF6EF] transition-all flex items-center justify-between gap-3 cursor-pointer"
            >
              <span class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-lg bg-[#173F32] border border-[#D4A447]/40 text-[#F2C45A] font-black flex items-center justify-center shrink-0">${String.fromCharCode(65 + idx)}</span>
                <span>${opt.text}</span>
              </span>
              <span class="material-symbols-outlined text-xl opacity-0 opt-status-icon">check_circle</span>
            </button>
          `).join('')}
        </div>

        <div id="game-a-feedback" class="hidden p-4 rounded-2xl bg-[#FAF6EF] text-[#292820] border-2 border-[#D4A447] space-y-3">
          <div class="flex items-start gap-2.5">
            <span class="material-symbols-outlined text-[#B65F45] text-xl shrink-0">menu_book</span>
            <p id="game-a-explanation" class="text-xs sm:text-sm font-medium leading-relaxed"></p>
          </div>
          <div class="flex justify-end">
            <button id="game-a-next-btn" type="button" onclick="MiniGameEngine.nextGameARound()" class="btn btn-primary text-xs py-2.5 px-6">
              ${qIdx + 1 < this.currentSession.totalRounds ? 'Soal Berikutnya ➔' : 'Lihat Hasil Sesi ➔'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.setMascotReaction('thinking', `Soal ${qIdx + 1}: Pilih jawaban yang paling mencerminkan kearifan budaya Nusantara (atau tekan tombol 1–4).`);
  },

  handleGameAAnswer(selectedIdx) {
    if (this.currentState !== this.STATES.PLAYING) return;
    const q = this.gameAQuestions[this.currentSession.roundIndex];
    if (!q) return;

    const chosen = q.options[selectedIdx];
    const buttons = document.querySelectorAll('#game-a-options button');
    buttons.forEach(b => { b.disabled = true; });

    this.currentSession.totalActions += 1;
    const selectedBtn = buttons[selectedIdx];

    if (chosen && chosen.isCorrect) {
      this.currentSession.correctActions += 1;
      this.transitionState(this.STATES.FEEDBACK);
      if (selectedBtn) {
        selectedBtn.classList.remove('bg-[#102B25]', 'border-[#D4A447]/30');
        selectedBtn.classList.add('bg-[#287E7A]', 'border-[#F2C45A]', 'text-white');
        const icon = selectedBtn.querySelector('.opt-status-icon');
        if (icon) { icon.innerText = 'check_circle'; icon.classList.remove('opacity-0'); }
      }
      this.playSuccessChime();
      this.setMascotReaction('celebrating', 'Tepat sekali! Pemahaman budayamu sangat tajam.');
    } else {
      this.currentSession.mistakes += 1;
      this.transitionState(this.STATES.FEEDBACK);
      if (selectedBtn) {
        selectedBtn.classList.remove('bg-[#102B25]', 'border-[#D4A447]/30');
        selectedBtn.classList.add('bg-[#B65F45]', 'border-white', 'text-white');
        const icon = selectedBtn.querySelector('.opt-status-icon');
        if (icon) { icon.innerText = 'cancel'; icon.classList.remove('opacity-0'); }
      }
      // Highlight the correct option too so the player learns
      q.options.forEach((o, idx) => {
        if (o.isCorrect && buttons[idx]) {
          buttons[idx].classList.add('border-[#34A59F]', 'bg-[#1E4E3E]');
        }
      });
      this.playErrorBuzz();
      this.setMascotReaction('encouraging', 'Belum tepat, namun jangan berkecil hati! Simak penjelasan pusaka di bawah ini.');
    }

    const fbBox = document.getElementById('game-a-feedback');
    const expEl = document.getElementById('game-a-explanation');
    if (expEl) expEl.innerText = q.explanation;
    if (fbBox) fbBox.classList.remove('hidden');
  },

  nextGameARound() {
    this.currentSession.roundIndex += 1;
    const stage = document.getElementById('arena-stage-container');
    if (this.currentSession.roundIndex < this.currentSession.totalRounds) {
      this.transitionState(this.STATES.PLAYING);
      this.renderGameARound(stage);
    } else {
      this.progressToCelebration();
    }
  },

  // =========================================================================
  // 4. MINI-GAME B: PASANGAN PUSAKA NUSANTARA (6 PAIRS / 12 CARDS MATCHING)
  // =========================================================================

  gameBPairs: [
    { pairId: 'rencong', left: 'Rencong Meucugek', right: 'Pusaka Kesultanan Aceh' },
    { pairId: 'gadang', left: 'Rumah Gadang Gonjong', right: 'Arsitektur Tahan Gempa Sumbar' },
    { pairId: 'batik', left: 'Batik Tulis Canting', right: 'Warisan Tekstil Malam Nusantara' },
    { pairId: 'betang', left: 'Rumah Panjang Betang', right: 'Hunian Komunal Dayak Kalimantan' },
    { pairId: 'tabot', left: 'Upacara Tabot & Tabuik', right: 'Ritus Muharam Bengkulu & Pariaman' },
    { pairId: 'kaganga', left: 'Aksara Ka Ga Nga', right: 'Tradisi Tulis Ulu Sumatera Selatan' }
  ],

  initGameB(stage) {
    this.currentSession.totalRounds = this.gameBPairs.length;
    this.currentSession.roundIndex = 0;

    // Build and deterministically shuffle cards
    const deck = [];
    this.gameBPairs.forEach((p, idx) => {
      deck.push({ cardId: `L_${idx}`, pairId: p.pairId, label: p.left, kind: 'Objek Budaya' });
      deck.push({ cardId: `R_${idx}`, pairId: p.pairId, label: p.right, kind: 'Asal & Makna' });
    });

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    this._gameBState = {
      deck,
      selectedCardId: null,
      matchedPairIds: new Set(),
      locked: false
    };

    this.renderGameBBoard(stage);
  },

  renderGameBBoard(stage) {
    const st = this._gameBState;
    const matchedCount = st.matchedPairIds.size;
    const progress = Math.round((matchedCount / this.currentSession.totalRounds) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`${matchedCount} / ${this.currentSession.totalRounds} Pasang Cocok`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-lg sm:text-xl font-black text-[#FAF6EF]">Pasangkan Objek Budaya dengan Asal & Fungsinya</h3>
            <p class="text-xs text-[#DFD5C3]">Pilih satu kartu Objek Budaya lalu pasangkan dengan kartu Asal & Makna yang tepat.</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#102B25] border border-[#34A59F]/40 text-xs font-extrabold text-[#34A59F]" id="game-b-counter">
            ${matchedCount} / ${this.currentSession.totalRounds} Terhubung
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="game-b-grid">
          ${st.deck.map(card => {
            const isMatched = st.matchedPairIds.has(card.pairId);
            const isSelected = st.selectedCardId === card.cardId;
            let cardClasses = 'bg-[#102B25] border-[#D4A447]/30 text-[#FAF6EF] hover:border-[#F2C45A]';
            if (isMatched) {
              cardClasses = 'bg-[#287E7A]/40 border-[#34A59F] text-[#FAF6EF] opacity-75 cursor-default';
            } else if (isSelected) {
              cardClasses = 'bg-[#B65F45] border-[#F2C45A] text-white scale-[1.02] shadow-lg';
            }
            return `
              <button
                type="button"
                data-card-id="${card.cardId}"
                data-pair-id="${card.pairId}"
                ${isMatched ? 'disabled' : ''}
                onclick="MiniGameEngine.handleGameBSelect('${card.cardId}')"
                class="p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between min-h-[96px] ${cardClasses}"
              >
                <span class="text-[10px] font-black uppercase tracking-wider ${card.kind === 'Objek Budaya' ? 'text-[#F2C45A]' : 'text-[#34A59F]'}">
                  ${isMatched ? '✓ Terhubung' : card.kind}
                </span>
                <span class="text-xs sm:text-sm font-bold leading-snug mt-1">${card.label}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (matchedCount === 0) {
      this.setMascotReaction('curious', 'Pilih dua kartu yang saling berkaitan antara nama pusaka dan daerah asalnya!');
    }
  },

  handleGameBSelect(cardId) {
    if (this.currentState !== this.STATES.PLAYING) return;
    const st = this._gameBState;
    if (!st || st.locked) return;

    const clickedCard = st.deck.find(c => c.cardId === cardId);
    if (!clickedCard || st.matchedPairIds.has(clickedCard.pairId)) return;

    // Prevent double-selecting the exact same card
    if (st.selectedCardId === cardId) {
      st.selectedCardId = null;
      this.renderGameBBoard(document.getElementById('arena-stage-container'));
      return;
    }

    if (!st.selectedCardId) {
      st.selectedCardId = cardId;
      this.playTone(440, 0.12, 'sine', 0.1);
      this.renderGameBBoard(document.getElementById('arena-stage-container'));
      return;
    }

    const firstCard = st.deck.find(c => c.cardId === st.selectedCardId);
    this.currentSession.totalActions += 1;

    if (firstCard && firstCard.pairId === clickedCard.pairId && firstCard.cardId !== clickedCard.cardId) {
      // Valid Match!
      st.matchedPairIds.add(clickedCard.pairId);
      st.selectedCardId = null;
      this.currentSession.correctActions += 1;
      this.currentSession.roundIndex = st.matchedPairIds.size;
      this.playSuccessChime();
      this.setMascotReaction('celebrating', `Bagus! "${firstCard.label}" berpasangan dengan "${clickedCard.label}".`);

      const stage = document.getElementById('arena-stage-container');
      this.renderGameBBoard(stage);

      if (st.matchedPairIds.size >= this.currentSession.totalRounds) {
        st.locked = true;
        this.registerTimeout(() => this.progressToCelebration(), 550);
      }
    } else {
      // Mismatch
      this.currentSession.mistakes += 1;
      st.locked = true;
      this.playErrorBuzz();
      this.setMascotReaction('encouraging', 'Pasangan tersebut belum cocok. Ingat kembali ciri khas wilayahnya!');

      const btn1 = document.querySelector(`#game-b-grid button[data-card-id="${st.selectedCardId}"]`);
      const btn2 = document.querySelector(`#game-b-grid button[data-card-id="${cardId}"]`);
      if (btn1) btn1.classList.add('bg-[#D96B4E]', 'border-white');
      if (btn2) btn2.classList.add('bg-[#D96B4E]', 'border-white');

      this.registerTimeout(() => {
        st.selectedCardId = null;
        st.locked = false;
        this.renderGameBBoard(document.getElementById('arena-stage-container'));
      }, 650);
    }
  },

  // =========================================================================
  // 5. MINI-GAME C: KONSTRUKSI VERNAKULAR & KRIYA (2-STAGE SEQUENCE BUILDER)
  // =========================================================================

  gameCStages: [
    {
      stageTitle: 'Tahap 1/2: Struktur Arsitektur Tahan Gempa Rumah Gadang',
      instruction: 'Susun 4 lapisan konstruksi vertikal Rumah Gadang Minangkabau dari fondasi paling bawah (1) hingga puncak atap (4):',
      steps: [
        { order: 1, title: '1. Batu Sandi & Kolong Fondasi', detail: 'Landasan batu pipih peredam getaran gempa bumi agar tiang tidak langsung menyentuh tanah lembap.' },
        { order: 2, title: '2. Tiang Tuo & Sistem Pasak Kayu', detail: 'Tiang utama kayu juha yang dirangkai dengan pasak kayu fleksibel tanpa satu pun paku besi.' },
        { order: 3, title: '3. Badan Rumah, Bilik & Anjuang', detail: 'Ruang keluarga matrilineal dengan dinding berukir ragam hias Itik Pulang Patang.' },
        { order: 4, title: '4. Atap Bagonjong Ijuk Enau', detail: 'Puncak atap melengkung menyerupai tanduk kerbau dari serat ijuk tahan puluhan tahun.' }
      ],
      poolOrder: [3, 1, 4, 2]
    },
    {
      stageTitle: 'Tahap 2/2: Urutan Proses Penciptaan Batik Tulis Tradisional',
      instruction: 'Susun 4 tahapan pembuatan mahakarya Batik Tulis Nusantara dari kain mori putih (1) hingga menjadi kain batik jadi (4):',
      steps: [
        { order: 1, title: '1. Nyungging & Njaplak (Pola Dasar)', detail: 'Memindahkan pola ragam hias filosofis ke atas lembaran kain mori putih bersih.' },
        { order: 2, title: '2. Nglowong dengan Canting & Malam', detail: 'Menorehkan lilin malam panas menggunakan canting tembaga mengikuti garis motif.' },
        { order: 3, title: '3. Medel & Nyolet (Pewarnaan)', detail: 'Mencelupkan kain ke dalam larutan pewarna alam seperti soga, mengkudu, atau tarum indigo.' },
        { order: 4, title: '4. Nglorod (Pelepasan Lilin Malam)', detail: 'Merebus kain dalam air mendidih untuk meluruhkan malam sehingga motif batik tampak jelas.' }
      ],
      poolOrder: [2, 4, 1, 3]
    }
  ],

  initGameC(stage) {
    this.currentSession.totalRounds = this.gameCStages.length;
    this.currentSession.roundIndex = 0;
    this._gameCPlaced = [];
    this.renderGameCStage(stage);
  },

  renderGameCStage(stage) {
    const sIdx = this.currentSession.roundIndex;
    const cfg = this.gameCStages[sIdx];
    const placedCount = this._gameCPlaced.length;
    const progress = Math.round(((sIdx * 4 + placedCount) / (this.currentSession.totalRounds * 4)) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`Tahap ${sIdx + 1} / ${this.currentSession.totalRounds}`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <div>
          <span class="text-xs font-black uppercase text-[#F2C45A]">${cfg.stageTitle}</span>
          <p class="text-xs sm:text-sm text-[#FAF6EF] mt-1">${cfg.instruction}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <!-- Left: Target Blueprint Slots -->
          <div class="bg-[#102B25] p-4 rounded-2xl border border-[#D4A447]/30 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-bold text-[#F2C45A] pb-1 border-b border-[#D4A447]/20">
              <span>Urutan Konstruksi / Proses</span>
              <span>${placedCount} / ${cfg.steps.length} Terpasang</span>
            </div>
            ${cfg.steps.map((st, idx) => {
              const isFilled = idx < placedCount;
              const isCurrentTarget = idx === placedCount;
              return `
                <div class="p-3 rounded-xl border-2 transition-all ${
                  isFilled
                    ? 'bg-[#287E7A]/35 border-[#34A59F] text-[#FAF6EF]'
                    : isCurrentTarget
                      ? 'bg-[#173F32] border-dashed border-[#F2C45A] text-[#F2C45A]'
                      : 'bg-[#0A1D18]/60 border-white/10 text-[#A99E8B]'
                }">
                  <div class="flex items-center justify-between text-xs font-black">
                    <span>${isFilled ? st.title : `Slot Urutan #${st.order} ${isCurrentTarget ? '(Pilih Komponen Berikutnya)' : ''}`}</span>
                    ${isFilled ? '<span class="material-symbols-outlined text-[18px] text-[#34A59F]">verified</span>' : ''}
                  </div>
                  ${isFilled ? `<p class="text-[11px] text-[#DFD5C3] mt-1">${st.detail}</p>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Right: Available Component Pool -->
          <div class="space-y-2.5">
            <span class="text-xs font-bold text-[#DFD5C3] block">Pilih Komponen secara Berurutan (Klik atau Enter):</span>
            ${cfg.poolOrder.map(orderNum => {
              const stepObj = cfg.steps.find(s => s.order === orderNum);
              const alreadyPlaced = this._gameCPlaced.includes(orderNum);
              return `
                <button
                  type="button"
                  data-step-order="${orderNum}"
                  ${alreadyPlaced ? 'disabled' : ''}
                  onclick="MiniGameEngine.handleGameCSelect(${orderNum})"
                  class="w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                    alreadyPlaced
                      ? 'bg-[#102B25]/40 border-[#34A59F]/30 text-[#A99E8B] opacity-50 cursor-default'
                      : 'bg-[#102B25] hover:bg-[#1E4E3E] border-[#D4A447]/35 text-[#FAF6EF] cursor-pointer'
                  }"
                >
                  <div>
                    <p class="text-xs sm:text-sm font-extrabold text-[#FAF6EF]">${stepObj.title.replace(/^\d+\.\s*/, '')}</p>
                    <p class="text-[11px] text-[#DFD5C3] mt-0.5">${stepObj.detail}</p>
                  </div>
                  <span class="material-symbols-outlined text-[#F2C45A] shrink-0">${alreadyPlaced ? 'check_circle' : 'add_circle'}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.setMascotReaction('thinking', `Pilih komponen urutan ke-${placedCount + 1} untuk menyusun struktur dengan benar.`);
  },

  handleGameCSelect(orderNum) {
    if (this.currentState !== this.STATES.PLAYING) return;
    const sIdx = this.currentSession.roundIndex;
    const cfg = this.gameCStages[sIdx];
    const expectedOrder = this._gameCPlaced.length + 1;

    this.currentSession.totalActions += 1;

    if (orderNum === expectedOrder) {
      this._gameCPlaced.push(orderNum);
      this.currentSession.correctActions += 1;
      this.playSuccessChime();

      const stage = document.getElementById('arena-stage-container');
      this.renderGameCStage(stage);

      if (this._gameCPlaced.length >= cfg.steps.length) {
        this.setMascotReaction('celebrating', 'Luar biasa! Susunan konstruksi budaya telah berdiri kokoh.');
        this.registerTimeout(() => {
          this.currentSession.roundIndex += 1;
          this._gameCPlaced = [];
          if (this.currentSession.roundIndex < this.currentSession.totalRounds) {
            this.renderGameCStage(document.getElementById('arena-stage-container'));
          } else {
            this.progressToCelebration();
          }
        }, 650);
      }
    } else {
      this.currentSession.mistakes += 1;
      this.playErrorBuzz();
      this.setMascotReaction('encouraging', `Urutan belum tepat! Kita membutuhkan komponen urutan ke-${expectedOrder} terlebih dahulu.`);
    }
  },

  // =========================================================================
  // 6. MINI-GAME D: SIMULASI RITME & LARAS TRADISI (EXPLICIT SIMULATION)
  // =========================================================================

  gameDRounds: [
    {
      roundTitle: 'Babak 1/3 • Pola Laras Saluang Darek (Sumatera Barat)',
      instrument: 'Saluang Bambu Talang & Talempong Pacik',
      culturalContext: 'Saluang dimainkan dengan teknik "manyisiahan angok" (pernapasan sirkular tanpa putus). Dengarkan atau amati urutan 3 bilah nada di bawah ini, lalu tirukan kembali!',
      targetPattern: [0, 2, 3] // Indeks bilah: 0=Ding, 1=Dong, 2=Deng, 3=Dung
    },
    {
      roundTitle: 'Babak 2/3 • Pola Tabuhan Talempong Pacik Poliritmik',
      instrument: 'Ansambel Talempong Perunggu',
      culturalContext: 'Talempong Pacik menggunakan jalinan nada saling mengisi (interlocking). Tirukan 3 nada berurutan berikut!',
      targetPattern: [1, 3, 2]
    },
    {
      roundTitle: 'Babak 3/3 • Pola Irama Tifa & Totobuang (Maluku & Papua)',
      instrument: 'Perkusi Tifa Kayu Lenggua',
      culturalContext: 'Tabuhan Tifa mengiringi gerak dinamis dan semangat kebersamaan masyarakat kepulauan timur. Tirukan 4 ketukan nada penutup ini!',
      targetPattern: [0, 1, 3, 0]
    }
  ],

  gameDNotes: [
    { idx: 0, code: 'NADA 1', name: 'Laras Ding (293 Hz)', freq: 293.66, color: '#F2C45A' },
    { idx: 1, code: 'NADA 2', name: 'Laras Dong (329 Hz)', freq: 329.63, color: '#34A59F' },
    { idx: 2, code: 'NADA 3', name: 'Laras Deng (392 Hz)', freq: 392.00, color: '#B65F45' },
    { idx: 3, code: 'NADA 4', name: 'Laras Dung (440 Hz)', freq: 440.00, color: '#D4A447' }
  ],

  initGameD(stage) {
    this.currentSession.totalRounds = this.gameDRounds.length;
    this.currentSession.roundIndex = 0;
    this._gameDUserInput = [];
    this.renderGameDRound(stage);
  },

  renderGameDRound(stage) {
    const rIdx = this.currentSession.roundIndex;
    const round = this.gameDRounds[rIdx];
    const progress = Math.round((rIdx / this.currentSession.totalRounds) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`Irama ${rIdx + 1} / ${this.currentSession.totalRounds}`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <!-- Honest Simulation Disclosure Badge (Section 7.6 Rule 10) -->
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4A447]/20">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-[#202136] border border-[#F2C45A]/40 text-[10px] font-extrabold text-[#F2C45A] uppercase">
              🎵 Simulasi Pembelajaran Tangga Nada & Pola Ritme Tradisional (Web Audio Synthesizer)
            </span>
            <h3 class="text-lg sm:text-xl font-black text-[#FAF6EF] mt-1.5">${round.roundTitle}</h3>
          </div>
          <button
            type="button"
            id="game-d-play-btn"
            onclick="MiniGameEngine.playGameDPattern()"
            class="btn btn-gold text-xs py-2.5 px-5 flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">volume_up</span>
            <span>Putar Simulasi Pola Nada</span>
          </button>
        </div>

        <p class="text-xs sm:text-sm text-[#DFD5C3] leading-relaxed">${round.culturalContext}</p>

        <!-- Visual Sequence Indicator (Accessible even with sound muted) -->
        <div class="bg-[#102B25] p-4 rounded-2xl border border-[#D4A447]/30 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-[#F2C45A]">Urutan Pola Target (Visual + Audio):</span>
            <span class="font-mono text-[#34A59F]">${this._gameDUserInput.length} / ${round.targetPattern.length} Ketukan Ditekan</span>
          </div>
          <div class="flex flex-wrap items-center gap-2.5" id="game-d-sequence-slots">
            ${round.targetPattern.map((noteIdx, pos) => {
              const note = this.gameDNotes[noteIdx];
              const isEntered = pos < this._gameDUserInput.length;
              return `
                <div
                  data-seq-pos="${pos}"
                  class="px-3.5 py-2 rounded-xl border-2 text-xs font-extrabold flex items-center gap-2 transition-all ${
                    isEntered
                      ? 'bg-[#287E7A] border-[#F2C45A] text-white'
                      : 'bg-[#173F32] border-[#D4A447]/40 text-[#FAF6EF]'
                  }"
                >
                  <span class="w-5 h-5 rounded-full bg-[#102B25] text-[#F2C45A] flex items-center justify-center text-[10px]">${pos + 1}</span>
                  <span>${note.code}</span>
                  ${isEntered ? '<span class="material-symbols-outlined text-[15px]">check</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4 Interactive Bronze Keys -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="game-d-pads">
          ${this.gameDNotes.map(n => `
            <button
              type="button"
              data-note-idx="${n.idx}"
              onclick="MiniGameEngine.handleGameDPad(${n.idx})"
              class="p-4 rounded-2xl bg-[#102B25] hover:bg-[#1E4E3E] active:translate-y-1 border-2 border-[#D4A447]/45 text-center space-y-1.5 transition-all cursor-pointer shadow-lg"
            >
              <div class="w-10 h-10 rounded-full mx-auto flex items-center justify-center bg-[#173F32] border border-[#F2C45A]">
                <span class="material-symbols-outlined text-[#F2C45A]">music_note</span>
              </div>
              <p class="text-xs font-black text-[#FAF6EF]">${n.code}</p>
              <p class="text-[10px] text-[#DFD5C3]">${n.name}</p>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.setMascotReaction('curious', 'Tekan bilah nada sesuai urutan pola di atas, atau klik "Putar Simulasi Pola Nada" untuk mendengarkannya!');
  },

  playGameDPattern() {
    if (this.currentState !== this.STATES.PLAYING) return;
    const round = this.gameDRounds[this.currentSession.roundIndex];
    if (!round) return;

    round.targetPattern.forEach((noteIdx, step) => {
      this.registerTimeout(() => {
        const note = this.gameDNotes[noteIdx];
        if (note) {
          this.playTone(note.freq, 0.35, 'triangle', 0.16);
          const pad = document.querySelector(`#game-d-pads button[data-note-idx="${noteIdx}"]`);
          if (pad) {
            pad.classList.add('ring-4', 'ring-[#F2C45A]', 'bg-[#B65F45]');
            this.registerTimeout(() => pad.classList.remove('ring-4', 'ring-[#F2C45A]', 'bg-[#B65F45]'), 260);
          }
        }
      }, step * 420);
    });
  },

  handleGameDPad(noteIdx) {
    if (this.currentState !== this.STATES.PLAYING) return;
    const round = this.gameDRounds[this.currentSession.roundIndex];
    if (!round) return;

    const note = this.gameDNotes[noteIdx];
    if (note) this.playTone(note.freq, 0.25, 'triangle', 0.15);

    const expectedIdx = round.targetPattern[this._gameDUserInput.length];
    this.currentSession.totalActions += 1;

    if (noteIdx === expectedIdx) {
      this._gameDUserInput.push(noteIdx);
      this.currentSession.correctActions += 1;
      const stage = document.getElementById('arena-stage-container');
      this.renderGameDRound(stage);

      if (this._gameDUserInput.length >= round.targetPattern.length) {
        this.playSuccessChime();
        this.setMascotReaction('celebrating', 'Harmoni yang indah! Pola ketukan dan nada berhasil kamu tirukan.');
        this.registerTimeout(() => {
          this.currentSession.roundIndex += 1;
          this._gameDUserInput = [];
          if (this.currentSession.roundIndex < this.currentSession.totalRounds) {
            this.renderGameDRound(document.getElementById('arena-stage-container'));
          } else {
            this.progressToCelebration();
          }
        }, 600);
      }
    } else {
      this.currentSession.mistakes += 1;
      this._gameDUserInput = [];
      this.playErrorBuzz();
      this.setMascotReaction('encouraging', 'Urutan nada meleset! Pola direset ke ketukan pertama—perhatikan urutan nomor NADA 1–4.');
      this.renderGameDRound(document.getElementById('arena-stage-container'));
    }
  },

  // =========================================================================
  // 7. MINI-GAME E: MUSYAWARAH & KEARIFAN ADAT (3-SCENE DILEMMA)
  // =========================================================================

  gameEScenes: [
    {
      sceneBadge: 'Babak 1/3 • Kerapatan Adat Nagari (Sumatera Barat)',
      speaker: 'Datuak Penghulu & Bundo Kanduang',
      scenario: 'Sebuah mata air ulayat di lereng bukit Nagari mulai menyusut saat musim kemarau, sementara dua kelompok peladang berselisih mengenai giliran pengairan sawah. Sebagai utusan muda adat, langkah apa yang kamu usulkan?',
      choices: [
        {
          label: 'Menggelar musyawarah mufakat di Balai Adat ("Bulek aia dek pambuluah, bulek kato dek mufakaik") untuk membagi jadwal giliran air secara adil dan menanam kembali pohon pelindung hulu.',
          isWisdom: true,
          feedback: 'Keputusan bijaksana! Pepatah Minang "Bulek aia dek pambuluah, bulek kato dek mufakaik" menempatkan mufakat bersama dan kelestarian alam sebagai hukum tertinggi.'
        },
        {
          label: 'Menutup mata air sepenuhnya bagi peladang kecil dan menyerahkan seluruh air kepada pihak yang membayar upeti paling tinggi.',
          isWisdom: false,
          feedback: 'Kurang tepat. Air ulayat dalam hukum adat Nusantara merupakan amanah komunal yang tidak boleh diprivatisasi secara sepihak.'
        }
      ]
    },
    {
      sceneBadge: 'Babak 2/3 • Tradisi Sasi Laut (Kepulauan Maluku)',
      speaker: 'Kewang (Penjaga Hutan & Laut Adat Maluku)',
      scenario: 'Wilayah pesisir desa sedang berada dalam masa "Tutup Sasi Lompa"—larangan adat menangkap ikan dan teripang selama beberapa bulan agar ekosistem laut pulih. Namun seorang pedagang luar menawarkan harga tinggi jika warga mau memanen sekarang.',
      choices: [
        {
          label: 'Menolak tawaran tersebut dengan santun dan menjaga disiplin Sasi Adat hingga waktu "Buka Sasi" tiba demi keberlanjutan laut anak cucu.',
          isWisdom: true,
          feedback: 'Tepat sekali! Tradisi Sasi di Maluku dan Papua adalah kearifan ekologis Nusantara yang terbukti menjaga populasi biota laut selama berabad-abad.'
        },
        {
          label: 'Membongkar tanda larangan Sasi secara diam-diam pada malam hari agar mendapat keuntungan cepat.',
          isWisdom: false,
          feedback: 'Melanggar Sasi merusak keseimbangan ekosistem laut dan mencederai ikatan kepercayaan masyarakat adat.'
        }
      ]
    },
    {
      sceneBadge: 'Babak 3/3 • Harmoni Subak & Tri Hita Karana (Bali)',
      speaker: 'Pekaseh (Pemimpin Subak Bali)',
      scenario: 'Dalam rapat anggota Subak, sebagian petani di bagian hulu ingin memperlebar saluran pribadi mereka, yang berisiko mengurangi debit air bagi sawah di hilir dan pura air.',
      choices: [
        {
          label: 'Menjaga sistem pembagian air proporsional (Tektek) sesuai prinsip Tri Hita Karana: keselarasan antara manusia (Pawongan), alam (Palemahan), dan Sang Pencipta (Parahyangan).',
          isWisdom: true,
          feedback: 'Sempurna! Sistem irigasi Subak diakui UNESCO karena keadilan pembagian air dan filosofi Tri Hita Karana.'
        },
        {
          label: 'Membiarkan petani hulu membendung seluruh aliran sungai tanpa mempedulikan sawah di hilir.',
          isWisdom: false,
          feedback: 'Tindakan sepihak di hulu bertentangan dengan awig-awig (aturan adat) Subak dan memicu gagal panen bersama.'
        }
      ]
    }
  ],

  initGameE(stage) {
    this.currentSession.totalRounds = this.gameEScenes.length;
    this.currentSession.roundIndex = 0;
    this.renderGameEScene(stage);
  },

  renderGameEScene(stage) {
    const sIdx = this.currentSession.roundIndex;
    const sc = this.gameEScenes[sIdx];
    const progress = Math.round((sIdx / this.currentSession.totalRounds) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`Kisah ${sIdx + 1} / ${this.currentSession.totalRounds}`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-1 rounded-full bg-[#B65F45] text-white text-xs font-extrabold uppercase">${sc.sceneBadge}</span>
          <span class="text-xs font-bold text-[#F2C45A]">Tokoh Tutur: ${sc.speaker}</span>
        </div>

        <div class="p-4 sm:p-5 rounded-2xl bg-[#FAF6EF] text-[#292820] border-2 border-[#D6C3A5] shadow-inner">
          <p class="text-xs sm:text-base font-semibold leading-relaxed">${sc.scenario}</p>
        </div>

        <div class="space-y-3" id="game-e-choices">
          ${sc.choices.map((ch, idx) => `
            <button
              type="button"
              data-choice-idx="${idx}"
              onclick="MiniGameEngine.handleGameEChoice(${idx})"
              class="w-full text-left p-4 rounded-2xl bg-[#102B25] hover:bg-[#1E4E3E] border-2 border-[#D4A447]/35 text-xs sm:text-sm font-bold text-[#FAF6EF] transition-all flex items-start gap-3 cursor-pointer"
            >
              <span class="w-7 h-7 rounded-lg bg-[#173F32] border border-[#F2C45A] text-[#F2C45A] font-black flex items-center justify-center shrink-0 mt-0.5">${idx + 1}</span>
              <span class="leading-relaxed">${ch.label}</span>
            </button>
          `).join('')}
        </div>

        <div id="game-e-feedback" class="hidden p-4 rounded-2xl bg-[#102B25] border-2 border-[#34A59F] space-y-3">
          <p id="game-e-feedback-text" class="text-xs sm:text-sm text-[#FAF6EF] leading-relaxed"></p>
          <div class="flex justify-end">
            <button id="game-e-next-btn" type="button" onclick="MiniGameEngine.nextGameEScene()" class="btn btn-primary text-xs py-2.5 px-6">
              ${sIdx + 1 < this.currentSession.totalRounds ? 'Kisah Adat Berikutnya ➔' : 'Selesaikan Musyawarah ➔'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.setMascotReaction('thinking', 'Pertimbangkan keseimbangan antara kerukunan warga dan kelestarian alam adat!');
  },

  handleGameEChoice(idx) {
    if (this.currentState !== this.STATES.PLAYING) return;
    const sc = this.gameEScenes[this.currentSession.roundIndex];
    if (!sc) return;

    const choice = sc.choices[idx];
    this.currentSession.totalActions += 1;

    if (choice && choice.isWisdom) {
      this.currentSession.correctActions += 1;
      this.transitionState(this.STATES.FEEDBACK);
      document.querySelectorAll('#game-e-choices button').forEach(b => { b.disabled = true; });
      const btn = document.querySelector(`#game-e-choices button[data-choice-idx="${idx}"]`);
      if (btn) btn.classList.add('bg-[#287E7A]', 'border-[#F2C45A]');

      this.playSuccessChime();
      this.setMascotReaction('celebrating', 'Keputusan yang arif! Musyawarah adat mencapai kemufakatan.');

      const fb = document.getElementById('game-e-feedback');
      const fbText = document.getElementById('game-e-feedback-text');
      if (fbText) fbText.innerText = choice.feedback;
      if (fb) fb.classList.remove('hidden');
    } else {
      this.currentSession.mistakes += 1;
      this.playErrorBuzz();
      this.setMascotReaction('encouraging', choice ? choice.feedback : 'Pertimbangkan kembali pilihan yang menjaga kerukunan adat.');
    }
  },

  nextGameEScene() {
    this.currentSession.roundIndex += 1;
    if (this.currentSession.roundIndex < this.currentSession.totalRounds) {
      this.transitionState(this.STATES.PLAYING);
      this.renderGameEScene(document.getElementById('arena-stage-container'));
    } else {
      this.progressToCelebration();
    }
  },

  // =========================================================================
  // 8. MINI-GAME F: RESTORASI RAGAM HIAS PUSAKA (2-ROUND TILE ROTATION)
  // =========================================================================

  gameFPuzzles: [
    {
      title: 'Restorasi 1/2 • Ukiran Geometris Saik Kalamai (Minangkabau)',
      subtitle: 'Putar keempat keping ukiran kayu hingga seluruh sudutnya mencapai 0° (Selaras Sempurna):',
      quadrants: ['Keping Hulu Kiri', 'Keping Hulu Kanan', 'Keping Hilir Kiri', 'Keping Hilir Kanan'],
      initialAngles: [90, 180, 270, 90]
    },
    {
      title: 'Restorasi 2/2 • Mandala Kawung & Surya Nusantara (Jawa)',
      subtitle: 'Selaraskan keempat keping motif Kawung empat penjuru hingga kembali ke orientasi 0°:',
      quadrants: ['Keping Barat Laut', 'Keping Timur Laut', 'Keping Barat Daya', 'Keping Tenggara'],
      initialAngles: [180, 90, 180, 270]
    }
  ],

  initGameF(stage) {
    this.currentSession.totalRounds = this.gameFPuzzles.length;
    this.currentSession.roundIndex = 0;
    this._gameFAngles = [...this.gameFPuzzles[0].initialAngles];
    this.renderGameFPuzzle(stage);
  },

  renderGameFPuzzle(stage) {
    const pIdx = this.currentSession.roundIndex;
    const puz = this.gameFPuzzles[pIdx];
    const alignedCount = this._gameFAngles.filter(a => a % 360 === 0).length;
    const progress = Math.round(((pIdx * 4 + alignedCount) / (this.currentSession.totalRounds * 4)) * 100);

    stage.innerHTML = `
      ${this.renderArenaSubheader(`Restorasi ${pIdx + 1} / ${this.currentSession.totalRounds}`, progress)}
      <div class="bg-[#173F32] border-2 border-[#D4A447]/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-lg sm:text-xl font-black text-[#FAF6EF]">${puz.title}</h3>
            <p class="text-xs text-[#DFD5C3] mt-0.5">${puz.subtitle}</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#102B25] border border-[#F2C45A]/40 text-xs font-extrabold text-[#F2C45A]">
            ${alignedCount} / 4 Keping Selaras
          </span>
        </div>

        <div class="grid grid-cols-2 gap-4 max-w-md mx-auto" id="game-f-grid" style="touch-action: manipulation;">
          ${this._gameFAngles.map((angle, idx) => {
            const isAligned = (angle % 360) === 0;
            return `
              <button
                type="button"
                data-tile-idx="${idx}"
                onclick="MiniGameEngine.rotateGameFTile(${idx})"
                style="touch-action: manipulation;"
                class="p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  isAligned
                    ? 'bg-[#287E7A]/40 border-[#34A59F] shadow-[0_0_20px_rgba(52,165,159,0.3)]'
                    : 'bg-[#102B25] hover:bg-[#1E4E3E] border-[#D4A447]/45'
                }"
              >
                <div class="w-16 h-16 flex items-center justify-center transition-transform duration-300" style="transform: rotate(${angle}deg);">
                  <svg viewBox="0 0 80 80" class="w-14 h-14">
                    <polygon points="40,6 74,40 40,74 6,40" fill="none" stroke="${isAligned ? '#34A59F' : '#F2C45A'}" stroke-width="5"/>
                    <polygon points="40,14 48,30 32,30" fill="${isAligned ? '#34A59F' : '#B65F45'}"/>
                    <circle cx="40" cy="44" r="6" fill="#F2C45A"/>
                  </svg>
                </div>
                <span class="text-xs font-bold text-[#FAF6EF]">${puz.quadrants[idx]}</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded ${isAligned ? 'bg-[#34A59F] text-[#072624] font-black' : 'bg-[#173F32] text-[#F2C45A]'}">
                  ${isAligned ? '0° SELARAS ✓' : `${angle % 360}° (Klik Putar +90°)`}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.setMascotReaction('curious', 'Klik keping yang masih miring hingga penunjuk panah merah menghadap tepat ke atas (0° SELARAS)!');
  },

  rotateGameFTile(idx) {
    if (this.currentState !== this.STATES.PLAYING) return;
    this._gameFAngles[idx] = (this._gameFAngles[idx] + 90) % 360;
    this.currentSession.totalActions += 1;

    if (this._gameFAngles[idx] === 0) {
      this.currentSession.correctActions += 1;
      this.playTone(587.33, 0.18, 'triangle', 0.14);
    } else {
      this.playTone(392.00, 0.12, 'sine', 0.1);
    }

    const stage = document.getElementById('arena-stage-container');
    this.renderGameFPuzzle(stage);

    if (this._gameFAngles.every(a => a % 360 === 0)) {
      this.playSuccessChime();
      this.setMascotReaction('celebrating', 'Sempurna! Ragam hias pusaka telah tersambung utuh.');
      this.registerTimeout(() => {
        this.currentSession.roundIndex += 1;
        if (this.currentSession.roundIndex < this.currentSession.totalRounds) {
          this._gameFAngles = [...this.gameFPuzzles[this.currentSession.roundIndex].initialAngles];
          this.renderGameFPuzzle(document.getElementById('arena-stage-container'));
        } else {
          this.progressToCelebration();
        }
      }, 550);
    }
  },

  // =========================================================================
  // 9. DETERMINISTIC SESSION COMPLETION & PERSISTENCE (NO DOM DESTRUCTION)
  // =========================================================================

  progressToCelebration() {
    this.cleanupResources();
    this.transitionState(this.STATES.COMPLETED);

    const sess = this.currentSession;
    const mode = this.MODES[this.activeGameType] || this.MODES.A;
    sess.endTime = Date.now();

    const durationSec = Math.max(1, Math.round((sess.endTime - sess.startTime - sess.pausedDurationMs) / 1000));
    const totalAttempts = Math.max(1, sess.correctActions + sess.mistakes);
    sess.accuracy = Math.round((sess.correctActions / totalAttempts) * 100);
    sess.score = Math.min(100, Math.max(60, sess.accuracy));

    // Idempotent Reward Ledger Calculation
    if (!sess.rewardClaimed) {
      sess.rewardClaimed = true;
      const accuracyBonus = sess.accuracy === 100 ? 15 : 0;
      sess.xpEarned = mode.xpBase + accuracyBonus;
      sess.gemsEarned = mode.gemsBase;

      // Persist via RagamaraEcosystem / GameState immediately so nothing is ever lost
      if (window.RagamaraEcosystem && typeof window.RagamaraEcosystem.recordMiniGameSession === 'function') {
        window.RagamaraEcosystem.recordMiniGameSession(sess);
      } else if (window.GameState && window.GameState.player) {
        window.GameState.player.xp = (window.GameState.player.xp || 0) + sess.xpEarned;
        window.GameState.player.gems = (window.GameState.player.gems || 0) + sess.gemsEarned;
        try {
          localStorage.setItem('ragamara_player_state', JSON.stringify(window.GameState.player));
        } catch (e) {}
        if (typeof window.updateHud === 'function') window.updateHud();
      }
    }

    this.playSuccessChime();
    this.setMascotReaction('celebrating', `Selamat! Sesi ${mode.title} tuntas dengan akurasi ${sess.accuracy}%!`);

    // CRITICAL FIX: Render celebration strictly inside #arena-stage-container
    // NEVER overwrite #gameplay-arena.innerHTML!
    const stage = document.getElementById('arena-stage-container');
    if (!stage) return;

    stage.innerHTML = `
      <div class="bg-[#173F32] border-2 border-[#F2C45A] rounded-3xl p-6 sm:p-10 max-w-2xl mx-auto w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div class="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#F2C45A] to-[#B65F45] mx-auto flex items-center justify-center text-[#292820] shadow-xl">
          <span class="material-symbols-outlined text-5xl" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
        </div>

        <div class="space-y-1.5">
          <span class="px-3 py-1 rounded-full bg-[#102B25] border border-[#F2C45A]/40 text-xs font-black text-[#F2C45A] uppercase tracking-wider">
            Misi Budaya Tuntas • Mode ${mode.id}
          </span>
          <h3 class="text-2xl sm:text-3xl font-black text-[#FAF6EF] pt-1">${mode.title}</h3>
          <p class="text-xs sm:text-sm text-[#DFD5C3]">Seluruh babak telah diselesaikan dan progres telah disimpan otomatis ke buku catatan penjelajahmu.</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-3.5 rounded-2xl bg-[#102B25] border border-[#D4A447]/35">
            <span class="text-[10px] font-bold uppercase text-[#DFD5C3]">XP Diraih</span>
            <p class="text-xl font-black text-[#F2C45A] mt-0.5">+${sess.xpEarned} XP</p>
          </div>
          <div class="p-3.5 rounded-2xl bg-[#102B25] border border-[#34A59F]/35">
            <span class="text-[10px] font-bold uppercase text-[#DFD5C3]">Permata</span>
            <p class="text-xl font-black text-[#34A59F] mt-0.5">+${sess.gemsEarned} 💎</p>
          </div>
          <div class="p-3.5 rounded-2xl bg-[#102B25] border border-[#D4A447]/35">
            <span class="text-[10px] font-bold uppercase text-[#DFD5C3]">Akurasi</span>
            <p class="text-xl font-black text-[#FAF6EF] mt-0.5">${sess.accuracy}%</p>
          </div>
          <div class="p-3.5 rounded-2xl bg-[#102B25] border border-[#D4A447]/35">
            <span class="text-[10px] font-bold uppercase text-[#DFD5C3]">Waktu</span>
            <p class="text-xl font-black text-[#FAF6EF] mt-0.5">${durationSec} dtk</p>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button type="button" onclick="MiniGameEngine.openArena('${mode.id}')" class="btn btn-surface w-full sm:w-auto py-3 px-6 text-xs">
            <span class="material-symbols-outlined text-[18px]">replay</span>
            <span>Mainkan Lagi ↻</span>
          </button>
          <button type="button" onclick="MiniGameEngine.closeArena(true)" class="btn btn-primary w-full sm:w-auto py-3 px-8 text-xs uppercase tracking-wider">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Simpan & Lanjutkan Petualangan ➔</span>
          </button>
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.MiniGameEngine = MiniGameEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MiniGameEngine;
}
