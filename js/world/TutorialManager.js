/**
 * NULAR Living World — 9-Step Interactive Guided Tutorial (js/world/TutorialManager.js)
 * Accompanied by Raga the Javan Rhinoceros (Rhinoceros sondaicus — approved NULAR mascot).
 * Features:
 *  - 9 context-aware interactive steps (Welcome, Movement, Camera, Architecture, Cultural Info,
 *    Collectibles, World Map, Transportation, Missions & Leaderboard)
 *  - Indonesian voice narration via /api/tts neural adapter + clearly labeled SpeechSynthesis fallback
 *  - Play, Pause, Resume, Repeat, Mute, Volume, Synchronized Subtitles
 *  - Skippable, replayable from settings, persisted in user profile & localStorage
 */
import { AuthClient } from '../auth-client.js';

const TUTORIAL_KEY = 'nular_tutorial_completed_v1';

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    num: 1,
    title: 'Selamat Datang di Nusantara',
    expression: 'greeting',
    voiceText: 'Halo Penjelajah! Saya Raga, Badak Penjelajah Nusantara. Selamat datang di NULAR, dunia budaya tiga dimensi tempat Anda menjelajahi arsitektur, wastra, kuliner, dan warisan 38 provinsi Indonesia.',
    actionHint: 'Klik Lanjut untuk memulai langkah eksplorasi pertama.'
  },
  {
    id: 'movement',
    num: 2,
    title: 'Langkah 2 — Gerakan Karakter',
    expression: 'encouraging',
    voiceText: 'Mari kita mulai berjalan! Gunakan tombol W A S D atau panah pada papan ketik, atau joystick sentuh di layar ponsel untuk bergerak maju beberapa langkah.',
    actionHint: 'Gerakkan karakter Anda minimal 1,5 meter untuk melanjutkan.'
  },
  {
    id: 'camera',
    num: 3,
    title: 'Langkah 3 — Kontrol Kamera',
    expression: 'curious',
    voiceText: 'Sekarang cobalah mengatur sudut pandang! Seret layar untuk memutar kamera, atau tekan tombol Kamera untuk berganti antara mode Orang Ketiga, Orang Pertama, dan Eksplorasi Bebas.',
    actionHint: 'Ubah mode kamera atau putar sudut pandang untuk melanjutkan.'
  },
  {
    id: 'architecture',
    num: 4,
    title: 'Langkah 4 — Penemuan Arsitektur',
    expression: 'excited',
    voiceText: 'Di sekitar Anda berdiri rumah adat Nusantara. Dekati suar emas berkilau lalu tekan E untuk menginspeksi struktur atap, tiang penyangga, dan konstruksi kayu tradisionalnya.',
    actionHint: 'Dekati komponen arsitektur atau klik Lanjut untuk melihat contoh inspeksi.'
  },
  {
    id: 'cultural-info',
    num: 5,
    title: 'Langkah 5 — Informasi Budaya & Atribusi',
    expression: 'learning',
    voiceText: 'Setiap bangunan di NULAR membedakan rekonstruksi terverifikasi dari interpretasi visual, lengkap dengan sumber riset DAPOBUD, monograf arsitektur, dan atribusi resmi.',
    actionHint: 'Perhatikan sumber referensi di setiap panel monograf budaya.'
  },
  {
    id: 'collectibles',
    num: 6,
    title: 'Langkah 6 — Koleksi Budaya Nusantara',
    expression: 'celebrating',
    voiceText: 'Kunjungi Paviliun Budaya di sekitar alun-alun untuk menemukan wastra batik, kuliner tradisional, alat musik, dan kriya pusaka, lalu simpan ke Buku Koleksi digital Anda!',
    actionHint: 'Temukan pameran di paviliun atau simpan item koleksi.'
  },
  {
    id: 'world-map',
    num: 7,
    title: 'Langkah 7 — Peta 38 Provinsi',
    expression: 'happy',
    voiceText: 'Anda dapat berpindah ke delapan wilayah Nusantara dan 38 provinsi melalui tombol Peta 38 Provinsi di kanan atas. Setiap wilayah memiliki bentang alam dan vegetasi khasnya sendiri.',
    actionHint: 'Buka Peta 38 Provinsi atau klik Lanjut.'
  },
  {
    id: 'transportation',
    num: 8,
    title: 'Langkah 8 — Transportasi Jelajah',
    expression: 'excited',
    voiceText: 'Untuk perjalanan lebih seru, Anda bisa mengendarai Sepeda Motor, Mobil Ekspedisi, Perahu Layar Nusantara di perairan, hingga menerbangkan Pesawat Perintis!',
    actionHint: 'Coba naik kendaraan melalui tombol Kendaraan atau tekan E di dekat kendaraan.'
  },
  {
    id: 'missions',
    num: 9,
    title: 'Langkah 9 — Misi, XP & Papan Peringkat',
    expression: 'achievement',
    voiceText: 'Setiap penemuan memberi XP terverifikasi server, membuka lencana pencapaian, dan tercatat pada Papan Peringkat Penjelajah. Selamat menjelajahi Indonesia yang hidup!',
    actionHint: 'Klik Selesai untuk mulai menjelajah secara bebas.'
  }
];

export class TutorialManager {
  constructor({ mountEl, world }) {
    this.mountEl = mountEl;
    this.world = world;
    this.stepIndex = 0;
    this.active = false;
    this.minimized = false;
    this.muted = false;
    this.paused = false;
    this.volume = 0.85;
    this.ttsBackendState = 'checking'; // 'neural' | 'browser_fallback'
    this._audioEl = null;
    this._startPos = null;
    this._initialCamMode = null;

    this._checkTtsBackend();
  }

  setMinimized(flag) {
    this.minimized = Boolean(flag);
    if (this.active) this._render();
  }

  toggleMinimized() {
    this.setMinimized(!this.minimized);
  }

  async _checkTtsBackend() {
    try {
      const res = await fetch('./api/tts');
      if (res.ok) {
        const data = await res.json();
        this.ttsBackendState = data.configured ? 'neural' : 'browser_fallback';
      } else {
        this.ttsBackendState = 'browser_fallback';
      }
    } catch {
      this.ttsBackendState = 'browser_fallback';
    }
  }

  isCompleted() {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  }

  start({ force = false } = {}) {
    if (!force && this.isCompleted()) return false;
    this.stepIndex = 0;
    this.active = true;
    // Start compact on narrow mobile viewports so the 3D world and touch controls remain unobstructed
    this.minimized = typeof window !== 'undefined' && window.innerWidth <= 768;
    this._startPos = this.world?.player?.position?.clone() || null;
    this._initialCamMode = this.world?.cameraCtrl?.mode || 'third-person';
    this._render();
    return true;
  }

  replay() {
    localStorage.removeItem(TUTORIAL_KEY);
    this.start({ force: true });
  }

  skip() {
    this.stopSpeech();
    this.active = false;
    localStorage.setItem(TUTORIAL_KEY, '1');
    AuthClient.updateProfile({ tutorialCompleted: true }).catch(() => {});
    if (this.mountEl) this.mountEl.innerHTML = '';
    window.dispatchEvent(new CustomEvent('nular:tutorial-state', { detail: { active: false, completed: true } }));
  }

  nextStep() {
    this.stopSpeech();
    if (this.stepIndex >= TUTORIAL_STEPS.length - 1) {
      this.skip();
      return;
    }
    this.stepIndex += 1;
    this._startPos = this.world?.player?.position?.clone() || null;
    this._initialCamMode = this.world?.cameraCtrl?.mode || 'third-person';
    this._render();
  }

  prevStep() {
    this.stopSpeech();
    if (this.stepIndex > 0) {
      this.stepIndex -= 1;
      this._render();
    }
  }

  getCurrentStep() {
    return this.active ? TUTORIAL_STEPS[this.stepIndex] : null;
  }

  // Called per frame or event to detect real interactive completion of movement/camera steps
  checkInteractiveProgress() {
    if (!this.active || !this.world) return;
    const step = TUTORIAL_STEPS[this.stepIndex];
    if (!step) return;

    if (step.id === 'movement' && this._startPos && this.world.player?.position) {
      const moved = this.world.player.position.distanceTo(this._startPos);
      if (moved >= 1.5) {
        const badge = this.mountEl?.querySelector('#tut-progress-badge');
        if (badge) badge.textContent = '✓ Gerakan terdeteksi! Klik Lanjut.';
      }
    } else if (step.id === 'camera' && this._initialCamMode && this.world.cameraCtrl?.mode !== this._initialCamMode) {
      const badge = this.mountEl?.querySelector('#tut-progress-badge');
      if (badge) badge.textContent = '✓ Perubahan kamera terdeteksi! Klik Lanjut.';
    }
  }

  async speakCurrentStep() {
    const step = TUTORIAL_STEPS[this.stepIndex];
    if (!step || this.muted) return;
    this.stopSpeech();
    this.paused = false;

    // 1. Try neural TTS backend first if configured
    if (this.ttsBackendState === 'neural') {
      try {
        const res = await fetch('./api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: step.voiceText })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) {
            this._audioEl = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
            this._audioEl.volume = this.volume;
            await this._audioEl.play();
            return;
          }
        }
      } catch {}
    }

    // 2. Clearly labeled Browser SpeechSynthesis fallback
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(step.voiceText);
      utter.lang = 'id-ID';
      utter.rate = 0.98;
      utter.volume = this.volume;
      window.speechSynthesis.speak(utter);
    }
  }

  pauseOrResumeSpeech() {
    if (this._audioEl) {
      if (this._audioEl.paused) { this._audioEl.play().catch(() => {}); this.paused = false; }
      else { this._audioEl.pause(); this.paused = true; }
      return;
    }
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); this.paused = false; }
      else if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); this.paused = true; }
    }
  }

  stopSpeech() {
    if (this._audioEl) {
      this._audioEl.pause();
      this._audioEl = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  _render() {
    if (!this.mountEl || !this.active) return;
    const step = TUTORIAL_STEPS[this.stepIndex];
    const avatarSize = this.minimized ? 36 : 64;
    const ragaSvg = typeof window.RagaMascot?.render === 'function'
      ? window.RagaMascot.render(step.expression, { size: avatarSize, withHeadpiece: true })
      : `<div style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;background:#9C7A4C;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;">RAGA</div>`;

    const voiceLabel = this.ttsBackendState === 'neural'
      ? 'Suara Neural ID'
      : 'Suara Peramban (Fallback ID)';

    if (this.minimized) {
      this.mountEl.innerHTML = `
        <section id="nular-tutorial-card" class="tutorial-overlay tutorial-overlay--compact nular-glass--dark" role="dialog" aria-label="Tutorial Interaktif NULAR (Ringkas)">
          <div class="tutorial-overlay__avatar">${ragaSvg}</div>
          <div class="tutorial-compact__info">
            <span class="tutorial-step-pill">Raga · ${step.num}/${TUTORIAL_STEPS.length}</span>
            <strong class="tutorial-compact__title">${step.title}</strong>
          </div>
          <div class="tutorial-compact__actions">
            <button type="button" id="tut-btn-expand" class="tut-btn" aria-label="Perluas panduan Raga">Buka</button>
            <button type="button" id="tut-btn-next" class="tut-btn tut-btn--primary" aria-label="Langkah berikutnya">${this.stepIndex >= TUTORIAL_STEPS.length - 1 ? 'Selesai' : 'Lanjut →'}</button>
            <button type="button" id="tut-btn-skip" class="tut-btn tut-btn--ghost" aria-label="Tutup tutorial" title="Lewati Tutorial">×</button>
          </div>
        </section>
      `;

      this.mountEl.querySelector('#tut-btn-expand')?.addEventListener('click', () => this.setMinimized(false));
      this.mountEl.querySelector('#tut-btn-next')?.addEventListener('click', () => this.nextStep());
      this.mountEl.querySelector('#tut-btn-skip')?.addEventListener('click', () => this.skip());

      window.dispatchEvent(new CustomEvent('nular:tutorial-state', {
        detail: { active: true, minimized: true, stepIndex: this.stepIndex, stepId: step.id, title: step.title }
      }));
      return;
    }

    this.mountEl.innerHTML = `
      <section id="nular-tutorial-card" class="tutorial-overlay nular-glass--dark" role="dialog" aria-label="Tutorial Interaktif NULAR">
        <div class="tutorial-overlay__avatar">${ragaSvg}</div>
        <div class="tutorial-overlay__body">
          <div class="tutorial-overlay__top">
            <span class="tutorial-step-pill">Tutorial ${step.num} / ${TUTORIAL_STEPS.length} · Raga Badak Penjelajah</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="tutorial-voice-tag">${voiceLabel}</span>
              <button type="button" id="tut-btn-minimize" class="tut-btn tut-btn--ghost" style="padding:2px 8px;" aria-label="Kecilkan panel tutorial" title="Kecilkan">− Kecilkan</button>
            </div>
          </div>
          <h3 class="tutorial-overlay__title">${step.title}</h3>
          <p id="tut-subtitle" class="tutorial-overlay__subtitle">${step.voiceText}</p>
          <div id="tut-progress-badge" class="tutorial-overlay__hint">${step.actionHint}</div>
          <div class="tutorial-overlay__controls">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <button type="button" id="tut-btn-speak" class="tut-btn">🔊 Putar Suara</button>
              <button type="button" id="tut-btn-pause" class="tut-btn">⏯ Jeda</button>
              <button type="button" id="tut-btn-mute" class="tut-btn">${this.muted ? '🔇 Bisu' : '🔈 Aktif'}</button>
              <input type="range" id="tut-vol" min="0" max="1" step="0.1" value="${this.volume}" aria-label="Volume Narasi" style="width:64px;" />
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" id="tut-btn-skip" class="tut-btn tut-btn--ghost">Lewati</button>
              ${this.stepIndex > 0 ? '<button type="button" id="tut-btn-prev" class="tut-btn">Sebelumnya</button>' : ''}
              <button type="button" id="tut-btn-next" class="tut-btn tut-btn--primary">
                ${this.stepIndex >= TUTORIAL_STEPS.length - 1 ? 'Selesai & Jelajah' : 'Lanjut →'}
              </button>
            </div>
          </div>
        </div>
      </section>
    `;

    this.mountEl.querySelector('#tut-btn-minimize')?.addEventListener('click', () => this.setMinimized(true));
    this.mountEl.querySelector('#tut-btn-speak')?.addEventListener('click', () => this.speakCurrentStep());
    this.mountEl.querySelector('#tut-btn-pause')?.addEventListener('click', () => this.pauseOrResumeSpeech());
    this.mountEl.querySelector('#tut-btn-mute')?.addEventListener('click', () => {
      this.muted = !this.muted;
      if (this.muted) this.stopSpeech();
      this._render();
    });
    this.mountEl.querySelector('#tut-vol')?.addEventListener('input', (e) => {
      this.volume = Number(e.target.value);
      if (this._audioEl) this._audioEl.volume = this.volume;
    });
    this.mountEl.querySelector('#tut-btn-skip')?.addEventListener('click', () => this.skip());
    this.mountEl.querySelector('#tut-btn-prev')?.addEventListener('click', () => this.prevStep());
    this.mountEl.querySelector('#tut-btn-next')?.addEventListener('click', () => this.nextStep());

    window.dispatchEvent(new CustomEvent('nular:tutorial-state', {
      detail: { active: true, minimized: false, stepIndex: this.stepIndex, stepId: step.id, title: step.title }
    }));
  }
}
