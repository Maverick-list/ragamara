/**
 * Vercel Node.js Function: POST/GET /api/tts
 * Neural Indonesian Text-to-Speech backend adapter.
 * Keeps all TTS API secrets strictly server-side.
 * Returns honest { configured: false, fallback: 'browser_speech_synthesis' } when
 * ELEVENLABS_API_KEY or GOOGLE_TTS_API_KEY is not configured.
 */

export async function GET() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY || process.env.GOOGLE_TTS_API_KEY);
  const provider = process.env.ELEVENLABS_API_KEY
    ? 'elevenlabs'
    : (process.env.GOOGLE_TTS_API_KEY ? 'google_cloud_tts' : 'none');

  return Response.json({
    configured,
    provider,
    fallback: 'browser_speech_synthesis',
    language: 'id-ID'
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim().slice(0, 600);
  if (!text) {
    return Response.json({ error: 'Teks narasi diperlukan.' }, { status: 400 });
  }

  const googleKey = process.env.GOOGLE_TTS_API_KEY;
  if (googleKey) {
    try {
      const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(googleKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'id-ID', name: 'id-ID-Wavenet-A' },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        return Response.json({
          configured: true,
          provider: 'google_cloud_tts',
          audioBase64: data.audioContent,
          mimeType: 'audio/mpeg'
        });
      }
    } catch {}
  }

  return Response.json({
    configured: false,
    provider: 'none',
    fallback: 'browser_speech_synthesis',
    notice: 'Neural TTS belum terkonfigurasi pada server. Menggunakan suara peramban (Web SpeechSynthesis) sebagai fallback.'
  }, { status: 503 });
}
