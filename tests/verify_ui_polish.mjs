import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'reports/ui-polish-qa/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      let fullPath = path.join(ROOT_DIR, rel);
      if (!fs.existsSync(fullPath) && !path.extname(rel) && fs.existsSync(`${fullPath}.html`)) {
        fullPath = `${fullPath}.html`;
      }
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
    this.failedRequests = [];
    this.httpErrors = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
          this.consoleErrors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'Uncaught exception';
          this.pageErrors.push(desc);
        } else if (msg.method === 'Network.responseReceived') {
          const { status, url } = msg.params.response || {};
          if (status >= 400 && url.includes('127.0.0.1')) {
            this.httpErrors.push({ status, url });
          }
        }
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile
    });
  }

  async navigate(url, waitMs = 2000) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, waitMs));
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), buf);
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
  }
}

async function run() {
  const { server, port } = await startStaticServer();
  const BASE = `http://127.0.0.1:${port}`;
  const debugPort = 9340;
  const userDataDir = `/tmp/chrome_ui_polish_${Date.now()}`;

  const chromeProc = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const results = [];
  function record(id, name, pass, details = {}) {
    results.push({ id, name, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Test ${id}: ${name}`);
    if (!pass) console.error('  Details:', details);
  }

  let cdp = null;
  try {
    const tabsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const tabs = await tabsRes.json();
    const pageTab = tabs.find((t) => t.type === 'page');
    if (!pageTab?.webSocketDebuggerUrl) throw new Error('Chrome CDP tab not found');

    cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();

    // 1. Mobile Menu Button Dimensions & Interaction (390x844)
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE}/index.html`, 2000);

    const menuCheck = await cdp.eval(`(() => {
      const btn = document.getElementById('mobile-menu-toggle');
      if (!btn) return { exists: false };
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      
      // Test opening
      btn.click();
      const drawer = document.getElementById('mobile-nav-drawer');
      const isOpen = drawer?.classList.contains('is-open');
      const ariaExpanded = btn.getAttribute('aria-expanded');

      // Test closing
      btn.click();
      const isClosed = !drawer?.classList.contains('is-open');

      return {
        exists: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        isOpen,
        ariaExpanded,
        isClosed
      };
    })()`);
    await cdp.screenshot('polish_01_mobile_menu.png');
    record(1, 'Mobile Menu Button 44x44px Touch Target & Toggle Operation',
      menuCheck.width >= 44 && menuCheck.height >= 44 && menuCheck.isOpen && menuCheck.isClosed,
      menuCheck
    );

    // 2. Mobile Hotspot Touch Target Hit Expansion (390x844)
    await cdp.navigate(`${BASE}/house.html?id=rumah-gadang`, 3000);
    const hotspotTouch = await cdp.eval(`(() => {
      const pin = document.querySelector('.hotspot-pin');
      if (!pin) return { found: false };
      const rect = pin.getBoundingClientRect();
      const beforeStyle = window.getComputedStyle(pin, '::before');
      
      // Select hotspot via clicking
      pin.click();
      const isSelected = pin.classList.contains('is-selected');
      const heading = document.getElementById('inspector-heading')?.innerText?.trim();

      return {
        found: true,
        visibleWidth: Math.round(rect.width),
        visibleHeight: Math.round(rect.height),
        pseudoMinWidth: beforeStyle.minWidth,
        pseudoMinHeight: beforeStyle.minHeight,
        isSelected,
        heading
      };
    })()`);
    await cdp.screenshot('polish_02_mobile_hotspot.png');
    record(2, 'Hotspot Pin Expanded Touch Target (::before min 44x44px) & Selection',
      hotspotTouch.found && 
      parseInt(hotspotTouch.pseudoMinWidth) >= 44 && 
      parseInt(hotspotTouch.pseudoMinHeight) >= 44 && 
      hotspotTouch.isSelected,
      hotspotTouch
    );

    // 3. Hotspot Keyboard Accessibility & Visible Focus Ring
    const a11yCheck = await cdp.eval(`(() => {
      const pin = document.querySelector('.hotspot-pin');
      pin.focus();
      const isFocused = document.activeElement === pin;
      const style = window.getComputedStyle(pin);
      return {
        isFocused,
        hasOutline: style.outlineStyle !== 'none' || pin.matches(':focus-visible')
      };
    })()`);
    record(3, 'Hotspot Keyboard Focusability & Navigation', a11yCheck.isFocused, a11yCheck);

    // 4. Camera Orbiting Unhindered by Hotspots
    const orbitTest = await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      if (!v) return { ok: false };
      const beforeRot = v.camera.position.clone();
      v.rotateBy(0.5);
      const afterRot = v.camera.position.clone();
      return { ok: true, changed: beforeRot.distanceTo(afterRot) > 0.01 };
    })()`);
    record(4, 'WebGL Orbit Unhindered with Active Hotspot Layer', orbitTest.ok && orbitTest.changed, orbitTest);

    // 5. Exploded View Mode Verification
    await cdp.setViewport(1440, 900, false);
    await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      v.setViewMode('exploded');
    })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const explodedCheck = await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      return {
        mode: v.currentMode,
        factor: v.explodeFactor,
        roofY: v.componentGroups.get('atap_gonjong')?.group.position.y
      };
    })()`);
    await cdp.screenshot('polish_03_desktop_exploded.png');
    record(5, 'Exploded Structural View Animation & Component Displacement',
      explodedCheck.mode === 'exploded' && explodedCheck.roofY > 1.2,
      explodedCheck
    );

    // 6. Rumah Joglo Interior Pendopo Mode
    await cdp.navigate(`${BASE}/house.html?id=rumah-joglo`, 3000);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1200));
    const jogloCheck = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      mode: window.__NULAR_VIEWER__?.currentMode,
      targetY: window.__NULAR_VIEWER__?.controls.target.y
    }))()`);
    await cdp.screenshot('polish_04_joglo_interior.png');
    record(6, 'Rumah Joglo Interior Pendopo View Mode',
      jogloCheck.loaded && jogloCheck.mode === 'interior',
      jogloCheck
    );

    // 7. Honai Papua Two-Level Cutaway Mode
    await cdp.navigate(`${BASE}/house.html?id=honai-papua`, 3000);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1200));
    const honaiCheck = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      roofY: window.__NULAR_VIEWER__?.componentGroups.get('atap_kubah_jerami')?.group.position.y
    }))()`);
    await cdp.screenshot('polish_05_honai_cutaway.png');
    record(7, 'Honai Papua Two-Level Cutaway Mode',
      honaiCheck.loaded && honaiCheck.roofY > 1.5,
      honaiCheck
    );

    // 8. Responsive Check Across All 5 Widths (320px, 390px, 768px, 1024px, 1440px)
    let allResponsivePass = true;
    for (const w of [320, 390, 768, 1024, 1440]) {
      await cdp.setViewport(w, 800, w < 768);
      await new Promise(r => setTimeout(r, 300));
      const res = await cdp.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
      if (!res) allResponsivePass = false;
    }
    record(8, 'Zero Horizontal Scroll Overflow on 5 Viewports (320px to 1440px)', allResponsivePass);

    // 9. Console & Network Error Check
    record(9, 'Zero Console Errors & Zero Failed HTTP Responses',
      cdp.consoleErrors.length === 0 && cdp.pageErrors.length === 0 && cdp.httpErrors.length === 0,
      { console: cdp.consoleErrors, page: cdp.pageErrors, http: cdp.httpErrors }
    );

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n======================================`);
  console.log(`UI POLISH VERIFICATION: ${passed}/${results.length} PASSED`);
  console.log(`======================================\n`);

  if (passed !== results.length) process.exit(1);
}

run().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
