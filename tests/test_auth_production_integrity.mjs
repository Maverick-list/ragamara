/**
 * NULAR — Phase A Authentication Production Integrity & Fail-Closed Test Suite
 * Verifies:
 *  1. Production with missing session secret -> 503 SESSION_SECRET_MISSING
 *  2. Production with missing Supabase vars -> 503 AUTH_STORAGE_UNAVAILABLE
 *  3. Production with incomplete Supabase vars -> 503 SUPABASE_CONFIG_INCOMPLETE
 *  4. Production rejects local filesystem fallback
 *  5. Ephemeral test fixture diagnostic mode
 *  6. Local dev persistent storage across reload & restart
 *  7. Cross-restart login rate-limit persistence (cannot bypass via process restart)
 *  8. Invalid/tampered session token rejection
 *  9. Logout & account deletion session JTI revocation + cleanup
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const authModuleUrl = pathToFileURL(path.resolve(process.cwd(), 'api/auth.js')).href;

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

async function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const prev = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

async function run() {
  const mod = await import(`${authModuleUrl}?integrity=${Date.now()}_1`);

  // 1. Production with missing session secret fails closed (503) & never leaks secret
  await withEnv({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    NULAR_SESSION_SECRET: undefined,
    RAGAMARA_SESSION_SECRET: undefined,
    SESSION_SECRET: undefined,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder'
  }, async () => {
    const provRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth?action=providers'));
    const provText = await provRes.text();
    const { providers } = JSON.parse(provText);
    assert.equal(providers.security.isProduction, true);
    assert.equal(providers.security.sessionSecretConfigured, false);
    assert.equal(providers.security.sessionSecretMandatoryMet, false);
    assert.equal(providers.productionReady, false);
    assert.equal(provText.includes('test-service-role-key-placeholder'), false, 'Diagnostics must never expose Supabase keys');

    const signupRes = await mod.POST(makeReq('http://127.0.0.1:3000/api/auth?action=signup', {
      method: 'POST',
      body: { email: 'prod-nosecret@nular.test', password: 'StrongPassword#2026' }
    }));
    assert.equal(signupRes.status, 503);
    const data = await signupRes.json();
    assert.equal(data.code, 'SESSION_SECRET_MISSING');
    assert.equal(mod.verifySessionToken('eyJ1aWQiOiIxIn0.invalidsig'), null);
  });

  // 2. Production with valid secret but missing Supabase fails closed (503) & rejects filesystem fallback
  await withEnv({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    NULAR_SESSION_SECRET: 'a-very-strong-production-secret-at-least-32-chars-long',
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_ANON_KEY: undefined
  }, async () => {
    const provRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth?action=providers'));
    const { providers } = await provRes.json();
    assert.equal(providers.storageMode, 'unconfigured_fail_closed', 'Production must reject local filesystem fallback');
    assert.equal(providers.productionReady, false);

    const loginRes = await mod.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
      method: 'POST',
      body: { email: 'prod-nosupabase@nular.test', password: 'StrongPassword#2026' }
    }));
    assert.equal(loginRes.status, 503);
    const data = await loginRes.json();
    assert.equal(data.code, 'AUTH_STORAGE_UNAVAILABLE');

    const delRes = await mod.DELETE(makeReq('http://127.0.0.1:3000/api/auth', { method: 'DELETE' }));
    assert.equal(delRes.status, 503);
  });

  // 3. Production with incomplete Supabase config (URL set, key missing) fails closed (503)
  await withEnv({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    NULAR_SESSION_SECRET: 'a-very-strong-production-secret-at-least-32-chars-long',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_ANON_KEY: undefined
  }, async () => {
    const provRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth?action=providers'));
    const { providers } = await provRes.json();
    assert.equal(providers.supabase.configured, false);
    assert.equal(providers.supabase.incomplete, true);
    assert.equal(providers.storageMode, 'unconfigured_fail_closed');

    const signupRes = await mod.POST(makeReq('http://127.0.0.1:3000/api/auth?action=signup', {
      method: 'POST',
      body: { email: 'prod-incomplete@nular.test', password: 'StrongPassword#2026' }
    }));
    assert.equal(signupRes.status, 503);
    const data = await signupRes.json();
    assert.equal(data.code, 'SUPABASE_CONFIG_INCOMPLETE');
  });

  // 4. Ephemeral test fixture diagnostic mode (explicit non-prod opt-in)
  await withEnv({
    NODE_ENV: 'development',
    VERCEL_ENV: undefined,
    VERCEL: undefined,
    NULAR_AUTH_TEST_FIXTURE: '1',
    SUPABASE_URL: undefined
  }, async () => {
    const provRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth?action=providers'));
    const { providers } = await provRes.json();
    assert.equal(providers.storageMode, 'ephemeral_test_fixture');
  });

  // 5-9. Local dev persistence, cross-restart rate-limit persistence, invalid session, logout/delete revocation
  await withEnv({
    NODE_ENV: 'development',
    VERCEL_ENV: undefined,
    VERCEL: undefined,
    NULAR_AUTH_TEST_FIXTURE: undefined,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_ANON_KEY: undefined
  }, async () => {
    const email = `integrity_${Date.now()}@nular.test`;
    const password = 'NularIntegrity#2026';

    const signupRes = await mod.POST(makeReq('http://127.0.0.1:3000/api/auth?action=signup', {
      method: 'POST',
      body: { email, password, username: 'IntegritasUji' }
    }));
    assert.equal(signupRes.status, 201);
    const cookie1 = (signupRes.headers.get('set-cookie') || '').split(';')[0];

    // Invalid/tampered session rejected
    const tamperedCookie = `${cookie1}tampered`;
    const badSessRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth', { cookie: tamperedCookie }));
    const badSess = await badSessRes.json();
    assert.equal(badSess.authenticated, false);

    // Logout revokes JTI immediately
    await mod.POST(makeReq('http://127.0.0.1:3000/api/auth?action=logout', { method: 'POST', cookie: cookie1 }));
    const afterLogoutRes = await mod.GET(makeReq('http://127.0.0.1:3000/api/auth', { cookie: cookie1 }));
    const afterLogout = await afterLogoutRes.json();
    assert.equal(afterLogout.authenticated, false, 'Revoked session cookie must be rejected after logout');

    // Reload module (simulate restart): revoked JTI still rejected, fresh login works
    const modRestart1 = await import(`${authModuleUrl}?integrity=${Date.now()}_2`);
    const replayAfterRestart = await modRestart1.GET(makeReq('http://127.0.0.1:3000/api/auth', { cookie: cookie1 }));
    assert.equal((await replayAfterRestart.json()).authenticated, false, 'Revoked JTI must persist across restart');

    // Trigger 5 failed logins, then restart module -> 6th attempt MUST STILL return 429!
    for (let i = 0; i < 5; i += 1) {
      const r = await modRestart1.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
        method: 'POST',
        body: { email, password: 'WrongPassword999!' }
      }));
      assert.equal(r.status, 401);
    }
    const modRestart2 = await import(`${authModuleUrl}?integrity=${Date.now()}_3`);
    const lockedAfterRestart = await modRestart2.POST(makeReq('http://127.0.0.1:3000/api/auth?action=login', {
      method: 'POST',
      body: { email, password }
    }));
    assert.equal(lockedAfterRestart.status, 429, 'Login rate limit must persist across process restarts in local dev');

    // Sign up a second temporary user to test account deletion + immediate session invalidation
    const email2 = `del_${Date.now()}@nular.test`;
    const s2 = await modRestart2.POST(makeReq('http://127.0.0.1:3000/api/auth?action=signup', {
      method: 'POST',
      body: { email: email2, password, username: 'HapusUji' }
    }));
    assert.equal(s2.status, 201);
    const cookie2 = (s2.headers.get('set-cookie') || '').split(';')[0];

    const del2 = await modRestart2.DELETE(makeReq('http://127.0.0.1:3000/api/auth', {
      method: 'DELETE',
      cookie: cookie2
    }));
    assert.equal(del2.status, 200);
    const postDelCheck = await modRestart2.GET(makeReq('http://127.0.0.1:3000/api/auth', { cookie: cookie2 }));
    assert.equal((await postDelCheck.json()).authenticated, false, 'Deleted account session must be invalidated immediately');
  });

  console.log('PASS: test_auth_production_integrity.mjs (9/9 integrity scenarios passed)');
}

run().catch((err) => {
  console.error('FAIL: test_auth_production_integrity.mjs', err);
  process.exit(1);
});
