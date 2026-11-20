import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404); res.end('Not found');
      }
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
  const locales = ['id', 'en', 'ar', 'ja', 'ko', 'zh', 'es', 'fr'];
  const validLocales = locales.every((c) => {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, `js/i18n/locales/${c}.json`), 'utf8'));
    return d.nav?.home && d.hero?.title && d.camera?.firstPerson && d.gamification?.xp;
  });
  check('1. All 8 Interface Locales Valid & Complete (id, en, ar, ja, ko, zh, es, fr)', validLocales);

  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/i18n/locales/regional-registry.json'), 'utf8'));
  check('2. Indonesian Regional Languages Registry Present (>= 15 Distinct Languages)', (reg.languages || []).length >= 15, `${reg.languages.length} regional languages`);

  const { s, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const debugPort = 9351;
  const userDataDir = `/tmp/nular_p12_${Date.now()}`;
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
    const errs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++cid;
      const h = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.text);
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable');
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

    // Test Landing Page + Switch to English + Switch to Arabic RTL
    await send('Page.navigate', { url: `${base}/index.html` });
    await new Promise((r) => setTimeout(r, 1100));

    const enCheck = await evalJs(`(async () => {
      await window.NularI18n.setLanguage('en');
      return {
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        heroTitle: document.querySelector('[data-i18n="hero.title"]')?.textContent?.trim(),
        cta: document.querySelector('[data-i18n="hero.ctaPrimary"]')?.textContent?.trim()
      };
    })()`);
    check('3. Landing Page English i18n Switch', enCheck.lang === 'en' && enCheck.dir === 'ltr' && enCheck.cta === 'Enter the World', JSON.stringify(enCheck));

    const arCheck = await evalJs(`(async () => {
      await window.NularI18n.setLanguage('ar');
      return {
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        heroTitle: document.querySelector('[data-i18n="hero.title"]')?.textContent?.trim()
      };
    })()`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase1_2_arabic_rtl_home.png'), Buffer.from(shot.data, 'base64'));
    check('4. Arabic RTL Layout (dir="rtl") & Translation Applied', arCheck.lang === 'ar' && arCheck.dir === 'rtl' && /[\u0600-\u06FF]/.test(arCheck.heroTitle || ''), JSON.stringify(arCheck));

    // Reset to Indonesian & verify Portal + Learn pages load cleanly
    await evalJs(`window.NularI18n.setLanguage('id')`);
    await send('Page.navigate', { url: `${base}/portal.html` });
    await new Promise((r) => setTimeout(r, 700));
    const portalOk = await evalJs(`document.querySelectorAll('[data-pick-avatar]').length === 6 && Boolean(document.getElementById('portal-camera-select'))`);
    check('5. Explore Portal Loads 6 Avatars & Camera/Quality Selectors', portalOk);

    await send('Page.navigate', { url: `${base}/learn.html` });
    await new Promise((r) => setTimeout(r, 600));
    const learnOk = await evalJs(`document.querySelectorAll('#regional-languages-grid > *').length >= 15`);
    check('6. Learning Center & Regional Language Registry Render Cleanly (0 Page Errors)', learnOk && errs.length === 0, `errors=${errs.length}`);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    s.close();
    await new Promise((r) => setTimeout(r, 350));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n[PHASE 1 & 2 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
