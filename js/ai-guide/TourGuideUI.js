/**
 * NULAR Living World — Minimal Transparent AI Cultural Guide Chat (js/ai-guide/TourGuideUI.js)
 *
 * Strict Minimalist Overlay Specification (Phase 5.4):
 * Displays ONLY the subtle transparent conversation overlay:
 *  - Conversation messages
 *  - One compact input field
 *  - Send action
 *  - Optional microphone control
 *  - Small speaker toggle control
 *  - Close / minimize action
 *
 * Context-aware across region, province, active house, selected component, exhibit, and tutorial step.
 * Uses backend /api/guide-chat when GEMINI_API_KEY is configured, with honest curated local fallback.
 */
import { escapeHtml } from '../museum-shell.js';
import { ContextResolver } from './ContextResolver.js';
import { KnowledgeRetriever } from './KnowledgeRetriever.js';
import { AudioPipeline } from './AudioPipeline.js';

export function mountTourGuide({ mountEl, world, houses }) {
  if (!mountEl) return null;

  const resolver = new ContextResolver(world, houses);
  const retriever = new KnowledgeRetriever(houses);
  const audio = new AudioPipeline();

  let speakerEnabled = true;
  let listening = false;
  let messages = [];

  mountEl.innerHTML = `
    <section id="ai-guide-panel" class="ai-minimal-chat" hidden aria-label="Percakapan Pemandu Budaya AI NULAR">
      <div class="ai-minimal-chat__top">
        <span class="ai-minimal-chat__tag">Pemandu Budaya</span>
        <div class="ai-minimal-chat__top-actions">
          <button type="button" id="ai-speaker-btn" class="ai-icon-btn is-on" title="Aktifkan/Matikan Suara" aria-label="Suara Pemandu">🔊</button>
          <button type="button" id="ai-close-btn" class="ai-icon-btn" title="Tutup / Perkecil" aria-label="Tutup Percakapan">×</button>
        </div>
      </div>

      <div id="ai-chat-messages" class="ai-minimal-chat__messages" aria-live="polite"></div>

      <form id="ai-chat-form" class="ai-minimal-chat__bar">
        <input id="ai-chat-input" type="text" class="ai-minimal-chat__input" placeholder="Tanya tentang bangunan atau budaya di sekitar Anda…" autocomplete="off" />
        <button type="button" id="ai-mic-btn" class="ai-icon-btn" title="Bicara (Mikrofon)" aria-label="Kontrol Mikrofon">🎤</button>
        <button type="submit" id="ai-send-btn" class="ai-send-btn" aria-label="Kirim">Kirim</button>
      </form>
    </section>
  `;

  const panel = mountEl.querySelector('#ai-guide-panel');
  const msgList = mountEl.querySelector('#ai-chat-messages');
  const form = mountEl.querySelector('#ai-chat-form');
  const input = mountEl.querySelector('#ai-chat-input');
  const micBtn = mountEl.querySelector('#ai-mic-btn');
  const speakerBtn = mountEl.querySelector('#ai-speaker-btn');
  const closeBtn = mountEl.querySelector('#ai-close-btn');

  function appendMessage(role, text) {
    messages.push({ role, text });
    const bubble = document.createElement('div');
    bubble.className = `ai-msg ai-msg--${role}`;
    bubble.innerHTML = escapeHtml(text);
    msgList.appendChild(bubble);
    msgList.scrollTop = msgList.scrollHeight;
  }

  function speakText(text) {
    if (!speakerEnabled) return;
    audio.stopSpeech();
    audio.speakFallback(text, 'id');
  }

  async function askGuide(question) {
    const q = String(question || '').trim();
    if (!q) return;
    appendMessage('user', q);

    const ctx = resolver.getContext();
    let answer = '';

    // 1. Attempt server-side LLM adapter (/api/guide-chat) first
    try {
      const res = await fetch('./api/guide-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: ctx, language: 'id' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.answer) answer = data.answer;
      }
    } catch {}

    // 2. Honest grounded cultural retrieval fallback when external LLM is unconfigured
    if (!answer) {
      const local = retriever.answerQuestion(q, ctx, 'id');
      answer = local?.text || 'Informasi spesifik tersebut belum terverifikasi dalam arsip NULAR saat ini. Anda dapat menanyakan arsitektur, material, atau tata ruang rumah adat yang sedang Anda kunjungi.';
    }

    appendMessage('guide', answer);
    speakText(answer);
  }

  function openPanel(initialPrompt = null) {
    panel.hidden = false;
    if (messages.length === 0) {
      const ctx = resolver.getContext();
      const loc = ctx.houseName || 'Alun-Alun Nusantara';
      appendMessage('guide', `Halo! Saya siap menjawab pertanyaan tentang ${loc} dan warisan budaya Nusantara di sekitar Anda.`);
    }
    if (initialPrompt) {
      askGuide(initialPrompt);
    } else {
      input.focus();
    }
  }

  function closePanel() {
    panel.hidden = true;
    audio.stopSpeech();
  }

  // Bind HUD button if present
  document.getElementById('btn-ai-guide')?.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  closeBtn.addEventListener('click', closePanel);

  speakerBtn.addEventListener('click', () => {
    speakerEnabled = !speakerEnabled;
    speakerBtn.textContent = speakerEnabled ? '🔊' : '🔇';
    speakerBtn.classList.toggle('is-on', speakerEnabled);
    if (!speakerEnabled) audio.stopSpeech();
  });

  micBtn.addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      appendMessage('guide', 'Pengenalan suara mikrofon tidak didukung pada peramban ini. Silakan ketik pertanyaan Anda.');
      return;
    }
    if (listening) return;
    listening = true;
    micBtn.classList.add('is-on');
    const rec = new SR();
    rec.lang = 'id-ID';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const spoken = ev.results?.[0]?.[0]?.transcript || '';
      if (spoken) askGuide(spoken);
    };
    rec.onerror = () => { listening = false; micBtn.classList.remove('is-on'); };
    rec.onend = () => { listening = false; micBtn.classList.remove('is-on'); };
    rec.start();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value;
    input.value = '';
    askGuide(val);
  });

  window.addEventListener('nular:ask-ai-guide', (e) => {
    openPanel(e.detail);
  });

  return { openPanel, closePanel, askGuide };
}
