import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const authModulePath = path.resolve(process.cwd(), 'api/auth.js');
const authModuleUrl = pathToFileURL(authModulePath).href;
const storeFile = path.resolve(process.cwd(), '.nular-local-data/auth-store.json');

function makeReq(url, { method = 'GET', body = null, cookie = '' } = {}) {
  const headers = new Headers();
  if (body) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function run() {
  const mod1 = await import(`${authModuleUrl}?t=${Date.now()}_1`);

  // 1. Provider diagnostics check
  const provRes = await mod1.GET(makeReq('http://127.0.0.1:3000/api/auth?action=providers'));
  assert.equal(provRes.status, 200);
  const provBody = await provRes.json();
  const prov = provBody.providers;
  assert.equal(prov.storageMode, 'local_dev_persistent', 'Expected local_dev_persistent storage in writable non-prod');
  assert.equal(prov.security?.loginRateLimitEnabled, true, 'Expected loginRateLimitEnabled=true');
  assert.equal(prov.email?.smtpConfigured, false, 'Expected smtpConfigured=false in local env without SMTP');

  const testEmail = `hardening_${Date.now()}@nular.test`;
  const testPassword = 'NularMuseum#2026';

  // 2. Signup & verify local persistence file exists
  const signupRes = await mod1.POST(makeReq('http://127.0.0.1:3000/api/auth?action=signup', {
    method: 'POST',
    body: { email: testEmail, password: testPassword, username: 'KuratorUji' }
  }));
  assert.equal(signupRes.status, 201);
  const setCookie = signupRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /nular_session=/, 'Expected HttpOnly session cookie');
  const sessionCookie = setCookie.split(';')[0];

  assert.equal(fs.existsSync(storeFile), true, 'Expected .nular-local-data/auth-store.json to be created');

  // 3. Honest verify-email returns 503 when SMTP/Supabase is unconfigured
  const verifyRes = await mod1.POST(makeReq('http://127.0.0.1:3000/api/auth?action=verify-email', {
    method: 'POST',
    cookie: sessionCookie,
    body: {}
  }));
  assert.equal(verifyRes.status, 503, 'verify-email must return 503 when SMTP is unconfigured');
  const verifyJson = await verifyRes.json();
  assert.equal(verifyJson.configured, false);
  assert.equal(verifyJson.emailVerified, false);

  // 4. Reload module (simulating server restart) and verify account persisted
  const mod2 = await import(`${authModuleUrl}?t=${Date.now()}_2`);
  const loginOkRes = await mod2.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  }));
  assert.equal(loginOkRes.status, 200, 'Persisted account should survive module/server restart');
  const loginOkData = await loginOkRes.json();
  assert.equal(loginOkData.authenticated, true);
  assert.equal(loginOkData.user.username, 'KuratorUji');

  // 5. Brute-force rate limiting (5 wrong passwords -> 6th returns 429)
  for (let i = 1; i <= 5; i += 1) {
    const badRes = await mod2.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
      method: 'POST',
      body: { email: testEmail, password: 'WrongPassword123!' }
    }));
    assert.equal(badRes.status, 401, `Attempt ${i} should return 401`);
  }
  const lockedRes = await mod2.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  }));
  assert.equal(lockedRes.status, 429, '6th login attempt during lockout window must return 429');
  const lockedJson = await lockedRes.json();
  assert.ok(lockedJson.retryAfterSeconds > 0, 'Expected retryAfterSeconds > 0');
  assert.ok(Number(lockedRes.headers.get('retry-after')) > 0, 'Expected Retry-After header');

  // 6. Clean up test account via DELETE
  const delRes = await mod2.DELETE(makeReq('http://127.0.0.1:3000/api/auth', {
    method: 'DELETE',
    cookie: sessionCookie
  }));
  assert.equal(delRes.status, 200);

  // Verify deleted account is removed from persisted file
  const mod3 = await import(`${authModuleUrl}?t=${Date.now()}_3`);
  const afterDelLogin = await mod3.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  }));
  assert.equal(afterDelLogin.status, 401, 'Deleted account must no longer exist after reload');

  console.log('PASS: test_auth_hardening.mjs (6/6 assertions passed)');
}

run().catch((err) => {
  console.error('FAIL: test_auth_hardening.mjs', err);
  process.exit(1);
});
