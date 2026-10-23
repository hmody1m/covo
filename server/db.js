import path from 'node:path';
import fs from 'node:fs';
import { DATA_DIR, id, now, readJson, writeJsonAtomic, log } from './util.js';
import { broadcast } from './bus.js';

// Tiny JSON document store. Everything lives in memory and is flushed to
// data/db.json (debounced). Good for a personal agent; swap for SQLite if you outgrow it.
const FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = () => ({
  version: 1,
  feed: [],          // UI items shown in the single conversation thread
  transcript: [],    // raw API messages for the main conversation (append-only)
  topics: [],        // { id, title, emoji, color, status, updatedAt }
  tasks: [],         // background jobs
  artifacts: [],     // Make tab items (content stored on disk)
  approvals: [],     // pending / decided approvals
  memory: [],        // long-term facts
  routines: [],      // scheduled prompts (morning brief…)
  pushSubs: [],      // web push subscriptions
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requests: 0 },
  meta: { seeded: false },
});

export const db = { data: Object.assign(EMPTY(), readJson(FILE, {})) };

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  try { writeJsonAtomic(FILE, db.data); } catch (e) { log.error('db flush failed', e); }
}
export function resetDb(keepRoutines = false) {
  const routines = keepRoutines ? db.data.routines : [];
  db.data = EMPTY();
  db.data.routines = routines;
  flush();
}
export function replaceDb(data) {
  db.data = Object.assign(EMPTY(), data);
  flush();
}
process.on('exit', flush);

/* ---------------- feed ---------------- */
export function addFeed(item) {
  const it = { id: id('f_'), ts: now(), ...item };
  db.data.feed.push(it);
  if (db.data.feed.length > 5000) db.data.feed.splice(0, db.data.feed.length - 5000);
  save();
  broadcast('feed.add', it);
  return it;
}
export function updateFeed(fid, patch) {
  const it = db.data.feed.find((f) => f.id === fid);
  if (!it) return null;
  Object.assign(it, patch, { updatedAt: now() });
  save();
  broadcast('feed.update', it);
  return it;
}
export function removeFeed(fid) {
  const i = db.data.feed.findIndex((f) => f.id === fid);
  if (i >= 0) { db.data.feed.splice(i, 1); save(); broadcast('feed.remove', { id: fid }); }
}

/* ---------------- topics ---------------- */
const COLORS = ['blue', 'orange', 'green', 'purple', 'pink', 'teal', 'yellow'];
export function upsertTopic({ title, emoji, status }) {
  if (!title) return null;
  const key = title.trim().toLowerCase();
  let t = db.data.topics.find((x) => x.title.toLowerCase() === key);
  if (!t) {
    t = { id: id('t_'), title: title.trim(), emoji: emoji || '', color: COLORS[db.data.topics.length % COLORS.length], status: status || 'active', createdAt: now(), updatedAt: now() };
    db.data.topics.push(t);
    broadcast('topic.add', t);
  } else {
    if (emoji) t.emoji = emoji;
    if (status) t.status = status;
    t.updatedAt = now();
    broadcast('topic.update', t);
  }
  save();
  return t;
}
export function setTopicStatus(tid, status) {
  const t = db.data.topics.find((x) => x.id === tid);
  if (!t) return;
  t.status = status; t.updatedAt = now();
  save();
  broadcast('topic.update', t);
}

/* ---------------- artifacts ---------------- */
const ART_DIR = path.join(DATA_DIR, 'artifacts');
export function artifactPath(aid, version) {
  return path.join(ART_DIR, aid, `v${version}.txt`);
}
export function saveArtifact({ aid, title, kind, content, summary, topicId, preview, refresh }) {
  let a = aid && db.data.artifacts.find((x) => x.id === aid);
  if (!a) {
    a = { id: id('a_'), title, kind: kind || 'page', summary: summary || '', topicId: topicId || null, pinned: false, version: 0, versions: [], createdAt: now(), refresh: refresh || '', preview: preview || null };
    db.data.artifacts.unshift(a);
  }
  a.version += 1;
  if (title) a.title = title;
  if (kind) a.kind = kind;
  if (summary !== undefined) a.summary = summary;
  if (preview !== undefined) a.preview = preview;
  if (refresh !== undefined) a.refresh = refresh;
  a.updatedAt = now();
  a.versions.push({ v: a.version, ts: a.updatedAt });
  fs.mkdirSync(path.join(ART_DIR, a.id), { recursive: true });
  fs.writeFileSync(artifactPath(a.id, a.version), content ?? '');
  save();
  broadcast('artifact.upsert', a);
  return a;
}
export function readArtifact(aid, version) {
  const a = db.data.artifacts.find((x) => x.id === aid);
  if (!a) return null;
  const v = version || a.version;
  try { return { ...a, content: fs.readFileSync(artifactPath(a.id, v), 'utf8'), viewingVersion: v }; } catch { return { ...a, content: '', viewingVersion: v }; }
}
export function deleteArtifact(aid) {
  db.data.artifacts = db.data.artifacts.filter((a) => a.id !== aid);
  fs.rmSync(path.join(ART_DIR, aid), { recursive: true, force: true });
  save();
  broadcast('artifact.remove', { id: aid });
}

/* ---------------- tasks ---------------- */
export function upsertTask(t) {
  let task = db.data.tasks.find((x) => x.id === t.id);
  if (!task) {
    task = { id: id('k_'), status: 'queued', progress: null, steps: [], transcript: [], createdAt: now(), ...t };
    db.data.tasks.unshift(task);
  } else Object.assign(task, t);
  task.updatedAt = now();
  save();
  broadcast('task.upsert', publicTask(task));
  return task;
}
export function publicTask(t) {
  const { transcript, ...rest } = t;
  return { ...rest, steps: rest.steps.slice(-200) };
}
export function addTaskStep(task, step) {
  task.steps.push({ ts: now(), ...step });
  if (task.steps.length > 500) task.steps.splice(0, task.steps.length - 500);
  task.updatedAt = now();
  save();
  broadcast('task.upsert', publicTask(task));
}

/* ---------------- approvals ---------------- */
export function addApproval(a) {
  const ap = { id: id('ap_'), status: 'pending', createdAt: now(), ...a };
  db.data.approvals.push(ap);
  save();
  broadcast('approval.upsert', ap);
  return ap;
}
export function updateApproval(apid, patch) {
  const ap = db.data.approvals.find((x) => x.id === apid);
  if (!ap) return null;
  Object.assign(ap, patch, { updatedAt: now() });
  save();
  broadcast('approval.upsert', ap);
  return ap;
}

/* ---------------- usage ---------------- */
export function addUsage(u) {
  if (!u) return;
  const s = db.data.usage;
  s.inputTokens += u.input_tokens || u.prompt_tokens || 0;
  s.outputTokens += u.output_tokens || u.completion_tokens || 0;
  s.cacheReadTokens += u.cache_read_input_tokens || 0;
  s.cacheWriteTokens += u.cache_creation_input_tokens || 0;
  s.requests += 1;
  save();
  broadcast('usage', s);
}
