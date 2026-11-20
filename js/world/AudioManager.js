/**
 * NULAR — Procedural Web Audio Feedback & Nusantara Chimes (js/world/AudioManager.js)
 * Zero external copyrighted audio dependencies. Respects user mute & volume preferences.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.45;
  }

  _ensureCtx() {
    if (!this.enabled) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  _playTone(freq, duration = 0.18, type = 'sine', delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(this.volume * 0.22, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playDiscovery() {
    // Pelog-inspired warm two-note chime
    this._playTone(523.25, 0.22, 'triangle', 0);
    this._playTone(659.25, 0.28, 'triangle', 0.09);
  }

  playMissionComplete() {
    this._playTone(523.25, 0.18, 'triangle', 0);
    this._playTone(659.25, 0.18, 'triangle', 0.1);
    this._playTone(783.99, 0.35, 'triangle', 0.2);
  }

  playLevelUp() {
    [440, 554.37, 659.25, 880].forEach((f, i) => this._playTone(f, 0.25, 'sine', i * 0.08));
  }
}

export const worldAudio = new AudioManager();
