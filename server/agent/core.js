import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, id, now, log, truncate } from '../util.js';
import { db, save, addFeed, updateFeed, addApproval, updateApproval, setTopicStatus, upsertTopic } from '../db.js';
import { bus, broadcast } from '../bus.js';
import { getSettings, activeProvider } from '../config.js';
import { notify } from '../notify.js';
import { emailConfigured, sendEmail } from '../email.js';
import { runLoop } from './loop.js';
import { renderSystemPrompt } from './prompt.js';
import { buildContext } from './context.js';
import { buildTools, toResultBlocks } from './tools/index.js';
import { Anthropic } from './providers/anthropic.js';
import * as tasks from './tasks.js';
import { demo } from './demo-host.js';

// ─────────────────────────────────────────────────────────────────────────────
// The main agent: one continuous thread. User messages and system events are
// queued and processed one turn at a time. Approvals, email cards and routines
// resume the agent with <event> messages (event-driven, nothing blocks).
// ─────────────────────────────────────────────────────────────────────────────

const main = { busy: false, queue: [], abort: null, notes: [] };
let agentState = 'idle';

export function setState(s) {
  if (s === 'idle' && db.data.approvals.some((a) => a.status === 'pending')) s = 'waiting';
  agentState = s;
  broadcast('agent.state', { state: s });
}
export const getState = () => agentState;

/* ---------------- hooks used by tools ---------------- */
export const hooks = {
  createApproval,
  createTask: tasks.createTask,
  messageTask: tasks.messageTask,
  updateTask: tasks.updateTask,
  reportToUser: tasks.reportToUser,
  askUser: tasks.askUser,
  completeTask: tasks.completeTask,
};
tasks.initTasks(hooks);

// Notes are facts recorded for the next turn without waking the agent.
bus.on('main.note', (text) => { main.notes.push(text); });
bus.on('main.event', (text) => enqueue({ type: 'event', text }));

/* ---------------- input ---------------- */
const TEXT_EXT = /\.(txt|md|csv|json|js|ts|py|html|css|xml|yaml|yml|log|ini|sql|sh|ps1|bat|java|c|cpp|go|rs|rb|php|tsx|jsx)$/i;

function attachmentBlocks(atts = []) {
  const out = [];
  for (const a of atts) {
    const rel = `uploads/${a.file}`;
    const full = path.join(DATA_DIR, rel);
    if (!fs.existsSync(full)) continue;
    if (/^image\/(png|jpe?g|gif|webp)$/.test(a.type)) out.push({ type: 'image', source: { type: 'ref', path: rel, media_type: a.type === 'image/jpg' ? 'image/jpeg' : a.type } });
    else if (a.type === 'application/pdf') out.push({ type: 'document', source: { type: 'ref', path: rel, media_type: 'application/pdf' } });
    else if (TEXT_EXT.test(a.name) || a.type.startsWith('text/')) out.push({ type: 'text', text: `<file name="${a.name}">\n${truncate(fs.readFileSync(full, 'utf8'), 120000)}\n</file>` });
    else out.push({ type: 'text', text: `[Attached file "${a.name}" (${a.type}, ${a.size} bytes) saved at ${full}]` });
  }
  return out;
}

export function userMessage({ text = '', attachments = [], topicId = null, source = 'app' }) {
  text = String(text).trim();
  if (!text && !attachments.length) return null;
  const item = addFeed({ kind: 'user', text, attachments, topicId, via: source !== 'app' ? source : undefined });
  enqueue({ type: 'user', text, attachments, feedId: item.id });
  return item;
}

export function enqueue(item) {
  main.queue.push(item);
  pump();
}

function lastTopicId() {
  for (let i = db.data.feed.length - 1; i >= 0; i--) {
    const f = db.data.feed[i];
    if (f.source === 'task') continue;
    if (f.topicId) return f.topicId;
  }
  return null;
}

function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Your Anthropic API key was rejected. Update it in Settings → Model.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key has no access to that model. Pick another model in Settings → Model.';
  if (e instanceof Anthropic.NotFoundError) return 'Model not found. Check the model name in Settings → Model.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the provider. I\'ll be able to continue in a moment — send your message again.';
  if (e instanceof Anthropic.APIConnectionError) return 'Can\'t reach the model provider. Check the internet connection (or Base URL in Settings → Model).';
  if (e instanceof Anthropic.BadRequestError) return 'The provider rejected the request: ' + e.message;
  if (e instanceof Anthropic.APIError) return `Provider error ${e.status}: ${e.message}`;
  return 'Something went wrong: ' + (e?.message || e);
}

async function pump() {
  if (main.busy) return;
  main.busy = true;
  try {
    while (main.queue.length) {
      const items = main.queue.splice(0);
      if (activeProvider() === 'demo') {
        setState('thinking');
        try { await demo.handle(items); } catch (e) { log.error('demo', e); }
        continue;
      }
      const s = getSettings();
      const notes = main.notes.splice(0);
      const content = [{ type: 'text', text: buildContext() + (notes.length ? '\n' + notes.map((n) => `<event>${n}</event>`).join('\n') : '') }];
      for (const it of items) {
        if (it.type === 'user') {
          content.push(...attachmentBlocks(it.attachments));
          content.push({ type: 'text', text: it.text || '(see attachments)' });
        } else {
          content.push({ type: 'text', text: `<event${it.source ? ` source="${it.source}"` : ''}>${it.text}</event>` });
          if (it.blocks) content.push(...it.blocks);
        }
      }
      db.data.transcript.push({ role: 'user', content });
      save();
      const ac = new AbortController();
      main.abort = ac;
      const routine = items.find((i) => i.routine)?.routine;
      const ctx = { scope: 'main', topicId: lastTopicId(), turnId: id('turn_'), hooks };
      try {
        const r = await runLoop({
          transcript: db.data.transcript,
          system: renderSystemPrompt(),
          ctx,
          effort: routine ? s.provider.anthropic.taskEffort : s.provider.anthropic.effort,
          signal: ac.signal,
          onStateChange: setState,
        });
        if (routine) afterRoutine(routine, r);
      } catch (e) {
        log.error('turn failed', e);
        addFeed({ kind: 'error', text: friendlyError(e), topicId: ctx.topicId });
      } finally {
        main.abort = null;
      }
    }
  } finally {
    main.busy = false;
    setState('idle');
  }
}

export function stop() {
  main.queue.length = 0;
  main.abort?.abort();
  demo.stop?.();
  setState('idle');
}

/* ---------------- approvals ---------------- */
export async function createApproval(input, ctx) {
  const s = getSettings();
  const expiresMin = input.expires_in_minutes || (input.tool ? s.agent.approvalExpiryMin : null);
  const ap = addApproval({
    title: input.title,
    detail: input.detail || '',
    amount: input.amount ?? null,
    currency: input.currency || (input.amount != null ? 'USD' : ''),
    actionLabel: input.action_label || 'Approve',
    kind: input.kind || (input.amount != null ? 'payment' : 'other'),
    expiresAt: expiresMin ? now() + expiresMin * 60_000 : null,
    scope: ctx.scope,
    taskId: ctx.task?.id || null,
    topicId: ctx.topicId,
    tool: input.tool || null,
  });
  addFeed({ kind: 'approval', approvalId: ap.id, topicId: ctx.topicId, source: ctx.scope, taskId: ctx.task?.id });
  if (ctx.topicId) setTopicStatus(ctx.topicId, 'needs_you');
  if (ctx.task) tasks.updateTask({ id: ctx.task.id, status: 'needs_you', note: `Needs your approval: ${ap.title}` }, ctx);
  const money = ap.amount != null ? ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: ap.currency || 'USD' }).format(ap.amount)}` : '';
  notify({ title: 'Needs your approval', body: `${ap.title}${money}`, kind: 'approval', url: `/?approval=${ap.id}`, tag: ap.id });
  return { status: 'pending_approval', approval_id: ap.id, note: 'Waiting for the user. Do not retry. Briefly say what is waiting; you will get an <event> with the decision.' };
}

function route(ap, text, blocks) {
  if (ap.scope === 'task' && ap.taskId) tasks.resumeTask(ap.taskId, text, blocks);
  else enqueue({ type: 'event', source: 'approval', text, blocks });
}

export async function decideApproval(apid, decision) {
  const ap = db.data.approvals.find((a) => a.id === apid);
  if (!ap) throw Object.assign(new Error('Approval not found'), { status: 404 });
  if (ap.status !== 'pending') return ap;
  const name = getSettings().profile.name || 'the user';
  if (ap.topicId) setTopicStatus(ap.topicId, 'in_progress');
  if (activeProvider() === 'demo' || ap.demo) {
    updateApproval(apid, { status: decision === 'approve' ? 'approved' : 'declined', decidedAt: now() });
    demo.onApproval(ap, decision);
    setState('idle');
    return ap;
  }
  if (decision !== 'approve') {
    updateApproval(apid, { status: 'declined', decidedAt: now() });
    route(ap, `Approval ${apid} "${ap.title}" was declined by ${name} ("Not now"). Don't do it. Acknowledge in a few words only if useful, and adjust the plan.`);
    return ap;
  }
  updateApproval(apid, { status: 'approved', decidedAt: now() });
  if (!ap.tool) {
    route(ap, `Approval ${apid} "${ap.title}"${ap.amount != null ? ` (${ap.currency} ${ap.amount})` : ''} was APPROVED by ${name}. Go ahead and continue.`);
    return ap;
  }
  setState('working');
  let text = '', blocks = [];
  try {
    const tool = buildTools({ scope: ap.scope, topicId: ap.topicId, hooks, task: db.data.tasks.find((t) => t.id === ap.taskId) }).find((t) => t.name === ap.tool.name);
    if (!tool) throw new Error(`Tool ${ap.tool.name} is no longer available`);
    const out = await tool.run(ap.tool.input);
    const r = toResultBlocks(out);
    text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    blocks = r.content.filter((c) => c.type === 'image');
  } catch (e) {
    text = 'Error: ' + e.message;
  }
  updateApproval(apid, { result: truncate(text, 2000) });
  route(ap, `Approval ${apid} "${ap.title}" was APPROVED by ${name}. The action ran (${ap.tool.name}). Result:\n${truncate(text, 8000)}`, blocks);
  return ap;
}

export function expireApprovals() {
  for (const ap of db.data.approvals) {
    if (ap.status === 'pending' && ap.expiresAt && ap.expiresAt < now()) {
      updateApproval(ap.id, { status: 'expired' });
      main.notes.push(`Approval ${ap.id} "${ap.title}" expired without a decision.`);
      if (ap.topicId) setTopicStatus(ap.topicId, 'in_progress');
    }
  }
}

/* ---------------- email cards ---------------- */
export async function emailAction(fid, action, patch = {}) {
  const it = db.data.feed.find((f) => f.id === fid && f.kind === 'email');
  if (!it) throw Object.assign(new Error('Email card not found'), { status: 404 });
  if (action === 'update') return updateFeed(fid, { draft: { ...it.draft, ...patch } });
  if (action === 'dismiss') {
    updateFeed(fid, { status: 'dismissed' });
    main.notes.push(`The user dismissed the email draft "${it.draft.subject}" ("Not now").`);
    if (activeProvider() === 'demo') demo.onEmail(it, 'dismiss');
    return it;
  }
  if (action === 'send') {
    let via = 'mailto';
    if (emailConfigured() && patch.via !== 'mailto') {
      try { await sendEmail(it.draft); via = 'smtp'; }
      catch (e) { updateFeed(fid, { status: 'failed', error: e.message }); throw Object.assign(e, { status: 502 }); }
    }
    updateFeed(fid, { status: 'sent', sentVia: via, sentAt: now() });
    const note = `The user sent the email "${it.draft.subject}" to ${it.draft.to}${via === 'mailto' ? ' (via their mail app)' : ''}.`;
    if (it.taskId) tasks.resumeTask(it.taskId, note); else main.notes.push(note);
    if (activeProvider() === 'demo') demo.onEmail(it, 'send');
    return it;
  }
  throw Object.assign(new Error('Unknown action'), { status: 400 });
}

/* ---------------- routines ---------------- */
export function runRoutine(r) {
  r.lastRun = now();
  save();
  broadcast('routines', db.data.routines);
  if (activeProvider() === 'demo') { demo.onRoutine?.(r); return; }
  if (r.mode === 'task') {
    tasks.createTask({ title: r.title, goal: r.prompt }, { scope: 'main' });
    return;
  }
  addFeed({ kind: 'event', text: `Routine · ${r.title}` });
  enqueue({ type: 'event', source: 'routine', text: `Routine "${r.title}" is running now (scheduled ${r.time}). ${r.prompt}`, routine: r });
}

function afterRoutine(r, result) {
  const name = getSettings().profile.name;
  if (/brief/i.test(r.title)) {
    const inProgress = db.data.tasks.filter((t) => ['running', 'queued'].includes(t.status)).length + db.data.topics.filter((t) => t.status === 'in_progress').length;
    const needs = db.data.approvals.filter((a) => a.status === 'pending').length + db.data.tasks.filter((t) => t.status === 'needs_you').length;
    notify({ title: getSettings().agent.name || 'Covo', body: `Morning${name ? ', ' + name.split(' ')[0] : ''}. ${inProgress} things in progress and ${needs} that need you.`, kind: 'brief', url: '/' });
  } else {
    const first = (result.posted[0] || '').split('\n\n')[0];
    if (first) notify({ title: r.title, body: first.slice(0, 180), kind: 'task' });
  }
}

/* ---------------- maintenance ---------------- */
export function clearConversation() {
  stop();
  db.data.feed = [];
  db.data.transcript = [];
  db.data.topics = [];
  db.data.approvals = db.data.approvals.filter((a) => a.status === 'pending' && false);
  save();
  broadcast('reload', {});
}

export { tasks };
