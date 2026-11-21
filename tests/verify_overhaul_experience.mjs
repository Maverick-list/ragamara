import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.cwd(), 'docs/qa/overhaul-evidence');
const DEBUG_PORT = 9277;
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
    await new Promise((r) => setTimeout(r, 250));
  }
  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1100));
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
  const userDataDir = `/tmp/chrome-overhaul-${Date.now()}`;
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

    // 1. Check index.html across all 9 viewports + capture visual evidence
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.width, vp.height, vp.mobile);
      await cdp.navigate(`${BASE}/index.html`);
      const ov = await cdp.evaluate(`({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth
      })`);
      assert.equal(ov.sw <= ov.cw, true, `index.html overflow at ${vp.name}: ${ov.sw} > ${ov.cw}`);

      if (vp.name === '1440x900') {
        const info = await cdp.evaluate(`({
          plates: document.querySelectorAll('.exhibition-plate').length,
          hasQuote: Boolean(document.querySelector('.curatorial-quote-band')),
          hasProgress: Boolean(document.querySelector('.museum-scroll-progress'))
        })`);
        assert.equal(info.plates, 4, 'Expected 4 exhibition plates');
        assert.equal(info.hasQuote, true, 'Expected curatorial quote band');
        assert.equal(info.hasProgress, true, 'Expected scroll progress bar');

        await cdp.screenshot('home_desktop_1440_top.png');
        await cdp.evaluate(`document.getElementById('exhibitions-heading')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
        await new Promise((r) => setTimeout(r, 700));
        await cdp.screenshot('home_desktop_1440_exhibitions.png');
        await cdp.evaluate(`document.querySelector('.curatorial-quote-band')?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
        await new Promise((r) => setTimeout(r, 700));
        await cdp.screenshot('home_desktop_1440_quote.png');
      }
      if (vp.name === '390x844') {
        await cdp.screenshot('home_mobile_390_top.png');
        await cdp.evaluate(`document.getElementById('exhibitions-heading')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
        await new Promise((r) => setTimeout(r, 600));
        await cdp.screenshot('home_mobile_390_exhibitions.png');
      }
      if (vp.name === '320x720') {
        await cdp.screenshot('home_mobile_320_top.png');
      }
    }

    // 2. Check auth.html across all 9 viewports + diagnostics strip + password strength meter
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.width, vp.height, vp.mobile);
      await cdp.navigate(`${BASE}/auth.html`);
      const ov = await cdp.evaluate(`({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth
      })`);
      assert.equal(ov.sw <= ov.cw, true, `auth.html overflow at ${vp.name}: ${ov.sw} > ${ov.cw}`);

      if (vp.name === '1440x900') {
        const diag = await cdp.evaluate(`document.getElementById('auth-diagnostics-strip')?.innerText || ''`);
        assert.match(diag, /Rate-Limit Login: Aktif/i, 'Expected Rate-Limit Login badge');
        assert.match(diag, /Penyimpanan:/i, 'Expected Storage Mode badge');

        const weakLabel = await cdp.evaluate(`(() => {
          const el = document.getElementById('auth-password');
          el.value = 'abc';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return document.getElementById('password-strength-label')?.textContent?.trim();
        })()`);
        assert.equal(weakLabel, 'Lemah');

        const strongLabel = await cdp.evaluate(`(() => {
          const el = document.getElementById('auth-password');
          el.value = 'NularMuseum#2026';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return document.getElementById('password-strength-label')?.textContent?.trim();
        })()`);
        assert.equal(strongLabel, 'Kuat');

        await cdp.screenshot('auth_desktop_1440_hardened.png');
      }
      if (vp.name === '390x844') {
        await cdp.screenshot('auth_mobile_390_hardened.png');
      }
    }

    // 3. Verify prefers-reduced-motion compliance via Emulation.setEmulatedMedia
    await cdp.setViewport(1440, 900, false);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await cdp.navigate(`${BASE}/index.html`);
    const allVisible = await cdp.evaluate(`(() => {
      const els = Array.from(document.querySelectorAll('[data-museum-reveal]'));
      return els.length > 0 && els.every((el) => getComputedStyle(el).opacity === '1');
    })()`);
    assert.equal(allVisible, true, 'All [data-museum-reveal] elements must be opacity:1 under prefers-reduced-motion');

    console.log('PASS: verify_overhaul_experience.mjs (9-viewport 0px overflow + exhibition plates + auth diagnostics + reduced-motion)');
  } finally {
    cdp?.close();
    chrome.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch((err) => {
  console.error('FAIL: verify_overhaul_experience.mjs', err);
  process.exit(1);
});
