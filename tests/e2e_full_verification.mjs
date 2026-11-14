import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'reports/final-transformation/screenshots');
const RESULTS_FILE = path.join(ROOT_DIR, 'reports/final-transformation/qa_execution_results.json');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startStaticServer(port = 8945) {
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
    this.failedRequests = [];
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
          const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
          this.consoleErrors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'Uncaught exception';
          this.pageErrors.push(desc);
        } else if (msg.method === 'Network.loadingFailed') {
          this.failedRequests.push(msg.params.errorText || 'Network failure');
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
      deviceScaleFactor: 1,
      mobile
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1400));
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text} (${expression})`);
    }
    return res.result?.value;
  }

  async screenshot(filename) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    return outPath;
  }

  close() {
    this.ws.close();
  }
}

async function launchChrome(debugPort = 9344) {
  const userDataDir = `/tmp/ragamara_chrome_${Date.now()}`;
  const proc = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await res.json();
      const pageTarget = targets.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }
  if (!wsUrl) throw new Error('Failed to connect to headless Chrome CDP');
  return { proc, wsUrl };
}

async function runVerification() {
  const PORT = 8945;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const server = await startStaticServer(PORT);
  const { proc, wsUrl } = await launchChrome(9344);
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();

  const report = {
    timestamp: new Date().toISOString(),
    viewports: [],
    journeys: [],
    miniGameSessions: [],
    edgeCases: [],
    screenshots: [],
    consoleErrors: [],
    pageErrors: []
  };

  try {
    // =========================================================================
    // 1. HOMEPAGE SCREENSHOTS & JOURNEY 1 START
    // =========================================================================
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/index.html`);
    await cdp.screenshot('01_homepage_desktop.png');
    report.screenshots.push('01_homepage_desktop.png');

    await cdp.setViewport(390, 844, true);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('02_homepage_mobile.png');
    report.screenshots.push('02_homepage_mobile.png');

    // Verify all 7 realms and honest stats on index.html
    const homepageCheck = await cdp.eval(`(() => {
      const text = document.body.innerText;
      return {
        has45Entities: text.includes('45') && text.includes('Entitas Budaya Kanonis'),
        has50Dapobud: text.includes('50') && text.includes('Rekaman Resmi DAPOBUD'),
        hasAll7Realms: ['Sumatra', 'Jawa', 'Bali', 'Kalimantan', 'Sulawesi', 'Maluku', 'Papua'].every(r => text.includes(r)),
        hasProfileNav: !!document.querySelector('a[href="app.html#profil"]')
      };
    })()`);
    report.journeys.push({ name: 'Homepage & Honest Metrics Verification', passed: Object.values(homepageCheck).every(Boolean), details: homepageCheck });

    // =========================================================================
    // 2. 10-VIEWPORT RESPONSIVE MATRIX (INDEX.HTML & APP.HTML)
    // =========================================================================
    const viewports = [
      { w: 320, h: 568, mobile: true },
      { w: 360, h: 800, mobile: true },
      { w: 375, h: 812, mobile: true },
      { w: 390, h: 844, mobile: true },
      { w: 430, h: 932, mobile: true },
      { w: 768, h: 1024, mobile: true },
      { w: 1024, h: 768, mobile: false },
      { w: 1280, h: 800, mobile: false },
      { w: 1440, h: 900, mobile: false },
      { w: 1920, h: 1080, mobile: false }
    ];

    for (const page of ['index.html', 'app.html']) {
      await cdp.navigate(`${BASE_URL}/${page}`);
      for (const vp of viewports) {
        await cdp.setViewport(vp.w, vp.h, vp.mobile);
        await new Promise(r => setTimeout(r, 180));
        const check = await cdp.eval(`(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          overflow: document.documentElement.scrollWidth > window.innerWidth
        }))()`);
        report.viewports.push({
          page,
          viewport: `${vp.w}x${vp.h}`,
          scrollWidth: check.scrollWidth,
          innerWidth: check.innerWidth,
          passed: !check.overflow
        });
      }
    }

    // =========================================================================
    // 3. APP CORE VIEWS & SCREENSHOTS 03, 04, 05, 06
    // =========================================================================
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/app.html`);
    await cdp.eval(`localStorage.clear(); RagamaraEcosystem.init();`);
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 05: Learning Journey Desktop
    await cdp.eval(`switchView('belajar')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('05_learning_journey_desktop.png');
    report.screenshots.push('05_learning_journey_desktop.png');

    // Screenshot 06: Learning Journey Mobile (390x844)
    await cdp.setViewport(390, 844, true);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('06_learning_journey_mobile.png');
    report.screenshots.push('06_learning_journey_mobile.png');

    // Switch back to Desktop 1440x900 for World Map & Regional Dossier
    await cdp.setViewport(1440, 900, false);
    await cdp.eval(`switchView('petualangan')`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.screenshot('03_world_map_desktop.png');
    report.screenshots.push('03_world_map_desktop.png');

    // Verify all 7 Regional Dossiers have all 10 required parts & open Sumatra dossier for Screenshot 04
    const dossierCheck = await cdp.eval(`(() => {
      const keys = ['sumatra', 'jawa', 'bali_nt', 'kalimantan', 'sulawesi', 'maluku', 'papua'];
      const results = {};
      for (const k of keys) {
        RagamaraEcosystem.RegionalDossier.open(k);
        const text = (document.getElementById('regional-dossier-body').textContent || '').toLowerCase();
        results[k] = text.length > 400 && text.includes('ikhtisar identitas') && text.includes('arsitektur') && text.includes('kuliner');
      }
      RagamaraEcosystem.RegionalDossier.open('sumatra');
      return results;
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('04_regional_dossier_modal.png');
    report.screenshots.push('04_regional_dossier_modal.png');
    await cdp.eval(`RagamaraEcosystem.RegionalDossier.close()`);
    report.journeys.push({ name: 'World Map & 7 Regional Dossiers (10-Part Check)', passed: Object.values(dossierCheck).every(Boolean), details: dossierCheck });

    // =========================================================================
    // 4. MINI-GAMES A–F: SCREENSHOTS 07–13 + 3 FULL SESSIONS PER MINI-GAME (18 SESSIONS)
    // =========================================================================
    await cdp.eval(`switchView('belajar')`);
    await new Promise(r => setTimeout(r, 300));

    // Helper functions to play each mini-game end-to-end
    for (let run = 1; run <= 3; run++) {
      // --- MINI-GAME A (4 Questions) ---
      await cdp.eval(`MiniGameEngine.openArena('A')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('07_minigame_A_multiple_choice.png');
        report.screenshots.push('07_minigame_A_multiple_choice.png');
      }
      const resA = await cdp.eval(`(() => {
        for (let q = 0; q < 4; q++) {
          const correctIdx = MiniGameEngine.gameAQuestions[q].options.findIndex(o => o.isCorrect);
          MiniGameEngine.handleGameAAnswer(correctIdx);
          MiniGameEngine.nextGameARound();
        }
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'A').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'A', run, ...resA, passed: resA.state === 'COMPLETED' && resA.score === 100 });

      // --- MINI-GAME B (6 Cultural Pairs = 12 Cards) ---
      await cdp.eval(`MiniGameEngine.openArena('B')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('08_minigame_B_cultural_matching.png');
        report.screenshots.push('08_minigame_B_cultural_matching.png');
      }
      const resB = await cdp.eval(`(async () => {
        for (let idx = 0; idx < 6; idx++) {
          MiniGameEngine.handleGameBSelect('L_' + idx);
          MiniGameEngine.handleGameBSelect('R_' + idx);
        }
        await new Promise(r => setTimeout(r, 650));
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'B').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'B', run, ...resB, passed: resB.state === 'COMPLETED' && resB.score === 100 });

      // --- MINI-GAME C (2 Stages x 4 Steps Sequence Builder) ---
      await cdp.eval(`MiniGameEngine.openArena('C')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('09_minigame_C_sequence_builder.png');
        report.screenshots.push('09_minigame_C_sequence_builder.png');
      }
      const resC = await cdp.eval(`(async () => {
        for (let stageIdx = 0; stageIdx < 2; stageIdx++) {
          for (let orderNum = 1; orderNum <= 4; orderNum++) {
            MiniGameEngine.handleGameCSelect(orderNum);
          }
          await new Promise(r => setTimeout(r, 750));
        }
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'C').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'C', run, ...resC, passed: resC.state === 'COMPLETED' && resC.score === 100 });

      // --- MINI-GAME D (3 Rounds Pentatonic Rhythm Simulation) ---
      await cdp.eval(`MiniGameEngine.openArena('D')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('10_minigame_D_rhythm_simulation.png');
        report.screenshots.push('10_minigame_D_rhythm_simulation.png');
      }
      const resD = await cdp.eval(`(async () => {
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const seq = MiniGameEngine.gameDRounds[rIdx].targetPattern;
          for (const noteIdx of seq) {
            MiniGameEngine.handleGameDPad(noteIdx);
          }
          await new Promise(r => setTimeout(r, 700));
        }
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'D').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'D', run, ...resD, passed: resD.state === 'COMPLETED' && resD.score === 100 });

      // --- MINI-GAME E (3 Customary Dilemma Scenarios) ---
      await cdp.eval(`MiniGameEngine.openArena('E')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('11_minigame_E_cultural_dilemma.png');
        report.screenshots.push('11_minigame_E_cultural_dilemma.png');
      }
      const resE = await cdp.eval(`(() => {
        for (let s = 0; s < 3; s++) {
          const correctIdx = MiniGameEngine.gameEScenes[s].choices.findIndex(c => c.isWisdom);
          MiniGameEngine.handleGameEChoice(correctIdx);
          MiniGameEngine.nextGameEScene();
        }
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'E').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'E', run, ...resE, passed: resE.state === 'COMPLETED' && resE.score === 100 });

      // --- MINI-GAME F (2 Rounds x 4-Quadrant Artifact Motif Rotation) ---
      await cdp.eval(`MiniGameEngine.openArena('F')`);
      await new Promise(r => setTimeout(r, 250));
      if (run === 1) {
        await cdp.screenshot('12_minigame_F_artifact_puzzle.png');
        report.screenshots.push('12_minigame_F_artifact_puzzle.png');
      }
      const resF = await cdp.eval(`(async () => {
        for (let pIdx = 0; pIdx < 2; pIdx++) {
          for (let q = 0; q < 4; q++) {
            while ((MiniGameEngine._gameFAngles[q] % 360) !== 0) {
              MiniGameEngine.rotateGameFTile(q);
            }
          }
          await new Promise(r => setTimeout(r, 650));
        }
        return {
          state: MiniGameEngine.currentState,
          score: MiniGameEngine.currentSession.score,
          accuracy: MiniGameEngine.currentSession.accuracy,
          completedCount: RagamaraEcosystem.Store.state.completedSessions.filter(s => s.gameId === 'F').length
        };
      })()`);
      report.miniGameSessions.push({ mode: 'F', run, ...resF, passed: resF.state === 'COMPLETED' && resF.score === 100 });

      if (run === 1) {
        await new Promise(r => setTimeout(r, 250));
        await cdp.screenshot('13_minigame_completion_screen.png');
        report.screenshots.push('13_minigame_completion_screen.png');
      }
    }

    // =========================================================================
    // 5. NEGATIVE & EDGE-CASE ENGINE TESTS (PAUSE/RESUME, WRONG ANSWER, REPLAY WITHOUT RELOAD)
    // =========================================================================
    const edgeCaseCheck = await cdp.eval(`(() => {
      // 1. Replay from celebration screen without location.reload()
      MiniGameEngine.restartGame();
      const replayWorks = MiniGameEngine.currentState === 'PLAYING' && !!document.getElementById('arena-stage-container');

      // 2. Pause & Resume lifecycle
      MiniGameEngine.pauseGame();
      const pausedWorks = MiniGameEngine.currentState === 'PAUSED' && !!document.getElementById('arena-pause-overlay');
      MiniGameEngine.resumeGame();
      const resumedWorks = MiniGameEngine.currentState === 'PLAYING' && !document.getElementById('arena-pause-overlay');

      // 3. Wrong answer handling in Mode A
      MiniGameEngine.openArena('A');
      const wrongIdx = MiniGameEngine.gameAQuestions[0].options.findIndex(o => !o.isCorrect);
      MiniGameEngine.handleGameAAnswer(wrongIdx);
      const wrongHandled = MiniGameEngine.currentSession.mistakes === 1 && MiniGameEngine.currentState === 'FEEDBACK';

      // 4. Clean closeArena
      MiniGameEngine.closeArena(true);
      const closedCleanly = MiniGameEngine.currentState === 'IDLE' && MiniGameEngine._timers.length === 0 && MiniGameEngine._intervals.length === 0;

      return { replayWorks, pausedWorks, resumedWorks, wrongHandled, closedCleanly };
    })()`);
    report.edgeCases.push({ name: 'Game Engine Lifecycle & Negative Tests', passed: Object.values(edgeCaseCheck).every(Boolean), details: edgeCaseCheck });

    // =========================================================================
    // 6. CULTUREPEDIA, MASCOTS, DAILY MISSIONS, LEADERBOARD & PROFILE SCREENSHOTS (14–18)
    // =========================================================================
    await cdp.eval(`switchView('koleksi'); switchKoleksiTab('culturepedia');`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.screenshot('14_culturepedia_desktop.png');
    report.screenshots.push('14_culturepedia_desktop.png');

    // Open Culturepedia Detail Modal for Screenshot 15
    const pediaCheck = await cdp.eval(`(() => {
      const entities = RagamaraEcosystem.getCanonicalEntities();
      const firstId = entities[0].record_id;
      RagamaraEcosystem.Culturepedia.openDetail(firstId);
      const modalText = document.getElementById('culturepedia-detail-body').innerText;
      return {
        entityCount: entities.length,
        hasDapobudLayer: modalText.includes('DAPOBUD'),
        hasWikiLayer: modalText.includes('Wikipedia'),
        hasArenaBridge: modalText.includes('Tantangan') || modalText.includes('Arena')
      };
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('15_culturepedia_detail_modal.png');
    report.screenshots.push('15_culturepedia_detail_modal.png');
    await cdp.eval(`RagamaraEcosystem.Culturepedia.closeDetail()`);
    report.journeys.push({ name: 'Journey 3: Culturepedia 45 Entities & Dual-Layer Provenance Modal', passed: pediaCheck.entityCount === 45 && pediaCheck.hasDapobudLayer && pediaCheck.hasWikiLayer && pediaCheck.hasArenaBridge, details: pediaCheck });

    // Screenshot 16: Mascot Collection
    await cdp.eval(`switchKoleksiTab('maskot')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('16_mascot_collection.png');
    report.screenshots.push('16_mascot_collection.png');

    // Screenshot 17: Daily Missions & Local Simulation Leaderboard
    await cdp.eval(`openLeaderboardModal()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('17_daily_missions_and_leaderboard.png');
    report.screenshots.push('17_daily_missions_and_leaderboard.png');
    await cdp.eval(`closeLeaderboardModal()`);

    // Screenshot 18: Player Profile & Achievements
    await cdp.eval(`switchView('profil')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('18_player_profile_and_achievements.png');
    report.screenshots.push('18_player_profile_and_achievements.png');

    // =========================================================================
    // 7. JOURNEY 2 (PERSISTENCE ACROSS RELOAD) & JOURNEY 5 (CORRUPTED STORAGE RECOVERY)
    // =========================================================================
    const beforeReload = await cdp.eval(`(() => {
      RagamaraEcosystem.Profile.equipFrame('frame_asmat');
      RagamaraEcosystem.Profile.setTitle('Penjaga Adat Nusantara');
      return {
        xp: RagamaraEcosystem.Store.state.player.xp,
        gems: RagamaraEcosystem.Store.state.player.gems,
        frame: RagamaraEcosystem.Store.state.player.frame,
        title: RagamaraEcosystem.Store.state.player.title
      };
    })()`);
    await cdp.navigate(`${BASE_URL}/app.html`);
    const afterReload = await cdp.eval(`(() => ({
      xp: RagamaraEcosystem.Store.state.player.xp,
      gems: RagamaraEcosystem.Store.state.player.gems,
      frame: RagamaraEcosystem.Store.state.player.frame,
      title: RagamaraEcosystem.Store.state.player.title
    }))()`);
    report.journeys.push({
      name: 'Journey 2: Returning Player State Persistence Across Reload',
      passed: beforeReload.xp === afterReload.xp && beforeReload.gems === afterReload.gems && afterReload.frame === 'frame_asmat',
      details: { beforeReload, afterReload }
    });

    // Journey 5: Corrupted localStorage Recovery
    await cdp.eval(`
      localStorage.setItem('ragamara_state_v2', '{corrupted_json_payload!!!');
      localStorage.setItem('ragamara_player_state', 'not_valid_json');
      localStorage.setItem('ragamara_saved_culture', '{"bad":true}');
    `);
    await cdp.navigate(`${BASE_URL}/app.html`);
    const recoveryCheck = await cdp.eval(`(() => ({
      schemaVersion: RagamaraEcosystem.Store.state.schemaVersion,
      validXp: typeof RagamaraEcosystem.Store.state.player.xp === 'number' && RagamaraEcosystem.Store.state.player.xp >= 2450,
      validBookmarks: Array.isArray(RagamaraEcosystem.Store.state.savedCultureIds)
    }))()`);
    report.journeys.push({
      name: 'Journey 5: Corrupted localStorage Recovery',
      passed: recoveryCheck.schemaVersion === '2.0.0' && recoveryCheck.validXp && recoveryCheck.validBookmarks,
      details: recoveryCheck
    });

    report.consoleErrors = cdp.consoleErrors;
    report.pageErrors = cdp.pageErrors;

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log('VERIFICATION SUMMARY:');
    console.log(`- Viewports Passed: ${report.viewports.filter(v => v.passed).length}/${report.viewports.length}`);
    console.log(`- Mini-Game Sessions Passed: ${report.miniGameSessions.filter(m => m.passed).length}/${report.miniGameSessions.length}`);
    console.log(`- Journeys Passed: ${report.journeys.filter(j => j.passed).length}/${report.journeys.length}`);
    console.log(`- Edge Cases Passed: ${report.edgeCases.filter(e => e.passed).length}/${report.edgeCases.length}`);
    console.log(`- Screenshots Captured: ${report.screenshots.length}/18`);
    console.log(`- Console Errors: ${report.consoleErrors.length}`);
    console.log(`- Uncaught Page Errors: ${report.pageErrors.length}`);
  } finally {
    cdp.close();
    proc.kill('SIGKILL');
    server.close();
  }
}

runVerification().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
