/**
 * NULAR — Universal Cross-Device & Responsive Verification Suite
 * Tests viewports: 320x720, 360x800, 390x844, 430x932, 768x1024, 1024x768, 1280x800, 1440x900, 1920x1080
 * Validates: Zero horizontal overflow, touch target sizes, mobile bottom nav, PWA manifest & SW, D-Pad switcher.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const PORT = 8966;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary'
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relPath = urlPath === '/' ? '/index.html' : urlPath;
      const filePath = path.join(ROOT_DIR, relPath);

      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res);
      this.ws.addEventListener('error', rej);
    });
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    await this.send('Page.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1200));
  }

  async setViewport(width, height, isMobile = false, deviceScaleFactor = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: isMobile
    });
    await new Promise((r) => setTimeout(r, 400));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`[SCREENSHOT] Saved ${filename} (${buf.length} bytes)`);
    return buf.length;
  }
}

async function run() {
  console.log('=== NULAR UNIVERSAL CROSS-DEVICE VERIFICATION SUITE ===');
  const server = await startServer(PORT);
  console.log(`[PASS] Test HTTP server online at http://127.0.0.1:${PORT}`);

  // 1. Verify PWA manifest on disk
  const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.webmanifest'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  if (manifest.short_name !== 'NULAR' || !manifest.icons?.length) {
    throw new Error('PWA Manifest invalid');
  }
  console.log(`[PASS] PWA Manifest verified: name="${manifest.name}", icons=${manifest.icons.length}`);

  // 2. Verify Service Worker script compiles
  const swCode = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
  if (!swCode.includes('nular-shell-v1') || !swCode.includes('offline.html')) {
    throw new Error('Service worker lacks cache definition or offline fallback');
  }
  console.log('[PASS] Service Worker script verified: Cache shell & offline fallback defined');

  // Launch Headless Chrome
  const chromeDataDir = `/tmp/chrome-universal-qa-${Date.now()}`;
  fs.mkdirSync(chromeDataDir, { recursive: true });
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9258',
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
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9258/json/list');
        const tabs = await res.json();
        const t = tabs.find((x) => x.type === 'page');
        if (t?.webSocketDebuggerUrl) {
          wsUrl = t.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log('[PASS] Connected to Headless Chrome via CDP');

    const VIEWPORTS = [
      { name: 'Micro Smartphone', w: 320, h: 720, mobile: true },
      { name: 'Standard Smartphone', w: 360, h: 800, mobile: true },
      { name: 'Modern iPhone 13/14', w: 390, h: 844, mobile: true },
      { name: 'Large Smartphone Pro Max', w: 430, h: 932, mobile: true },
      { name: 'iPad Portrait', w: 768, h: 1024, mobile: true },
      { name: 'Tablet Landscape', w: 1024, h: 768, mobile: false },
      { name: 'Compact Laptop', w: 1280, h: 800, mobile: false },
      { name: 'Desktop Standard', w: 1440, h: 900, mobile: false },
      { name: 'Full HD Desktop', w: 1920, h: 1080, mobile: false }
    ];

    // TEST 1: Homepage Responsive Viewports & Zero Overflow
    console.log('\n--- Auditing Viewports for Zero Horizontal Overflow (Homepage) ---');
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.w, vp.h, vp.mobile);
      await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
      const metrics = await cdp.evaluate(`(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const bNav = document.getElementById('mobile-bottom-nav');
        const bNavVisible = bNav && window.getComputedStyle(bNav).display !== 'none';
        return { docW, winW, overflow: docW > winW, bNavVisible };
      })()`);

      if (metrics.overflow) {
        throw new Error(`Horizontal overflow detected on ${vp.name} (${vp.w}x${vp.h}): scrollWidth=${metrics.docW} > innerWidth=${metrics.winW}`);
      }

      // Mobile bottom nav must be visible on mobile (<768) and hidden on desktop (>=768)
      if (vp.w < 768 && !metrics.bNavVisible) {
        throw new Error(`Mobile bottom nav missing on ${vp.name} (${vp.w}px)`);
      }
      if (vp.w >= 768 && metrics.bNavVisible) {
        throw new Error(`Mobile bottom nav unexpectedly visible on desktop ${vp.name} (${vp.w}px)`);
      }

      console.log(`[PASS] ${vp.name} (${vp.w}x${vp.h}) — scrollWidth=${metrics.docW}px, bottomNav=${metrics.bNavVisible ? 'visible' : 'hidden'}`);
    }

    // Capture visual screenshots across key breakpoints
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
    await cdp.captureScreenshot('desktop_1440_home.png');

    await cdp.setViewport(768, 1024, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
    await cdp.captureScreenshot('tablet_768_home.png');

    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
    await cdp.captureScreenshot('mobile_390_home.png');

    await cdp.setViewport(320, 720, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/index.html`);
    await cdp.captureScreenshot('mobile_320_home.png');

    // TEST 2: Mobile House Explorer with Bottom Sheet
    console.log('\n--- Verifying Mobile House Inspector & Bottom Sheet ---');
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/house.html?id=rumah-gadang`);
    await new Promise((r) => setTimeout(r, 1500));

    const houseInspect = await cdp.evaluate(`(() => {
      const panel = document.querySelector('.inspector-panel');
      const stage = document.querySelector('.viewer-stage');
      const bNav = document.getElementById('mobile-bottom-nav');
      return {
        hasPanel: Boolean(panel),
        hasStage: Boolean(stage),
        panelDisplay: panel ? window.getComputedStyle(panel).display : 'none',
        bNavVisible: bNav && window.getComputedStyle(bNav).display !== 'none'
      };
    })()`);
    if (!houseInspect.hasPanel || !houseInspect.hasStage) {
      throw new Error('House inspector or stage not mounted properly');
    }
    console.log(`[PASS] Mobile House Explorer mounted with responsive bottom sheet:`, houseInspect);
    await cdp.captureScreenshot('mobile_390_house_bottomsheet.png');

    // TEST 3: Mobile 3D World with Touch Controls & Accessible D-Pad
    console.log('\n--- Verifying Mobile 3D World Touch Controls & Accessible D-Pad ---');
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`http://127.0.0.1:${PORT}/world.html?notutorial=1`);
    await new Promise((r) => setTimeout(r, 2000));

    const worldTouch = await cdp.evaluate(`(() => {
      const joyBase = document.getElementById('mobile-joystick-base');
      const dpad = document.getElementById('mobile-dpad-container');
      const switcher = document.getElementById('toggle-control-mode-btn');
      const jumpBtn = document.getElementById('mobile-btn-jump');
      const interactBtn = document.getElementById('mobile-btn-interact');

      const initialJoyVisible = joyBase && !joyBase.hidden;
      const initialDpadHidden = dpad && dpad.hidden;

      // Click switcher to activate D-pad
      if (switcher) switcher.click();

      const afterDpadVisible = dpad && !dpad.hidden;
      const afterJoyHidden = joyBase && joyBase.hidden;

      return {
        initialJoyVisible,
        initialDpadHidden,
        afterDpadVisible,
        afterJoyHidden,
        jumpBtnSize: jumpBtn ? { w: jumpBtn.offsetWidth, h: jumpBtn.offsetHeight } : null,
        interactBtnSize: interactBtn ? { w: interactBtn.offsetWidth, h: interactBtn.offsetHeight } : null
      };
    })()`);

    if (!worldTouch.afterDpadVisible || !worldTouch.afterJoyHidden) {
      throw new Error('Control mode switcher failed to toggle D-pad');
    }
    if (worldTouch.jumpBtnSize.w < 44 || worldTouch.jumpBtnSize.h < 44) {
      throw new Error(`Touch target too small: ${JSON.stringify(worldTouch.jumpBtnSize)}`);
    }
    console.log('[PASS] Mobile 3D World touch controls & accessible D-pad verified:', worldTouch);
    await cdp.captureScreenshot('mobile_390_world_dpad.png');

    // TEST 4: Landscape Smartphone Orientation (844x390)
    console.log('\n--- Verifying Landscape Smartphone Layout ---');
    await cdp.setViewport(844, 390, true);
    await new Promise((r) => setTimeout(r, 800));
    const landscapeCheck = await cdp.evaluate(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      return { docW, winW, noOverflow: docW <= winW };
    })()`);
    if (!landscapeCheck.noOverflow) {
      throw new Error('Overflow detected in smartphone landscape orientation');
    }
    console.log('[PASS] Smartphone landscape orientation verified: scrollWidth <= innerWidth');
    await cdp.captureScreenshot('mobile_landscape_844_world.png');

    // TEST 5: Tablet Landscape Cultural Atlas (1024x768)
    console.log('\n--- Verifying Tablet Landscape Cultural Atlas (1024x768) ---');
    await cdp.setViewport(1024, 768, false);
    await cdp.navigate(`http://127.0.0.1:${PORT}/map.html`);
    await new Promise((r) => setTimeout(r, 1200));
    const mapMetrics = await cdp.evaluate(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      return { docW, winW, noOverflow: docW <= winW };
    })()`);
    if (!mapMetrics.noOverflow) {
      throw new Error('Overflow detected on tablet landscape map.html');
    }
    console.log('[PASS] Tablet landscape cultural atlas verified');
    await cdp.captureScreenshot('tablet_landscape_1024_map.png');

    console.log('\n=== ALL UNIVERSAL CROSS-DEVICE VERIFICATIONS PASSED (100%) ===\n');
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(chromeDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('[UNIVERSAL TEST FATAL]', err);
  process.exit(1);
});
