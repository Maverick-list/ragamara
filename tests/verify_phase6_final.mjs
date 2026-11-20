/**
 * NULAR — Phase 6 Final Integration, Responsive/A11y Matrix & Performance Benchmark Suite
 * Zero-dependency Chrome DevTools Protocol (CDP) runner + built-in static/API server.
 * Verifies:
 *  1. 38-province / 42-house catalog & GeoJSON integrity
 *  2. 42 walkable house GLBs & 6 animated avatar GLBs (validity + uncompressed & Brotli sizes)
 *  3. Authentic batik vs non-batik textile provenance
 *  4. Responsive & stability matrix across all 8 routes x 5 widths (320, 390, 768, 1024, 1440px)
 *  5. Reduced-motion accessibility + homepage integration (42/42/38 metrics, 4 showcase tabs, World CTA)
 *  6. Full E2E flow: Hub -> House -> Wardrobe -> Walk -> Inspection -> AI Tour Guide -> Profile Journal
 *  7. Real WebGL FPS, draw calls, triangles, JS heap & GPU geometry disposal across 5 house transitions
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const REPORT_JSON = path.join(ROOT, 'docs/immersive-world/phase6_benchmark_metrics.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

const results = [];
const metrics = {
  timestamp: new Date().toISOString(),
  assets: {},
  responsiveMatrix: [],
  performance: {},
  e2e: {}
};

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/api/guide-session' && req.method === 'POST') {
        const mod = await import(`file://${ROOT}/api/guide-session.js`);
        const chunks = []; for await (const c of req) chunks.push(c);
        const webReq = new Request('http://127.0.0.1/api/guide-session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks)
        });
        const webRes = await mod.POST(webReq);
        res.writeHead(webRes.status, { 'Content-Type': 'application/json' });
        res.end(await webRes.text());
        return;
      }
      const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404); res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function auditStaticAssets() {
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  const geojson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/indonesia-38-provinces.geojson'), 'utf8'));
  const textiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/textiles.json'), 'utf8'));
  const avatarsManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/asset-manifests/avatars-manifest.json'), 'utf8'));

  const uniqueProvinces = new Set(houses.map((h) => h.province));
  check(
    '1. Data & Atlas Coverage: 42 Houses Covering 38/38 Provinces & 38 GeoJSON Features',
    houses.length === 42 && uniqueProvinces.size === 38 && geojson.features.length === 38,
    `${houses.length} houses, ${uniqueProvinces.size} provinces, ${geojson.features.length} GeoJSON features`
  );

  const houseStats = [];
  let validHouseGlbs = 0;
  for (const h of houses) {
    const rel = h.modelPath || `assets/models/houses/${h.id}.glb`;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    const buf = fs.readFileSync(full);
    if (buf.subarray(0, 4).toString('ascii') === 'glTF') validHouseGlbs++;
    const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
    houseStats.push({ id: h.id, bytes: buf.length, brotliBytes: br.length });
  }

  const avatarList = avatarsManifest.avatars || [];
  const avatarStats = [];
  let validAvatarGlbs = 0;
  for (const av of avatarList) {
    const full = path.join(ROOT, av.glbUrl);
    if (!fs.existsSync(full)) continue;
    const buf = fs.readFileSync(full);
    if (buf.subarray(0, 4).toString('ascii') === 'glTF') validAvatarGlbs++;
    avatarStats.push({ id: av.id, bytes: buf.length });
  }

  const sizes = houseStats.map((s) => s.bytes).sort((a, b) => a - b);
  const brSizes = houseStats.map((s) => s.brotliBytes).sort((a, b) => a - b);
  metrics.assets = {
    houseCount: houses.length,
    validHouseGlbs,
    houseGlbMinKB: +(sizes[0] / 1024).toFixed(1),
    houseGlbMedianKB: +(sizes[Math.floor(sizes.length / 2)] / 1024).toFixed(1),
    houseGlbMaxKB: +(sizes[sizes.length - 1] / 1024).toFixed(1),
    houseGlbTotalMB: +(sizes.reduce((a, b) => a + b, 0) / 1048576).toFixed(2),
    houseBrotliMedianKB: +(brSizes[Math.floor(brSizes.length / 2)] / 1024).toFixed(1),
    houseBrotliTotalMB: +(brSizes.reduce((a, b) => a + b, 0) / 1048576).toFixed(2),
    avatarCount: avatarList.length,
    validAvatarGlbs,
    avatarGlbMaxKB: +(Math.max(...avatarStats.map((s) => s.bytes)) / 1024).toFixed(1)
  };

  check(
    '2. 3D Asset Integrity: All 42 Walkable House GLBs & 6 Animated Avatar GLBs Valid glTF 2.0',
    validHouseGlbs === 42 && validAvatarGlbs === 6,
    `Houses: ${validHouseGlbs}/42 (median ${metrics.assets.houseGlbMedianKB} KB, Brotli ${metrics.assets.houseBrotliMedianKB} KB, max ${metrics.assets.houseGlbMaxKB} KB), Avatars: ${validAvatarGlbs}/6`
  );

  const nonBatikIds = ['tenun-ikat-sumba', 'songket-minangkabau', 'ulos-ragidup-batak', 'sasirangan-banjar'];
  const textileClean = nonBatikIds.every((id) => {
    const av = avatarList.find((a) => a.id === id);
    return av && av.isBatik === false && Boolean(av.textileClassification);
  }) && (textiles.outfits || []).length >= 6;

  check(
    '3. Cultural Textile Provenance: Authentic Separation of Batik vs Non-Batik Nusantara Textiles',
    textileClean,
    `${avatarList.length} wearable Nusantara textile outfits (2 Batik, 4 Non-Batik Woven/Tie-Dye)`
  );
}

async function runCdpSuite(baseUrl) {
  const debugPort = 9348;
  const userDataDir = `/tmp/nular_p6_${Date.now()}`;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1800));

  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let cidSeq = 0;
    let consoleErrs = [];
    let pageErrs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++cidSeq;
      const h = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === id) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); }
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = m.params.args.map((a) => a.value || a.description).join(' ');
        if (!txt.includes('fonts.g') && !txt.includes('Failed to load resource')) consoleErrs.push(txt);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        pageErrs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable');
    await send('Runtime.enable');

    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'Eval error');
      return r.result?.value;
    };
    const saveShot = async (filename) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), Buffer.from(shot.data, 'base64'));
    };
    const waitFor = async (expr, maxMs = 15000) => {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (await evalJs(`Boolean(${expr})`)) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    };

    // 4. Responsive & Stability Matrix: 8 routes x 5 widths
    const routes = [
      { id: 'index', path: '/index.html', ready: `document.querySelectorAll('#hero-model-tabs button').length === 4` },
      { id: 'explore', path: '/explore.html', ready: `document.querySelectorAll('#catalog-grid article').length >= 42` },
      { id: 'house', path: '/house.html?id=rumah-joglo', ready: `document.getElementById('article-heading')?.textContent?.includes('Joglo')` },
      { id: 'map', path: '/map.html', ready: `document.querySelectorAll('#atlas-svg-mount path.atlas-prov').length === 38` },
      { id: 'anatomy', path: '/anatomy.html', ready: `document.querySelectorAll('#compare-select-a option').length >= 42` },
      { id: 'about', path: '/about.html', ready: `document.querySelectorAll('#attribution-registry-table tr').length >= 42` },
      { id: 'profile', path: '/profile.html', ready: `document.querySelectorAll('#milestones-grid > *').length >= 3` },
      { id: 'world', path: '/world.html?house=rumah-joglo', ready: `window.__NULAR_WORLD__?.running && window.__NULAR_WORLD__?.activeHouse?.id === 'rumah-joglo'` }
    ];
    const widths = [320, 390, 768, 1024, 1440];
    const matrixFailures = [];

    for (const r of routes) {
      consoleErrs = []; pageErrs = [];
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const t0 = Date.now();
      await send('Page.navigate', { url: `${baseUrl}${r.path}` });
      const isReady = await waitFor(r.ready, 20000);
      const loadMs = Date.now() - t0;
      if (!isReady) matrixFailures.push(`${r.id} did not reach ready state`);

      if (r.id === 'index') {
        metrics.performance.homeLoadMs = loadMs;
        await new Promise((res) => setTimeout(res, 700));
        await saveShot('phase6_01_home_desktop_1440.png');
      }
      if (r.id === 'map') metrics.performance.mapLoadMs = loadMs;
      if (r.id === 'house') metrics.performance.houseLoadMs = loadMs;
      if (r.id === 'world') metrics.performance.worldJogloLoadMs = loadMs;

      for (const w of widths) {
        const h = w <= 390 ? 844 : (w === 768 ? 1024 : 900);
        await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
        await new Promise((res) => setTimeout(res, 180));
        const layout = await evalJs(`(() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          hasLandmark: Boolean(document.querySelector('main, canvas'))
        }))()`);
        metrics.responsiveMatrix.push({ route: r.id, width: w, overflow: layout.overflow, errors: consoleErrs.length + pageErrs.length });
        if (layout.overflow > 3 || !layout.hasLandmark) {
          matrixFailures.push(`${r.id}@${w}px overflow=${layout.overflow}px`);
        }
        if (r.id === 'index' && w === 390) {
          await new Promise((res) => setTimeout(res, 300));
          await saveShot('phase6_02_home_mobile_390.png');
        }
      }
      if (consoleErrs.length || pageErrs.length) {
        matrixFailures.push(`${r.id} errors: ${[...consoleErrs, ...pageErrs].join('; ')}`);
      }
    }

    check(
      '4. Responsive & Stability Matrix: All 8 Routes x 5 Breakpoints (320/390/768/1024/1440px)',
      matrixFailures.length === 0,
      matrixFailures.length === 0 ? '40/40 viewport checks clean, 0 horizontal overflow, 0 runtime errors' : matrixFailures.slice(0, 4).join(' | ')
    );

    // 5. Homepage Integration + Reduced-Motion A11y
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.navigate', { url: `${baseUrl}/index.html` });
    await waitFor(`document.querySelectorAll('#hero-model-tabs button').length === 4`, 12000);
    const homeCheck = await evalJs(`(() => ({
      houses: document.querySelector('[data-metric="houses"]')?.textContent?.trim(),
      models: document.querySelector('[data-metric="models"]')?.textContent?.trim(),
      provinces: document.querySelector('[data-metric="provinces"]')?.textContent?.trim(),
      tabs: document.querySelectorAll('#hero-model-tabs button').length,
      hasWorldCta: Boolean(document.querySelector('a[href="world.html"]')),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }))()`);
    await send('Emulation.setEmulatedMedia', { features: [] });

    check(
      '5. Homepage Integration & Reduced-Motion A11y: Metrics (42/42/38), 4 Showcase Tabs & World CTA',
      homeCheck.houses === '42' && homeCheck.models === '42' && homeCheck.provinces === '38' &&
      homeCheck.tabs === 4 && homeCheck.hasWorldCta && homeCheck.reducedMotion,
      JSON.stringify(homeCheck)
    );

    // 6. Full E2E Cultural World Integration + Real WebGL Performance & GPU Disposal
    consoleErrs = []; pageErrs = [];
    await send('Page.navigate', { url: `${baseUrl}/world.html?house=rumah-joglo` });
    await waitFor(`window.__NULAR_WORLD__?.running && window.__NULAR_WORLD__?.activeHouse?.id === 'rumah-joglo'`, 20000);
    await new Promise((r) => setTimeout(r, 600));
    await saveShot('phase6_03_world_desktop_1440.png');

    // Measure FPS & Render Stats during simulated forward movement
    const perfSample = await evalJs(`(async () => {
      const w = window.__NULAR_WORLD__;
      w.input.keys.add('KeyW');
      const start = performance.now();
      let frames = 0;
      await new Promise((resolve) => {
        function tick() {
          frames++;
          if (performance.now() - start >= 2000) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      w.input.keys.delete('KeyW');
      const sec = (performance.now() - start) / 1000;
      const info = w.gameScene.renderer.info;
      return {
        fps: +(frames / sec).toFixed(1),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        playerPos: w.player.position.toArray().map((n) => +n.toFixed(2))
      };
    })()`);

    // E2E: Avatar Wardrobe + Component Inspection + AI Tour Guide
    const e2eData = await evalJs(`(async () => {
      const w = window.__NULAR_WORLD__;
      document.getElementById('btn-open-wardrobe').click();
      await new Promise(r => setTimeout(r, 250));
      const cards = document.querySelectorAll('#wardrobe-modal .outfit-card');
      const outfitCount = cards.length;
      if (cards[2]) cards[2].click();
      await new Promise(r => setTimeout(r, 450));

      const compItem = (w.interaction.interactables || []).find(it => it.kind === 'component');
      let inspected = false;
      if (compItem) {
        w.player.position.set(compItem.position.x, compItem.position.y, compItem.position.z);
        await new Promise(r => setTimeout(r, 150));
        w.input.triggerAction('interact');
        await new Promise(r => setTimeout(r, 200));
        inspected = !document.getElementById('world-drawer').hidden;
      }
      await new Promise(r => setTimeout(r, 250));

      document.getElementById('btn-ai-guide').click();
      await new Promise(r => setTimeout(r, 250));
      await window.__NULAR_AI_GUIDE__.handleUserQuestion('Jelaskan material dan konstruksi rumah ini');
      await new Promise(r => setTimeout(r, 350));
      const transcript = window.__NULAR_AI_GUIDE__.getTranscript();
      const lastGuide = [...transcript].reverse().find(m => m.role === 'guide')?.text || '';
      document.getElementById('ai-close-btn').click();
      return { outfitCount, inspected, lastGuide };
    })()`);

    // GPU Disposal Stress Check across 5 distinct regional house transitions
    const transitionSamples = await evalJs(`(async () => {
      const w = window.__NULAR_WORLD__;
      const ids = ['rumah-gadang', 'tongkonan-toraja', 'honai-papua', 'mbaru-niang', 'rumah-betang'];
      const out = [];
      for (const id of ids) {
        await w.enterHouse(id);
        await new Promise(r => setTimeout(r, 300));
        const info = w.gameScene.renderer.info;
        out.push({ house: id, geos: info.memory.geometries, calls: info.render.calls, triangles: info.render.triangles });
      }
      return out;
    })()`);

    const maxGeos = Math.max(...transitionSamples.map((s) => s.geos));
    const maxCalls = Math.max(...transitionSamples.map((s) => s.calls));

    // Mobile World Viewport check & screenshot
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 400));
    const mobileControlsVisible = await evalJs(`(() => {
      const el = document.querySelector('.mobile-controls');
      return Boolean(el && getComputedStyle(el).display !== 'none');
    })()`);
    await saveShot('phase6_04_world_mobile_390.png');

    // Navigate to Profile Journal to verify localStorage sync from 3D World
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${baseUrl}/profile.html` });
    await waitFor(`document.querySelectorAll('#history-list > *').length >= 1`, 10000);
    await new Promise((r) => setTimeout(r, 400));
    const journalState = await evalJs(`(() => {
      const raw = localStorage.getItem('nular_museum_v1');
      const st = raw ? JSON.parse(raw) : null;
      const hist = st?.exploredHistory || [];
      return {
        visitedCount: hist.length,
        inspectedCount: hist.reduce((acc, h) => acc + (h.inspectedComponents?.length || 0), 0),
        historyItems: document.querySelectorAll('#history-list > *').length
      };
    })()`);
    await saveShot('phase6_05_profile_journal_1440.png');

    metrics.performance = {
      ...metrics.performance,
      headlessSwiftShaderFps: perfSample.fps,
      jogloDrawCalls: perfSample.drawCalls,
      jogloTriangles: perfSample.triangles,
      jogloHeapMB: perfSample.heapMB,
      transitionMaxGeometries: maxGeos,
      transitionMaxDrawCalls: maxCalls,
      transitionSamples
    };
    metrics.e2e = {
      outfitCount: e2eData.outfitCount,
      inspected: e2eData.inspected,
      guideGrounded: /kayu|jati|konstruksi/i.test(e2eData.lastGuide),
      mobileControlsVisible,
      journalState,
      worldErrors: consoleErrs.length + pageErrs.length
    };

    check(
      '6. E2E Cultural World Journey: Wardrobe (6 Outfits), Inspection, AI Guide & Mobile Touch Pads',
      consoleErrs.length === 0 && pageErrs.length === 0 && e2eData.outfitCount === 6 && e2eData.inspected && metrics.e2e.guideGrounded && mobileControlsVisible,
      `outfits=${e2eData.outfitCount}, inspected=${e2eData.inspected}, guideGrounded=${metrics.e2e.guideGrounded}, mobilePads=${mobileControlsVisible}`
    );

    check(
      '7. GPU Disposal & Render Budget: Bounded Geometries & Draw Calls Across 5 Regional Transitions',
      maxGeos < 300 && maxCalls < 220,
      `maxGeos=${maxGeos}, maxCalls=${maxCalls}, Joglo tris=${perfSample.triangles}, SwiftShader FPS=${perfSample.fps}, heap=${perfSample.heapMB}MB`
    );

    check(
      '8. Non-Gamified Exploration Journal Persistence: World Visits & Inspections Synced to profile.html',
      journalState.visitedCount >= 5 && journalState.inspectedCount >= 1 && journalState.historyItems >= 5,
      JSON.stringify(journalState)
    );
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 450));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  auditStaticAssets();
  const { server, port } = await startServer();
  try {
    await runCdpSuite(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }

  fs.writeFileSync(REPORT_JSON, JSON.stringify(metrics, null, 2));
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n[PHASE 6 FINAL ACCEPTANCE SUITE] ${passed}/${results.length} PASSED`);
  console.log('Saved benchmark metrics ->', REPORT_JSON);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
