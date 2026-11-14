import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer(port = 8955) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relPath = urlPath === '/' ? '/index.html' : urlPath;
      const filePath = path.join(ROOT_DIR, relPath);
      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found: ' + relPath);
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
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
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
          console.log('[BROWSER CONSOLE]', msg.params.type, text);
          if (msg.params.type === 'error') this.consoleErrors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'Uncaught exception';
          console.log('[BROWSER EXCEPTION]', desc);
          this.pageErrors.push(desc);
        } else if (msg.method === 'Network.responseReceived') {
          console.log('[NETWORK]', msg.params.response.status, msg.params.response.url);
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

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1500));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return res.result?.value;
  }
}

async function run() {
  const port = 8955;
  const server = await startServer(port);
  console.log(`[TEST] Static server running on port ${port}`);

  const chromeUserData = `/tmp/chrome_test_nular_${Date.now()}`;
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9245',
    '--disable-gpu',
    '--no-sandbox',
    '--mute-audio',
    `--user-data-dir=${chromeUserData}`
  ]);

  await new Promise(r => setTimeout(r, 1200));

  let cdp = null;
  try {
    const versionRes = await fetch('http://127.0.0.1:9245/json/list');
    const tabs = await versionRes.json();
    const pageTarget = tabs.find(t => t.type === 'page');
    const wsUrl = pageTarget?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No Chrome page tab found');

    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log('[TEST] Connected to Chrome CDP');

    // 1. Load app.html
    console.log('[TEST] Navigating to app.html...');
    await cdp.navigate(`http://127.0.0.1:${port}/app.html#profil`);
    await new Promise(r => setTimeout(r, 1000));

    // Check page errors
    console.log('[TEST] Console errors:', cdp.consoleErrors);
    console.log('[TEST] Page exceptions:', cdp.pageErrors);
    if (cdp.pageErrors.length > 0) {
      throw new Error('Uncaught exceptions on app.html: ' + cdp.pageErrors.join('; '));
    }

    // 2. Verify Ecosystem initialization
    const storeState = await cdp.evaluate(`(() => {
      const p = RagamaraEcosystem.Store.state.player;
      return {
        name: p.name,
        gems: p.gems,
        xp: p.xp,
        level: p.level,
        framesCount: (p.unlockedFrames || []).length,
        titlesCount: (p.unlockedTitles || []).length,
        outfitsCount: (p.unlockedOutfits || []).length
      };
    })()`);
    console.log('[TEST] Initial store state:', storeState);

    // 3. Test Toko Adat Shop Purchase
    console.log('[TEST] Testing Toko Adat purchasing and economy...');
    const purchaseResult = await cdp.evaluate(`(() => {
      const initialGems = RagamaraEcosystem.Store.state.player.gems;
      // Purchase frame_majapahit (120 gems)
      RagamaraEcosystem.TokoAdat.purchase('frame_majapahit');
      const afterGems = RagamaraEcosystem.Store.state.player.gems;
      const ownsMajapahit = RagamaraEcosystem.TokoAdat.isOwned({ id: 'frame_majapahit', category: 'frame', price: 120 });
      // Equip it
      RagamaraEcosystem.TokoAdat.equip('frame_majapahit');
      const equippedFrame = RagamaraEcosystem.Store.state.player.frame;

      // Purchase Title Penjaga Adat Nusantara (100 gems)
      RagamaraEcosystem.TokoAdat.purchase('Penjaga Adat Nusantara');
      const ownsTitle = RagamaraEcosystem.TokoAdat.isOwned({ id: 'Penjaga Adat Nusantara', category: 'title', price: 100 });
      RagamaraEcosystem.TokoAdat.equip('Penjaga Adat Nusantara');
      const equippedTitle = RagamaraEcosystem.Store.state.player.title;

      return {
        initialGems,
        afterGems,
        gemDiff: initialGems - afterGems,
        ownsMajapahit,
        equippedFrame,
        ownsTitle,
        equippedTitle
      };
    })()`);
    console.log('[TEST] Toko Adat result:', purchaseResult);
    if (!purchaseResult.ownsMajapahit || purchaseResult.equippedFrame !== 'frame_majapahit') {
      throw new Error('TokoAdat purchase/equip failed for frame_majapahit');
    }
    if (!purchaseResult.ownsTitle || purchaseResult.equippedTitle !== 'Penjaga Adat Nusantara') {
      throw new Error('TokoAdat purchase/equip failed for Penjaga Adat Nusantara');
    }

    // 4. Test Streak Milestone Claim
    console.log('[TEST] Testing 7-Day Streak claim...');
    const streakResult = await cdp.evaluate(`(() => {
      const preXp = RagamaraEcosystem.Store.state.player.xp;
      const preGems = RagamaraEcosystem.Store.state.player.gems;
      RagamaraEcosystem.Streak.claimMilestone();
      const postXp = RagamaraEcosystem.Store.state.player.xp;
      const postGems = RagamaraEcosystem.Store.state.player.gems;
      // Second claim should be idempotent (no double spend)
      RagamaraEcosystem.Streak.claimMilestone();
      const doubleClaimGems = RagamaraEcosystem.Store.state.player.gems;

      return {
        preXp, postXp, xpDiff: postXp - preXp,
        preGems, postGems, gemsDiff: postGems - preGems,
        isIdempotent: doubleClaimGems === postGems
      };
    })()`);
    console.log('[TEST] Streak result:', streakResult);
    if (streakResult.xpDiff !== 50 || streakResult.gemsDiff !== 20 || !streakResult.isIdempotent) {
      throw new Error('Streak claim failed or is not idempotent');
    }

    // 5. Test Profile Editor
    console.log('[TEST] Testing Profile Edit modal and save...');
    const profileEditResult = await cdp.evaluate(`(() => {
      RagamaraEcosystem.Profile.openEditModal();
      document.getElementById('edit-profile-name').value = 'Firza Penjelajah Nusantara';
      document.getElementById('edit-profile-bio').value = 'Menjaga keluhuran adat dan tradisi dari Sabang hingga Merauke.';
      RagamaraEcosystem.Profile.selectAvatar('assets/images/mascot_cendro_avatar.svg');
      RagamaraEcosystem.Profile.saveEdit();

      const p = RagamaraEcosystem.Store.state.player;
      const domName = document.getElementById('profile-player-name')?.innerText;
      const domBio = document.getElementById('profile-player-bio')?.innerText;

      return {
        savedName: p.name,
        savedBio: p.bio,
        savedAvatar: p.avatar,
        domName,
        domBio
      };
    })()`);
    console.log('[TEST] Profile edit result:', profileEditResult);
    if (profileEditResult.savedName !== 'Firza Penjelajah Nusantara' || profileEditResult.domName !== 'Firza Penjelajah Nusantara') {
      throw new Error('Profile editor failed to update player name in Store or DOM');
    }

    // 6. Test Audio Synthesizer calls
    console.log('[TEST] Testing Web Audio synthetics...');
    const audioResult = await cdp.evaluate(`(() => {
      try {
        RagamaraEcosystem.Audio.playGamelanChime();
        RagamaraEcosystem.Audio.playSuccessFanfare();
        RagamaraEcosystem.Audio.playPurchaseChime();
        RagamaraEcosystem.Audio.playTap();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })()`);
    console.log('[TEST] Audio result:', audioResult);
    if (!audioResult.success) {
      throw new Error('Audio synthesizer error: ' + audioResult.error);
    }

    console.log('\n🎉 ALL GAMIFICATION, SHOP, PROFILE, & AUDIO TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(chromeUserData, { recursive: true, force: true });
  }
}

run().catch(err => {
  console.error('[TEST FATAL]', err);
  process.exit(1);
});
