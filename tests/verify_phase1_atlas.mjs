import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = (req.url || '/').split('?')[0];
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
  const rec = (name, ok, details = {}) => {
    results.push({ name, ok, details });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`, ok ? '' : JSON.stringify(details));
  };

  // --- PART A: DATA VALIDATION ---
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/provinces.json'), 'utf8'));
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/indonesia-38-provinces.geojson'), 'utf8'));
  const textiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/textiles.json'), 'utf8'));

  const all38 = provinces.islands.flatMap((i) => i.provinces);
  const covered = new Set(houses.map((h) => h.province));
  rec('1. Data: 38/38 Provinces Covered in houses.json', all38.every((p) => covered.has(p)), { total: houses.length, covered: covered.size });
  rec('2. Data: GeoJSON Contains Exactly 38 Province Features', geo.features?.length === 38, { features: geo.features?.length });

  const articleKeys = [
    'historicalOrigins', 'culturalAndCommunityContext', 'architecturalIdentity', 'structuralSystem',
    'interiorAndSpatialOrganization', 'materialAndConstruction', 'climateAdaptation',
    'culturalMeaning', 'preservationAndContemporaryRelevance', 'referencesSummary'
  ];
  const badArticles = houses.filter((h) => !h.article || articleKeys.some((k) => !h.article[k]));
  rec('3. Data: All 42 Houses Have Complete 10-Section Research Articles', badArticles.length === 0, { missing: badArticles.map((h) => h.id) });

  const missingPhotos = houses.filter((h) => !h.referenceImages?.[0]?.url || !fs.existsSync(path.join(ROOT, h.referenceImages[0].url)));
  rec('4. Data: All 42 Houses Have Valid On-Disk Hero Images', missingPhotos.length === 0, { missing: missingPhotos.map((h) => h.id) });

  const nonBatikAccurate = textiles.outfits.filter((o) => !o.isBatik).every((o) => /bukan batik/i.test(o.textileClassification));
  rec('5. Data: Textile Registry Separates Batik vs Non-Batik Authentically', textiles.outfits.length >= 6 && nonBatikAccurate);

  // --- PART B: VISUAL BROWSER TEST ---
  const { server, port } = await startServer();
  const BASE = `http://127.0.0.1:${port}`;
  const debugPort = 9371;
  const userDataDir = `/tmp/chrome_p1_${Date.now()}`;
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);

  await new Promise((r) => setTimeout(r, 1800));
  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let id = 0;
    const consoleErrs = [], pageErrs = [], httpErrs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const cid = ++id;
      const h = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === cid) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); }
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrs.push(m.params.args.map((a) => a.value || a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') pageErrs.push(m.params.exceptionDetails?.text);
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && m.params.response.url.includes('127.0.0.1')) {
        httpErrs.push({ status: m.params.response.status, url: m.params.response.url });
      }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

    // Desktop Atlas (1440x900)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${BASE}/map.html` });
    await new Promise((r) => setTimeout(r, 2000));

    const atlasCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const paths = document.querySelectorAll('.atlas-prov').length;
        const dirChips = document.querySelectorAll('.atlas-dir-chip').length;
        // Click Jawa Timur
        document.querySelector('[data-select-province="Jawa Timur"]')?.click();
        const jatimText = document.getElementById('panel-region-body')?.innerText || '';
        // Click Papua Barat Daya
        document.querySelector('[data-select-province="Papua Barat Daya"]')?.click();
        const pbdText = document.getElementById('panel-region-body')?.innerText || '';
        return { paths, dirChips, hasOsing: jatimText.includes('Osing'), hasKambik: pbdText.includes('Kambik') };
      })()`,
      returnByValue: true
    });
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase1_01_living_atlas_38_provinces.png'), Buffer.from(shot1.data, 'base64'));
    const av = atlasCheck.result?.value;
    rec('6. Browser: 38-Province GeoJSON Living Atlas Renders & Interactive Dossiers Work',
      av?.paths === 38 && av?.dirChips === 38 && av?.hasOsing && av?.hasKambik, av);

    // Mobile Atlas (390x844)
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 600));
    const mobOv = await send('Runtime.evaluate', { expression: `document.documentElement.scrollWidth <= window.innerWidth + 2`, returnByValue: true });
    rec('7. Browser: Living Atlas Mobile Responsive (390x844, Zero Overflow)', mobOv.result?.value === true);

    // Explore Catalog (42 cards + 0 broken images)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${BASE}/explore.html` });
    await new Promise((r) => setTimeout(r, 2000));
    const exp = await send('Runtime.evaluate', {
      expression: `(() => {
        const cards = document.querySelectorAll('#catalog-grid .house-card').length;
        const imgs = [...document.querySelectorAll('#catalog-grid img')];
        const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
        return { cards, brokenCount: broken.length, broken };
      })()`,
      returnByValue: true
    });
    rec('8. Browser: Explore Catalog Renders All 42 Houses with Zero Broken Images',
      exp.result?.value?.cards === 42 && exp.result?.value?.brokenCount === 0, exp.result?.value);

    // House 10-Section Research Article (Rumah Osing)
    await send('Page.navigate', { url: `${BASE}/house.html?id=rumah-osing` });
    await new Promise((r) => setTimeout(r, 1500));
    const art = await send('Runtime.evaluate', {
      expression: `(() => ({
        chapters: document.querySelectorAll('.article-chapter').length,
        hasWorldBtn: !!document.querySelector('a[href^="world.html?house=rumah-osing"]')
      }))()`,
      returnByValue: true
    });
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase1_02_osing_10_section_article.png'), Buffer.from(shot2.data, 'base64'));
    rec('9. Browser: House Page Renders Full 10-Section Article & Enter 3D World CTA',
      art.result?.value?.chapters === 10 && art.result?.value?.hasWorldBtn, art.result?.value);

    rec('10. Browser: Zero Console, Page, or HTTP 4xx/5xx Errors',
      consoleErrs.length === 0 && pageErrs.length === 0 && httpErrs.length === 0,
      { consoleErrs, pageErrs, httpErrs });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[PHASE 1 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
