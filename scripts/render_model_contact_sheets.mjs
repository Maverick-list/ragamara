import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const OUT_DIR = path.join(ROOT, 'reports/phase11-contact-sheets');
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runAudit() {
  console.log("Starting Chrome for contact sheet renders...");
  const debugPort = 9422;
  const userDataDir = `/tmp/nular_p11_${Date.now()}`;
  const chrome = spawn('/usr/bin/google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--window-size=1200,900',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:3000/viewer_audit.html'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  console.log("Waiting for page load...");
  await new Promise(r => setTimeout(r, 2000));

  // Top 5 houses to capture multi-angle contact sheets
  const focusHouses = [
    { id: 'rumah-gadang', name: 'Rumah Gadang (Sumbar)' },
    { id: 'rumah-joglo', name: 'Rumah Joglo (Jateng)' },
    { id: 'tongkonan-toraja', name: 'Tongkonan (Sulsel)' },
    { id: 'honai-papua', name: 'Honai (Papua Pegunungan)' },
    { id: 'mbaru-niang', name: 'Mbaru Niang (NTT)' }
  ];

  const angles = ['iso', 'front', 'side', 'rear', 'top', 'interior'];

  for (const h of focusHouses) {
    console.log(`\nRendering multi-angle suite for ${h.id}...`);
    const modelUrl = `/assets/models/houses/${h.id}.glb`;

    // Load model
    const loadEval = await send('Runtime.evaluate', {
      expression: `window.loadModel("${modelUrl}")`,
      awaitPromise: true,
      returnByValue: true
    });

    if (loadEval.exceptionDetails) {
      console.error(`Failed to load ${h.id}:`, loadEval.exceptionDetails);
      continue;
    }

    console.log(`Loaded ${h.id}: Bounds =`, loadEval.result.value);

    for (const angle of angles) {
      await send('Runtime.evaluate', {
        expression: `window.setCameraAngle("${angle}")`,
        returnByValue: true
      });
      await new Promise(r => setTimeout(r, 250));

      const shotEval = await send('Runtime.evaluate', {
        expression: `window.getScreenshot()`,
        returnByValue: true
      });

      const base64Data = shotEval.result.value.replace(/^data:image\/jpeg;base64,/, '');
      const outPath = path.join(OUT_DIR, `${h.id}_${angle}.jpg`);
      fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));

      // If angle is iso, copy to artifact dir as well
      if (angle === 'iso') {
        const artPath = path.join(ARTIFACT_DIR, `phase11_${h.id}_baseline_iso.jpg`);
        fs.writeFileSync(artPath, Buffer.from(base64Data, 'base64'));
      }
      console.log(`Saved ${outPath}`);
    }
  }

  // Also do a quick front + iso render for ALL 42 models to assess baseline quality
  console.log("\nAuditing baseline visual renders for all 42 houses...");
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  const overviewSummary = [];

  for (const h of houses) {
    const modelUrl = `/assets/models/houses/${h.id}.glb`;
    try {
      const loadEval = await send('Runtime.evaluate', {
        expression: `window.loadModel("${modelUrl}")`,
        awaitPromise: true,
        returnByValue: true
      });
      if (loadEval.exceptionDetails) {
        overviewSummary.push({ id: h.id, status: 'load_error', error: loadEval.exceptionDetails });
        continue;
      }
      await send('Runtime.evaluate', { expression: `window.setCameraAngle("iso")` });
      await new Promise(r => setTimeout(r, 120));
      const shotEval = await send('Runtime.evaluate', { expression: `window.getScreenshot()`, returnByValue: true });
      const base64Data = shotEval.result.value.replace(/^data:image\/jpeg;base64,/, '');
      const outPath = path.join(OUT_DIR, `${h.id}_thumb.jpg`);
      fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
      overviewSummary.push({ id: h.id, status: 'rendered', bounds: loadEval.result.value });
    } catch (e) {
      overviewSummary.push({ id: h.id, status: 'error', error: e.message });
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'render_audit_summary.json'), JSON.stringify(overviewSummary, null, 2));
  console.log(`Audit renders complete! Saved ${overviewSummary.length} house thumbnails.`);

  ws.close();
  chrome.kill();
  process.exit(0);
}

runAudit().catch(err => {
  console.error("Audit runner failed:", err);
  process.exit(1);
});
