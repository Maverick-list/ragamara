/**
 * NULAR — AI House Tour Guide Ephemeral Session Service (api/guide-session.js)
 * Vercel Node.js Function (Fluid Compute) — NEVER exposes GEMINI_API_KEY to browser.
 *
 * Mints a single-use, short-lived Gemini 3.8 Live ephemeral auth token constrained to
 * the visitor's current house context & grounded cultural knowledge.
 * Gracefully signals curated-local fallback when GEMINI_API_KEY is not configured.
 */

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'models/gemini-3.8-live';
    const language = body.language === 'en' ? 'en' : 'id';
    const systemInstructionText = typeof body.systemInstruction === 'string'
      ? body.systemInstruction.slice(0, 8000)
      : 'Anda adalah Pemandu Tur Museum Arsitektur Nusantara NULAR.';

    if (!apiKey) {
      return Response.json({
        mode: 'curated-local',
        ephemeralToken: null,
        model,
        language,
        reason: 'GEMINI_API_KEY is not configured on this server environment. Using grounded curated knowledge + Web Speech voice mode.'
      }, { status: 200 });
    }

    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const tokenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uses: 1,
          expireTime,
          newSessionExpireTime,
          bidiGenerateContentSetup: {
            model,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Aoede' }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: systemInstructionText }]
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        })
      }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error('[NULAR AI Guide] Failed to mint Gemini Live ephemeral token:', tokenRes.status, errText.slice(0, 240));
      return Response.json({
        mode: 'curated-local',
        ephemeralToken: null,
        model,
        language,
        reason: `Gemini Live token endpoint returned HTTP ${tokenRes.status}. Falling back cleanly to grounded curated guide.`
      }, { status: 200 });
    }

    const tokenJson = await tokenRes.json();
    return Response.json({
      mode: 'gemini-live',
      ephemeralToken: tokenJson.name,
      wsEndpoint: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
      model,
      language,
      expireTime
    }, { status: 200 });
  } catch (err) {
    console.error('[NULAR AI Guide] Session endpoint error:', err);
    return Response.json({
      mode: 'curated-local',
      ephemeralToken: null,
      reason: 'Server session error; using grounded local knowledge mode.'
    }, { status: 200 });
  }
}
