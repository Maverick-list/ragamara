# NULAR — AI CULTURAL GUIDE & NEURAL VOICE SETUP GUIDE
**Modules:** `js/ai-guide/TourGuideUI.js` (Minimal Transparent Chat Overlay), `js/world/TutorialManager.js` (9-Step Raga Interactive Tutorial), `api/guide-chat.js`, `api/guide-session.js`, `api/tts.js`

---

## 1. Architecture & Privacy Rules

- **Server-Side Secrets Only:** No LLM (`GEMINI_API_KEY`) or Neural TTS (`ELEVENLABS_API_KEY`, `GOOGLE_TTS_API_KEY`) key is ever placed in browser JavaScript.
- **Minimal Transparent Chat UI:** `TourGuideUI.js` renders strictly a subtle transparent glass overlay containing only conversation messages, one compact input field, send button, optional microphone button, small speaker toggle, and close button.
- **Honest Fallback Behavior:**
  - When `GEMINI_API_KEY` is not configured, `/api/guide-chat` falls back cleanly to `KnowledgeRetriever.js` grounded in `data/houses.json` and `data/cultural-items.json`, explicitly acknowledging when a specific detail is not verified in the archive.
  - When `GOOGLE_TTS_API_KEY` / `ELEVENLABS_API_KEY` is not configured, `/api/tts` returns HTTP 503 with `{ configured: false, fallback: 'browser_speech_synthesis' }`, and `TutorialManager.js` clearly labels its voice indicator as **`Suara Peramban (Fallback ID)`** (never mislabeling browser speech as a neural AI voice).

---

## 2. Manual Configuration Steps

1. Copy `.env.example` to `.env.local` (or open **Vercel Project Settings → Environment Variables**).
2. **Gemini Cultural Guide LLM:**
   - Obtain a Gemini API key from Google AI Studio.
   - Set `GEMINI_API_KEY` on the server.
3. **Neural Indonesian TTS (Optional):**
   - Enable Google Cloud Text-to-Speech API and set `GOOGLE_TTS_API_KEY` (uses `id-ID-Wavenet-A` MP3 synthesis in `api/tts.js`), or configure `ELEVENLABS_API_KEY`.
4. **Browser Autoplay Compliance:**
   - Voice narration never auto-blasts without user interaction; players start/pause/mute/adjust volume directly from the Raga Tutorial card or Minimal Chat speaker toggle.
