import assert from 'node:assert/strict';
import { POST as authPost } from '../api/auth.js';
import { POST as progPost, GET as progGet } from '../api/progress.js';
import { GET as lbGet } from '../api/leaderboard.js';

async function run() {
  // 1. Create authenticated user for progress test (isolated test identity)
  const testEmail = `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@nular.id`;
  const sRes = await authPost(new Request('http://127.0.0.1/api/auth?action=signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'Password123!', username: 'ArjunaNusantara' })
  }));
  const cookie = sRes.headers.get('set-cookie').split(';')[0];

  // 2. Award XP — attempt client-side tamper (`xp: 999999`) -> server MUST ignore and award 10 XP
  const p1 = await progPost(new Request('http://127.0.0.1/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityType: 'discover_item', eventKey: 'discover:item-rencong-aceh', xp: 999999 })
  }));
  const j1 = await p1.json();
  assert.equal(j1.duplicate, false);
  assert.equal(j1.xpAwarded, 10);
  assert.equal(j1.xp, 10);

  // 3. Replay attack with same eventKey -> MUST return duplicate: true, xpAwarded: 0
  const pDup = await progPost(new Request('http://127.0.0.1/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityType: 'discover_item', eventKey: 'discover:item-rencong-aceh' })
  }));
  const jDup = await pDup.json();
  assert.equal(jDup.duplicate, true);
  assert.equal(jDup.xpAwarded, 0);
  assert.equal(jDup.xp, 10);

  // 4. Complete quiz (+20 XP) & verify streak
  const pQuiz = await progPost(new Request('http://127.0.0.1/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityType: 'finish_quiz', eventKey: 'quiz:quiz-nusantara-core', timezone: 'Asia/Jakarta' })
  }));
  const jQuiz = await pQuiz.json();
  assert.equal(jQuiz.xp, 30);
  assert.equal(jQuiz.streakDays, 1);

  // 5. Leaderboard privacy check: NO email or userId exposed
  const lbRes = await lbGet(new Request('http://127.0.0.1/api/leaderboard?scope=global'));
  const lbJson = await lbRes.json();
  assert.ok(lbJson.entries.length >= 1);
  const entry = lbJson.entries.find(e => e.username === 'ArjunaNusantara');
  assert.ok(entry, 'Expected ArjunaNusantara in leaderboard entries');
  assert.equal(entry.username, 'ArjunaNusantara');
  assert.equal(entry.email, undefined);
  assert.equal(entry.userId, undefined);

  // 6. GET /api/progress
  const meRes = await progGet(new Request('http://127.0.0.1/api/progress', { headers: { Cookie: cookie } }));
  const meJson = await meRes.json();
  assert.equal(meJson.xp, 30);

  console.log('[PHASE 7, 8 & 9 GAMIFICATION, ANTI-ABUSE & LEADERBOARD VERIFICATION] 6/6 PASSED');
}

run().catch((e) => { console.error(e); process.exit(1); });
