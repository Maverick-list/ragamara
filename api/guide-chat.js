/**
 * NULAR — AI House Tour Guide Grounded Text Q&A Fallback (api/guide-chat.js)
 * Vercel Node.js Function (Fluid Compute) — Strictly server-side API key usage.
 */

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 600) : '';
    const systemInstruction = typeof body.systemInstruction === 'string' ? body.systemInstruction.slice(0, 8000) : '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!question) {
      return Response.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!apiKey) {
      return Response.json({
        mode: 'curated-local',
        answer: null,
        reason: 'GEMINI_API_KEY not configured on server'
      }, { status: 200 });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 320
          }
        })
      }
    );

    if (!res.ok) {
      console.error('[NULAR AI Guide] Text fallback API error:', res.status);
      return Response.json({ mode: 'curated-local', answer: null }, { status: 200 });
    }

    const json = await res.json();
    const answer = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || null;
    return Response.json({ mode: 'gemini-text', answer }, { status: 200 });
  } catch (err) {
    console.error('[NULAR AI Guide] Chat endpoint error:', err);
    return Response.json({ mode: 'curated-local', answer: null }, { status: 200 });
  }
}
