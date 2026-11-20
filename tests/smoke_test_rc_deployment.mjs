import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const REPORT_DIR = path.join(ROOT_DIR, 'reports/release-candidate-qa');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = 'https://ragamara-ntajmyfxq-firza-miftahul-ilmis-projects.vercel.app';
const SHARE_PARAM = '_vercel_share=TtNu3Efn5XwSvQRg1PJDA3BNXfeWLKER';

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
          if (status >= 400 && url.startsWith(BASE)) {
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

  async navigate(url, waitMs = 2800) {
    const sep = url.includes('?') ? '&' : '?';
    const targetUrl = url.includes('_vercel_share') ? url : `${url}${sep}${SHARE_PARAM}`;
    await this.send('Page.navigate', { url: targetUrl });
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
  const debugPort = 9345;
  const userDataDir = `/tmp/chrome_smoke_rc_${Date.now()}`;

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
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Smoke Test ${id}: ${name}`);
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

    console.log(`Connecting to RC Deployment at ${BASE}...`);

    // 1. Mobile Menu Button 44x44px on Deployed Preview (commit 78fbcfd)
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE}/index.html`, 3000);
    const menuSmoke = await cdp.eval(`(() => {
      const btn = document.getElementById('mobile-menu-toggle');
      if (!btn) return { exists: false };
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      
      btn.click();
      const isOpen = document.getElementById('mobile-nav-drawer')?.classList.contains('is-open');
      btn.click();
      const isClosed = !document.getElementById('mobile-nav-drawer')?.classList.contains('is-open');

      return {
        exists: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        isOpen,
        isClosed
      };
    })()`);
    await cdp.screenshot('rc_smoke_01_mobile_menu.png');
    record(1, 'RC Deployment: Mobile Menu 44x44px Target & State Toggle',
      menuSmoke.width >= 44 && menuSmoke.height >= 44 && menuSmoke.isOpen && menuSmoke.isClosed,
      menuSmoke
    );

    // 2. Mobile Hotspot Touch Expander (::before min 44x44px) on Deployed Preview
    await cdp.navigate(`${BASE}/house.html?id=rumah-gadang`, 3500);
    const hotspotSmoke = await cdp.eval(`(() => {
      const pin = document.querySelector('.hotspot-pin');
      if (!pin) return { found: false };
      const rect = pin.getBoundingClientRect();
      const beforeStyle = window.getComputedStyle(pin, '::before');
      
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
    await cdp.screenshot('rc_smoke_02_hotspot_expanded.png');
    record(2, 'RC Deployment: Hotspot 44x44px Touch Expander (::before) & Dossier',
      hotspotSmoke.found && 
      parseInt(hotspotSmoke.pseudoMinWidth) >= 44 && 
      parseInt(hotspotSmoke.pseudoMinHeight) >= 44 && 
      hotspotSmoke.isSelected,
      hotspotSmoke
    );

    // 3. Exploded View & Hotspot Selection on Deployed Preview
    await cdp.setViewport(1440, 900, false);
    await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      v.setViewMode('exploded');
    })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const explodedSmoke = await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      return {
        mode: v.currentMode,
        factor: v.explodeFactor,
        roofY: v.componentGroups.get('atap_gonjong')?.group.position.y
      };
    })()`);
    await cdp.screenshot('rc_smoke_03_exploded_view.png');
    record(3, 'RC Deployment: 3D Exploded View Structural Displacement',
      explodedSmoke.mode === 'exploded' && explodedSmoke.roofY > 1.2,
      explodedSmoke
    );

    // 4. Rumah Joglo Interior Pendopo Mode on Deployed Preview
    await cdp.navigate(`${BASE}/house.html?id=rumah-joglo`, 3200);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1200));
    const jogloSmoke = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      mode: window.__NULAR_VIEWER__?.currentMode
    }))()`);
    await cdp.screenshot('rc_smoke_04_joglo_interior.png');
    record(4, 'RC Deployment: Rumah Joglo Interior Pendopo Mode',
      jogloSmoke.loaded && jogloSmoke.mode === 'interior',
      jogloSmoke
    );

    // 5. Honai Papua Cutaway Mode on Deployed Preview
    await cdp.navigate(`${BASE}/house.html?id=honai-papua`, 3200);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1200));
    const honaiSmoke = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      roofY: window.__NULAR_VIEWER__?.componentGroups.get('atap_kubah_jerami')?.group.position.y
    }))()`);
    await cdp.screenshot('rc_smoke_05_honai_cutaway.png');
    record(5, 'RC Deployment: Honai Papua Two-Level Cutaway Mode',
      honaiSmoke.loaded && honaiSmoke.roofY > 1.5,
      honaiSmoke
    );

    // 6. Zero Console Errors & Zero Failed Network Responses
    record(6, 'RC Deployment: Zero Console Errors & Zero 4xx/5xx HTTP Errors',
      cdp.consoleErrors.length === 0 && cdp.pageErrors.length === 0 && cdp.httpErrors.length === 0,
      { console: cdp.consoleErrors, page: cdp.pageErrors, http: cdp.httpErrors }
    );

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n======================================`);
  console.log(`RC DEPLOYMENT SMOKE TESTS: ${passed}/${results.length} PASSED`);
  console.log(`======================================\n`);

  fs.writeFileSync(path.join(REPORT_DIR, 'rc_smoke_results.json'), JSON.stringify(results, null, 2));

  if (passed !== results.length) process.exit(1);
}

run().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
