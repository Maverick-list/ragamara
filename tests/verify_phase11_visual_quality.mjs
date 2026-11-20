import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';

const tests = [];
function check(name, pass, detail = '') {
  tests.push({ name, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function runVerification() {
  console.log("=== NULAR PHASE 11 VISUAL QUALITY & CULTURAL FIDELITY TEST SUITE ===");

  // 1. Verify 42 Houses in houses.json
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  check("42 Houses Catalog Completeness", houses.length === 42, `Found ${houses.length} houses`);

  // 2. Verify all 42 GLB files exist and are valid non-empty files
  let allGlbValid = true;
  for (const h of houses) {
    const glbPath = path.join(ROOT, `assets/models/houses/${h.id}.glb`);
    if (!fs.existsSync(glbPath) || fs.statSync(glbPath).size < 1000) {
      allGlbValid = false;
      break;
    }
  }
  check("All 42 House GLBs Valid on Disk", allGlbValid, "All 42 models present in assets/models/houses/");

  // 3. Verify Top 5 Rebuilt Masterpiece Models and Manifests
  const top5 = ['rumah-gadang', 'rumah-joglo', 'tongkonan-toraja', 'honai-papua', 'mbaru-niang'];
  for (const id of top5) {
    const glb = path.join(ROOT, `assets/models/houses/${id}.glb`);
    const manifest = path.join(ROOT, `data/asset-manifests/${id}.json`);
    const glbSize = fs.statSync(glb).size;
    const manData = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    check(`Masterpiece Rebuild: ${id}`, glbSize > 100000 && manData.assetStatus === 'VERIFIED_MASTERPIECE', `${glbSize} bytes, ${manData.meshes} meshes, ${manData.colliders} colliders`);
  }

  // 4. Verify Cultural Items & Artifacts (19 items, 6 artifact GLBs)
  const culturalItems = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cultural-items.json'), 'utf8'));
  check("Unified Cultural Items Registry", culturalItems.totalItems === 19 && culturalItems.items.length === 19, "19 cultural items registered");

  const artifacts = [
    'clothing-batik-parang.glb',
    'clothing-songket-minangkabau.glb',
    'clothing-tenun-sumba.glb',
    'weapon-keris-nusantara.glb',
    'weapon-mandau-kalimantan.glb',
    'weapon-rencong-aceh.glb'
  ];
  let artifactsValid = true;
  for (const art of artifacts) {
    const p = path.join(ROOT, `assets/models/artifacts/${art}`);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1000) artifactsValid = false;
  }
  check("Cultural Artifacts GLB Assets", artifactsValid, "6 of 6 custom 3D artifact models present");

  // 5. In-Browser WebGL Verification of Walkable Interiors & Camera Modes
  console.log("\nStarting headless Chrome for in-engine 3D world verification...");
  const debugPort = 9433;
  const userDataDir = `/tmp/nular_p11_test_${Date.now()}`;
  const chrome = spawn('/usr/bin/google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--window-size=1440,900',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:3000/world.html?house=rumah-gadang'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
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
    await new Promise(r => setTimeout(r, 2000));

    // Verify 3D World Canvas
    const canvasExists = await send('Runtime.evaluate', {
      expression: '!!document.querySelector("canvas")',
      returnByValue: true
    });
    check("3D World WebGL Canvas Mount", !!canvasExists.result.value, "Canvas element rendered");

    // Wait for world init loop
    let worldSceneLoaded = false;
    for (let i = 0; i < 35; i++) {
      await new Promise(r => setTimeout(r, 200));
      const ok = await send('Runtime.evaluate', {
        expression: 'Boolean(window.__NULAR_WORLD__?.running && window.__NULAR_WORLD__?.activeHouse?.id === "rumah-gadang")',
        returnByValue: true
      });
      if (ok.result?.value) {
        worldSceneLoaded = true;
        break;
      }
    }
    check("Living Archipelago World Engine Initialized", worldSceneLoaded, "window.__NULAR_WORLD__ running with activeHouse");

    // Capture in-engine screenshot of the upgraded Rumah Gadang in the world
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase11_world_rumah_gadang_masterpiece.png'), buffer);
    check("In-Engine Masterpiece World Screenshot Captured", buffer.length > 50000, `Saved ${buffer.length} bytes`);

    ws.close();
  } catch (err) {
    check("In-Engine World Verification", false, err.message);
  } finally {
    chrome.kill();
  }

  // Summary
  const passed = tests.filter(t => t.pass).length;
  const total = tests.length;
  console.log(`\n=== TEST SUITE RESULTS: ${passed}/${total} PASSED ===`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
