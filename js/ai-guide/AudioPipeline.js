/**
 * NULAR AI House Tour Guide — AudioPipeline (js/ai-guide/AudioPipeline.js)
 * Handles:
 *  - Explicit-consent microphone PCM 16kHz mono capture (zero audio recording/storage)
 *  - 24kHz PCM audio output playback queue for Gemini 3.8 Live native audio
 *  - Instant barge-in interruption (clearQueue + speechSynthesis.cancel)
 *  - Browser Web Speech API (SpeechRecognition + SpeechSynthesis) fallback for ID/EN
 */

export class AudioPipeline {
  constructor({ onPcmChunk, onSpeechEnd, onSpeechRecognized, onActivityChange } = {}) {
    this.onPcmChunk = onPcmChunk;
    this.onSpeechEnd = onSpeechEnd;
    this.onSpeechRecognized = onSpeechRecognized;
    this.onActivityChange = onActivityChange;

    this.captureCtx = null;
    this.playbackCtx = null;
    this.mediaStream = null;
    this.processorNode = null;
    this.nextPlayTime = 0;
    this.activeSources = [];
    this.listening = false;
    this.recognition = null;
  }

  async startPcmCapture() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser tidak mendukung akses mikrofon (getUserMedia).');
    }
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.captureCtx = new Ctx({ sampleRate: 16000 });
    const src = this.captureCtx.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.captureCtx.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (ev) => {
      if (!this.listening) return;
      const input = ev.inputBuffer.getChannelData(0);
      // Downsample / convert Float32 [-1..1] to Int16 little-endian PCM
      const pcm16 = new Int16Array(input.length);
      let energy = 0;
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        energy += Math.abs(s);
      }
      const avg = energy / input.length;
      this.onActivityChange?.(avg > 0.015 ? 'speaking' : 'listening');
      const bytes = new Uint8Array(pcm16.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      this.onPcmChunk?.(btoa(bin));
    };

    src.connect(this.processorNode);
    this.processorNode.connect(this.captureCtx.destination);
    this.listening = true;
    this.onActivityChange?.('listening');
  }

  stopPcmCapture() {
    this.listening = false;
    this.onSpeechEnd?.();
    this.onActivityChange?.('idle');
    if (this.processorNode) { this.processorNode.disconnect(); this.processorNode = null; }
    if (this.mediaStream) { this.mediaStream.getTracks().forEach((t) => t.stop()); this.mediaStream = null; }
    if (this.captureCtx) { this.captureCtx.close().catch(() => {}); this.captureCtx = null; }
  }

  /**
   * Queue 24kHz little-endian 16-bit PCM audio from Gemini 3.8 Live.
   */
  enqueuePcm24k(base64Pcm) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!this.playbackCtx) {
        this.playbackCtx = new Ctx({ sampleRate: 24000 });
        this.nextPlayTime = this.playbackCtx.currentTime;
      }
      if (this.playbackCtx.state === 'suspended') this.playbackCtx.resume();

      const bin = atob(base64Pcm);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

      const audioBuf = this.playbackCtx.createBuffer(1, float32.length, 24000);
      audioBuf.copyToChannel(float32, 0);

      const src = this.playbackCtx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(this.playbackCtx.destination);
      const startAt = Math.max(this.playbackCtx.currentTime, this.nextPlayTime);
      src.start(startAt);
      this.nextPlayTime = startAt + audioBuf.duration;
      this.activeSources.push(src);
      src.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== src);
      };
    } catch { /* ignore decode edge case */ }
  }

  /**
   * Immediate interruption / barge-in: clears all queued PCM audio & Web Speech synthesis.
   */
  stopSpeaking() {
    for (const s of this.activeSources) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    this.activeSources = [];
    if (this.playbackCtx) this.nextPlayTime = this.playbackCtx.currentTime;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  /**
   * Browser SpeechSynthesis fallback when operating in Curated Local Guide mode.
   */
  speakTextFallback(text, language = 'id', onDone = null) {
    this.stopSpeaking();
    if (!('speechSynthesis' in window) || !text) {
      onDone?.();
      return false;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === 'en' ? 'en-US' : 'id-ID';
      u.rate = 0.98;
      u.onend = () => onDone?.();
      u.onerror = () => onDone?.();
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      onDone?.();
      return false;
    }
  }

  startWebSpeechRecognition(language = 'id', continuous = false) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.stopWebSpeechRecognition();
    this.recognition = new SR();
    this.recognition.lang = language === 'en' ? 'en-US' : 'id-ID';
    this.recognition.continuous = continuous;
    this.recognition.interimResults = false;
    this.recognition.onstart = () => this.onActivityChange?.('listening');
    this.recognition.onresult = (e) => {
      const transcript = e.results?.[e.results.length - 1]?.[0]?.transcript?.trim();
      if (transcript) this.onSpeechRecognized?.(transcript);
    };
    this.recognition.onend = () => this.onActivityChange?.('idle');
    this.recognition.onerror = () => this.onActivityChange?.('idle');
    this.recognition.start();
    return true;
  }

  stopWebSpeechRecognition() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.recognition = null;
    }
    this.onActivityChange?.('idle');
  }

  dispose() {
    this.stopPcmCapture();
    this.stopWebSpeechRecognition();
    this.stopSpeaking();
    if (this.playbackCtx) { this.playbackCtx.close().catch(() => {}); this.playbackCtx = null; }
  }
}
