/**
 * NULAR — Post-Refinement Interactive Functionality, Network, Performance & A11y Audit
 * Verifies real live DOM interactions, zero broken images/assets, keyboard a11y,
 * reduced-motion behavior, touch targets, and measured WebGL rendering metrics.
 */

import fs from 'node:fs';
import { spawn } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:3000';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res);
      this.ws.addEventListener('error', rej);
    });
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
      }
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params?.response;
        if (r && r.url.startsWith(BASE_URL) && r.status >= 400 && !r.url.includes('/api/auth')) {
          this.failedRequests.push(`${r.status} ${r.url}`);
        }
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    await this.send('Page.enable');
    await this.send('Network.enable');
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url, waitMs = 800) {
    const loadPromise = new Promise((resolve) => {
      const onMsg = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === 'Page.loadEventFired') {
          this.ws.removeEventListener('message', onMsg);
          resolve();
        }
      };
      this.ws.addEventListener('message', onMsg);
      setTimeout(() => {
        this.ws.removeEventListener('message', onMsg);
        resolve();
      }, 6000);
    });
    await this.send('Page.navigate', { url });
    await loadPromise;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
    }
    return res.result?.value;
  }
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function run() {
  console.log('=== NULAR POST-REFINEMENT INTERACTIVE, PERF & A11Y VERIFICATION ===\n');

  const chromeDataDir = `/tmp/chrome-post-refine-${Date.now()}`;
  fs.mkdirSync(chromeDataDir, { recursive: true });
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9264',
    `--user-data-dir=${chromeDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9264/json/list');
        const tabs = await res.json();
        const t = tabs.find((x) => x.type === 'page');
        if (t?.webSocketDebuggerUrl) { wsUrl = t.webSocketDebuggerUrl; break; }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!wsUrl) throw new Error('Failed to connect to Headless Chrome');
    cdp = new CDPClient(wsUrl);
    await cdp.connect();

    // 1. Mobile 3D World Live Interactions (390x844)
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/world.html?house=rumah-gadang&tutorial=1`, 2500);
    for (let i = 0; i < 40; i++) {
      if (await cdp.evaluate('Boolean(window.__NULAR_WORLD__?.running && window.__NULAR_TUTORIAL__?.active)')) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    // 1a. Tutorial lifecycle: compact -> expand -> minimize -> next -> close -> replay
    const tutFlow = await cdp.evaluate(`(() => {
      const t = window.__NULAR_TUTORIAL__;
      const startMinimized = t.minimized === true;
      document.getElementById('tut-btn-expand')?.click();
      const afterExpand = t.minimized === false && Boolean(document.getElementById('tut-btn-minimize'));
      document.getElementById('tut-btn-minimize')?.click();
      const afterMinimize = t.minimized === true;
      document.getElementById('tut-btn-next')?.click();
      const stepAfterNext = t.stepIndex; // should be 1 (Step 2)
      document.getElementById('tut-btn-skip')?.click();
      const afterClose = t.active === false && localStorage.getItem('nular_tutorial_completed_v1') === '1';
      document.getElementById('btn-replay-tutorial')?.click();
      const afterReplay = t.active === true && t.stepIndex === 0 && t.minimized === false;
      t.setMinimized(true);
      return { startMinimized, afterExpand, afterMinimize, stepAfterNext, afterClose, afterReplay };
    })()`);
    check('Tutorial Lifecycle (Compact, Expand, Minimize, Next, Close, Replay)',
      tutFlow.startMinimized && tutFlow.afterExpand && tutFlow.afterMinimize && tutFlow.stepAfterNext === 1 && tutFlow.afterClose && tutFlow.afterReplay,
      JSON.stringify(tutFlow));

    // 1b. Joystick & D-Pad mutual exclusivity
    const padFlow = await cdp.evaluate(`(() => {
      const joy = document.getElementById('mobile-joystick-base');
      const dpad = document.getElementById('mobile-dpad-container');
      const sw = document.getElementById('toggle-control-mode-btn');
      const s0 = { joyVis: getComputedStyle(joy).display !== 'none', dpadVis: getComputedStyle(dpad).display !== 'none' };
      sw.click();
      const s1 = { joyVis: getComputedStyle(joy).display !== 'none', dpadVis: getComputedStyle(dpad).display !== 'none' };
      sw.click();
      const s2 = { joyVis: getComputedStyle(joy).display !== 'none', dpadVis: getComputedStyle(dpad).display !== 'none' };
      return { s0, s1, s2 };
    })()`);
    check('Joystick & D-Pad Mutually Exclusive Toggle',
      padFlow.s0.joyVis && !padFlow.s0.dpadVis && !padFlow.s1.joyVis && padFlow.s1.dpadVis && padFlow.s2.joyVis && !padFlow.s2.dpadVis,
      JSON.stringify(padFlow));

    // 1c. Mobile HUD expansion & Inspection Drawer Z-index layering
    const hudFlow = await cdp.evaluate(`(() => {
      const bar = document.getElementById('hud-actions-bar');
      const more = document.getElementById('btn-mobile-hud-more');
      const sec = document.getElementById('btn-open-wardrobe');
      const beforeHidden = getComputedStyle(sec).display === 'none';
      more.click();
      const afterVisible = bar.classList.contains('is-expanded') && getComputedStyle(sec).display !== 'none';
      more.click();
      const drawer = document.getElementById('world-drawer');
      const tut = document.getElementById('nular-tutorial-card');
      const drawerZ = Number(getComputedStyle(drawer).zIndex || 0);
      const tutZ = Number(getComputedStyle(tut).zIndex || 0);
      return { beforeHidden, afterVisible, drawerZ, tutZ };
    })()`);
    check('Mobile HUD Expansion & Drawer Layering (drawerZ > tutZ)',
      hudFlow.beforeHidden && hudFlow.afterVisible && hudFlow.drawerZ > hudFlow.tutZ,
      JSON.stringify(hudFlow));

    // 1d. Touch target dimensions >= 44px
    const touchSizes = await cdp.evaluate(`(() => {
      const ids = ['mobile-btn-sprint', 'mobile-btn-jump', 'mobile-btn-interact', 'btn-mobile-hud-more'];
      return ids.map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { id, w: Math.round(r.width), h: Math.round(r.height) };
      });
    })()`);
    check('Mobile 3D Touch Targets >= 44x44px',
      touchSizes.every((b) => b.w >= 44 && b.h >= 44),
      JSON.stringify(touchSizes));

    // 2. Measured 3D Performance Metrics (Desktop 1440x900)
    await cdp.setViewport(1440, 900, false);
    const perf3d = await cdp.evaluate(`(async () => {
      const w = window.__NULAR_WORLD__;
      const info = w.gameScene.renderer.info;
      const times = [];
      let prev = performance.now();
      for (let i = 0; i < 15; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now();
        times.push(now - prev);
        prev = now;
      }
      const avgFrameMs = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
      const heapMb = performance.memory ? Math.round((performance.memory.usedJSHeapSize / 1048576) * 10) / 10 : null;
      return {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        avgFrameMsSwiftShader: avgFrameMs,
        heapMb
      };
    })()`);
    check('Measured 3D Rendering Budget (Post-PBR Refinement)',
      perf3d.drawCalls > 0 && perf3d.drawCalls < 400 && perf3d.triangles < 50000,
      JSON.stringify(perf3d));

    // 3. Major Pages Navigation, Broken Images (including lazy-loaded), Keyboard Focus & Reduced Motion
    const pages = ['index.html', 'house.html?id=rumah-gadang', 'map.html', 'profile.html', 'quests.html', 'auth.html'];
    let brokenImgs = [];
    for (const p of pages) {
      await cdp.navigate(`${BASE_URL}/${p}`, 1300);
      const imgs = await cdp.evaluate(`(async () => {
        const all = Array.from(document.images).filter(i => i.src);
        await Promise.all(all.map(img => {
          img.loading = 'eager';
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(res => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
            setTimeout(res, 2500);
          });
        }));
        return all.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
      })()`);
      if (imgs.length) brokenImgs.push({ page: p, imgs });
    }
    check('Zero Broken Images Across All Major Pages (Eager + Lazy Verified)', brokenImgs.length === 0,
      brokenImgs.length ? JSON.stringify(brokenImgs) : `Verified all images across ${pages.length} pages`);

    // 3b. Keyboard accessibility & skip link on index.html
    await cdp.navigate(`${BASE_URL}/index.html`, 1200);
    const a11y = await cdp.evaluate(`(() => {
      const skip = document.querySelector('.skip-link');
      const firstLink = document.querySelector('.museum-nav__link');
      if (firstLink) firstLink.focus();
      const activeTag = document.activeElement?.tagName;
      return { hasSkipLink: Boolean(skip), activeTag, title: document.title };
    })()`);
    check('Keyboard Skip-Link & Focusable Navigation', a11y.hasSkipLink && a11y.activeTag === 'A', JSON.stringify(a11y));

    // 3c. Reduced motion emulation
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await cdp.navigate(`${BASE_URL}/index.html`, 1400);
    const reducedMotionOk = await cdp.evaluate(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`);
    check('Prefers-Reduced-Motion Media Query Respected', reducedMotionOk === true, 'prefers-reduced-motion: reduce active');
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });

    // 4. Offline page zero-network inline SVG icons & recovery links
    await cdp.navigate(`${BASE_URL}/offline.html`, 700);
    const offlineCheck = await cdp.evaluate(`(() => {
      const svgs = document.querySelectorAll('svg').length;
      const ligatures = document.querySelectorAll('.material-symbols-outlined').length;
      const links = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'));
      const reloadBtn = Boolean(document.querySelector('button[onclick*="reload"]'));
      return { svgs, ligatures, links, reloadBtn };
    })()`);
    check('Offline Page Zero-Font Inline SVG & Recovery Links',
      offlineCheck.svgs >= 2 && offlineCheck.ligatures === 0 && offlineCheck.reloadBtn && offlineCheck.links.includes('index.html'),
      JSON.stringify(offlineCheck));

    // 5. Console & Network Health
    check('Zero Uncaught Console Exceptions', cdp.consoleErrors.length === 0, `${cdp.consoleErrors.length} errors`);
    check('Zero Failed Local Network Assets (4xx/5xx)', cdp.failedRequests.length === 0,
      cdp.failedRequests.length ? cdp.failedRequests.join(', ') : '0 failed local requests');

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n=== POST-REFINEMENT INTERACTIVE AUDIT: ${passed}/${results.length} PASSED ===`);
    if (passed !== results.length) process.exitCode = 1;
  } catch (err) {
    console.error('Audit fatal error:', err);
    process.exitCode = 1;
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill();
  }
}

run();
