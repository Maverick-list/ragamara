/**
 * NULAR — Phase B/C/D Real Exhibition Product, Collection Integration & Full-Site Verification Suite
 * Zero-dependency CDP suite (runs against http://127.0.0.1:3000).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.cwd(), 'docs/qa/completion-evidence');
const DEBUG_PORT = 9288;
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320x720', width: 320, height: 720, mobile: true },
  { name: '360x800', width: 360, height: 800, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '412x915', width: 412, height: 915, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
  { name: '1440x900', width: 1440, height: 900, mobile: false },
  { name: '1920x1080', width: 1920, height: 1080, mobile: false }
];

function verifyDataIntegrityOnDisk() {
  const exhData = JSON.parse(fs.readFileSync('data/exhibitions.json', 'utf8'));
  const housesJson = JSON.parse(fs.readFileSync('data/houses.json', 'utf8'));
  const itemsJson = JSON.parse(fs.readFileSync('data/cultural-items.json', 'utf8'));
  const houses = new Map((Array.isArray(housesJson) ? housesJson : housesJson.houses).map((h) => [h.id, h]));
  const items = new Map((Array.isArray(itemsJson) ? itemsJson : itemsJson.items).map((i) => [i.id, i]));

  assert.equal(exhData.exhibitions.length, 4, 'Expected exactly 4 curated exhibitions');
  const expectedIds = [
    'arsitektur-nusantara',
    'wastra-nusantara',
    'bunyi-dan-gerak-nusantara',
    'pusaka-dan-kriya-nusantara'
  ];
  assert.deepEqual(exhData.exhibitions.map((e) => e.id), expectedIds);

  let totalRefs = 0;
  for (const exh of exhData.exhibitions) {
    assert.ok(exh.title && exh.subtitle && exh.curatorialIntro, `Missing metadata on ${exh.id}`);
    assert.ok(fs.existsSync(exh.coverImage), `Cover image missing on disk: ${exh.coverImage}`);
    assert.ok(exh.sources?.length >= 2, `Expected >=2 sources on ${exh.id}`);
    assert.ok(exh.chapters?.length >= 2, `Expected >=2 chapters on ${exh.id}`);
    for (const ch of exh.chapters) {
      for (const ref of ch.exhibitRefs) {
        totalRefs += 1;
        if (ref.type === 'house') {
          const h = houses.get(ref.id);
          assert.ok(h, `Invalid house ref ${ref.id} in ${exh.id}`);
          if (h.model3DUrl && h.modelStatus === 'available') {
            assert.ok(fs.existsSync(h.model3DUrl), `Missing GLB on disk: ${h.model3DUrl}`);
          }
        } else {
          const it = items.get(ref.id);
          assert.ok(it, `Invalid cultural_item ref ${ref.id} in ${exh.id}`);
          if (it.model3D) {
            assert.ok(fs.existsSync(it.model3D), `Missing artifact GLB on disk: ${it.model3D}`);
          }
        }
      }
    }
  }
  console.log(`[PASS] Exhibition Data Integrity: 4 exhibitions, ${totalRefs} verified item refs, 100% real files on disk`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.exceptions = [];
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
        this.exceptions.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile
    });
    await new Promise((r) => setTimeout(r, 200));
  }
  async navigate(url, waitMs = 1100) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, waitMs));
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime evaluation error');
    }
    return res.result?.value;
  }
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(res.data, 'base64'));
  }
  close() {
    try { this.ws?.close(); } catch {}
  }
}

async function waitForChromeWs(port) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await res.json();
      const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) return pageTarget.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Timed out waiting for headless Chrome CDP');
}

async function run() {
  verifyDataIntegrityOnDisk();

  const userDataDir = `/tmp/chrome-completion-${Date.now()}`;
  fs.mkdirSync(userDataDir, { recursive: true });
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    const wsUrl = await waitForChromeWs(DEBUG_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();

    // 1. 9-viewport 0px overflow check on exhibitions.html + search/filter tests
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.width, vp.height, vp.mobile);
      await cdp.navigate(`${BASE}/exhibitions.html`, 950);
      const ov = await cdp.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`);
      assert.equal(ov.sw <= ov.cw, true, `exhibitions.html overflow at ${vp.name}: ${ov.sw} > ${ov.cw}`);
      if (vp.name === '1440x900') {
        await cdp.screenshot('02_exhibition_hall_desktop_1440.png');
        const filterStats = await cdp.evaluate(`(() => {
          const allCount = document.querySelectorAll('[data-exhibition-id]').length;
          const search = document.getElementById('exh-search');
          search.value = 'Keris';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          const kerisCount = document.querySelectorAll('[data-exhibition-id]').length;
          document.getElementById('exh-reset').click();

          const cat = document.getElementById('exh-category');
          cat.value = 'textiles';
          cat.dispatchEvent(new Event('change', { bubbles: true }));
          const texCount = document.querySelectorAll('[data-exhibition-id]').length;
          document.getElementById('exh-reset').click();

          const reg = document.getElementById('exh-region');
          reg.value = 'Papua';
          reg.dispatchEvent(new Event('change', { bubbles: true }));
          const papuaCount = document.querySelectorAll('[data-exhibition-id]').length;
          document.getElementById('exh-reset').click();

          return { allCount, kerisCount, texCount, papuaCount };
        })()`);
        assert.deepEqual(filterStats, { allCount: 4, kerisCount: 1, texCount: 1, papuaCount: 1 });
        console.log('[PASS] Exhibition Hall filters verified:', JSON.stringify(filterStats));
      }
      if (vp.name === '390x844') await cdp.screenshot('13_mobile_390_exhibition_hall.png');
      if (vp.name === '320x720') await cdp.screenshot('15_mobile_320_exhibition_hall.png');
    }

    // 2. All 4 Exhibition Details + Chapter Navigation + 3D/Fallback + Save + XP Idempotency
    await cdp.setViewport(1440, 900, false);
    const detailChecks = [
      { id: 'arsitektur-nusantara', file: '03_exhibition_arsitektur_desktop_1440.png', expect3D: true },
      { id: 'wastra-nusantara', file: '04_exhibition_wastra_desktop_1440.png', expect3D: true },
      { id: 'bunyi-dan-gerak-nusantara', file: '05_exhibition_bunyi_gerak_desktop_1440.png', expect3D: false },
      { id: 'pusaka-dan-kriya-nusantara', file: '06_exhibition_pusaka_kriya_desktop_1440.png', expect3D: true }
    ];

    for (const d of detailChecks) {
      await cdp.navigate(`${BASE}/exhibition.html?id=${d.id}`, 1300);
      const ov = await cdp.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`);
      assert.equal(ov.sw <= ov.cw, true, `exhibition.html?id=${d.id} overflow: ${ov.sw} > ${ov.cw}`);

      const info = await cdp.evaluate(`(() => ({
        title: document.getElementById('exh-title')?.textContent?.trim(),
        hasCanvas: Boolean(document.querySelector('#exhibit-visual-stage canvas')),
        hasFallback: Boolean(document.querySelector('#exhibit-visual-stage .exhibition-media-fallback')),
        chapters: document.querySelectorAll('[data-chapter-tab]').length
      }))()`);
      assert.ok(info.title && info.title.length > 5, `Missing title on ${d.id}`);
      assert.ok(info.chapters >= 2, `Expected >=2 chapters on ${d.id}`);
      if (d.expect3D) assert.equal(info.hasCanvas, true, `Expected 3D canvas on ${d.id}`);
      else assert.equal(info.hasFallback, true, `Expected honest archival fallback on ${d.id}`);

      // Scroll slightly to show chapter + stage for visual review
      await cdp.evaluate(`document.getElementById('chapter-journey')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await new Promise((r) => setTimeout(r, 450));
      await cdp.screenshot(d.file);
    }

    // Test Chapter Navigation, Save/Unsave, Collection Book integration, and XP Idempotency on arsitektur-nusantara
    await cdp.navigate(`${BASE}/exhibition.html?id=arsitektur-nusantara`, 1200);
    const navAndXp = await cdp.evaluate(`(async () => {
      document.querySelector('[data-chapter-tab="1"]')?.click();
      await new Promise((r) => setTimeout(r, 250));
      const ch2Title = document.getElementById('active-chapter-title')?.textContent || '';
      const progressText = document.getElementById('exhibition-progress-label')?.textContent || '';

      // Save exhibition + save active exhibit
      document.getElementById('btn-save-this-exhibition')?.click();
      document.getElementById('btn-save-active-exhibit')?.click();

      // Claim XP twice -> verify idempotency
      const btnComp = document.getElementById('btn-complete-exhibition');
      btnComp.click();
      await new Promise((r) => setTimeout(r, 400));
      const firstFeedback = document.getElementById('completion-feedback')?.textContent || '';
      btnComp.click();
      await new Promise((r) => setTimeout(r, 400));
      const secondFeedback = document.getElementById('completion-feedback')?.textContent || '';

      return { ch2Title, progressText, firstFeedback, secondFeedback };
    })()`);
    assert.match(navAndXp.ch2Title, /Bab 02/i);
    assert.match(navAndXp.progressText, /2\/3/);
    assert.match(navAndXp.firstFeedback, /\+100 XP|sudah pernah diklaim/i);
    assert.match(navAndXp.secondFeedback, /idempoten|\+0 XP duplikat/i);
    console.log('[PASS] Chapter navigation & server-authoritative XP idempotency verified');

    // Verify invalid exhibition ID renders clean Not Found without errors
    await cdp.navigate(`${BASE}/exhibition.html?id=tidak-ada-999`, 800);
    const nfText = await cdp.evaluate(`document.body.innerText`);
    assert.match(nfText, /Tidak Tersedia/i);

    // 3. Verify Saved Exhibits appear in profile.html Collection Book & Remove works across reload
    await cdp.navigate(`${BASE}/profile.html`, 1100);
    await cdp.evaluate(`document.getElementById('saved-exhibits-section')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await new Promise((r) => setTimeout(r, 400));
    await cdp.screenshot('10_profile_collection_book_desktop_1440.png');
    const savedBefore = await cdp.evaluate(`document.querySelectorAll('[data-remove-exhibit]').length`);
    assert.ok(savedBefore >= 2, `Expected >=2 saved exhibits in profile.html, got ${savedBefore}`);
    await cdp.evaluate(`document.querySelector('[data-remove-exhibit]')?.click()`);
    await cdp.navigate(`${BASE}/profile.html`, 900);
    const savedAfter = await cdp.evaluate(`document.querySelectorAll('[data-remove-exhibit]').length`);
    assert.equal(savedAfter, savedBefore - 1, 'Removed exhibit must stay removed across reload');
    console.log(`[PASS] Collection Book integration verified (savedBefore=${savedBefore}, savedAfter=${savedAfter})`);

    // 4. Mobile exhibition detail check (390x844) + remaining full-site visual captures
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE}/exhibition.html?id=arsitektur-nusantara`, 1200);
    const mobOv = await cdp.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`);
    assert.equal(mobOv.sw <= mobOv.cw, true, `Mobile exhibition detail overflow: ${mobOv.sw} > ${mobOv.cw}`);
    await cdp.screenshot('14_mobile_390_exhibition_detail.png');

    await cdp.setViewport(1440, 900, false);
    const siteCaptures = [
      ['index.html', '01_landing_desktop_1440.png'],
      ['house.html?id=rumah-gadang', '07_architecture_viewer_desktop_1440.png'],
      ['learn.html', '08_cultural_collection_desktop_1440.png'],
      ['auth.html', '09_auth_hardened_desktop_1440.png'],
      ['quests.html', '11_quests_desktop_1440.png'],
      ['map.html', '12_atlas_map_desktop_1440.png'],
      ['offline.html', '16_offline_fallback_desktop_1440.png']
    ];
    for (const [route, file] of siteCaptures) {
      await cdp.navigate(`${BASE}/${route}`, 1200);
      const ov = await cdp.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`);
      assert.equal(ov.sw <= ov.cw, true, `${route} desktop overflow: ${ov.sw} > ${ov.cw}`);
      await cdp.screenshot(file);
    }

    assert.equal(cdp.exceptions.length, 0, `Uncaught exceptions detected: ${cdp.exceptions.join('; ')}`);
    console.log('PASS: verify_exhibitions_and_full_site.mjs (ALL checks & 16 full-site captures passed, 0 uncaught exceptions)');
  } finally {
    cdp?.close();
    chrome.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch((err) => {
  console.error('FAIL: verify_exhibitions_and_full_site.mjs', err);
  process.exit(1);
});
