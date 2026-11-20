import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png'
};

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = decodeURIComponent((req.url || '/').split('?')[0]);
      const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else { res.writeHead(404); res.end('Not found'); }
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
  });
}

async function main() {
  const { s, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const debugPort = 9355;
  const userDataDir = `/tmp/nular_p45_${Date.now()}`;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1700));

  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let cid = 0;
    const errs = [];
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++cid;
      const h = (e) => { const m = JSON.parse(e.data); if (m.id === cid) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable');
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

    await send('Page.navigate', { url: `${base}/world.html?house=rumah-joglo` });
    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (await evalJs(`Boolean(window.__NULAR_WORLD__?.running && window.__NULAR_WORLD__?.activeHouse?.id === 'rumah-joglo')`)) break;
    }

    const res = await evalJs(`(async () => {
      const w = window.__NULAR_WORLD__;
      w.character.setCustomization({ hairstyle: 'bun', accessory: 'blangkon' });
      const customCount = w.character.customAttachmentGroup.children.length;

      w.setCameraMode('first-person');
      await new Promise(r => setTimeout(r, 250));
      const fpVisible = w.character.avatarGroup.visible;

      w.setCameraMode('free-explore');
      await new Promise(r => setTimeout(r, 250));
      const freeMode = w.cameraCtrl.mode;

      w.setCameraMode('third-person');
      const qualResolved = w.gameScene.setQualityProfile('low');

      return { customCount, fpVisible, freeMode, tpVisible: w.character.avatarGroup.visible, qualResolved };
    })()`);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase4_5_world_custom_camera.png'), Buffer.from(shot.data, 'base64'));

    const ok = res.customCount === 2 && res.fpVisible === false && res.freeMode === 'free-explore' && res.tpVisible === true && res.qualResolved === 'low' && errs.length === 0;
    console.log(ok ? '[PASS]' : '[FAIL]', JSON.stringify(res), `errors=${errs.length}`, errs.slice(0, 2));
    if (!ok) process.exit(1);
    console.log('[PHASE 4 & 5 CAMERA, CUSTOMIZATION & ENV VERIFICATION] PASSED');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    s.close();
    await new Promise((r) => setTimeout(r, 350));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
