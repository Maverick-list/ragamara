/**
 * NULAR — Final Release Readiness Gate: 9-Viewport Zero-Overflow & Evidence Verification
 * Validates exact scrollWidth <= innerWidth across all 9 target viewports (320px..1920px)
 * and captures post-320px-fix screenshots in docs/qa/final-readiness/.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const OUT_DIR = path.join(ROOT_DIR, 'docs/qa/final-readiness');
const BASE_URL = 'http://127.0.0.1:3000';

fs.mkdirSync(OUT_DIR, { recursive: true });

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
      const m = JSON.parse(e.data);
      if (m.id && this.callbacks.has(m.id)) {
        const { resolve, reject } = this.callbacks.get(m.id);
        this.callbacks.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
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
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await new Promise((r) => setTimeout(r, 250));
  }
  async navigate(url, waitMs = 1500) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, waitMs));
    await this.evaluate(`(async () => {
      if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]);
    })()`);
    await new Promise((r) => setTimeout(r, 200));
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }
  async capture(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
    console.log(`[SHOT] ${filename} (${Math.round(buf.length / 1024)} KB, hash=${hash})`);
    return { filename, size: buf.length, hash };
  }
}

async function run() {
  console.log('=== NULAR FINAL RELEASE READINESS: 9-VIEWPORT & 320PX FIX GATE ===\n');
  const chromeDir = `/tmp/chrome-final-gate-${Date.now()}`;
  fs.mkdirSync(chromeDir, { recursive: true });
  const proc = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9272',
    `--user-data-dir=${chromeDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let cdp = null;
  let allPass = true;
  try {
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9272/json/list');
        const tabs = await res.json();
        const t = tabs.find((x) => x.type === 'page');
        if (t?.webSocketDebuggerUrl) { wsUrl = t.webSocketDebuggerUrl; break; }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome');
    cdp = new CDPClient(wsUrl);
    await cdp.connect();

    // 1. Validate ALL 9 Viewports on index.html (strict: scrollWidth <= targetWidth)
    const VIEWPORTS = [
      { w: 320, h: 720, mobile: true, label: '320x720 (Compact Mobile)' },
      { w: 360, h: 800, mobile: true, label: '360x800 (Standard Android)' },
      { w: 390, h: 844, mobile: true, label: '390x844 (iPhone 13/14)' },
      { w: 430, h: 932, mobile: true, label: '430x932 (Pro Max Mobile)' },
      { w: 768, h: 1024, mobile: true, label: '768x1024 (Tablet Portrait)' },
      { w: 1024, h: 768, mobile: false, label: '1024x768 (Tablet Landscape)' },
      { w: 1280, h: 800, mobile: false, label: '1280x800 (Compact Laptop)' },
      { w: 1440, h: 900, mobile: false, label: '1440x900 (Standard Desktop)' },
      { w: 1920, h: 1080, mobile: false, label: '1920x1080 (Full HD Desktop)' }
    ];

    console.log('--- 9-Viewport Overflow Verification (index.html) ---');
    await cdp.navigate(`${BASE_URL}/index.html`, 2000);
    for (const vp of VIEWPORTS) {
      await cdp.setViewport(vp.w, vp.h, vp.mobile);
      const m = await cdp.evaluate('({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })');
      const pass = m.scrollWidth <= vp.w && m.innerWidth <= vp.w;
      if (!pass) allPass = false;
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${vp.label}: scrollWidth=${m.scrollWidth}px, innerWidth=${m.innerWidth}px (target <= ${vp.w}px)`);
    }

    // 2. Capture post-fix evidence screenshots
    console.log('\n--- Capturing Final Readiness Evidence (docs/qa/final-readiness/) ---');
    await cdp.setViewport(320, 720, true);
    await cdp.evaluate('window.scrollTo(0, 0)');
    await new Promise((r) => setTimeout(r, 250));
    await cdp.capture('01_landing_mobile_320_zero_overflow.png');

    await cdp.evaluate('document.getElementById("home-prog-title")?.scrollIntoView({ behavior: "instant", block: "center" })');
    await new Promise((r) => setTimeout(r, 250));
    await cdp.capture('02_landing_mobile_320_progress_wrapped.png');

    await cdp.setViewport(390, 844, true);
    await cdp.evaluate('window.scrollTo(0, 0)');
    await new Promise((r) => setTimeout(r, 250));
    await cdp.capture('03_landing_mobile_390_zero_overflow.png');

    await cdp.setViewport(1440, 900, false);
    await cdp.evaluate('window.scrollTo(0, 0)');
    await new Promise((r) => setTimeout(r, 350));
    await cdp.capture('04_landing_desktop_1440.png');

    // 3D World Desktop & Mobile
    await cdp.navigate(`${BASE_URL}/world.html?house=rumah-gadang&notutorial=1`, 2500);
    for (let i = 0; i < 40; i++) {
      if (await cdp.evaluate('Boolean(window.__NULAR_WORLD__?.running)')) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1000));
    await cdp.capture('05_world_3d_desktop_1440.png');

    await cdp.setViewport(390, 844, true);
    await new Promise((r) => setTimeout(r, 400));
    await cdp.capture('06_world_3d_mobile_390.png');

    // 320px Offline page check & shot
    await cdp.setViewport(320, 720, true);
    await cdp.navigate(`${BASE_URL}/offline.html`, 800);
    const offM = await cdp.evaluate('({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })');
    const offPass = offM.scrollWidth <= 320;
    if (!offPass) allPass = false;
    console.log(`[${offPass ? 'PASS' : 'FAIL'}] Offline 320x720: scrollWidth=${offM.scrollWidth}px <= 320px`);
    await cdp.capture('07_offline_mobile_320.png');

    console.log(`\n=== 9-VIEWPORT GATE RESULT: ${allPass ? 'ALL PASSED (TRUE 0PX OVERFLOW)' : 'OVERFLOW DETECTED'} ===`);
    if (!allPass) process.exitCode = 1;
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (cdp?.ws) cdp.ws.close();
    proc.kill();
  }
}

run();
