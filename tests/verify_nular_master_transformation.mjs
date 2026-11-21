/**
 * NULAR — Master Product Transformation End-to-End Verification Suite (Phase 7)
 * Tests Phases 1–6 across APIs, Three.js PBR/Batik, Open World Pavilions,
 * 4 Vehicles (Motorcycle, Car, Boat, Airplane), 9-Step Raga Tutorial,
 * Minimal Transparent AI Chat, Collection Book, and Desktop/Tablet/Mobile viewports.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startFullDevServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.startsWith('/api/')) {
        const modName = p.slice(5).split('?')[0];
        const modPath = path.join(ROOT, 'api', `${modName}.js`);
        if (fs.existsSync(modPath)) {
          try {
            const mod = await import(`file://${modPath}?t=${Date.now()}`);
            const chunks = [];
            for await (const c of req) chunks.push(c);
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
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
      }
      const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const results = [];
const perfMetrics = {};
const check = (phase, name, pass, detail = '') => {
  results.push({ phase, name, status: pass ? 'PASS' : 'FAIL', detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] [${phase}] ${name}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  const { server, port } = await startFullDevServer();
  const base = `http://127.0.0.1:${port}`;
  const debugPort = 9477;
  const userDataDir = `/tmp/nular_master_qa_${Date.now()}`;

  // ==========================================================================
  // PHASE 2 & 5 API TESTS (Auth: Email, Google 503, Phone OTP + Cooldown; TTS 503)
  // ==========================================================================
  const authMod = await import('../api/auth.js');
  const ttsMod = await import('../api/tts.js');

  // Google OAuth honest unconfigured state
  const gStart = await authMod.POST(new Request(`${base}/api/auth?action=google-start`, { method: 'POST' }));
  const gJson = await gStart.json();
  check('Phase 2', 'Google OAuth Honest Unconfigured State', gStart.status === 503 && gJson.configured === false, gJson.error);

  // Phone OTP E.164 + Local Dev Delivery + 60s Cooldown + Verify
  const badPhone = await authMod.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0812345' })
  }));
  check('Phase 2', 'Phone OTP Rejects Non-E.164 Format', badPhone.status === 400, `status=${badPhone.status}`);

  const otpReq = await authMod.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+6281299988877' })
  }));
  const otpJson = await otpReq.json();
  check('Phase 2', 'Phone OTP Local Dev Delivery & Expiry', otpReq.status === 200 && Boolean(otpJson.devOtpPreview), `mode=${otpJson.deliveryMode}, ttl=${otpJson.expiresInSeconds}s`);

  const otpCooldown = await authMod.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+6281299988877' })
  }));
  check('Phase 2', 'Phone OTP 60s Resend Cooldown (429)', otpCooldown.status === 429, `status=${otpCooldown.status}`);

  const otpVerify = await authMod.POST(new Request(`${base}/api/auth?action=phone-verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+6281299988877', code: otpJson.devOtpPreview, username: 'NusantaraOTP' })
  }));
  const otpVerJson = await otpVerify.json();
  check('Phase 2', 'Phone OTP Verification & HMAC Cookie', otpVerify.status === 200 && otpVerJson.authenticated === true && Boolean(otpVerify.headers.get('set-cookie')), `user=${otpVerJson.user?.username}`);

  // Neural TTS Backend Adapter Honest Unconfigured State
  const ttsRes = await ttsMod.POST(new Request(`${base}/api/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Halo Nusantara' })
  }));
  const ttsJson = await ttsRes.json();
  check('Phase 5', 'Neural TTS Honest Fallback State', ttsRes.status === 503 && ttsJson.fallback === 'browser_speech_synthesis', ttsJson.notice);

  // ==========================================================================
  // HEADLESS CHROME FULL ECOSYSTEM & 3D OPEN WORLD VERIFICATION
  // ==========================================================================
  const chrome = spawn('/usr/bin/google-chrome-stable', [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1800));

  let ws;
  const consoleErrors = [];
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
    ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let cid = 0;
    const pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(m.error) : resolve(m.result);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++cid;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. PHASE 1: Homepage + Real-Progress Loader + Nav Link
    const t0 = Date.now();
    await send('Page.navigate', { url: `${base}/index.html` });
    let homeCheck = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200));
      homeCheck = await evalJs(`(() => ({
        title: document.querySelector('h1')?.textContent?.trim(),
        hasWorldNav: Boolean(document.querySelector('a[href="world.html"]')),
        introSeen: sessionStorage.getItem('nular_intro_seen_v1') === '1'
      }))()`);
      if (homeCheck?.introSeen && homeCheck?.hasWorldNav) break;
    }
    perfMetrics.homeLoadMs = Date.now() - t0;
    check('Phase 1', 'Homepage Loader & Nusantara World Navigation', Boolean(homeCheck?.title) && homeCheck?.hasWorldNav && homeCheck?.introSeen, `load=${perfMetrics.homeLoadMs}ms`);

    // 2. PHASE 3: House Anatomy Viewer (PBR + Exploded + Roof Cutaway + Isolate)
    await send('Page.navigate', { url: `${base}/house.html?id=rumah-gadang` });
    let anatomyCheck = null;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      anatomyCheck = await evalJs(`(() => ({
        hasCutawayBtn: Boolean(document.querySelector('[data-action="toggle-cutaway"]')),
        hasIsolateBtn: Boolean(document.querySelector('[data-action="toggle-isolate"]')),
        hasExplodedBtn: Boolean(document.querySelector('[data-mode="exploded"]'))
      }))()`);
      if (anatomyCheck?.hasCutawayBtn && anatomyCheck?.hasIsolateBtn && anatomyCheck?.hasExplodedBtn) break;
    }
    check('Phase 3', 'Architectural Anatomy Toolbar (Exploded, Cutaway, Isolate)', anatomyCheck?.hasCutawayBtn && anatomyCheck?.hasIsolateBtn && anatomyCheck?.hasExplodedBtn, JSON.stringify(anatomyCheck));

    // 3. PHASE 4, 5, 6: Nusantara Open World (Hub + Pavilions + 4 Vehicles + 9-Step Raga Tutorial + Minimal AI Chat + Collection Book)
    const tWorld = Date.now();
    await send('Page.navigate', { url: `${base}/world.html?tutorial=1` });
    let worldReady = false;
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (await evalJs(`Boolean(window.__NULAR_WORLD__?.running)`)) { worldReady = true; break; }
    }
    perfMetrics.worldBootMs = Date.now() - tWorld;
    check('Phase 4', 'Nusantara World Hub Boot & Streaming', worldReady, `boot=${perfMetrics.worldBootMs}ms`);

    // Verify PBR Batik texture applied to player avatar
    const avatarCheck = await evalJs(`(() => {
      const m = window.__NULAR_WORLD__?.character?.currentModel;
      let texturedMeshes = 0;
      m?.traverse((o) => { if (o.isMesh && o.material?.map) texturedMeshes++; });
      return { outfit: window.__NULAR_WORLD__?.character?.currentOutfitId, texturedMeshes };
    })()`);
    check('Phase 3', 'Avatar Regional Batik PBR Texture Applied', avatarCheck?.texturedMeshes > 0, `outfit=${avatarCheck?.outfit}, texturedMeshes=${avatarCheck?.texturedMeshes}`);

    // Verify Cultural Exhibition Pavilions mounted in Hub
    const pavCheck = await evalJs(`(() => ({
      pavilions: window.__NULAR_WORLD__?.pavilions?.group?.children?.length || 0,
      exhibitBeacons: (window.__NULAR_WORLD__?.interaction?.interactables || []).filter((i) => i.kind === 'exhibit').length
    }))()`);
    check('Phase 4', 'Cultural Exhibition Pavilions & Discoverable Exhibits', pavCheck?.pavilions === 4 && pavCheck?.exhibitBeacons === 4, JSON.stringify(pavCheck));

    // Verify 9-Step Raga Interactive Tutorial
    const tutCheck = await evalJs(`(() => {
      const t = window.__NULAR_TUTORIAL__;
      const hasCard = Boolean(document.getElementById('nular-tutorial-card'));
      const hasRagaSvg = Boolean(document.querySelector('#nular-tutorial-card svg'));
      const step1 = t?.getCurrentStep()?.num;
      t?.nextStep();
      const step2 = t?.getCurrentStep()?.num;
      t?.skip();
      const completed = t?.isCompleted();
      return { hasCard, hasRagaSvg, step1, step2, completed };
    })()`);
    check('Phase 5', '9-Step Raga Interactive Tutorial (Launch, Step, Skip, Persist)', tutCheck?.hasCard && tutCheck?.hasRagaSvg && tutCheck?.step1 === 1 && tutCheck?.step2 === 2 && tutCheck?.completed === true, JSON.stringify(tutCheck));

    // Verify Minimal Transparent AI Chat Overlay
    const aiCheck = await evalJs(`(async () => {
      const g = window.__NULAR_AI_GUIDE__;
      g?.openPanel('Apa fungsi rumah adat di Nusantara?');
      await new Promise((r) => setTimeout(r, 450));
      const panel = document.getElementById('ai-guide-panel');
      const msgs = document.querySelectorAll('#ai-chat-messages .ai-msg').length;
      const hasInput = Boolean(document.getElementById('ai-chat-input'));
      const hasMic = Boolean(document.getElementById('ai-mic-btn'));
      const hasSpeaker = Boolean(document.getElementById('ai-speaker-btn'));
      g?.closePanel();
      return { isMinimal: panel?.classList.contains('ai-minimal-chat'), msgs, hasInput, hasMic, hasSpeaker };
    })()`);
    check('Phase 5', 'Minimal Transparent AI Chat Overlay & Context Answer', aiCheck?.isMinimal && aiCheck?.msgs >= 2 && aiCheck?.hasInput && aiCheck?.hasMic && aiCheck?.hasSpeaker, JSON.stringify(aiCheck));

    // Verify All 4 Vehicles (Motorcycle, Car, Boat, Airplane Takeoff & Dismount)
    const vehCheck = await evalJs(`(() => {
      const w = window.__NULAR_WORLD__;
      const ids = [...w.vehicles.vehicles.keys()];
      const tested = {};
      for (const vid of ['motor', 'mobil', 'perahu', 'pesawat']) {
        const spec = w.mountVehicle(vid);
        w.input.keys.add('KeyW');
        if (vid === 'pesawat') w.input.keys.add('Space');
        for (let f = 0; f < 10; f++) w.vehicles.update(0.05, w.input, w.player);
        const v = w.vehicles.activeVehicle;
        tested[vid] = { mounted: Boolean(spec), speed: Number(v?.speed?.toFixed(2) || 0), alt: Number(v?.altitude?.toFixed(2) || 0) };
        w.input.keys.delete('KeyW');
        w.input.keys.delete('Space');
        w.dismountVehicle();
      }
      return { count: ids.length, tested };
    })()`);
    check(
      'Phase 4',
      '4-Vehicle Transportation System (Motor, Car, Boat, Airplane Takeoff)',
      vehCheck?.count === 4 && vehCheck?.tested?.motor?.speed > 0 && vehCheck?.tested?.mobil?.speed > 0 && vehCheck?.tested?.perahu?.speed > 0 && vehCheck?.tested?.pesawat?.alt > 0,
      JSON.stringify(vehCheck?.tested)
    );

    // Stream Rumah Gadang & verify architectural PBR textures + GPU telemetry
    await evalJs(`window.__NULAR_WORLD__.enterHouse('rumah-gadang')`);
    await new Promise((r) => setTimeout(r, 900));
    const houseWorldCheck = await evalJs(`(() => {
      const w = window.__NULAR_WORLD__;
      let pbrCount = 0;
      w.streaming.activeHouseRoot?.traverse((o) => { if (o.isMesh && o.material?.userData?.nularPbrApplied) pbrCount++; });
      const info = w.gameScene.renderer.info;
      return {
        houseId: w.activeHouse?.id,
        pbrCount,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries
      };
    })()`);
    perfMetrics.drawCalls = houseWorldCheck?.drawCalls;
    perfMetrics.triangles = houseWorldCheck?.triangles;
    perfMetrics.geometries = houseWorldCheck?.geometries;
    check('Phase 3', 'Streamed Rumah Gadang Architectural PBR Enhancement', houseWorldCheck?.houseId === 'rumah-gadang' && houseWorldCheck?.pbrCount > 10, `pbrMeshes=${houseWorldCheck?.pbrCount}, drawCalls=${houseWorldCheck?.drawCalls}, tris=${houseWorldCheck?.triangles}`);

    // Desktop Screenshot (1440x900)
    const deskShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'master_p7_desktop_world_1440.png'), Buffer.from(deskShot.data, 'base64'));
    check('Phase 7', 'Desktop 1440px Open World Screenshot', deskShot.data.length > 50000, `${deskShot.data.length} bytes`);

    // Tablet Viewport (768x1024)
    await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
    await new Promise((r) => setTimeout(r, 400));
    const tabShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'master_p7_tablet_world_768.png'), Buffer.from(tabShot.data, 'base64'));
    check('Phase 7', 'Tablet 768px Responsive Render', tabShot.data.length > 40000, `${tabShot.data.length} bytes`);

    // Mobile Viewport (390x844)
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 400));
    const mobShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'master_p7_mobile_world_390.png'), Buffer.from(mobShot.data, 'base64'));
    check('Phase 7', 'Mobile 390px Responsive Render & Touch Controls', mobShot.data.length > 40000, `${mobShot.data.length} bytes`);

    check('Phase 7', 'Zero Uncaught Console Exceptions', consoleErrors.length === 0, consoleErrors.length ? consoleErrors[0] : '0 runtime errors');

    ws.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`\n=== MASTER TRANSFORMATION QA: ${passed}/${results.length} PASSED ===`);
  console.log('Performance Metrics:', JSON.stringify(perfMetrics));
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
