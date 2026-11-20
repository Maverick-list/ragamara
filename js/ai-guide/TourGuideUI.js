/**
 * NULAR AI House Tour Guide — TourGuideUI (js/ai-guide/TourGuideUI.js)
 * Museum-grade conversational voice & text tour guide panel integrated into world.html.
 * Supports:
 *  - Gemini 3.8 Live bidirectional audio via secure /api/guide-session ephemeral tokens
 *  - Transparent Curated Knowledge + Web Speech API fallback when GEMINI_API_KEY is absent
 *  - Indonesian (default) & English switching
 *  - Push-to-Talk, Continuous Voice mode, Live Captions, Transcript History, Stop Speaking (barge-in),
 *    Explicit Microphone Privacy Notice, and Spatial Context Grounding
 */
import { escapeHtml } from '../museum-shell.js';
import { ContextResolver } from './ContextResolver.js';
import { KnowledgeRetriever } from './KnowledgeRetriever.js';
import { AudioPipeline } from './AudioPipeline.js';
import { GeminiLiveClient } from './GeminiLiveClient.js';

export function mountTourGuide({ mountEl, world, houses }) {
  if (!mountEl) return null;

  const resolver = new ContextResolver(world, houses);
  const retriever = new KnowledgeRetriever(houses);

  let language = 'id';
  let mode = 'idle'; // 'idle' | 'gemini-live' | 'curated-local'
  let continuousMode = false;
  let sessionActive = false;
  let transcript = [];

  mountEl.innerHTML = `
    <aside id="ai-guide-panel" class="ai-guide-panel" hidden aria-label="Pemandu Tur Arsitektur AI NULAR">
      <div class="ai-guide-head">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.12em;text-transform:uppercase;color:#D4AE7A;">
            Pemandu Tur Arsitektur AI
          </div>
          <div id="ai-guide-loc" style="font-family:'Fraunces',serif;font-size:1.1rem;font-weight:600;margin-top:2px;">NULAR Museum Guide</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button type="button" id="ai-lang-toggle" class="ai-mini-btn" title="Ganti Bahasa (ID / EN)">ID</button>
          <button type="button" id="ai-close-btn" class="ai-mini-btn" aria-label="Tutup Pemandu AI">×</button>
        </div>
      </div>

      <div id="ai-mode-bar" class="ai-mode-bar">
        <span id="ai-status-dot" class="ai-status-dot"></span>
        <span id="ai-mode-label">Siap memulai sesi tur</span>
        <button type="button" id="ai-end-session" class="ai-mini-btn" style="margin-left:auto;" hidden>Akhiri</button>
      </div>

      <div class="ai-privacy-note">
        Privasi Mikrofon: Audio Anda diproses real-time hanya saat mikrofon aktif dan <strong>tidak direkam atau disimpan</strong>.
      </div>

      <div id="ai-live-caption" class="ai-live-caption" aria-live="polite" hidden></div>
      <div id="ai-transcript" class="ai-transcript" role="log" aria-live="polite"></div>

      <div id="ai-quick-prompts" class="ai-quick-prompts"></div>

      <div class="ai-voice-bar">
        <button type="button" id="ai-ptt-btn" class="ai-voice-btn">
          <span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">mic</span>
          <span id="ai-ptt-label">Tekan untuk Bicara</span>
        </button>
        <button type="button" id="ai-cont-toggle" class="ai-mini-btn" title="Mode Suara Berkelanjutan" aria-pressed="false">Kontinu</button>
        <button type="button" id="ai-stop-speak" class="ai-mini-btn" title="Hentikan Suara Pemandu">Henti</button>
      </div>

      <form id="ai-text-form" class="ai-text-form">
        <input id="ai-text-input" type="text" placeholder="Tanyakan tentang struktur, ruang, atau sejarah rumah ini..." autocomplete="off" />
        <button type="submit" class="ai-send-btn" aria-label="Kirim pertanyaan">Kirim</button>
      </form>
    </aside>
  `;

  // Inject scoped styles cleanly once
  if (!document.getElementById('ai-guide-styles')) {
    const st = document.createElement('style');
    st.id = 'ai-guide-styles';
    st.textContent = `
      .ai-guide-panel {
        position: fixed; bottom: 56px; right: 16px; width: min(400px, calc(100vw - 32px));
        max-height: min(620px, calc(100vh - 130px)); z-index: 35;
        background: rgba(15, 25, 20, 0.95); color: #FAF7F2; border: 1px solid rgba(212,174,122,0.45);
        border-radius: 6px; display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.55); backdrop-filter: blur(14px);
      }
      .ai-guide-panel[hidden] { display: none; }
      .ai-guide-head { flex-shrink: 0; padding: 11px 14px; border-bottom: 1px solid rgba(250,247,242,0.12); display: flex; justify-content: space-between; align-items: center; }
      .ai-mode-bar { flex-shrink: 0; padding: 6px 14px; background: rgba(250,247,242,0.05); font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem; color: #C7D1CA; display: flex; align-items: center; gap: 8px; }
      .ai-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #8c9c92; flex-shrink: 0; }
      .ai-status-dot.is-live { background: #6ee7a8; }
      .ai-status-dot.is-speaking { background: #f5c77a; }
      .ai-privacy-note { flex-shrink: 0; padding: 6px 14px; font-size: 0.69rem; color: #a7b8ad; border-bottom: 1px solid rgba(250,247,242,0.08); }
      .ai-live-caption { flex-shrink: 0; max-height: 64px; overflow-y: auto; padding: 7px 14px; background: rgba(212,174,122,0.14); border-bottom: 1px solid rgba(212,174,122,0.28); font-size: 0.78rem; line-height: 1.4; color: #FFF8EB; }
      .ai-transcript { flex: 1 1 auto; min-height: 90px; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 9px; }
      .ai-msg { padding: 8px 11px; border-radius: 5px; font-size: 0.82rem; line-height: 1.5; max-width: 94%; }
      .ai-msg--guide { background: rgba(250,247,242,0.09); border-left: 2px solid #D4AE7A; align-self: flex-start; }
      .ai-msg--user { background: #9C7A4C; color: #FFFDF9; align-self: flex-end; }
      .ai-msg__cite { margin-top: 5px; font-family: 'IBM Plex Mono', monospace; font-size: 0.64rem; color: #D4AE7A; }
      .ai-quick-prompts { flex-shrink: 0; padding: 7px 14px; display: flex; flex-wrap: wrap; gap: 5px; border-top: 1px solid rgba(250,247,242,0.08); }
      .ai-chip { background: rgba(250,247,242,0.08); border: 1px solid rgba(212,174,122,0.3); color: #FAF7F2; font-size: 0.7rem; padding: 4px 9px; border-radius: 999px; cursor: pointer; }
      .ai-chip:hover { background: #9C7A4C; }
      .ai-voice-bar { flex-shrink: 0; padding: 7px 14px; display: flex; gap: 6px; align-items: center; border-top: 1px solid rgba(250,247,242,0.1); }
      .ai-voice-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; background: #9C7A4C; color: #FFFDF9; border: none; border-radius: 4px; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
      .ai-voice-btn.is-listening { background: #b83b2e; }
      .ai-mini-btn { min-height: 32px; padding: 4px 9px; background: rgba(250,247,242,0.1); color: #FAF7F2; border: 1px solid rgba(250,247,242,0.2); border-radius: 4px; font-size: 0.72rem; cursor: pointer; }
      .ai-mini-btn[aria-pressed="true"] { background: #D4AE7A; color: #121c17; font-weight: 700; }
      .ai-text-form { flex-shrink: 0; display: flex; gap: 6px; padding: 7px 14px 12px; }
      .ai-text-form input { flex: 1; min-width: 0; background: rgba(250,247,242,0.1); border: 1px solid rgba(250,247,242,0.22); color: #FAF7F2; padding: 8px 10px; border-radius: 4px; font-size: 0.82rem; font-family: inherit; }
      .ai-send-btn { flex-shrink: 0; background: #D4AE7A; color: #121c17; border: none; padding: 8px 14px; border-radius: 4px; font-weight: 700; font-size: 0.78rem; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }

  const panel = document.getElementById('ai-guide-panel');
  const locEl = document.getElementById('ai-guide-loc');
  const statusDot = document.getElementById('ai-status-dot');
  const modeLabel = document.getElementById('ai-mode-label');
  const endBtn = document.getElementById('ai-end-session');
  const captionEl = document.getElementById('ai-live-caption');
  const transcriptEl = document.getElementById('ai-transcript');
  const quickEl = document.getElementById('ai-quick-prompts');
  const pttBtn = document.getElementById('ai-ptt-btn');
  const pttLabel = document.getElementById('ai-ptt-label');
  const contToggle = document.getElementById('ai-cont-toggle');
  const langBtn = document.getElementById('ai-lang-toggle');
  const textInput = document.getElementById('ai-text-input');

  const audio = new AudioPipeline({
    onPcmChunk: (b64) => liveClient.sendAudioChunk(b64),
    onSpeechEnd: () => liveClient.sendAudioStreamEnd(),
    onSpeechRecognized: (text) => handleUserQuestion(text),
    onActivityChange: (st) => {
      statusDot.classList.toggle('is-speaking', st === 'speaking');
      pttBtn.classList.toggle('is-listening', st === 'listening' || st === 'speaking');
      pttLabel.textContent = st === 'idle'
        ? (language === 'en' ? 'Push to Talk' : 'Tekan untuk Bicara')
        : (language === 'en' ? 'Listening... (Tap to Stop)' : 'Mendengarkan... (Klik Henti)');
    }
  });

  const liveClient = new GeminiLiveClient({
    onAudioChunk: (b64) => audio.enqueuePcm24k(b64),
    onInputTranscript: (txt) => addMessage('user', txt),
    onOutputTranscript: (txt) => {
      captionEl.hidden = false;
      captionEl.textContent = txt;
      addMessage('guide', txt, 'Gemini 3.8 Live · Grounded NULAR Context');
    },
    onInterrupted: () => {
      audio.stopSpeaking();
      captionEl.textContent = language === 'en' ? '(Interrupted — listening to you)' : '(Diinterupsi — mendengarkan Anda)';
    },
    onStatusChange: (s) => {
      if (s === 'closed' || s === 'error') {
        mode = 'curated-local';
        updateModeBadge();
      }
    }
  });

  function addMessage(role, text, cite = '') {
    transcript.push({ role, text, cite, ts: Date.now() });
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg--${role}`;
    div.innerHTML = `<div>${escapeHtml(text)}</div>${cite ? `<div class="ai-msg__cite">Sumber: ${escapeHtml(cite)}</div>` : ''}`;
    transcriptEl.appendChild(div);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function updateModeBadge() {
    statusDot.classList.toggle('is-live', sessionActive);
    endBtn.hidden = !sessionActive;
    if (!sessionActive) {
      modeLabel.textContent = language === 'en' ? 'Ready to start tour session' : 'Siap memulai sesi tur';
    } else if (mode === 'gemini-live') {
      modeLabel.textContent = 'Gemini 3.8 Live · Audio Real-Time';
    } else {
      modeLabel.textContent = language === 'en'
        ? 'Curated Knowledge Mode · Web Speech Voice'
        : 'Mode Arsip Terverifikasi · Suara Web Speech';
    }
  }

  function refreshContextUI() {
    const ctx = resolver.resolve();
    locEl.textContent = `${ctx.houseName} → ${ctx.roomName}`;
    const prompts = ctx.house
      ? (language === 'en'
          ? [`About ${ctx.houseName}`, 'Materials & structure', 'Interior layout', 'Cultural meaning']
          : [`Ceritakan ${ctx.houseName}`, 'Material & struktur', 'Tata ruang interior', 'Makna budaya'])
      : (language === 'en'
          ? ['How do I explore?', 'Which houses have interiors?']
          : ['Cara menjelajah?', 'Apa saja arsitektur di sini?']);
    quickEl.innerHTML = prompts.map((p) => `<button type="button" class="ai-chip" data-q="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('');
  }

  async function ensureSession() {
    if (sessionActive) return;
    const ctx = resolver.resolve();
    const sysInst = retriever.buildGroundedSystemInstruction(ctx, language);

    try {
      const res = await fetch('/api/guide-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseId: ctx.houseId, language, systemInstruction: sysInst })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mode === 'gemini-live' && data.ephemeralToken) {
          await liveClient.connect({
            wsEndpoint: data.wsEndpoint,
            ephemeralToken: data.ephemeralToken,
            model: data.model,
            systemInstruction: sysInst
          });
          mode = 'gemini-live';
          sessionActive = true;
          updateModeBadge();
          return;
        }
      }
    } catch { /* fallback below */ }

    mode = 'curated-local';
    sessionActive = true;
    updateModeBadge();
  }

  async function handleUserQuestion(question) {
    const q = (question || '').trim();
    if (!q) return;
    audio.stopSpeaking();
    addMessage('user', q);
    await ensureSession();

    const ctx = resolver.resolve();
    world?.character?.playOneShot?.('Point', 1.0);

    if (mode === 'gemini-live' && liveClient.connected) {
      liveClient.sendText(`[Lokasi: ${ctx.houseName} → ${ctx.roomName}] ${q}`);
      return;
    }

    // Try server-side Gemini text endpoint if available; otherwise deterministic grounded local retrieval
    const sysInst = retriever.buildGroundedSystemInstruction(ctx, language);
    try {
      const res = await fetch('/api/guide-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, systemInstruction: sysInst })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          captionEl.hidden = false;
          captionEl.textContent = data.answer;
          addMessage('guide', data.answer, `Gemini Grounded · ${ctx.houseName}`);
          audio.speakTextFallback(data.answer, language);
          return;
        }
      }
    } catch { /* local fallback */ }

    const localAns = retriever.answerLocally(q, ctx, language);
    captionEl.hidden = false;
    captionEl.textContent = localAns.text;
    addMessage('guide', localAns.text, localAns.groundedIn);
    audio.speakTextFallback(localAns.text, language);
  }

  function openGuide() {
    panel.hidden = false;
    refreshContextUI();
    if (!transcript.length) {
      const ctx = resolver.resolve();
      const greet = retriever.answerLocally('', ctx, language);
      addMessage('guide', greet.text, greet.groundedIn);
    }
  }

  // Bind UI buttons
  document.getElementById('btn-ai-guide')?.addEventListener('click', () => {
    if (panel.hidden) openGuide();
    else panel.hidden = true;
  });
  document.getElementById('ai-close-btn').addEventListener('click', () => { panel.hidden = true; });
  endBtn.addEventListener('click', () => {
    audio.stopPcmCapture();
    audio.stopWebSpeechRecognition();
    audio.stopSpeaking();
    liveClient.disconnect();
    sessionActive = false;
    mode = 'idle';
    captionEl.hidden = true;
    updateModeBadge();
  });

  langBtn.addEventListener('click', () => {
    language = language === 'id' ? 'en' : 'id';
    langBtn.textContent = language.toUpperCase();
    textInput.placeholder = language === 'en'
      ? 'Ask about structure, interior rooms, or history...'
      : 'Tanyakan tentang struktur, ruang, atau sejarah rumah ini...';
    refreshContextUI();
    updateModeBadge();
  });

  contToggle.addEventListener('click', () => {
    continuousMode = !continuousMode;
    contToggle.setAttribute('aria-pressed', String(continuousMode));
  });

  document.getElementById('ai-stop-speak').addEventListener('click', () => {
    audio.stopSpeaking();
    captionEl.hidden = true;
  });

  pttBtn.addEventListener('click', async () => {
    if (audio.listening || audio.recognition) {
      audio.stopPcmCapture();
      audio.stopWebSpeechRecognition();
      return;
    }
    audio.stopSpeaking();
    await ensureSession();
    if (mode === 'gemini-live') {
      try {
        await audio.startPcmCapture();
      } catch (err) {
        addMessage('guide', `Akses mikrofon tidak tersedia (${err.message}). Silakan ketik pertanyaan Anda di bawah.`);
      }
    } else {
      const ok = audio.startWebSpeechRecognition(language, continuousMode);
      if (!ok) {
        addMessage('guide', language === 'en'
          ? 'Browser voice input is unavailable here — please type your question below.'
          : 'Input suara browser tidak tersedia pada perangkat ini — silakan ketik pertanyaan Anda di kolom bawah.');
      }
    }
  });

  quickEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) handleUserQuestion(chip.getAttribute('data-q'));
  });

  document.getElementById('ai-text-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = textInput.value.trim();
    if (!q) return;
    textInput.value = '';
    handleUserQuestion(q);
  });

  window.addEventListener('nular:world-context', () => {
    refreshContextUI();
  });
  window.addEventListener('nular:ask-ai-guide', (e) => {
    openGuide();
    if (typeof e.detail === 'string') handleUserQuestion(e.detail);
  });

  const api = { openGuide, handleUserQuestion, resolver, retriever, getTranscript: () => transcript };
  window.__NULAR_AI_GUIDE__ = api;
  return api;
}
