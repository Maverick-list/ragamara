import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`Invalid GLB magic in ${filePath}`);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + len));
}

async function run() {
  const results = [];
  const rec = (name, ok, d = {}) => {
    results.push({ name, ok, d });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`, ok ? '' : JSON.stringify(d));
  };

  // 1. Verify Blender Python scripts syntax
  let pyOk = true;
  try {
    execFileSync('python3', ['-m', 'py_compile', path.join(ROOT, 'scripts/blender/validate_asset.py'), path.join(ROOT, 'scripts/blender/export_glb.py')]);
  } catch { pyOk = false; }
  rec('1. Blender 4.x Python Scripts Syntax Valid (py_compile)', pyOk);

  // 2. Verify all 6 Avatar GLBs + 8 embedded AnimationClips each
  const avManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/asset-manifests/avatars-manifest.json'), 'utf8'));
  const expectedAnims = ['Idle', 'Walk', 'Run', 'Turn', 'Interact', 'Point', 'Wave', 'Sit'];
  let allAvatarsOk = avManifest.avatars.length === 6;
  for (const av of avManifest.avatars) {
    const g = parseGlbJson(path.join(ROOT, av.glbUrl));
    const names = (g.animations || []).map((a) => a.name);
    if (!expectedAnims.every((e) => names.includes(e)) || (g.meshes?.length || 0) < 15) {
      allAvatarsOk = false;
    }
  }
  rec('2. All 6 Playable Avatar GLBs Valid with 8 Embedded glTF Animations Each', allAvatarsOk, { count: avManifest.avatars.length });

  // 3. Verify Rumah Joglo Walkable Pilot GLB + Named Groups + COLLISION
  const jogloGlb = parseGlbJson(path.join(ROOT, 'assets/models/houses/rumah-joglo.glb'));
  const nodeNames = (jogloGlb.nodes || []).map((n) => n.name || '');
  const requiredGroups = ['SOKO_GURU', 'TUMPANG_SARI', 'UMPAK', 'WALL_SYSTEM', 'FLOOR_SYSTEM', 'DOORS', 'INTERIOR_FURNITURE', 'COLLISION'];
  const missingGroups = requiredGroups.filter((g) => !nodeNames.includes(g));
  const colliderNodes = nodeNames.filter((n) => n.startsWith('COLLISION_'));
  rec('3. Rumah Joglo Walkable Pilot GLB Contains All Named Structural Groups & Colliders',
    missingGroups.length === 0 && colliderNodes.length >= 10,
    { missingGroups, colliderCount: colliderNodes.length });

  // 4. Visual Browser WebGL Test: Render Avatar (Wave animation) + Joglo Pilot in Three.js
  const server = http.createServer((req, res) => {
    const p = (req.url || '/').split('?')[0];
    if (p === '/__phase2_preview.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><script type="importmap">{"imports":{"three":"./js/vendor/three/build/three.module.js","three/addons/":"./js/vendor/three/"}}</script></head><body style="margin:0;background:#13211b;"><canvas id="c" width="1280" height="720"></canvas><script type="module">
        import * as THREE from 'three';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
        renderer.setSize(1280, 720);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x16241d);
        const cam = new THREE.PerspectiveCamera(44, 1280/720, 0.1, 100);
        cam.position.set(8.5, 4.8, 10.5);
        cam.lookAt(0, 2.0, 0);
        scene.add(new THREE.HemisphereLight(0xfff5e4, 0x26352e, 1.3));
        const dir = new THREE.DirectionalLight(0xfff1dc, 2.0);
        dir.position.set(10, 16, 12);
        scene.add(dir);
        const loader = new GLTFLoader();
        const [houseGltf, av1, av2] = await Promise.all([
          loader.loadAsync('./assets/models/houses/rumah-joglo.glb'),
          loader.loadAsync('./assets/models/avatars/batik-parang-solo.glb'),
          loader.loadAsync('./assets/models/avatars/songket-minangkabau.glb')
        ]);
        houseGltf.scene.traverse(o => { if (o.name?.startsWith('COLLISION')) o.visible = false; });
        scene.add(houseGltf.scene);
        av1.scene.position.set(-1.3, 0.48, 5.2);
        av2.scene.position.set(1.3, 0.48, 5.2);
        scene.add(av1.scene, av2.scene);
        const mixer = new THREE.AnimationMixer(av1.scene);
        const wave = av1.animations.find(a => a.name === 'Wave');
        if (wave) { mixer.clipAction(wave).play(); mixer.update(0.35); }
        renderer.render(scene, cam);
        window.__P2_OK__ = { houseLoaded: true, avatarAnims: av1.animations.map(a => a.name) };
      </script></body></html>`);
      return;
    }
    const full = path.join(ROOT, p.replace(/^\/+/, ''));
    if (!fs.existsSync(full)) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(full);
    const mime = ext === '.js' ? 'application/javascript' : ext === '.glb' ? 'model/gltf-binary' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(full).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const debugPort = 9373;
  const userDataDir = `/tmp/chrome_p2_${Date.now()}`;
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle',
    '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 1800));

  let ws;
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    let id = 0;
    const send = (method, params = {}) => new Promise((res, rej) => {
      const cid = ++id;
      const h = (e) => { const m = JSON.parse(e.data); if (m.id === cid) { ws.removeEventListener('message', h); m.error ? rej(m.error) : res(m.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/__phase2_preview.html` });
    await new Promise((r) => setTimeout(r, 2500));

    const check = await send('Runtime.evaluate', { expression: 'window.__P2_OK__', returnByValue: true });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase2_01_avatars_and_joglo_pilot.png'), Buffer.from(shot.data, 'base64'));
    rec('4. Browser WebGL: GLTFLoader + AnimationMixer Render Walkable Joglo Pilot & Animated Avatars',
      Boolean(check.result?.value?.houseLoaded && check.result?.value?.avatarAnims?.length === 8),
      check.result?.value);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[PHASE 2 VERIFICATION] ${passed}/${results.length} PASSED`);
  if (passed !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
