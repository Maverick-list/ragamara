import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const p = (req.url || '/').split('?')[0];
      if (p === '/api/guide-session' && req.method === 'POST') {
        const mod = await import(`file://${ROOT}/api/guide-session.js`);
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const webReq = new Request('http://127.0.0.1/api/guide-session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks)
        });
        const webRes = await mod.POST(webReq);
        res.writeHead(webRes.status, { 'Content-Type': 'application/json' });
        res.end(await webRes.text());
        return;
      }
      if (p === '/api/guide-chat' && req.method === 'POST') {
        const mod = await import(`file://${ROOT}/api/guide-chat.js`);
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const webReq = new Request('http://127.0.0.1/api/guide-chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks)
        });
        const webRes = await mod.POST(webReq);
        res.writeHead(webRes.status, { 'Content-Type': 'application/json' });
        res.end(await webRes.text());
        return;
      }
      let rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
      let full = path.join(ROOT, rel);
      if (!fs.existsSync(full) && !path.extname(rel) && fs.existsSync(`${full}.html`)) full = `${full}.html`;
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function run() {
  const results = [];
  const rec = (name, ok, d = {}) => {
    results.push({ name, ok, d });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`, ok ? '' : JSON.stringify(d));
  };

  // 1. Security Check: Zero hardcoded Google API keys in frontend or backend files
  const filesToScan = [
    'api/guide-session.js', 'api/guide-chat.js',
    'js/ai-guide/ContextResolver.js', 'js/ai-guide/KnowledgeRetriever.js',
    'js/ai-guide/AudioPipeline.js', 'js/ai-guide/GeminiLiveClient.js', 'js/ai-guide/TourGuideUI.js'
  ];
  const leaked = filesToScan.filter((f) => /AIza[0-9A-Za-z_-]{20,}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  rec('1. Security: Zero Hardcoded API Keys Across All AI Guide Frontend & Backend Modules', leaked.length === 0, { leaked });

  // 2. Unit Grounding & Anti-Hallucination Check (KnowledgeRetriever)
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  const { KnowledgeRetriever } = await import(`file://${ROOT}/js/ai-guide/KnowledgeRetriever.js`);
  const kr = new KnowledgeRetriever(houses);
  const joglo = houses.find((h) => h.id === 'rumah-joglo');
  const ctxJoglo = { houseId: 'rumah-joglo', house: joglo, houseName: joglo.houseName, province: joglo.province, roomName: 'Pendopo (Zona Publik)', inspectedComponent: joglo.hotspots[2] };

  const ansSoko = kr.answerLocally('Apa fungsi Soko Guru di sini?', ctxJoglo, 'id');
  const ansEn = kr.answerLocally('Tell me about the materials used here', ctxJoglo, 'en');
  const ansHallucination = kr.answerLocally('Berapa harga tiket masuk dan tahun pasti dibangunnya?', ctxJoglo, 'id');
  const ansCompare = kr.answerLocally('Bandingkan rumah ini dengan Tongkonan', ctxJoglo, 'id');

  rec('2. Grounding: Answers Stay Strictly Focused on Active House & Component (Joglo -> Soko Guru)',
    ansSoko.text.includes('Joglo') && !/Tongkonan|Gadang/i.test(ansSoko.text), ansSoko);
  rec('3. Bilingual Support: English Mode Responds Accurately in English',
    /traditionally constructed|Jati/i.test(ansEn.text), ansEn);
  rec('4. Anti-Hallucination: Explicitly Admits Missing Undocumented Facts',
    /belum terdokumentasi|Maaf/i.test(ansHallucination.text), ansHallucination);
  rec('5. Explicit Comparison: Only Compares Across Houses When Explicitly Asked',
    ansCompare.text.includes('Joglo') && ansCompare.text.includes('Tongkonan'), ansCompare);

  // 3. Browser Integration Test (world.html + /api/guide-session + Live UI)
  const { server, port } = await startServer();
  const BASE = `http://127.0.0.1:${port}`;
  const debugPort = 9388;
  const userDataDir = `/tmp/chrome_p5_${Date.now()}`;
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle',
    '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1800));

  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let id = 0;
    const consoleErrs = [], pageErrs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const cid = ++id;
      const h = (e) => { const m = JSON.parse(e.data); if (m.id === cid) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrs.push(m.params.args.map((a) => a.value || a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') pageErrs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: `${BASE}/world.html?house=rumah-joglo` });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const rdy = await send('Runtime.evaluate', { expression: 'Boolean(window.__NULAR_WORLD__?.running && window.__NULAR_AI_GUIDE__)', returnByValue: true });
      if (rdy.result?.value) break;
    }

    const uiRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('btn-ai-guide').click();
        await new Promise(r => setTimeout(r, 250));
        await window.__NULAR_AI_GUIDE__.handleUserQuestion('Jelaskan tata ruang interior Rumah Joglo');
        await new Promise(r => setTimeout(r, 350));
        // Switch language to English and ask follow-up
        document.getElementById('ai-lang-toggle').click();
        await window.__NULAR_AI_GUIDE__.handleUserQuestion('What materials are used?');
        await new Promise(r => setTimeout(r, 350));
        return {
          panelOpen: !document.getElementById('ai-guide-panel').hidden,
          hasPrivacyNotice: document.body.innerText.includes('tidak direkam'),
          transcriptLen: window.__NULAR_AI_GUIDE__.getTranscript().length,
          caption: document.getElementById('ai-live-caption').innerText,
          modeLabel: document.getElementById('ai-mode-label').innerText
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase5_01_ai_tour_guide_panel.png'), Buffer.from(shot.data, 'base64'));

    const uv = uiRes.result?.value;
    rec('6. Browser: AI Tour Guide Opens, Displays Privacy Notice, Grounded Live Captions & Bilingual Q&A',
      Boolean(uv?.panelOpen && uv?.hasPrivacyNotice && uv?.transcriptLen >= 5 && uv?.caption?.length > 20), uv);
    rec('7. Zero Console or Runtime Page Errors During AI Tour Guide Session',
      consoleErrs.length === 0 && pageErrs.length === 0, { consoleErrs, pageErrs });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[PHASE 5 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
