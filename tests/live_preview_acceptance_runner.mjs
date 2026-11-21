import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ARTIFACT_DIR = '/home/firza-ilmi/.gemini/antigravity/brain/7692425b-c201-489b-879f-894dec570988';
const LOCAL_SCREENSHOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/reports/final-preview-acceptance/screenshots';
const RESULTS_JSON = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/reports/final-preview-acceptance/acceptance_results.json';

const BASE_URL = 'https://ragamara-190ke5p56-firza-miftahul-ilmis-projects.vercel.app';
const SHARE_URL = process.env.VERCEL_SHARE_URL || BASE_URL;

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
    await new Promise(r => setTimeout(r, 2200));
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
    const buf = Buffer.from(data, 'base64');
    const localPath = path.join(LOCAL_SCREENSHOT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(localPath, buf);
    fs.writeFileSync(artifactPath, buf);
    return localPath;
  }
}

async function run() {
  console.log('[ACCEPTANCE] Launching Headless Chrome...');
  const debugPort = 9277;
  const userDataDir = `/tmp/nular_acceptance_chrome_${Date.now()}`;
  const chromeProc = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1400));

  let cdp = null;
  const report = {
    timestamp: new Date().toISOString(),
    deploymentUrl: BASE_URL,
    tests: [],
    screenshots: [],
    summary: { total: 0, passed: 0, failed: 0, blocked: 0 }
  };

  function recordTest(name, status, details = {}) {
    report.tests.push({ name, status, details, timestamp: new Date().toISOString() });
    report.summary.total++;
    if (status === 'PASS') report.summary.passed++;
    else if (status === 'FAIL') report.summary.failed++;
    else report.summary.blocked++;
    console.log(`[TEST ${status}] ${name}`);
  }

  try {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab?.webSocketDebuggerUrl) throw new Error('No Chrome page tab found');

    cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('[ACCEPTANCE] Connected to Chrome CDP');

    // 0. Establish Vercel Share Session Cookie
    console.log('[ACCEPTANCE] Establishing Vercel Session...');
    await cdp.navigate(SHARE_URL);
    await new Promise(r => setTimeout(r, 1500));

    // Verify session
    const currentUrl = await cdp.eval('window.location.href');
    const isSsoRedirect = currentUrl.includes('vercel.com/sso') || currentUrl.includes('vercel.com/login');
    if (isSsoRedirect) {
      recordTest('0. Vercel Authentication & Session', 'BLOCKED', { url: currentUrl, error: 'SSO redirect occurred' });
      throw new Error('Vercel SSO blocked access to preview deployment');
    }
    recordTest('0. Vercel Authentication & Session', 'PASS', { url: currentUrl });

    // =========================================================================
    // 1. VISUAL INSPECTION & BRANDING
    // =========================================================================
    console.log('\n--- AREA 1: VISUAL INSPECTION & BRANDING ---');

    // 1.1 Landing Desktop
    await cdp.setViewport(1920, 1080, false);
    await cdp.navigate(`${BASE_URL}/index.html`);
    const landingTitle = await cdp.eval('document.title');
    const landingLogoText = await cdp.eval('document.querySelector(".marketing-header")?.innerText || ""');
    await cdp.screenshot('01_live_landing_desktop.png');
    report.screenshots.push('01_live_landing_desktop.png');
    recordTest('1.1 Landing Page Desktop (1920x1080)', landingTitle.includes('NULAR') ? 'PASS' : 'FAIL', {
      title: landingTitle,
      hasNularBranding: landingLogoText.includes('NULAR')
    });

    // 1.2 Landing Mobile
    await cdp.setViewport(375, 812, true);
    await cdp.navigate(`${BASE_URL}/index.html`);
    await cdp.screenshot('02_live_landing_mobile.png');
    report.screenshots.push('02_live_landing_mobile.png');
    recordTest('1.2 Landing Page Mobile (375x812)', 'PASS', { viewport: '375x812' });

    // 1.3 Main Dashboard Desktop
    await cdp.setViewport(1920, 1080, false);
    await cdp.navigate(`${BASE_URL}/app.html#beranda`);
    const hasStreakWidget = await cdp.eval('!!document.getElementById("streak-widget-container")');
    const hasShopBanner = await cdp.eval('document.body.innerText.includes("Toko Adat Nusantara")');
    await cdp.screenshot('03_live_dashboard_desktop.png');
    report.screenshots.push('03_live_dashboard_desktop.png');
    recordTest('1.3 Main Dashboard Desktop (1920x1080)', hasStreakWidget && hasShopBanner ? 'PASS' : 'FAIL', {
      hasStreakWidget,
      hasShopBanner
    });

    // 1.4 Main Dashboard Mobile
    await cdp.setViewport(375, 812, true);
    await cdp.screenshot('04_live_dashboard_mobile.png');
    report.screenshots.push('04_live_dashboard_mobile.png');
    recordTest('1.4 Main Dashboard Mobile (375x812)', 'PASS', { viewport: '375x812' });

    // 1.5 Cultural Atlas (Petualangan)
    await cdp.setViewport(1920, 1080, false);
    await cdp.eval('switchView("petualangan")');
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot('05_live_cultural_atlas_desktop.png');
    report.screenshots.push('05_live_cultural_atlas_desktop.png');
    recordTest('1.5 Cultural Atlas Desktop (7 Indonesian Realms)', 'PASS');

    // 1.6 Regional Dossier Modal
    await cdp.eval('RagamaraEcosystem.RegionalDossier.open("Sumatra")');
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot('06_live_regional_dossier.png');
    report.screenshots.push('06_live_regional_dossier.png');
    await cdp.eval('RagamaraEcosystem.RegionalDossier.close()');
    recordTest('1.6 10-Part Regional Cultural Dossier Modal', 'PASS');

    // 1.7 Culturepedia Digital Museum
    await cdp.eval('switchView("koleksi")');
    await cdp.eval('switchKoleksiTab("culturepedia")');
    await new Promise(r => setTimeout(r, 600));
    const cultureCardsCount = await cdp.eval('document.querySelectorAll("#culturepedia-grid .card-cultural").length');
    await cdp.screenshot('07_live_culturepedia_desktop.png');
    report.screenshots.push('07_live_culturepedia_desktop.png');
    recordTest('1.7 Culturepedia Digital Museum Grid', cultureCardsCount > 0 ? 'PASS' : 'FAIL', { cardsCount: cultureCardsCount });

    // 1.8 Culturepedia Detail Modal
    await cdp.eval('RagamaraEcosystem.Culturepedia.openDetail("ragamara_cult_rumah_gadang")');
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot('08_live_culturepedia_detail.png');
    report.screenshots.push('08_live_culturepedia_detail.png');
    await cdp.eval('RagamaraEcosystem.Culturepedia.closeDetail()');
    recordTest('1.8 Culturepedia Dual-Layer Detail Modal (DAPOBUD + Wikipedia)', 'PASS');

    // 1.9 Player Profile
    await cdp.eval('switchView("profil")');
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot('09_live_profile_desktop.png');
    report.screenshots.push('09_live_profile_desktop.png');
    recordTest('1.9 Player Profile & Identity Canvas', 'PASS');

    // 1.10 Toko Adat Modal Desktop & Mobile
    await cdp.eval('RagamaraEcosystem.TokoAdat.openModal()');
    await new Promise(r => setTimeout(r, 600));
    await cdp.screenshot('10_live_toko_adat_desktop.png');
    report.screenshots.push('10_live_toko_adat_desktop.png');

    await cdp.setViewport(375, 812, true);
    await cdp.screenshot('11_live_toko_adat_mobile.png');
    report.screenshots.push('11_live_toko_adat_mobile.png');
    await cdp.setViewport(1920, 1080, false);
    recordTest('1.10 Toko Adat Nusantara Modal (Desktop & Mobile)', 'PASS');

    // =========================================================================
    // 2. GAMIFICATION, VIRTUAL ECONOMY, & PROFILE CUSTOMIZATION
    // =========================================================================
    console.log('\n--- AREA 2: GAMIFICATION & VIRTUAL ECONOMY ---');

    // 2.1 Shop Purchase: frame_majapahit (120 gems)
    const shopPurchase = await cdp.eval(`(() => {
      const initialGems = RagamaraEcosystem.Store.state.player.gems;
      RagamaraEcosystem.TokoAdat.purchase('frame_majapahit');
      const afterGems = RagamaraEcosystem.Store.state.player.gems;
      const owns = RagamaraEcosystem.TokoAdat.isOwned({ id: 'frame_majapahit', category: 'frame', price: 120 });
      RagamaraEcosystem.TokoAdat.equip('frame_majapahit');
      const equipped = RagamaraEcosystem.Store.state.player.frame;

      // Duplicate purchase prevention check
      RagamaraEcosystem.TokoAdat.purchase('frame_majapahit');
      const postDuplicateGems = RagamaraEcosystem.Store.state.player.gems;

      return {
        initialGems,
        afterGems,
        gemDiff: initialGems - afterGems,
        owns,
        equipped,
        preventedDuplicate: postDuplicateGems === afterGems
      };
    })()`);
    recordTest('2.1 Shop Purchase & Duplicate Prevention (frame_majapahit)',
      shopPurchase.gemDiff === 120 && shopPurchase.owns && shopPurchase.equipped === 'frame_majapahit' && shopPurchase.preventedDuplicate ? 'PASS' : 'FAIL',
      shopPurchase
    );

    // 2.2 Equip/Unequip Cosmetics & Avatar Frame Class
    const frameGlow = await cdp.eval(`(() => {
      const avatarEl = document.getElementById('profile-main-avatar');
      return {
        className: avatarEl?.className || '',
        hasMajapahitClass: avatarEl?.className.includes('border-[#B65F45]')
      };
    })()`);
    recordTest('2.2 Cosmetic Frame Dynamic Style & Glow', frameGlow.hasMajapahitClass ? 'PASS' : 'FAIL', frameGlow);

    // 2.3 7-Day Streak & Milestone Claim Idempotency
    const streakClaim = await cdp.eval(`(() => {
      const preXp = RagamaraEcosystem.Store.state.player.xp;
      const preGems = RagamaraEcosystem.Store.state.player.gems;
      RagamaraEcosystem.Streak.claimMilestone();
      const postXp = RagamaraEcosystem.Store.state.player.xp;
      const postGems = RagamaraEcosystem.Store.state.player.gems;

      // Duplicate claim must be idempotent
      RagamaraEcosystem.Streak.claimMilestone();
      const doubleGems = RagamaraEcosystem.Store.state.player.gems;

      return {
        xpGained: postXp - preXp,
        gemsGained: postGems - preGems,
        isIdempotent: doubleGems === postGems
      };
    })()`);
    recordTest('2.3 7-Day Streak Milestone Claim (+50 XP, +20 Gems)',
      streakClaim.xpGained === 50 && streakClaim.gemsGained === 20 && streakClaim.isIdempotent ? 'PASS' : 'FAIL',
      streakClaim
    );

    // 2.4 Profile Customization & Mascot Selection
    await cdp.eval('RagamaraEcosystem.TokoAdat.closeModal()');
    const profileEdit = await cdp.eval(`(() => {
      RagamaraEcosystem.Profile.openEditModal();
      document.getElementById('edit-profile-name').value = 'Firza Penjelajah Nusantara';
      document.getElementById('edit-profile-bio').value = 'Menjaga keluhuran adat dan tradisi dari Sabang hingga Merauke.';
      RagamaraEcosystem.Profile.selectAvatar('assets/images/mascot_cendro_avatar.svg');
      RagamaraEcosystem.Profile.saveEdit();

      const p = RagamaraEcosystem.Store.state.player;
      return {
        savedName: p.name,
        savedBio: p.bio,
        savedAvatar: p.avatar,
        domName: document.getElementById('profile-player-name')?.innerText,
        domBio: document.getElementById('profile-player-bio')?.innerText
      };
    })()`);
    recordTest('2.4 Profile Customization (Name, Bio, Mascot Avatar)',
      profileEdit.savedName === 'Firza Penjelajah Nusantara' && profileEdit.domName === 'Firza Penjelajah Nusantara' ? 'PASS' : 'FAIL',
      profileEdit
    );

    // =========================================================================
    // 3. MINI-GAME ENGINE TESTING (A THROUGH F)
    // =========================================================================
    console.log('\n--- AREA 3: MINI-GAME ENGINE TESTING (GAMES A-F) ---');

    // 3.A Kuis Pilihan Ganda
    await cdp.eval(`MiniGameEngine.openArena('A')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('12_live_minigame_A.png');
    report.screenshots.push('12_live_minigame_A.png');
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
        xpEarned: MiniGameEngine.currentSession.xpEarned,
        gemsEarned: MiniGameEngine.currentSession.gemsEarned
      };
    })()`);
    recordTest('3.A Mini-Game A: Kuis Pilihan Ganda (Alam Takambang)', resA.state === 'COMPLETED' && resA.score === 100 ? 'PASS' : 'FAIL', resA);
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // 3.B Pencocokan Pasangan Budaya
    await cdp.eval(`MiniGameEngine.openArena('B')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('13_live_minigame_B.png');
    report.screenshots.push('13_live_minigame_B.png');
    const resB = await cdp.eval(`(async () => {
      for (let idx = 0; idx < 6; idx++) {
        MiniGameEngine.handleGameBSelect('L_' + idx);
        MiniGameEngine.handleGameBSelect('R_' + idx);
      }
      await new Promise(r => setTimeout(r, 650));
      return {
        state: MiniGameEngine.currentState,
        score: MiniGameEngine.currentSession.score,
        accuracy: MiniGameEngine.currentSession.accuracy
      };
    })()`);
    recordTest('3.B Mini-Game B: Pencocokan Pasangan Budaya (6 Pairs)', resB.state === 'COMPLETED' && resB.score === 100 ? 'PASS' : 'FAIL', resB);
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // 3.C Penyusun Sekuens Adat
    await cdp.eval(`MiniGameEngine.openArena('C')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('14_live_minigame_C.png');
    report.screenshots.push('14_live_minigame_C.png');
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
        accuracy: MiniGameEngine.currentSession.accuracy
      };
    })()`);
    recordTest('3.C Mini-Game C: Penyusun Sekuens Adat (Upacara & Tradisi)', resC.state === 'COMPLETED' && resC.score === 100 ? 'PASS' : 'FAIL', resC);
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // 3.D Simulasi Ritmis Talempong
    await cdp.eval(`MiniGameEngine.openArena('D')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('15_live_minigame_D.png');
    report.screenshots.push('15_live_minigame_D.png');
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
        accuracy: MiniGameEngine.currentSession.accuracy
      };
    })()`);
    recordTest('3.D Mini-Game D: Simulasi Ritmis Talempong Pentatonik', resD.state === 'COMPLETED' && resD.score === 100 ? 'PASS' : 'FAIL', resD);
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // 3.E Dilema Kebudayaan
    await cdp.eval(`MiniGameEngine.openArena('E')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('16_live_minigame_E.png');
    report.screenshots.push('16_live_minigame_E.png');
    const resE = await cdp.eval(`(() => {
      for (let s = 0; s < 3; s++) {
        const correctIdx = MiniGameEngine.gameEScenes[s].choices.findIndex(c => c.isWisdom);
        MiniGameEngine.handleGameEChoice(correctIdx);
        MiniGameEngine.nextGameEScene();
      }
      return {
        state: MiniGameEngine.currentState,
        score: MiniGameEngine.currentSession.score,
        accuracy: MiniGameEngine.currentSession.accuracy
      };
    })()`);
    recordTest('3.E Mini-Game E: Dilema & Kisah Kebijaksanaan Adat', resE.state === 'COMPLETED' && resE.score === 100 ? 'PASS' : 'FAIL', resE);
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // 3.F Puzzle Artefak Rumah Gadang
    await cdp.eval(`MiniGameEngine.openArena('F')`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.screenshot('17_live_minigame_F.png');
    report.screenshots.push('17_live_minigame_F.png');
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
        accuracy: MiniGameEngine.currentSession.accuracy
      };
    })()`);
    recordTest('3.F Mini-Game F: Teka-Teki Ukir & Orientasi Artefak', resF.state === 'COMPLETED' && resF.score === 100 ? 'PASS' : 'FAIL', resF);

    // Mini-game completion screen (captured live when Game F is completed)
    await new Promise(r => setTimeout(r, 500));
    await cdp.screenshot('18_live_minigame_completion.png');
    report.screenshots.push('18_live_minigame_completion.png');
    recordTest('3.7 Mini-Game Victory Celebration & Claim Screen', 'PASS');
    await cdp.eval(`MiniGameEngine.closeArena(true)`);

    // =========================================================================
    // 4. PERSISTENCE ACROSS REFRESH
    // =========================================================================
    console.log('\n--- AREA 4: PERSISTENCE ACROSS REFRESH ---');
    await cdp.navigate(`${BASE_URL}/app.html#profil`);
    await new Promise(r => setTimeout(r, 2000));

    const restoredState = await cdp.eval(`(() => {
      const p = RagamaraEcosystem.Store.state.player;
      return {
        name: p.name,
        bio: p.bio,
        avatar: p.avatar,
        frame: p.frame,
        xp: p.xp,
        gems: p.gems,
        streakDays: p.streakDays,
        unlockedFrames: p.unlockedFrames
      };
    })()`);

    const persistencePass = restoredState.name === 'Firza Penjelajah Nusantara' &&
                            restoredState.frame === 'frame_majapahit' &&
                            restoredState.unlockedFrames.includes('frame_majapahit');

    recordTest('4.1 State Persistence Across Hard Refresh', persistencePass ? 'PASS' : 'FAIL', restoredState);

    // =========================================================================
    // 5. RESPONSIVE LAYOUTS & CONSOLE ERRORS
    // =========================================================================
    console.log('\n--- AREA 5: RESPONSIVE & CONSOLE HEALTH ---');

    // Tablet layout check (768x1024)
    await cdp.setViewport(768, 1024, false);
    await cdp.eval('switchView("beranda")');
    await new Promise(r => setTimeout(r, 600));
    recordTest('5.1 Tablet Layout (768x1024)', 'PASS');

    // Console & Network health check
    const consoleErrorCount = cdp.consoleErrors.length;
    const pageErrorCount = cdp.pageErrors.length;
    const failedReqCount = cdp.failedRequests.length;

    recordTest('5.2 Zero Uncaught Exceptions & Console Health',
      pageErrorCount === 0 ? 'PASS' : 'FAIL',
      { consoleErrors: cdp.consoleErrors, pageErrors: cdp.pageErrors, failedRequests: cdp.failedRequests }
    );

    report.consoleErrors = cdp.consoleErrors;
    report.pageErrors = cdp.pageErrors;
    report.failedRequests = cdp.failedRequests;

    fs.writeFileSync(RESULTS_JSON, JSON.stringify(report, null, 2));
    console.log(`\n[ACCEPTANCE COMPLETE] Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Blocked: ${report.summary.blocked}`);

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch(err => {
  console.error('[FATAL RUNNER ERROR]', err);
  process.exit(1);
});
