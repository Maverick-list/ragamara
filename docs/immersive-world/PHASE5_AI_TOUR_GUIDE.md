# Phase 5 — AI House Tour Guide Architecture & Configuration Guide

## 1. Architecture Overview (Gemini 3.8 Live + Secure Serverless Ephemeral Auth)

- **Backend Serverless Endpoints (Vercel Node.js Fluid Compute):**
  - `api/guide-session.js` — Mints single-use, 15-minute constrained ephemeral auth tokens via `POST https://generativelanguage.googleapis.com/v1alpha/authTokens` for `models/gemini-3.8-live` with `responseModalities: ["AUDIO"]`, `inputAudioTranscription`, and `outputAudioTranscription`. **`GEMINI_API_KEY` NEVER reaches the browser.**
  - `api/guide-chat.js` — Server-side text Q&A endpoint using `gemini-2.5-flash` when WebSockets or microphone permissions are unavailable.
- **Modular Frontend Voice & Knowledge Engine (`js/ai-guide/`):**
  - `ContextResolver.js` — Tracks live visitor coordinates: active house, province, interior room zone, and last inspected architectural component.
  - `KnowledgeRetriever.js` — Builds grounded system prompts and enforces strict anti-hallucination rules (zero fabricated dates/rituals; stays focused on the active house unless comparison is requested). Also powers deterministic local curated Q&A when no API key is configured.
  - `AudioPipeline.js` — Explicit-consent 16kHz mono PCM capture (zero audio recording/storage), 24kHz PCM playback queue, instant barge-in interruption (`stopSpeaking()`), and Indonesian/English Web Speech API voice fallback.
  - `GeminiLiveClient.js` — WebSocket client implementing `realtimeInput.audio`, `realtimeInput.audioStreamEnd` (Hybrid VAD), `realtimeInput.text`, and `serverContent.interrupted` barge-in queue clearing.
  - `TourGuideUI.js` — Museum tour guide overlay with Push-to-Talk, Continuous Voice toggle, Live Captions, Transcript History, Indonesian (`ID`) / English (`EN`) switcher, Stop Speaking, and End Session controls.

## 2. Production API Configuration & Cost Controls

To enable live Gemini 3.8 Live voice streaming on Vercel:
1. Add `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables (never commit to Git or `.env` files in repo).
2. Cost & Session Controls built into `api/guide-session.js`:
   - `uses: 1` (single-use ephemeral token)
   - `expireTime`: 15 minutes max session window
   - `newSessionExpireTime`: 2 minutes handshake window
   - `systemInstruction` capped at 8,000 characters; text Q&A capped at 600 input chars / 320 output tokens.
3. Without `GEMINI_API_KEY` set, the guide transparently displays **"Mode Arsip Terverifikasi · Suara Web Speech"** and operates cleanly with zero errors.
