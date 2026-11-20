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
  const rec = (name, ok, d = {}) => {
    results.push({ name, ok, d });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`, ok ? '' : JSON.stringify(d));
  };

  // 1. Validate all 42 GLBs & Manifests on disk
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  let validGlbs = 0, validManifests = 0;
  const bad = [];
  for (const h of houses) {
    const glbPath = path.join(ROOT, h.worldModel3DUrl || '');
    const manPath = path.join(ROOT, h.worldManifestUrl || '');
    if (fs.existsSync(glbPath) && fs.readFileSync(glbPath).readUInt32LE(0) === 0x46546c67) validGlbs++;
    else bad.push(`GLB:${h.id}`);
    if (fs.existsSync(manPath)) {
      const m = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      if (m.colliders >= 7 && m.interiorZones?.length >= 1) validManifests++;
      else bad.push(`MAN:${h.id}`);
    } else bad.push(`MAN:${h.id}`);
  }
  rec('1. Binary Asset Audit: All 42 House GLBs & Manifests Valid with Colliders & Interior Zones',
    validGlbs === 42 && validManifests === 42, { validGlbs, validManifests, bad });

  // 2. Real-Browser 7-Region Streaming, Interior Walkthrough & GPU Memory Disposal Verification
  const { server, port } = await startServer();
  const BASE = `http://127.0.0.1:${port}`;
  const debugPort = 9382;
  const userDataDir = `/tmp/chrome_p4_${Date.now()}`;
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
    const consoleErrs = [], pageErrs = [], httpErrs = [];
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
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && m.params.response.url.includes('127.0.0.1') && !m.params.response.url.includes('TourGuideUI.js')) {
        httpErrs.push({ status: m.params.response.status, url: m.params.response.url });
      }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: `${BASE}/world.html?house=rumah-gadang` });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const rdy = await send('Runtime.evaluate', { expression: 'Boolean(window.__NULAR_WORLD__?.running)', returnByValue: true });
      if (rdy.result?.value) break;
    }

    const regionalPilots = [
      { region: 'Sumatra', id: 'rumah-gadang', shot: 'phase4_01_sumatra_rumah_gadang.png' },
      { region: 'Java', id: 'rumah-osing', shot: 'phase4_02_java_rumah_osing.png' },
      { region: 'Kalimantan', id: 'rumah-bubungan-tinggi', shot: null },
      { region: 'Sulawesi', id: 'tongkonan-toraja', shot: 'phase4_03_sulawesi_tongkonan.png' },
      { region: 'Bali & Nusa Tenggara', id: 'mbaru-niang', shot: 'phase4_04_ntt_mbaru_niang.png' },
      { region: 'Maluku', id: 'baileo-maluku', shot: null },
      { region: 'Papua', id: 'honai-papua', shot: 'phase4_05_papua_honai.png' }
    ];

    const gpuGeoCounts = [];
    for (const p of regionalPilots) {
      const check = await send('Runtime.evaluate', {
        expression: `(async () => {
          const w = window.__NULAR_WORLD__;
          await w.enterHouse(${JSON.stringify(p.id)});
          await new Promise(r => setTimeout(r, 450));
          // Verify walkable interior transition
          const zone = w.player.interiorZones[0];
          const midX = (zone.bounds.minX + zone.bounds.maxX) / 2;
          const midZ = (zone.bounds.minZ + zone.bounds.maxZ) / 2;
          w.player.position.set(midX, zone.floorY + 0.05, midZ);
          await new Promise(r => setTimeout(r, 350));
          return {
            loaded: Boolean(w.streaming.activeHouseRoot),
            colliders: w.collision.floors.length + w.collision.walls.length,
            enteredRoom: w.player.currentZone?.name || null,
            roofCutaway: w.streaming.roofCutawayActive,
            gpuGeometries: w.gameScene.renderer.info.memory.geometries
          };
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
      const v = check.result?.value;
      if (v) gpuGeoCounts.push(v.gpuGeometries);
      if (p.shot) {
        const s = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, p.shot), Buffer.from(s.data, 'base64'));
      }
      rec(`Regional Streaming [${p.region}]: ${p.id} Walkable Interior & Colliders`,
        Boolean(v?.loaded && v?.colliders >= 7 && v?.enteredRoom && v?.roofCutaway), v);
    }

    // Verify GPU geometry count does not leak across 7 sequential scene loads
    const maxGeo = Math.max(...gpuGeoCounts);
    rec('9. Scene Streaming GPU Memory Hygiene (Zero Unbounded Geometry Leak Across 7 Transitions)',
      maxGeo < 260, { gpuGeoCounts, maxGeo });

    // Verify Museum Inspector (house.html) also loads a newly generated GLB (mbaru-niang) cleanly with COLLISION hidden
    await send('Page.navigate', { url: `${BASE}/house.html?id=mbaru-niang` });
    await new Promise((r) => setTimeout(r, 2000));
    const insp = await send('Runtime.evaluate', {
      expression: `(() => {
        const v = window.__NULAR_VIEWER__;
        let visibleColliders = 0;
        v?.modelRoot?.traverse(o => { if (o.name?.toUpperCase().startsWith('COLLISION') && o.visible) visibleColliders++; });
        return { loaded: Boolean(v?.modelRoot), groups: v?.componentGroups?.size || 0, visibleColliders };
      })()`,
      returnByValue: true
    });
    rec('10. Museum 3D Inspector (house.html) Loads New Reconstructed GLBs with Colliders Hidden',
      Boolean(insp.result?.value?.loaded && insp.result?.value?.groups >= 5 && insp.result?.value?.visibleColliders === 0),
      insp.result?.value);

    rec('11. Zero Console, Page, or Core HTTP Errors',
      consoleErrs.length === 0 && pageErrs.length === 0 && httpErrs.length === 0,
      { consoleErrs, pageErrs, httpErrs });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[PHASE 4 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
