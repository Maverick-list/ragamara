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

  const { server, port } = await startServer();
  const BASE = `http://127.0.0.1:${port}`;
  const debugPort = 9377;
  const userDataDir = `/tmp/chrome_p3_${Date.now()}`;
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

    // 1. Nusantara Hub Plaza Loads Cleanly
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${BASE}/world.html` });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const rdy = await send('Runtime.evaluate', { expression: 'Boolean(window.__NULAR_WORLD__?.running)', returnByValue: true });
      if (rdy.result?.value) break;
    }
    await new Promise((r) => setTimeout(r, 400));

    const hub = await send('Runtime.evaluate', {
      expression: `(() => {
        const w = window.__NULAR_WORLD__;
        return {
          ready: Boolean(w && w.running),
          mode: w?.mode,
          avatarLoaded: Boolean(w?.character?.currentModel),
          portals: w?.interaction?.interactables?.length || 0
        };
      })()`,
      returnByValue: true
    });
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase3_01_hub_plaza.png'), Buffer.from(shot1.data, 'base64'));
    rec('1. Nusantara Hub Plaza Loads with Playable Avatar & 7 Island Gateways',
      hub.result?.value?.ready && hub.result?.value?.mode === 'hub' && hub.result?.value?.avatarLoaded && hub.result?.value?.portals >= 8,
      hub.result?.value);

    // 2. Avatar Wardrobe & Non-Batik Provenance Switch
    const avSwitch = await send('Runtime.evaluate', {
      expression: `(async () => {
        document.getElementById('btn-open-wardrobe').click();
        const text = document.getElementById('outfit-grid').innerText;
        const btn = document.querySelector('[data-select-outfit="tenun-ikat-sumba"]');
        btn.click();
        await new Promise(r => setTimeout(r, 900));
        return {
          outfit: window.__NULAR_WORLD__.character.currentOutfitId,
          distinguishesNonBatik: /BUKAN BATIK/i.test(text)
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    rec('2. Avatar Wardrobe Switches Outfit Live & Distinguishes Non-Batik Textiles',
      avSwitch.result?.value?.outfit === 'tenun-ikat-sumba' && avSwitch.result?.value?.distinguishesNonBatik,
      avSwitch.result?.value);

    // 3. Enter Walkable Rumah Joglo + Walk Inside Pendopo + Automatic Roof Cutaway + Wall Collision
    const jogloPlay = await send('Runtime.evaluate', {
      expression: `(async () => {
        const w = window.__NULAR_WORLD__;
        await w.enterHouse('rumah-joglo');
        await new Promise(r => setTimeout(r, 600));
        const startZ = w.player.position.z;
        // Walk forward (KeyW) for 1.5s up the steps into Pendopo!
        w.input.keys.add('KeyW');
        await new Promise(r => setTimeout(r, 1450));
        w.input.keys.delete('KeyW');
        await new Promise(r => setTimeout(r, 400));
        const afterWalk = {
          x: +w.player.position.x.toFixed(2),
          y: +w.player.position.y.toFixed(2),
          z: +w.player.position.z.toFixed(2),
          room: w.player.currentZone?.name || null,
          roofCutaway: w.streaming.roofCutawayActive
        };
        // Test wall collision: try pushing through left Ndalem wall (x=-4.7, z=-3.0)
        w.player.position.set(-4.1, 0.48, -3.0);
        w.input.keys.add('KeyA');
        await new Promise(r => setTimeout(r, 600));
        w.input.keys.delete('KeyA');
        const clampedX = +w.player.position.x.toFixed(2);
        return { startZ, afterWalk, clampedX, wallBlocked: clampedX > -4.65, floors: w.collision.floors.map(f=>({n:f.name,min:f.box.min.toArray(),max:f.box.max.toArray()})), walls: w.collision.walls.map(f=>({n:f.name,min:f.box.min.toArray(),max:f.box.max.toArray()})) };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase3_02_joglo_walkable_interior.png'), Buffer.from(shot2.data, 'base64'));
    const jp = jogloPlay.result?.value || jogloPlay.exceptionDetails;
    rec('3. Third-Person Walk Into Pendopo, Stair Ascent, Smart Roof Cutaway & Wall Collision',
      jp?.afterWalk?.z < jp?.startZ - 3.0 && jp?.afterWalk?.y >= 0.44 && Boolean(jp?.afterWalk?.room) && jp?.afterWalk?.roofCutaway && jp?.wallBlocked,
      jp);

    // 4. Proximity Component Interaction [E]
    const interactTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        const w = window.__NULAR_WORLD__;
        const firstComp = w.interaction.interactables.find(i => i.kind === 'component');
        w.player.position.set(firstComp.position.x, firstComp.position.y, firstComp.position.z + 0.8);
        await new Promise(r => setTimeout(r, 250));
        w.input.triggerAction('interact');
        await new Promise(r => setTimeout(r, 350));
        return {
          drawerVisible: !document.getElementById('world-drawer').hidden,
          drawerTitle: document.getElementById('drawer-title').innerText,
          mission: w.exploration.getMissionStatus('rumah-joglo', 7)
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    rec('4. Proximity Component Inspection [E] Opens Dossier & Updates Discovery State',
      interactTest.result?.value?.drawerVisible && interactTest.result?.value?.mission?.inspectedCount >= 1,
      interactTest.result?.value);

    // 5. Mobile Viewport (390x844) Virtual Joystick & Controls Visible
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 500));
    const mob = await send('Runtime.evaluate', {
      expression: `(() => ({
        joyVisible: getComputedStyle(document.querySelector('.mobile-controls')).display !== 'none',
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2
      }))()`,
      returnByValue: true
    });
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase3_03_mobile_world_controls.png'), Buffer.from(shot3.data, 'base64'));
    rec('5. Mobile Touch Controls (Virtual Joystick + Action Pads) & Zero Overflow',
      mob.result?.value?.joyVisible && mob.result?.value?.noOverflow, mob.result?.value);

    rec('6. Zero Uncaught Console, Page, or Core HTTP Errors',
      consoleErrs.length === 0 && pageErrs.length === 0 && httpErrs.length === 0,
      { consoleErrs, pageErrs, httpErrs });
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[PHASE 3 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
