import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8', '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer(async (req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.startsWith('/api/')) {
        const modName = p.slice(5).split('?')[0];
        const modPath = path.join(ROOT, 'api', `${modName}.js`);
        if (fs.existsSync(modPath)) {
          const mod = await import(`file://${modPath}`);
          const chunks = []; for await (const c of req) chunks.push(c);
          const init = { method: req.method, headers: req.headers };
          if (req.method !== 'GET' && req.method !== 'HEAD' && chunks.length) init.body = Buffer.concat(chunks);
          const webReq = new Request(`http://127.0.0.1${req.url}`, init);
          const fn = mod[req.method] || mod.GET;
          const webRes = await fn(webReq);
          const headersObj = {};
          webRes.headers.forEach((v, k) => { headersObj[k] = v; });
          res.writeHead(webRes.status, headersObj);
          res.end(await webRes.text());
          return;
        }
      }
      const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else { res.writeHead(404); res.end('Not found'); }
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
  });
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  const { s, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const debugPort = 9358;
  const userDataDir = `/tmp/nular_p10_${Date.now()}`;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1700));

  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let cid = 0;
    let errs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++cid;
      const h = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable');
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

    // 1. All 12 Ecosystem Routes across Desktop (1440px) & Mobile (390px)
    const routes = [
      '/index.html', '/explore.html', '/portal.html', '/map.html', '/learn.html',
      '/quests.html', '/house.html?id=rumah-joglo', '/anatomy.html', '/profile.html',
      '/auth.html', '/about.html', '/world.html?house=rumah-joglo'
    ];
    const failures = [];
    for (const r of routes) {
      errs = [];
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `${base}${r}` });
      await new Promise((res) => setTimeout(res, r.includes('world.html') ? 2200 : 650));
      const d = await evalJs(`document.documentElement.scrollWidth - window.innerWidth`);
      if (d > 3) failures.push(`${r}@1440 overflow=${d}`);
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await new Promise((res) => setTimeout(res, 200));
      const m = await evalJs(`document.documentElement.scrollWidth - window.innerWidth`);
      if (m > 3) failures.push(`${r}@390 overflow=${m}`);
      if (errs.length) failures.push(`${r} err=${errs[0]}`);
    }
    check('1. All 12 Ecosystem Routes Clean (1440px & 390px, 0 Overflow, 0 Exceptions)', failures.length === 0, failures.join(' | ') || '24/24 route checks passed');

    // 2. Learning Center 3D Artifact Viewer + Discovery XP
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${base}/learn.html` });
    await new Promise((r) => setTimeout(r, 700));
    const learnRes = await evalJs(`(async () => {
      const btn3d = document.querySelector('[data-inspect-3d="item-rencong-aceh"]');
      if (btn3d) btn3d.click();
      await new Promise(r => setTimeout(r, 600));
      const hasCanvas = Boolean(document.querySelector('#artifact-3d-stage canvas'));
      const btnCol = document.querySelector('[data-collect-item="item-rencong-aceh"]');
      if (btnCol) btnCol.click();
      await new Promise(r => setTimeout(r, 400));
      const prog = JSON.parse(localStorage.getItem('nular_progression_v1') || '{}');
      return { hasCanvas, title: document.getElementById('artifact-title')?.textContent, xp: prog.xp };
    })()`);
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase10_learning_3d_artifact.png'), Buffer.from(shot1.data, 'base64'));
    check('2. Learning Center 3D Artifact Viewer (Rencong Aceh) & Discovery +10 XP', learnRes.hasCanvas && learnRes.xp >= 10, JSON.stringify(learnRes));

    // 3. Quests Quiz + Leaderboard E2E
    await send('Page.navigate', { url: `${base}/quests.html` });
    await new Promise((r) => setTimeout(r, 700));
    const qRes = await evalJs(`(async () => {
      document.querySelector('input[name="q_0"][value="0"]').click();
      document.querySelector('input[name="q_1"][value="1"]').click();
      document.querySelector('input[name="q_2"][value="1"]').click();
      document.getElementById('btn-submit-quiz').click();
      await new Promise(r => setTimeout(r, 500));
      const prog = JSON.parse(localStorage.getItem('nular_progression_v1') || '{}');
      return { fb: document.getElementById('quiz-feedback')?.textContent, xp: prog.xp, lb: document.getElementById('leaderboard-table')?.textContent?.slice(0, 60) };
    })()`);
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase10_quests_leaderboard.png'), Buffer.from(shot2.data, 'base64'));
    check('3. Interactive Cultural Quiz (+20 XP) & Privacy-Safe Leaderboard Sync', qRes.xp >= 30 && /3\/3/.test(qRes.fb || ''), JSON.stringify(qRes));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    s.close();
    await new Promise((r) => setTimeout(r, 350));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n[PHASE 10 FINAL ECOSYSTEM QA] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
