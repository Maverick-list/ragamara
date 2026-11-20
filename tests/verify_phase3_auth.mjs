import assert from 'node:assert/strict';
import { POST, GET, DELETE } from '../api/auth.js';

async function run() {
  // 1. Guest check
  const gRes = await GET(new Request('http://127.0.0.1/api/auth'));
  const gJson = await gRes.json();
  assert.equal(gJson.authenticated, false);
  assert.equal(gJson.mode, 'guest');

  // 2. Sign up
  const sRes = await POST(new Request('http://127.0.0.1/api/auth?action=signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nusa@example.id', password: 'Password123!', username: 'NusaExplorer' })
  }));
  assert.equal(sRes.status, 201);
  const sJson = await sRes.json();
  assert.equal(sJson.authenticated, true);
  assert.equal(sJson.user.username, 'NusaExplorer');
  assert.equal(sJson.passwordHash, undefined);
  const cookie = sRes.headers.get('set-cookie').split(';')[0];
  assert.ok(sRes.headers.get('set-cookie').includes('HttpOnly'));

  // 3. Session verify with signed cookie
  const meRes = await GET(new Request('http://127.0.0.1/api/auth', { headers: { Cookie: cookie } }));
  const meJson = await meRes.json();
  assert.equal(meJson.authenticated, true);
  assert.equal(meJson.user.username, 'NusaExplorer');

  // 4. Reject invalid password
  const badRes = await POST(new Request('http://127.0.0.1/api/auth?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nusa@example.id', password: 'WrongPassword!' })
  }));
  assert.equal(badRes.status, 401);

  // 5. Delete account
  const delRes = await DELETE(new Request('http://127.0.0.1/api/auth', { method: 'DELETE', headers: { Cookie: cookie } }));
  const delJson = await delRes.json();
  assert.equal(delJson.deleted, true);

  console.log('[PHASE 3 AUTH & DB SCHEMA VERIFICATION] 5/5 PASSED');
}

run().catch((e) => { console.error(e); process.exit(1); });
