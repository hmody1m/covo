import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Router, readJsonBody, readBody, send, parseCookies, clientIp, MIME } from './http.js';
import { DATA_DIR, ROOT, id, now, log } from './util.js';
import * as A from './auth.js';
import { db, save, readArtifact, deleteArtifact, publicTask, upsertTask, replaceDb, resetDb, flush } from './db.js';
import { broadcast } from './bus.js';
import { getSettings, publicSettings, updateSettings, activeProvider, replaceSettings, resetSettings, DEFAULT_SETTINGS } from './config.js';
import { listDevices, disconnectDevice } from './devices.js';
import { mcpStatus, reloadMcp } from './mcp.js';
import { vapidPublicKey, addPushSub, removePushSub, notify } from './notify.js';
import { emailConfigured } from './email.js';
import { renderSystemPrompt, PRESETS, promptTemplate } from './agent/prompt.js';
import { CATEGORIES } from './agent/policy.js';
import * as core from './agent/core.js';
import { demo } from './agent/demo-host.js';
import { anthropicTest, anthropicModels, resetAnthropicDegraded } from './agent/providers/anthropic.js';
import { openaiTest } from './agent/providers/openai.js';
import { artifactToHtml } from '../web/js/lib/artifact-html.js';
import { publicStatus as integrationStatus, restartTelegram } from './integrations/telegram.js';

export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const SECURE = process.env.SECURE_COOKIES === '1';
const COOKIE = 'covo_session';

export function authFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return A.apiTokenValid(auth.slice(7)) ? { kind: 'token' } : null;
  const s = A.sessionFromToken(parseCookies(req)[COOKIE]);
  return s ? { kind: 'session', session: s } : null;
}

function setCookie(res, token) {
  const days = getSettings().security.sessionDays || 30;
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${SECURE ? '; Secure' : ''}`);
}
const err = (status, message) => Object.assign(new Error(message), { status });

export const router = new Router();
const r = router;

/* ───────────── auth (public) ───────────── */
// Desktop app (desktop/main.cjs): the app window signs itself in with a per-launch key.
const DESKTOP_KEY = process.env.COVO_DESKTOP_KEY || '';
const isDesktopReq = (req) => !!DESKTOP_KEY && !!authFromReq(req)?.session?.desktop;

r.get('/api/auth/status', (req, res) => send(res, 200, { setup: A.isSetup(), authed: !!authFromReq(req), version: VERSION, appName: getSettings().agent.name || 'Covo', desktop: isDesktopReq(req), hasPassword: A.hasPassword() }), { public: true });

r.get('/api/auth/desktop', (req, res) => {
  const key = new URL(req.url, 'http://x').searchParams.get('key') || '';
  const ok = DESKTOP_KEY && key.length === DESKTOP_KEY.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(DESKTOP_KEY));
  if (!ok) throw err(403, 'Forbidden');
  if (!isDesktopReq(req)) setCookie(res, A.createSession('Covo Desktop', { desktop: true }));
  send(res, 302, null, { Location: '/' });
}, { public: true });

r.post('/api/auth/setup', async (req, res) => {
  if (A.isSetup()) throw err(409, 'Already set up');
  const b = await readJsonBody(req);
  if (!b.password && isDesktopReq(req)) A.markLocalSetup();
  else A.setPassword(b.password);
  const patch = { profile: { name: (b.name || '').trim() } };
  if (b.language) patch.profile.language = b.language;
  if (b.timezone) patch.profile.timezone = b.timezone;
  if (b.theme) patch.appearance = { theme: b.theme };
  updateSettings(patch);
  if (!isDesktopReq(req)) setCookie(res, A.createSession(req.headers['user-agent']));
  send(res, 200, { ok: true });
}, { public: true });

r.post('/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  if (A.rateLimited(ip)) throw err(429, 'Too many attempts. Try again in a few minutes.');
  const b = await readJsonBody(req);
  if (!A.checkPassword(b.password)) { A.noteFailure(ip); throw err(401, 'Wrong password'); }
  A.noteSuccess(ip);
  setCookie(res, A.createSession(req.headers['user-agent']));
  send(res, 200, { ok: true });
}, { public: true });

r.post('/api/auth/logout', (req, res) => {
  const s = A.sessionFromToken(parseCookies(req)[COOKIE]);
  if (s) A.revokeSession(s.id);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  send(res, 200, { ok: true });
}, { public: true });

/* ───────────── bootstrap ───────────── */
function ensureSeeded() {
  if (!db.data.meta?.seeded) {
    (db.data.meta ||= {}).seeded = true;
    if (activeProvider() === 'demo' && !db.data.feed.length) demo.seed();
    if (!db.data.routines.some((x) => /brief/i.test(x.title))) {
      db.data.routines.push({ id: id('r_'), title: 'Morning brief', prompt: 'Check every active topic and task, update anything stale, then send my morning brief.', time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, mode: 'main', createdAt: now(), lastRun: null });
    }
    save();
  }
}

export function bootstrap() {
  ensureSeeded();
  return {
    version: VERSION,
    settings: publicSettings(),
    provider: activeProvider(),
    state: core.getState(),
    feed: db.data.feed.slice(-500),
    topics: db.data.topics,
    tasks: db.data.tasks.map(publicTask),
    artifacts: db.data.artifacts,
    approvals: db.data.approvals.filter((a) => a.status === 'pending' || now() - (a.updatedAt || a.createdAt) < 7 * 86400_000),
    memory: db.data.memory,
    routines: db.data.routines,
    devices: listDevices(),
    mcp: mcpStatus(),
    usage: db.data.usage,
    suggestions: activeProvider() === 'demo' ? db.data.meta?.suggestions || [] : [],
    emailConfigured: emailConfigured(),
    vapidKey: vapidPublicKey(),
    categories: CATEGORIES,
    presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.name])),
    server: { hostname: os.hostname(), platform: process.platform, dataDir: DATA_DIR, node: process.version },
    integrations: integrationStatus(),
  };
}
r.get('/api/bootstrap', (req, res) => send(res, 200, bootstrap()));

/* ───────────── chat ───────────── */
r.post('/api/messages', async (req, res) => {
  const b = await readJsonBody(req);
  const item = core.userMessage({ text: b.text, attachments: b.attachments || [] });
  send(res, 200, { ok: true, item });
});
r.post('/api/stop', (req, res) => { core.stop(); send(res, 200, { ok: true }); });
r.post('/api/demo/start', (req, res) => { if (activeProvider() === 'demo') demo.start(); send(res, 200, { ok: true }); });

r.post('/api/approvals/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const ap = await core.decideApproval(p.id, b.decision === 'approve' ? 'approve' : 'decline');
  send(res, 200, ap);
});

r.post('/api/emails/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const it = await core.emailAction(p.id, b.action, { ...(b.draft || {}), via: b.via });
  send(res, 200, it);
});

r.delete('/api/feed/:id', (req, res, p) => {
  const i = db.data.feed.findIndex((f) => f.id === p.id);
  if (i >= 0) { db.data.feed.splice(i, 1); save(); broadcast('feed.remove', { id: p.id }); }
  send(res, 200, { ok: true });
});

/* ───────────── topics ───────────── */
r.patch('/api/topics/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const t = db.data.topics.find((x) => x.id === p.id);
  if (!t) throw err(404, 'Not found');
  for (const k of ['title', 'emoji', 'status', 'archived']) if (b[k] !== undefined) t[k] = b[k];
  t.updatedAt = now(); save(); broadcast('topic.update', t);
  send(res, 200, t);
});

/* ───────────── tasks ───────────── */
r.get('/api/tasks/:id', (req, res, p) => {
  const t = db.data.tasks.find((x) => x.id === p.id);
  if (!t) throw err(404, 'Not found');
  send(res, 200, { ...publicTask(t), steps: t.steps });
});
r.post('/api/tasks', async (req, res) => {
  const b = await readJsonBody(req);
  if (!b.title || !b.goal) throw err(400, 'title and goal are required');
  if (activeProvider() === 'demo') throw err(400, 'Connect a model in Settings → Model to run real tasks.');
  send(res, 200, core.tasks.createTask({ title: b.title, goal: b.goal, total: b.total }, { scope: 'user' }));
});
r.post('/api/tasks/:id/action', async (req, res, p) => {
  const b = await readJsonBody(req);
  const t = db.data.tasks.find((x) => x.id === p.id);
  if (!t) throw err(404, 'Not found');
  if (t.demo) {
    if (b.message) { t.steps.push({ ts: now(), kind: 'user', text: b.message }); }
    if (b.action === 'pause') t.status = 'paused'; else if (b.action === 'resume') t.status = 'running'; else if (b.action === 'cancel') t.status = 'cancelled';
    upsertTask({ id: t.id });
    return send(res, 200, { ok: true, demo: true });
  }
  send(res, 200, core.tasks.messageTask({ id: p.id, message: b.message, action: b.action }));
});
r.delete('/api/tasks/:id', (req, res, p) => { core.tasks.deleteTask(p.id); save(); send(res, 200, { ok: true }); });

/* ───────────── artifacts ───────────── */
r.get('/api/artifacts/:id', (req, res, p) => {
  const a = readArtifact(p.id, Number(new URL(req.url, 'http://x').searchParams.get('v')) || undefined);
  if (!a) throw err(404, 'Not found');
  send(res, 200, a);
});
r.patch('/api/artifacts/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const a = db.data.artifacts.find((x) => x.id === p.id);
  if (!a) throw err(404, 'Not found');
  for (const k of ['title', 'pinned', 'summary']) if (b[k] !== undefined) a[k] = b[k];
  save(); broadcast('artifact.upsert', a);
  send(res, 200, a);
});
r.delete('/api/artifacts/:id', (req, res, p) => { deleteArtifact(p.id); send(res, 200, { ok: true }); });

// Rendered artifact for iframes. Sandboxed (opaque origin) so artifact scripts can't call the API.
r.get('/a/:id', (req, res, p) => {
  const v = Number(new URL(req.url, 'http://x').searchParams.get('v')) || undefined;
  const a = readArtifact(p.id, v);
  if (!a) throw err(404, 'Not found');
  send(res, 200, artifactToHtml(a), {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals",
    'Cache-Control': 'no-cache',
  });
});
r.get('/a/:id/download', (req, res, p) => {
  const a = readArtifact(p.id);
  if (!a) throw err(404, 'Not found');
  const html = ['page', 'dashboard', 'deck'].includes(a.kind);
  const name = (a.title || 'artifact').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + (html ? '.html' : '.md');
  send(res, 200, a.content, { 'Content-Type': html ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
});

/* ───────────── settings & prompt ───────────── */
r.get('/api/settings', (req, res) => send(res, 200, publicSettings()));
r.put('/api/settings', async (req, res) => {
  const b = await readJsonBody(req);
  const before = JSON.stringify(getSettings().tools.mcpServers);
  const wasDemo = activeProvider() === 'demo';
  const out = updateSettings(b);
  // First switch from the demo to a real model: clear the scripted demo data for a clean start.
  if (wasDemo && activeProvider() !== 'demo' && db.data.meta?.demoStep) {
    core.stop();
    const keep = { memory: db.data.memory, pushSubs: db.data.pushSubs };
    resetDb(false);
    Object.assign(db.data, keep);
    db.data.meta.seeded = false;
    ensureSeeded();
    broadcast('reload', {});
  }
  if (b.provider) resetAnthropicDegraded();
  if (JSON.stringify(getSettings().tools.mcpServers) !== before) reloadMcp();
  if (b.integrations?.telegram) restartTelegram();
  broadcast('provider', activeProvider());
  broadcast('devices', listDevices());
  send(res, 200, { settings: out, provider: activeProvider() });
});
r.post('/api/settings/test', async (req, res) => {
  const p = getSettings().provider.type;
  try {
    const out = p === 'anthropic' ? await anthropicTest() : p === 'openai' ? await openaiTest() : { ok: true, model: 'demo', reply: 'Demo mode is active.' };
    send(res, 200, out);
  } catch (e) {
    send(res, 200, { ok: false, error: e.message });
  }
});
r.get('/api/models', async (req, res) => send(res, 200, await anthropicModels()));
r.get('/api/prompt', (req, res) => send(res, 200, {
  template: promptTemplate(),
  rendered: renderSystemPrompt(),
  presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { name: v.name, text: v.text }])),
  variables: ['agent_name', 'user_name', 'environment', 'extra'],
}));
r.get('/api/settings/defaults', (req, res) => send(res, 200, DEFAULT_SETTINGS));

/* ───────────── memory ───────────── */
r.get('/api/memory', (req, res) => send(res, 200, db.data.memory));
r.post('/api/memory', async (req, res) => {
  const b = await readJsonBody(req);
  if (!b.text?.trim()) throw err(400, 'text required');
  const m = { id: id('m_'), text: b.text.trim(), createdAt: now(), source: 'user' };
  db.data.memory.push(m); save(); broadcast('memory', db.data.memory);
  send(res, 200, m);
});
r.patch('/api/memory/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const m = db.data.memory.find((x) => x.id === p.id);
  if (!m) throw err(404, 'Not found');
  m.text = b.text ?? m.text; m.updatedAt = now(); save(); broadcast('memory', db.data.memory);
  send(res, 200, m);
});
r.delete('/api/memory/:id', (req, res, p) => { db.data.memory = db.data.memory.filter((m) => m.id !== p.id); save(); broadcast('memory', db.data.memory); send(res, 200, { ok: true }); });

/* ───────────── routines ───────────── */
r.get('/api/routines', (req, res) => send(res, 200, db.data.routines));
r.post('/api/routines', async (req, res) => {
  const b = await readJsonBody(req);
  if (!b.title || !b.prompt || !/^\d{2}:\d{2}$/.test(b.time || '')) throw err(400, 'title, prompt and time (HH:MM) are required');
  const rt = { id: id('r_'), title: b.title, prompt: b.prompt, time: b.time, days: b.days?.length ? b.days : [0, 1, 2, 3, 4, 5, 6], enabled: b.enabled !== false, mode: b.mode === 'task' ? 'task' : 'main', createdAt: now(), lastRun: null };
  db.data.routines.push(rt); save(); broadcast('routines', db.data.routines);
  send(res, 200, rt);
});
r.patch('/api/routines/:id', async (req, res, p) => {
  const b = await readJsonBody(req);
  const rt = db.data.routines.find((x) => x.id === p.id);
  if (!rt) throw err(404, 'Not found');
  for (const k of ['title', 'prompt', 'time', 'days', 'enabled', 'mode']) if (b[k] !== undefined) rt[k] = b[k];
  save(); broadcast('routines', db.data.routines);
  send(res, 200, rt);
});
r.delete('/api/routines/:id', (req, res, p) => { db.data.routines = db.data.routines.filter((x) => x.id !== p.id); save(); broadcast('routines', db.data.routines); send(res, 200, { ok: true }); });
r.post('/api/routines/:id/run', (req, res, p) => {
  const rt = db.data.routines.find((x) => x.id === p.id);
  if (!rt) throw err(404, 'Not found');
  core.runRoutine(rt);
  send(res, 200, { ok: true });
});

/* ───────────── devices ───────────── */
r.get('/api/devices', (req, res) => send(res, 200, listDevices()));
r.post('/api/devices/pair', async (req, res) => {
  const b = await readJsonBody(req);
  const d = A.createDeviceToken(b.name);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  const server = `${proto}://${host}`;
  send(res, 200, { ...d, server });
  broadcast('devices', listDevices());
});
r.patch('/api/devices/:id', async (req, res, p) => { const b = await readJsonBody(req); A.renameDevice(p.id, b.name); broadcast('devices', listDevices()); send(res, 200, { ok: true }); });
r.delete('/api/devices/:id', (req, res, p) => { A.revokeDeviceToken(p.id); disconnectDevice(p.id); broadcast('devices', listDevices()); send(res, 200, { ok: true }); });
// Download the device runner as a single page of instructions + files
r.get('/device/:file', (req, res, p) => {
  const allowed = ['covo-device.js', 'tools.js', 'package.json', 'device.config.example.json', 'start-device.bat', 'start-device.sh'];
  if (!allowed.includes(p.file)) throw err(404, 'Not found');
  const f = path.join(ROOT, 'device', p.file);
  send(res, 200, fs.readFileSync(f), { 'Content-Type': MIME[path.extname(f)] || 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${p.file}"` });
}, { public: true });

/* ───────────── legal documents (public) ───────────── */
const LEGAL = ['TERMS.md', 'PRIVACY.md', 'TRADEMARKS.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'SECURITY.md'];
r.get('/legal/:name', (req, res, p) => {
  if (!LEGAL.includes(p.name)) throw err(404, 'Not found');
  send(res, 200, fs.readFileSync(path.join(ROOT, p.name), 'utf8'), { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
}, { public: true });

/* ───────────── MCP ───────────── */
r.get('/api/mcp', (req, res) => send(res, 200, mcpStatus()));
r.post('/api/mcp/reload', async (req, res) => { await reloadMcp(); send(res, 200, mcpStatus()); });

/* ───────────── uploads ───────────── */
r.post('/api/uploads', async (req, res) => {
  const name = decodeURIComponent(req.headers['x-filename'] || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  const type = (req.headers['content-type'] || 'application/octet-stream').split(';')[0];
  const buf = await readBody(req, 25 * 1024 * 1024);
  const file = `${id('u_')}-${name}`;
  fs.writeFileSync(path.join(DATA_DIR, 'uploads', file), buf);
  send(res, 200, { file, name, type, size: buf.length, url: `/uploads/${encodeURIComponent(file)}` });
});
r.get('/uploads/:file', (req, res, p) => {
  const f = path.join(DATA_DIR, 'uploads', path.basename(p.file));
  if (!fs.existsSync(f)) throw err(404, 'Not found');
  send(res, 200, fs.readFileSync(f), { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': 'sandbox' });
});

/* ───────────── push ───────────── */
r.get('/api/push/key', (req, res) => send(res, 200, { key: vapidPublicKey() }));
r.post('/api/push/subscribe', async (req, res) => { addPushSub(await readJsonBody(req), req.headers['user-agent']); send(res, 200, { ok: true }); });
r.post('/api/push/unsubscribe', async (req, res) => { const b = await readJsonBody(req); removePushSub(b.endpoint); send(res, 200, { ok: true }); });
r.post('/api/push/test', async (req, res) => {
  const name = (getSettings().profile.name || '').split(' ')[0];
  await notify({ title: getSettings().agent.name || 'Covo', body: `Morning${name ? ', ' + name : ''}. This is how I'll reach you.`, kind: 'info', urgent: true });
  send(res, 200, { ok: true, subscribers: db.data.pushSubs.length });
});

/* ───────────── security ───────────── */
r.get('/api/security', (req, res) => send(res, 200, { sessions: A.listSessions(), tokens: A.listApiTokens(), devices: A.listDeviceTokens(), hasPassword: A.hasPassword(), desktop: isDesktopReq(req) }));
r.post('/api/security/password', async (req, res) => {
  const b = await readJsonBody(req);
  const desktop = isDesktopReq(req); // the desktop app window is already trusted on this computer
  if (A.hasPassword() && !desktop && !A.checkPassword(b.current)) throw err(401, 'Current password is wrong');
  A.setPassword(b.next);
  setCookie(res, desktop ? A.createSession('Covo Desktop', { desktop: true }) : A.createSession(req.headers['user-agent']));
  send(res, 200, { ok: true });
});
r.delete('/api/security/sessions/:id', (req, res, p) => { A.revokeSession(p.id); send(res, 200, { ok: true }); });
r.post('/api/security/signout-others', (req, res) => { const a = authFromReq(req); A.revokeAllSessions(a?.session?.id); send(res, 200, { ok: true }); });
r.post('/api/security/tokens', async (req, res) => { const b = await readJsonBody(req); send(res, 200, A.createApiToken(b.name)); });
r.delete('/api/security/tokens/:id', (req, res, p) => { A.revokeApiToken(p.id); send(res, 200, { ok: true }); });

/* ───────────── data ───────────── */
r.get('/api/export', (req, res) => {
  flush();
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), version: VERSION, settings: getSettings(), db: db.data }, null, 2);
  send(res, 200, body, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="covo-backup-${new Date().toISOString().slice(0, 10)}.json"` });
});
// The whole thread as a readable Markdown document.
r.get('/api/export/thread.md', (req, res) => {
  const name = getSettings().profile.name || 'You';
  const agent = getSettings().agent.name || 'Covo';
  const topics = Object.fromEntries(db.data.topics.map((t) => [t.id, t.title]));
  const lines = [`# ${agent} — conversation export`, '', `_Exported ${new Date().toISOString()}_`, ''];
  let topic = null;
  for (const f of db.data.feed) {
    if (f.kind !== 'user' && f.topicId && f.topicId !== topic) { topic = f.topicId; lines.push(`## ${topics[topic] || 'Topic'}`, ''); }
    const when = new Date(f.ts).toLocaleString('en-GB', { timeZone: getSettings().profile.timezone || undefined });
    if (f.kind === 'user') lines.push(`**${name}** · ${when}`, '', f.text || '', ...(f.attachments || []).map((a) => `- 📎 ${a.name}`), '');
    else if (f.kind === 'assistant') lines.push(`**${agent}** · ${when}`, '', (f.text || '').replace(/\[\[([^\]]+)\]\]/g, '$1'), '');
    else if (f.kind === 'approval') { const a = db.data.approvals.find((x) => x.id === f.approvalId); if (a) lines.push(`> ${a.status === 'approved' ? '✅' : a.status === 'pending' ? '⏳' : '✖️'} Approval: ${a.title}${a.amount != null ? ` · ${a.currency} ${a.amount}` : ''} (${a.status})`, ''); }
    else if (f.kind === 'artifact') { const a = db.data.artifacts.find((x) => x.id === f.artifactId); if (a) lines.push(`> 📄 ${a.title} (${a.kind}, v${a.version})`, ''); }
    else if (f.kind === 'email') lines.push(`> ✉️ Email to ${f.draft.to}: "${f.draft.subject}" (${f.status})`, '', '```', f.draft.body, '```', '');
    else if (f.kind === 'error') lines.push(`> ⚠️ ${f.text}`, '');
  }
  send(res, 200, lines.join('\n'), { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${(agent || 'covo').toLowerCase()}-thread-${new Date().toISOString().slice(0, 10)}.md"` });
});

r.post('/api/import', async (req, res) => {
  const b = JSON.parse((await readBody(req, 200 * 1024 * 1024)).toString('utf8'));
  if (!b.db || !b.settings) throw err(400, 'Not a Covo backup file');
  core.stop();
  replaceDb(b.db);
  replaceSettings(b.settings);
  reloadMcp();
  broadcast('reload', {});
  send(res, 200, { ok: true });
});
r.post('/api/reset', async (req, res) => {
  const b = await readJsonBody(req);
  core.stop();
  if (b.scope === 'conversation') core.clearConversation();
  else if (b.scope === 'demo') { resetDb(false); demo.seed(); }
  else if (b.scope === 'all') { resetDb(false); resetSettings(); (db.data.meta ||= {}).seeded = false; }
  broadcast('reload', {});
  send(res, 200, { ok: true });
});

/* ───────────── logs ───────────── */
r.get('/api/logs', (req, res) => send(res, 200, log.all()));
