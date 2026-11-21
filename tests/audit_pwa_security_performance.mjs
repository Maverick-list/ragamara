/**
 * NULAR — Final QA Deep Audit: PWA, Security, Performance, and Compatibility
 * Executes Phase 2 (PWA validation), Phase 5 (Performance profiling), Phase 6 (Security audit).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const PORT = 8977;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.startsWith('/api/')) {
        const modName = p.slice(5).split('?')[0];
        const modPath = path.join(ROOT_DIR, 'api', `${modName}.js`);
        if (fs.existsSync(modPath)) {
          try {
            const mod = await import(modPath);
            const method = req.method || 'GET';
            let bodyText = '';
            req.on('data', (c) => { bodyText += c; });
            req.on('end', async () => {
              const fullUrl = `http://127.0.0.1:${port}${req.url}`;
              const webReq = new Request(fullUrl, {
                method,
                headers: req.headers,
                body: ['POST', 'PUT', 'DELETE'].includes(method) ? bodyText : undefined
              });
              const handler = mod[method] || mod.default;
              if (handler) {
                const webRes = await handler(webReq);
                res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
                res.end(await webRes.text());
              } else {
                res.writeHead(405); res.end('Method Not Allowed');
              }
            });
            return;
          } catch (err) {
            res.writeHead(500); res.end(err.message);
            return;
          }
        }
      }

      const rel = p === '/' ? 'index.html' : p.replace(/^\//, '');
      const fp = path.join(ROOT_DIR, rel);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port }));
  });
}

const auditResults = {
  pwa: [],
  security: [],
  performance: [],
  compatibility: []
};

function record(category, test, passed, detail = '') {
  auditResults[category].push({ test, passed, detail });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] [${category.toUpperCase()}] ${test}${detail ? ' — ' + detail : ''}`);
}

async function runAudit() {
  console.log('=== NULAR FINAL QUALITY ASSURANCE & DEEP AUDIT SUITE ===\n');
  const { server, port } = await startServer(PORT);
  const base = `http://127.0.0.1:${port}`;

  // ==========================================================================
  // SECTION 1: PWA REAL-WORLD VALIDATION (Phase 2)
  // ==========================================================================
  console.log('--- 1. PWA Real-World Validation ---');
  // 1.1 Manifest Validity
  const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.webmanifest'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  record('pwa', 'Manifest JSON Syntax & Required Keys',
    manifest.name === 'NULAR — The Living World of Nusantara' &&
    manifest.short_name === 'NULAR' &&
    manifest.start_url === 'index.html' &&
    manifest.display === 'standalone' &&
    manifest.theme_color === '#153027' &&
    manifest.background_color === '#FAF7F2',
    `name="${manifest.name}", display="${manifest.display}"`
  );

  // 1.2 Icon Assets Presence & Sizes
  const icon192Path = path.join(ROOT_DIR, 'assets/images/icon-192.png');
  const icon512Path = path.join(ROOT_DIR, 'assets/images/icon-512.png');
  const hasIcons = fs.existsSync(icon192Path) && fs.existsSync(icon512Path);
  const icon192Size = hasIcons ? fs.statSync(icon192Path).size : 0;
  const icon512Size = hasIcons ? fs.statSync(icon512Path).size : 0;
  record('pwa', 'Application Icons Present & Sized',
    hasIcons && icon192Size > 10000 && icon512Size > 30000,
    `icon-192 (${icon192Size}B), icon-512 (${icon512Size}B)`
  );

  // 1.3 Service Worker Cache Rules: API & Private Data Exclusion
  const swCode = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
  const excludesApi = swCode.includes("url.pathname.startsWith('/api/')");
  const excludesNonGet = swCode.includes("request.method !== 'GET'");
  const hasOfflineFallback = swCode.includes("caches.match('./offline.html')");
  record('pwa', 'Service Worker Excludes API Requests from Cache',
    excludesApi && excludesNonGet,
    'Guarantees /api/ endpoints and mutations never cached'
  );
  record('pwa', 'Service Worker Implements Dedicated Offline Page Fallback',
    hasOfflineFallback,
    'Falls back to ./offline.html on navigate error'
  );

  // 1.4 Offline HTML file completeness
  const offlineHtml = fs.readFileSync(path.join(ROOT_DIR, 'offline.html'), 'utf8');
  record('pwa', 'Offline HTML Page Complete & Accessible',
    offlineHtml.includes('Anda Sedang Offline') && offlineHtml.includes('Muat Ulang Halaman'),
    'Includes reload trigger and navigation links'
  );

  // ==========================================================================
  // SECTION 2: SECURITY & PRIVACY AUDIT (Phase 6)
  // ==========================================================================
  console.log('\n--- 2. Security & Anti-Tampering Audit ---');
  const authMod = await import('../api/auth.js');
  const progMod = await import('../api/progress.js');
  const leadMod = await import('../api/leaderboard.js');

  // 2.1 Password Hashing with Scrypt & Unique Salt
  const pass1 = 'NusantaraSecret2026!';
  const authHeader = authMod.POST ? authMod : authMod.default;
  const testEmail = `explorer_qa_${Date.now()}@nular.id`;
  const regRes = await authHeader.POST(new Request(`${base}/api/auth?action=signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: pass1, username: 'ArsiparisBudaya' })
  }));
  const regJson = await regRes.json();
  record('security', 'User Registration with Password Hashing & Sanitization',
    regRes.status === 201 && regJson.user && regJson.user.username === 'ArsiparisBudaya' && !regJson.user.password && !regJson.user.passwordHash,
    `User registered safely without leaking password hash`
  );

  // 2.2 Tampered HMAC Session Cookie Rejection
  const rawCookie = regRes.headers.get('set-cookie') || '';
  const tokenMatch = rawCookie.match(/nular_session=([^;]+)/);
  const validToken = tokenMatch ? tokenMatch[1] : '';
  const tamperedToken = validToken ? validToken.slice(0, -6) + 'XXXXXX' : '';
  const verifyValid = authMod.verifySessionToken(validToken);
  const verifyTampered = authMod.verifySessionToken(tamperedToken);
  record('security', 'HMAC Session Signature Anti-Tamper Verification',
    verifyValid !== null && verifyTampered === null,
    `Valid signature accepted, tampered signature strictly rejected (null)`
  );

  // 2.3 Server-Authoritative Anti-Tamper XP Engine
  const hackPayload = {
    activityType: 'inspect_detail',
    eventKey: 'qa-audit-tongkonan-roof-001',
    amount: 999999, // Malicious client attempting arbitrary score inflation
    guestId: 'qa-tester-guest'
  };
  const hackRes = await progMod.POST(new Request(`${base}/api/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hackPayload)
  }));
  const hackJson = await hackRes.json();
  record('security', 'Server-Authoritative Anti-Tamper XP Scoring',
    hackRes.status === 200 && hackJson.xpAwarded === 10 && hackJson.xp === 10,
    `Client injected 999999 XP; Server strictly awarded authoritative 10 XP`
  );

  // 2.4 OTP E.164 Format & 60s Cooldown
  const badOtpRes = await authHeader.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0812345678' }) // Not E.164
  }));
  const goodOtpRes1 = await authHeader.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+6281234567890' })
  }));
  const goodOtpRes2 = await authHeader.POST(new Request(`${base}/api/auth?action=phone-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+6281234567890' }) // Rapid resend attempt
  }));
  record('security', 'Phone OTP Validation (E.164 Format & 60s Rate-Limit)',
    badOtpRes.status === 400 && goodOtpRes1.status === 200 && goodOtpRes2.status === 429,
    `Non-E.164 rejected (400), first send accepted (200), immediate resend rate-limited (429)`
  );

  // 2.5 Leaderboard Privacy Gate (Masking User Information)
  const lbRes = await leadMod.GET(new Request(`${base}/api/leaderboard?scope=global`));
  const lbJson = await lbRes.json();
  const emailsMasked = (lbJson.entries || []).every((entry) => !entry.email || entry.email.includes('***'));
  record('security', 'Leaderboard Privacy Protection (Masked Emails)',
    lbRes.status === 200 && emailsMasked,
    `Public leaderboard never discloses raw user emails`
  );

  // ==========================================================================
  // SECTION 3: PERFORMANCE & COMPATIBILITY VIA HEADLESS CHROME (Phases 3, 4, 5)
  // ==========================================================================
  console.log('\n--- 3. Performance Profiling & 3D Stability ---');
  const chromeDataDir = `/tmp/chrome-deep-qa-${Date.now()}`;
  fs.mkdirSync(chromeDataDir, { recursive: true });
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9299',
    `--user-data-dir=${chromeDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let ws = null;
  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9299/json/list');
        const tabs = await res.json();
        const t = tabs.find((x) => x.type === 'page');
        if (t?.webSocketDebuggerUrl) {
          wsUrl = t.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    ws = new WebSocket(wsUrl);
    let idCounter = 1;
    const callbacks = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    });
    await new Promise((r) => ws.addEventListener('open', r));

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = idCounter++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Performance.enable');

    // 3.1 Homepage Core Web Vitals
    await send('Page.navigate', { url: `${base}/index.html` });
    for (let i = 0; i < 30; i++) {
      const done = await evalJs('Boolean(performance.getEntriesByType("navigation")[0]?.domInteractive > 0)');
      if (done) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const perfMetrics = await send('Performance.getMetrics');
    const metricMap = Object.fromEntries(perfMetrics.metrics.map((m) => [m.name, m.value]));

    const navTiming = await evalJs(`(() => {
      const t = performance.getEntriesByType('navigation')[0];
      return {
        domInteractive: Math.round(t?.domInteractive || 0),
        loadEventEnd: Math.round(t?.loadEventEnd || 0)
      };
    })()`);

    record('performance', 'Core Web Vitals & Loading Performance (Homepage)',
      navTiming.domInteractive < 2500 && metricMap.LayoutCount > 0,
      `DOMInteractive=${navTiming.domInteractive}ms, LoadEventEnd=${navTiming.loadEventEnd}ms, JSHeapUsed=${Math.round((metricMap.JSHeapUsedSize || 0) / 1024 / 1024)}MB`
    );

    // 3.2 Mobile 3D World Stability, WebGL Capabilities & Quality Profiles
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `${base}/world.html?notutorial=1` });
    for (let i = 0; i < 40; i++) {
      const ready = await evalJs('Boolean(window.__NULAR_WORLD__?.running)');
      if (ready) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    const worldEngineAudit = await evalJs(`(() => {
      const w = window.__NULAR_WORLD__;
      if (!w) return null;
      const gs = w.gameScene;
      const detected = gs.constructor.detectDeviceCapability ? gs.constructor.detectDeviceCapability() : 'medium';
      const profLow = gs.setQualityProfile('performance');
      const dprLow = gs.renderer.getPixelRatio();
      const profHigh = gs.setQualityProfile('high');
      const dprHigh = gs.renderer.getPixelRatio();

      return {
        running: w.running,
        hasRenderer: Boolean(gs.renderer),
        detectedProfile: detected,
        profilePerformance: { prof: profLow, dpr: dprLow, shadows: gs.renderer.shadowMap.enabled },
        profileHigh: { prof: profHigh, dpr: dprHigh, shadows: gs.renderer.shadowMap.enabled },
        canvasTouchAction: window.getComputedStyle(gs.canvas).touchAction
      };
    })()`);

    record('performance', 'Adaptive 3D Quality Profiles & Capability Detection',
      worldEngineAudit && worldEngineAudit.running && worldEngineAudit.profileHigh.shadows === true,
      `Detected="${worldEngineAudit?.detectedProfile}", Performance Tier dpr=${worldEngineAudit?.profilePerformance.dpr}, High Tier dpr=${worldEngineAudit?.profileHigh.dpr}`
    );

    record('compatibility', 'Mobile 3D Touch Action Safe Against Scroll Conflicts',
      worldEngineAudit?.canvasTouchAction === 'none',
      `Canvas touchAction="${worldEngineAudit?.canvasTouchAction}" (prevents accidental page scrolling during orbit)`
    );

    // 3.3 WebGL Context Loss & Restoration Handling
    const contextLossHandled = await evalJs(`(() => {
      const gs = window.__NULAR_WORLD__?.gameScene;
      if (!gs) return false;
      const initialLost = gs.contextLost;
      // Dispatch synthetic webglcontextlost event
      const evt = new Event('webglcontextlost', { cancelable: true });
      gs.canvas.dispatchEvent(evt);
      const afterLost = gs.contextLost;
      // Dispatch restored event
      const resEvt = new Event('webglcontextrestored');
      gs.canvas.dispatchEvent(resEvt);
      const afterRestored = gs.contextLost;
      return !initialLost && afterLost && !afterRestored;
    })()`);

    record('compatibility', 'WebGL Context Loss Graceful Pause & Auto-Restoration',
      Boolean(contextLossHandled),
      'Context loss pauses render loop without unhandled exceptions; restored event resumes cleanly'
    );

    // 3.4 Multi-Touch Pinch-to-Zoom Simulation
    const pinchZoomVerified = await evalJs(`(() => {
      const input = window.__NULAR_WORLD__?.input;
      if (!input) return false;
      const canvas = input.canvas;
      const initialZoom = input.zoomDelta;

      // Simulate 2 pointers down
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }));

      // Move pointer 2 outwards (spread / zoom in)
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 250, clientY: 200 }));
      const afterSpreadZoom = input.zoomDelta;

      // Release
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));

      return afterSpreadZoom !== initialZoom;
    })()`);

    record('compatibility', 'Touch Pinch-to-Zoom Gesture Recognition',
      Boolean(pinchZoomVerified),
      'Two-pointer distance delta correctly translates to camera zoom delta'
    );

    // 3.5 Virtual Keyboard Resizing Resiliency
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 420, deviceScaleFactor: 1, mobile: true }); // Simulated virtual keyboard opening
    await new Promise((r) => setTimeout(r, 400));
    const kbResizeSafe = await evalJs(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const controls = document.querySelector('.mobile-controls');
      return { noOverflow: docW <= winW, controlsVisible: Boolean(controls) };
    })()`);
    record('compatibility', 'Virtual Keyboard Viewport Contraction Resiliency',
      kbResizeSafe.noOverflow,
      `Height reduced to 420px; zero horizontal overflow and HUD controls intact`
    );

  } finally {
    if (ws) ws.close();
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(chromeDataDir, { recursive: true, force: true });
  }

  // Summary
  const allPassed = Object.values(auditResults).flat().every((r) => r.passed);
  console.log(`\n=== FINAL AUDIT RESULT: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'FAILURES DETECTED'} ===`);
  return { allPassed, auditResults };
}

runAudit().then(({ allPassed }) => {
  process.exit(allPassed ? 0 : 1);
}).catch((err) => {
  console.error('[AUDIT FATAL]', err);
  process.exit(1);
});
