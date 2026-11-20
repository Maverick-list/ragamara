/**
 * NULAR AI House Tour Guide — GeminiLiveClient (js/ai-guide/GeminiLiveClient.js)
 * Connects to Gemini 3.8 Live over WebSockets using a server-minted ephemeral token
 * from /api/guide-session (NEVER receives a permanent Google API key).
 *
 * Protocol compliance (gemini-live-api-dev):
 * - Uses realtimeInput.{audio, text, audioStreamEnd} (never deprecated media field)
 * - Processes ALL parts in each serverContent.modelTurn event
 * - Handles serverContent.interrupted === true cleanly by clearing audio queue
 */

export class GeminiLiveClient {
  constructor({ onAudioChunk, onInputTranscript, onOutputTranscript, onInterrupted, onStatusChange }) {
    this.onAudioChunk = onAudioChunk;
    this.onInputTranscript = onInputTranscript;
    this.onOutputTranscript = onOutputTranscript;
    this.onInterrupted = onInterrupted;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.connected = false;
  }

  async connect({ wsEndpoint, ephemeralToken, model, systemInstruction }) {
    this.disconnect();
    const url = `${wsEndpoint}?access_token=${encodeURIComponent(ephemeralToken)}`;

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Gemini Live WebSocket connection timed out'));
      }, 9000);

      ws.onopen = () => {
        clearTimeout(timer);
        this.connected = true;
        ws.send(JSON.stringify({
          setup: {
            model,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        }));
        this.onStatusChange?.('gemini-live-connected');
        resolve();
      };

      ws.onmessage = async (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : await event.data.text();
          const msg = JSON.parse(raw);
          const sc = msg.serverContent;
          if (!sc) return;

          if (sc.interrupted === true) {
            this.onInterrupted?.();
          }
          if (sc.inputTranscription?.text) {
            this.onInputTranscript?.(sc.inputTranscription.text);
          }
          if (sc.outputTranscription?.text) {
            this.onOutputTranscript?.(sc.outputTranscription.text);
          }
          if (sc.modelTurn?.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData?.data) {
                this.onAudioChunk?.(part.inlineData.data);
              } else if (part.text) {
                this.onOutputTranscript?.(part.text);
              }
            }
          }
        } catch { /* ignore non-JSON frames */ }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        this.connected = false;
        this.onStatusChange?.('error');
        reject(new Error('Gemini Live WebSocket error'));
      };

      ws.onclose = () => {
        this.connected = false;
        this.onStatusChange?.('closed');
      };
    });
  }

  sendAudioChunk(base64Pcm16k) {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Pcm16k
        }
      }
    }));
  }

  sendAudioStreamEnd() {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  sendText(text) {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ realtimeInput: { text } }));
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.connected = false;
  }
}
