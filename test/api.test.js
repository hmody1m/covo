import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitFor } from './helpers.js';

let s;
before(async () => { s = await startServer(); });
after(() => s.stop());

test('first run: setup required, API locked', async () => {
  const st = await s.req('GET', '/api/auth/status');
  assert.equal(st.body.setup, false);
  assert.equal((await s.req('GET', '/api/bootstrap')).status, 401);
});

test('setup creates the owner and a session; password rules enforced', async () => {
  assert.equal((await s.req('POST', '/api/auth/setup', { password: '123', name: 'Sara' })).status, 400);
  const r = await s.req('POST', '/api/auth/setup', { password: 'secret123', name: 'Sara' });
  assert.equal(r.status, 200);
  assert.equal((await s.req('POST', '/api/auth/setup', { password: 'other123' })).status, 409);
});

test('bootstrap seeds the demo and masks secrets', async () => {
  await s.req('PUT', '/api/settings', { provider: { anthropic: { apiKey: 'sk-ant-test-abcd' } } });
  const b = (await s.req('GET', '/api/bootstrap')).body;
  assert.equal(b.provider, 'demo');
  assert.ok(b.feed.length >= 1, 'morning brief seeded');
  assert.ok(b.tasks.length >= 5);
  assert.equal(b.settings.provider.anthropic.apiKey, '••••abcd');
  assert.equal(b.settings.agent.name, 'Covo');
});

test('demo flow: start → approval → Paid', async () => {
  await s.req('POST', '/api/demo/start');
  const ap = await waitFor(async () => (await s.req('GET', '/api/bootstrap')).body.approvals.find((a) => a.status === 'pending'));
  assert.equal(ap.amount, 480);
  await s.req('POST', `/api/approvals/${ap.id}`, { decision: 'approve' });
  await waitFor(async () => (await s.req('GET', '/api/bootstrap')).body.feed.some((f) => /^Paid\./.test(f.text || '')), 20000);
});

test('artifacts are served sandboxed', async () => {
  const b = (await s.req('GET', '/api/bootstrap')).body;
  const a = b.artifacts[0];
  const r = await s.req('GET', `/a/${a.id}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
  assert.ok(!/allow-same-origin/.test(r.headers.get('content-security-policy')));
});

test('legal documents are public; unknown files are not', async () => {
  for (const f of ['TERMS.md', 'PRIVACY.md', 'TRADEMARKS.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE']) {
    assert.equal((await s.req('GET', `/legal/${f}`)).status, 200, f);
  }
  assert.equal((await s.req('GET', '/legal/package.json')).status, 404);
  assert.match((await s.req('GET', '/legal/TRADEMARKS.md')).body, /not affiliated/i);
});

test('static files: no path traversal, fonts allow CORS', async () => {
  const r = await fetch(s.url + '/..%2f..%2fpackage.json');
  assert.notEqual(r.status, 500);
  assert.ok(!(await r.text()).includes('"dependencies"'));
  const f = await fetch(s.url + '/fonts/fonts.css');
  assert.equal(f.headers.get('access-control-allow-origin'), '*');
});

test('thread export as Markdown', async () => {
  const r = await s.req('GET', '/api/export/thread.md');
  assert.equal(r.status, 200);
  assert.match(r.body, /Morning brief/);
});

test('API tokens and device pairing', async () => {
  const tok = (await s.req('POST', '/api/security/tokens', { name: 'test' })).body.token;
  assert.match(tok, /^covo_/);
  const r = await fetch(s.url + '/api/bootstrap', { headers: { Authorization: `Bearer ${tok}` } });
  assert.equal(r.status, 200);
  const bad = await fetch(s.url + '/api/bootstrap', { headers: { Authorization: 'Bearer covo_nope' } });
  assert.equal(bad.status, 401);
  const dev = (await s.req('POST', '/api/devices/pair', { name: 'PC' })).body;
  assert.match(dev.token, /^dev_/);
});

test('login rate limiting', async () => {
  for (let i = 0; i < 5; i++) await s.req('POST', '/api/auth/login', { password: 'wrong' });
  assert.equal((await s.req('POST', '/api/auth/login', { password: 'wrong' })).status, 429);
});
