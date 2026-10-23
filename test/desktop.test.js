import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

// Desktop app mode (desktop/src/main.cjs): the app window signs itself in with a per-launch key.
const KEY = 'test-desktop-key-0123456789';
let s;
before(async () => { s = await startServer({ COVO_DESKTOP_KEY: KEY, COVO_DESKTOP: '1' }); });
after(() => s.stop());

const signIn = (key) => fetch(`${s.url}/api/auth/desktop?key=${encodeURIComponent(key)}`, { redirect: 'manual' });

test('wrong key is refused, right key signs the window in', async () => {
  assert.equal((await signIn('nope')).status, 403);
  assert.equal((await signIn(KEY.slice(0, -1) + 'x')).status, 403);
  const r = await signIn(KEY);
  assert.equal(r.status, 302);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const st = await (await fetch(`${s.url}/api/auth/status`, { headers: { Cookie: cookie } })).json();
  assert.equal(st.desktop, true);
  assert.equal(st.authed, true);
  assert.equal(st.setup, false);
  // the shared test client now uses the desktop session
  await s.req('GET', '/api/auth/status', undefined, { Cookie: cookie });
  s.cookie = cookie;
});

test('desktop setup needs no password; other clients still need one', async () => {
  const h = { Cookie: s.cookie };
  assert.equal((await s.req('POST', '/api/auth/setup', { name: 'Sara' }, h)).status, 200);
  const st = (await s.req('GET', '/api/auth/status', undefined, h)).body;
  assert.equal(st.setup, true);
  assert.equal(st.hasPassword, false);
  // no password yet → nobody can log in from another device
  const other = await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: '' }) });
  assert.equal(other.status, 401);
  assert.equal((await fetch(`${s.url}/api/bootstrap`)).status, 401);
});

test('setting a password from the desktop window enables phone sign-in', async () => {
  const r = await fetch(`${s.url}/api/security/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: s.cookie }, body: JSON.stringify({ next: 'phone-pass-1' }) });
  assert.equal(r.status, 200);
  const desktopCookie = r.headers.get('set-cookie').split(';')[0];
  const sec = await (await fetch(`${s.url}/api/security`, { headers: { Cookie: desktopCookie } })).json();
  assert.equal(sec.hasPassword, true);
  assert.equal(sec.desktop, true);
  const phone = await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Phone' }, body: JSON.stringify({ password: 'phone-pass-1' }) });
  assert.equal(phone.status, 200);
  // a phone session can't change the password without the current one
  const pc = phone.headers.get('set-cookie').split(';')[0];
  const bad = await fetch(`${s.url}/api/security/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: pc }, body: JSON.stringify({ next: 'hijack-123' }) });
  assert.equal(bad.status, 401);
});

test('devices list says "this computer" in the desktop app', async () => {
  const r = await fetch(`${s.url}/api/auth/desktop?key=${KEY}`, { redirect: 'manual' });
  const c = (r.headers.get('set-cookie') || '').split(';')[0] || s.cookie;
  const b = await (await fetch(`${s.url}/api/bootstrap`, { headers: { Cookie: c } })).json();
  const srv = b.devices.find((d) => d.id === 'server');
  assert.match(srv.name, /this computer/);
  assert.equal(srv.enabled, true);
});

test('a phone that pretends to be the desktop app gets no desktop rights', async () => {
  const r = await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Covo Desktop' }, body: JSON.stringify({ password: 'phone-pass-1' }) });
  assert.equal(r.status, 200);
  const c = r.headers.get('set-cookie').split(';')[0];
  const st = await (await fetch(`${s.url}/api/auth/status`, { headers: { Cookie: c } })).json();
  assert.equal(st.desktop, false);
  const bad = await fetch(`${s.url}/api/security/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ next: 'hijack-123' }) });
  assert.equal(bad.status, 401);
});
