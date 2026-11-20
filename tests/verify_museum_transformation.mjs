import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const REPORT_DIR = path.join(ROOT_DIR, 'reports/museum-transformation-qa');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
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
    this.httpErrorResponses = [];
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
        } else if (msg.method === 'Network.loadingFailed') {
          if (!msg.params.canceled) {
            this.failedRequests.push({ errorText: msg.params.errorText, type: msg.params.type });
          }
        } else if (msg.method === 'Network.responseReceived') {
          const { status, url } = msg.params.response || {};
          if (status >= 400 && url.startsWith('http://127.0.0.1')) {
            this.httpErrorResponses.push({ status, url });
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

  async navigate(url, waitMs = 1800) {
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
  const debugPort = 9322;
  const userDataDir = `/tmp/nular_museum_qa_${Date.now()}`;

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

  await new Promise((r) => setTimeout(r, 1800));

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };

  function record(name, passed, details = {}) {
    results.tests.push({ name, status: passed ? 'PASS' : 'FAIL', details });
    results.summary.total++;
    if (passed) results.summary.passed++;
    else results.summary.failed++;
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`, passed ? '' : JSON.stringify(details));
  }

  let cdp = null;
  try {
    const tabsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const tabs = await tabsRes.json();
    const pageTab = tabs.find((t) => t.type === 'page');
    if (!pageTab?.webSocketDebuggerUrl) throw new Error('Chrome CDP tab not found');

    cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();

    // 1. HOME — Desktop (1440x900) + Live 3D Hero Preview + No Gamification Clutter
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE}/index.html`, 2800);
    await cdp.eval(`document.fonts ? document.fonts.ready.then(() => true) : true`);
    await new Promise((r) => setTimeout(r, 400));
    const homeCheck = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1')?.innerText?.trim();
      const navLinks = [...document.querySelectorAll('.museum-nav__link')].map(a => a.innerText.trim());
      const bodyText = document.body.innerText;
      const hasGameClutter = /Toko Adat|Mini-Game|Leaderboard|XP Diraih|Permata/i.test(bodyText);
      const hasCanvas = !!document.querySelector('#hero-3d-canvas canvas');
      const featuredCount = document.querySelectorAll('#featured-houses-grid .house-card').length;
      const islandTiles = document.querySelectorAll('#island-explorer-grid .island-tile').length;
      return { h1, navLinks, hasGameClutter, hasCanvas, featuredCount, islandTiles };
    })()`);
    await cdp.screenshot('museum_01_home_desktop.png');
    results.screenshots.push('museum_01_home_desktop.png');
    record(
      '1. Home Living Atlas Desktop & Live 3D Hero Preview',
      homeCheck.h1 === 'Discover the Architecture of Nusantara.' &&
      homeCheck.navLinks.length === 5 &&
      !homeCheck.hasGameClutter &&
      homeCheck.hasCanvas &&
      homeCheck.featuredCount === 4 &&
      homeCheck.islandTiles === 8,
      homeCheck
    );

    // 2. HOME — Mobile (390x844)
    await cdp.setViewport(390, 844, true);
    await new Promise((r) => setTimeout(r, 700));
    const homeMobileCheck = await cdp.eval(`(() => ({
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2,
      mobileMenuBtn: !!document.getElementById('mobile-menu-toggle')
    }))()`);
    await cdp.screenshot('museum_02_home_mobile.png');
    results.screenshots.push('museum_02_home_mobile.png');
    record('2. Home Living Atlas Mobile Responsive (390x844)', homeMobileCheck.noOverflow && homeMobileCheck.mobileMenuBtn, homeMobileCheck);

    // 3. EXPLORE — Catalog Search & Multi-Facet Filters
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE}/explore.html`, 1600);
    await cdp.screenshot('museum_03_explore_desktop.png');
    results.screenshots.push('museum_03_explore_desktop.png');

    const exploreCheck = await cdp.eval(`(() => {
      const totalCards = document.querySelectorAll('#catalog-grid .house-card').length;

      // Test local/alternative name search
      const search = document.getElementById('search-input');
      search.value = 'Bagonjong';
      search.dispatchEvent(new Event('input'));
      const searchBagonjong = document.querySelectorAll('#catalog-grid .house-card').length;

      // Reset & test multi-tradition province Sumatera Barat (Rumah Gadang + Uma Mentawai)
      document.getElementById('reset-filters-btn').click();
      const prov = document.getElementById('filter-province');
      prov.value = 'Sumatera Barat';
      prov.dispatchEvent(new Event('change'));
      const sumbarCount = document.querySelectorAll('#catalog-grid .house-card').length;

      // Reset & test 3D available filter
      document.getElementById('reset-filters-btn').click();
      const f3d = document.getElementById('filter-3d');
      f3d.value = 'available';
      f3d.dispatchEvent(new Event('change'));
      const count3D = document.querySelectorAll('#catalog-grid .house-card').length;

      return { totalCards, searchBagonjong, sumbarCount, count3D };
    })()`);
    record(
      '3. Explore Catalog Search, Multi-Tradition Province & 3D Filter',
      exploreCheck.totalCards === 14 && exploreCheck.searchBagonjong === 1 && exploreCheck.sumbarCount === 2 && exploreCheck.count3D === 4,
      exploreCheck
    );

    // 4. HOUSE 3D EXPLORER — Rumah Gadang (GLB load, Rotate, Zoom, Reset, Hotspot, Exploded View)
    await cdp.navigate(`${BASE}/house.html?id=rumah-gadang`, 2800);
    const rg3D = await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      if (!v || !v.modelRoot) return { loaded: false };
      const initialDist = v.camera.position.distanceTo(v.controls.target);
      v.zoomBy(0.8);
      const zoomedDist = v.camera.position.distanceTo(v.controls.target);
      v.rotateBy(0.45);
      v.resetCamera();
      const interiorDisabled = document.querySelector('[data-mode="interior"]')?.disabled === true;
      const explodedEnabled = document.querySelector('[data-mode="exploded"]')?.disabled === false;
      const hotspotPins = document.querySelectorAll('.hotspot-pin').length;
      return {
        loaded: true,
        componentGroups: v.componentGroups.size,
        zoomWorked: zoomedDist < initialDist,
        interiorDisabled,
        explodedEnabled,
        hotspotPins
      };
    })()`);
    await cdp.screenshot('museum_04_house_rumah_gadang_3d.png');
    results.screenshots.push('museum_04_house_rumah_gadang_3d.png');
    record(
      '4. 3D Explorer — Rumah Gadang GLB Load, Orbit/Zoom/Reset & Hotspots',
      rg3D.loaded && rg3D.componentGroups === 8 && rg3D.zoomWorked && rg3D.interiorDisabled && rg3D.explodedEnabled && rg3D.hotspotPins === 8,
      rg3D
    );

    // 5. Exploded View + Hotspot Component Selection on Rumah Gadang
    await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      v.setViewMode('exploded');
      v.selectHotspot('rg-atap');
    })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const explodedCheck = await cdp.eval(`(() => {
      const v = window.__NULAR_VIEWER__;
      const roofGroup = v.componentGroups.get('atap_gonjong');
      const heading = document.getElementById('inspector-heading')?.innerText?.trim();
      return {
        explodeFactor: +v.explodeFactor.toFixed(2),
        roofMovedUp: roofGroup ? roofGroup.group.position.y > 1.2 : false,
        inspectorHeading: heading
      };
    })()`);
    await cdp.screenshot('museum_05_house_rumah_gadang_exploded.png');
    results.screenshots.push('museum_05_house_rumah_gadang_exploded.png');
    record(
      '5. 3D Exploded View & Contextual Hotspot Inspection',
      explodedCheck.roofMovedUp && explodedCheck.inspectorHeading === 'Atap Gonjong Melengkung',
      explodedCheck
    );

    // 6. Save House + Personal Study Note on Rumah Gadang
    await cdp.eval(`(() => {
      document.querySelector('[data-toggle-save="rumah-gadang"]')?.click();
      const ta = document.getElementById('personal-note-input');
      ta.value = 'Batu sandi berfungsi sebagai isolator kelembapan dan peredam gempa alami.';
      document.getElementById('save-note-btn')?.click();
    })()`);

    // 7. Mobile 3D Explorer Viewport Check (390x844)
    await cdp.setViewport(390, 844, true);
    await cdp.eval(`window.__NULAR_VIEWER__?.resetCamera()`);
    await new Promise((r) => setTimeout(r, 900));
    const mobile3D = await cdp.eval(`(() => ({
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2,
      canvasTouchLock: getComputedStyle(document.querySelector('.viewer-canvas')).touchAction === 'none'
    }))()`);
    await cdp.screenshot('museum_06_house_3d_mobile.png');
    results.screenshots.push('museum_06_house_3d_mobile.png');
    record('6. 3D Viewer Mobile Responsive & Touch Scroll Lock', mobile3D.noOverflow && mobile3D.canvasTouchLock, mobile3D);

    // 8. Second & Third & Fourth 3D Models (Tongkonan, Joglo Interior, Honai Interior Cutaway)
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE}/house.html?id=tongkonan-toraja`, 2400);
    const tkLoaded = await cdp.eval(`!!window.__NULAR_VIEWER__?.modelRoot && window.__NULAR_VIEWER__.componentGroups.size === 7`);
    await cdp.screenshot('museum_07_house_tongkonan_3d.png');
    results.screenshots.push('museum_07_house_tongkonan_3d.png');
    record('7. 3D Model #2 — Tongkonan Toraja GLB (7 Components)', tkLoaded);

    await cdp.navigate(`${BASE}/house.html?id=rumah-joglo`, 2400);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1100));
    const jogloCheck = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      interiorEnabled: document.querySelector('[data-mode="interior"]')?.disabled === false,
      mode: window.__NULAR_VIEWER__?.currentMode
    }))()`);
    await cdp.screenshot('museum_08_house_joglo_interior_3d.png');
    results.screenshots.push('museum_08_house_joglo_interior_3d.png');
    record('8. 3D Model #3 — Rumah Joglo GLB + True Interior Tumpang Sari Mode', jogloCheck.loaded && jogloCheck.interiorEnabled && jogloCheck.mode === 'interior', jogloCheck);

    await cdp.navigate(`${BASE}/house.html?id=honai-papua`, 2400);
    await cdp.eval(`window.__NULAR_VIEWER__?.setViewMode('interior')`);
    await new Promise((r) => setTimeout(r, 1100));
    const honaiCheck = await cdp.eval(`(() => ({
      loaded: !!window.__NULAR_VIEWER__?.modelRoot,
      roofLifted: window.__NULAR_VIEWER__?.componentGroups.get('atap_kubah_jerami')?.group.position.y > 1.5
    }))()`);
    await cdp.screenshot('museum_09_house_honai_interior_3d.png');
    results.screenshots.push('museum_09_house_honai_interior_3d.png');
    record('9. 3D Model #4 — Honai Papua GLB + Two-Level Interior Cutaway', honaiCheck.loaded && honaiCheck.roofLifted, honaiCheck);

    // 10. Transparent Handling of Missing 3D Model (Mbaru Niang Wae Rebo)
    await cdp.navigate(`${BASE}/house.html?id=mbaru-niang`, 1600);
    const prepCheck = await cdp.eval(`(() => ({
      hasTransparentBanner: document.body.innerText.includes('Model 3D sedang disiapkan'),
      noFake3DCanvas: !document.querySelector('#house-3d-stage'),
      hasPhotographerAttribution: document.body.innerText.includes('AsdarMunandar') && document.body.innerText.includes('CC BY-SA 4.0')
    }))()`);
    await cdp.screenshot('museum_10_house_mbaru_niang_prep.png');
    results.screenshots.push('museum_10_house_mbaru_niang_prep.png');
    record('10. Missing 3D Model Handled Transparently with Verified Photography', prepCheck.hasTransparentBanner && prepCheck.noFake3DCanvas && prepCheck.hasPhotographerAttribution, prepCheck);

    // 11. Interactive Indonesia Architecture Map
    await cdp.navigate(`${BASE}/map.html`, 1600);
    await cdp.eval(`document.querySelector('[data-island="Sulawesi"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await new Promise((r) => setTimeout(r, 400));
    const sulawesiText = await cdp.eval(`document.getElementById('panel-region-body')?.innerText || ''`);
    await cdp.screenshot('museum_11_architecture_map.png');
    results.screenshots.push('museum_11_architecture_map.png');
    await cdp.eval(`document.getElementById('show-all-islands-btn')?.click()`);
    await new Promise((r) => setTimeout(r, 250));
    await cdp.eval(`document.querySelector('[data-select-province="Aceh"]')?.click()`);
    await new Promise((r) => setTimeout(r, 250));
    const acehUnderResearch = await cdp.eval(`/dalam penelitian/i.test(document.getElementById('panel-region-body')?.innerText || '')`);
    record(
      '11. Interactive Map Connected to Catalog & Honest Research Coverage',
      sulawesiText.includes('Tongkonan') && sulawesiText.includes('Saoraja') && acehUnderResearch,
      { hasTongkonan: sulawesiText.includes('Tongkonan'), hasSaoraja: sulawesiText.includes('Saoraja'), acehUnderResearch }
    );

    // 12. Architectural Details & Side-by-Side Comparator
    await cdp.navigate(`${BASE}/anatomy.html?a=rumah-gadang&b=honai-papua#comparator`, 1600);
    const compareCheck = await cdp.eval(`(() => {
      const txt = document.getElementById('comparison-table-container')?.innerText || '';
      return txt.includes('Rumah Gadang') && txt.includes('Honai') && txt.includes('Batu Sandi');
    })()`);
    await cdp.screenshot('museum_12_anatomy_comparator.png');
    results.screenshots.push('museum_12_anatomy_comparator.png');
    record('12. Architectural Anatomy & Two-House Structural Comparator', compareCheck);

    // 13. About NULAR & Dynamic Attribution Registry
    await cdp.navigate(`${BASE}/about.html`, 1600);
    const aboutCheck = await cdp.eval(`(() => {
      const rows = document.querySelectorAll('#attribution-registry-table tbody tr').length;
      const txt = document.body.innerText;
      return { rows, hasTangibleDistinction: txt.includes('tangible architectural heritage') || txt.includes('Warisan Benda') };
    })()`);
    await cdp.screenshot('museum_13_about_attribution.png');
    results.screenshots.push('museum_13_about_attribution.png');
    record('13. About NULAR & Complete 14-Entry Attribution Registry', aboutCheck.rows === 14 && aboutCheck.hasTangibleDistinction, aboutCheck);

    // 14. Exploration Journal (Profile) Persistence Verification
    await cdp.navigate(`${BASE}/profile.html`, 1600);
    const profileCheck = await cdp.eval(`(() => {
      const txt = document.body.innerText;
      return {
        hasSavedGadang: document.querySelectorAll('#saved-houses-grid .house-card').length >= 1,
        hasHistory: document.querySelectorAll('#history-list a').length >= 4,
        hasSavedNote: txt.includes('isolator kelembapan'),
        hasMilestones: document.querySelectorAll('#milestones-grid article').length === 5,
        noGamification: !/\b(XP|Gems|Leaderboard|Streak)\b/i.test(txt)
      };
    })()`);
    await cdp.screenshot('museum_14_exploration_journal.png');
    results.screenshots.push('museum_14_exploration_journal.png');
    record(
      '14. Exploration Journal Persistence (Saved, History, Notes, Milestones)',
      profileCheck.hasSavedGadang && profileCheck.hasHistory && profileCheck.hasSavedNote && profileCheck.hasMilestones && profileCheck.noGamification,
      profileCheck
    );

    // 15. Console, Runtime & HTTP Network Health
    record(
      '15. Zero Uncaught Exceptions, Zero Console Errors & Zero 4xx/5xx Responses',
      cdp.pageErrors.length === 0 && cdp.consoleErrors.length === 0 && cdp.httpErrorResponses.length === 0,
      { pageErrors: cdp.pageErrors, consoleErrors: cdp.consoleErrors, httpErrors: cdp.httpErrorResponses }
    );

    results.consoleErrors = cdp.consoleErrors;
    results.pageErrors = cdp.pageErrors;
    results.httpErrorResponses = cdp.httpErrorResponses;
    fs.writeFileSync(path.join(REPORT_DIR, 'qa_results.json'), JSON.stringify(results, null, 2));
    console.log(`\n[MUSEUM QA COMPLETE] Total: ${results.summary.total} | Passed: ${results.summary.passed} | Failed: ${results.summary.failed}`);
    if (results.summary.failed > 0) process.exitCode = 1;
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('[FATAL QA ERROR]', err);
  process.exit(1);
});
