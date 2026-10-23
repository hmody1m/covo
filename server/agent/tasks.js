import { db, upsertTask, addTaskStep, addFeed, upsertTopic, setTopicStatus } from '../db.js';
import { getSettings, activeProvider } from '../config.js';
import { bus, broadcast } from '../bus.js';
import { id, log } from '../util.js';
import { notify } from '../notify.js';
import { runLoop } from './loop.js';
import { renderSystemPrompt, TASK_ADDENDUM } from './prompt.js';
import { buildContext } from './context.js';

// Background tasks: each one is its own agent loop with its own transcript.
// They post into the main thread (report_to_user / ask_user / complete_task)
// and show in the Tasks tab with progress + an activity log.
const running = new Map(); // taskId -> { abort: AbortController }
const inbox = new Map();   // taskId -> [{ text, blocks }]
let hooks = null;

const topicOf = (task) => db.data.topics.find((t) => t.id === task.topicId);
const mainNote = (text) => bus.emit('main.note', text);

export function initTasks(h) {
  hooks = h;
  for (const t of db.data.tasks) if (t.status === 'running' && !t.demo) { t.status = 'queued'; }
  setTimeout(schedule, 2000);
}

export function createTask({ title, goal, topic, total }, ctx = {}) {
  let tp = null;
  if (topic) tp = upsertTopic({ title: topic, status: 'in_progress' });
  else if (ctx.topicId) tp = db.data.topics.find((t) => t.id === ctx.topicId);
  if (!tp) tp = upsertTopic({ title, status: 'in_progress' });
  const task = upsertTask({ title, goal, topicId: tp.id, topicTitle: tp.title, status: 'queued', progress: total ? { done: 0, total } : null, note: 'Starting…', origin: ctx.scope || 'user' });
  addTaskStep(task, { kind: 'created', text: goal });
  setTimeout(schedule, 10);
  return { task_id: task.id, status: 'started', note: 'Runs in the background and reports back in this thread.' };
}

export function schedule() {
  if (activeProvider() === 'demo') return;
  const max = getSettings().agent.maxConcurrentTasks || 3;
  const queued = db.data.tasks.filter((t) => t.status === 'queued' && !t.demo).reverse();
  for (const t of queued) {
    if (running.size >= max) break;
    run(t);
  }
}

async function run(task) {
  if (running.has(task.id) || task.demo) return;
  const ac = new AbortController();
  running.set(task.id, { abort: ac });
  upsertTask({ id: task.id, status: 'running', question: null });
  setTopicStatus(task.topicId, 'in_progress');
  const notes = inbox.get(task.id) || [];
  inbox.delete(task.id);
  const first = task.transcript.length === 0;
  const blocks = [{ type: 'text', text: buildContext() }];
  if (first) blocks.push({ type: 'text', text: `Start the task now.\nTask: ${task.title}\nGoal: ${task.goal}` });
  for (const n of notes) { blocks.push({ type: 'text', text: `<event>${n.text}</event>` }); if (n.blocks) blocks.push(...n.blocks); }
  if (!first && !notes.length) blocks.push({ type: 'text', text: '<event>Resume the task where you left off.</event>' });
  task.transcript.push({ role: 'user', content: blocks });
  const ctx = { scope: 'task', task, topicId: task.topicId, turnId: id('turn_'), hooks };
  const s = getSettings();
  try {
    const r = await runLoop({
      transcript: task.transcript,
      system: renderSystemPrompt(TASK_ADDENDUM(task)),
      ctx,
      effort: s.provider.anthropic.taskEffort || 'high',
      signal: ac.signal,
      onStateChange: (st) => broadcast('task.state', { id: task.id, state: st }),
    });
    const cur = db.data.tasks.find((t) => t.id === task.id);
    if (cur && cur.status === 'running' && !ac.signal.aborted) {
      const waiting = db.data.approvals.some((a) => a.taskId === task.id && a.status === 'pending');
      if (waiting) {
        upsertTask({ id: task.id, status: 'needs_you', note: 'Waiting for your approval' });
      } else {
        const text = (r.taskText || '').trim();
        if (text) reportToUser(text, ctx);
        upsertTask({ id: task.id, status: 'done', note: text.split('\n')[0].slice(0, 200) || 'Done' });
        setTopicStatus(task.topicId, 'done');
      }
    }
  } catch (e) {
    log.error(`task ${task.id} failed`, e);
    upsertTask({ id: task.id, status: 'failed', note: e.message });
    addTaskStep(task, { kind: 'error', text: e.message });
    notify({ title: task.title, body: `Task failed: ${e.message}`, kind: 'task' });
  } finally {
    running.delete(task.id);
    const cur = db.data.tasks.find((t) => t.id === task.id);
    if (cur && inbox.get(task.id)?.length && !['cancelled', 'paused'].includes(cur.status)) upsertTask({ id: task.id, status: 'queued' });
    setTimeout(schedule, 10);
  }
}

export function resumeTask(taskId, text, blocks) {
  const t = db.data.tasks.find((x) => x.id === taskId);
  if (!t) return;
  (inbox.get(taskId) || inbox.set(taskId, []).get(taskId)).push({ text, blocks });
  addTaskStep(t, { kind: 'event', text });
  if (!running.has(taskId) && !['cancelled', 'paused'].includes(t.status)) upsertTask({ id: taskId, status: 'queued' });
  schedule();
}

export function messageTask({ id: tid, message, action }) {
  const t = db.data.tasks.find((x) => x.id === tid);
  if (!t) return { error: 'No task with that id' };
  if (action === 'pause') {
    running.get(tid)?.abort.abort();
    upsertTask({ id: tid, status: 'paused', note: 'Paused' });
    addTaskStep(t, { kind: 'user', text: 'Paused' });
  } else if (action === 'cancel') {
    running.get(tid)?.abort.abort();
    upsertTask({ id: tid, status: 'cancelled', note: 'Cancelled' });
    addTaskStep(t, { kind: 'user', text: 'Cancelled' });
    setTopicStatus(t.topicId, 'done');
  } else if (action === 'resume') {
    upsertTask({ id: tid, status: 'queued' });
    addTaskStep(t, { kind: 'user', text: 'Resumed' });
  } else if (action === 'retry') {
    upsertTask({ id: tid, status: 'queued', note: 'Retrying…' });
  }
  if (message) {
    (inbox.get(tid) || inbox.set(tid, []).get(tid)).push({ text: `Message from the user: ${message}` });
    addTaskStep(t, { kind: 'user', text: message });
    if (!running.has(tid) && !['cancelled'].includes(t.status)) upsertTask({ id: tid, status: 'queued', question: null });
  }
  schedule();
  return { ok: true };
}

export function updateTask(input, ctx) {
  const tid = input.id || ctx.task?.id;
  const t = db.data.tasks.find((x) => x.id === tid);
  if (!t) return { error: 'No task with that id' };
  const patch = { id: tid };
  if (input.status === 'needs_you') patch.status = 'needs_you';
  else if (input.status === 'done') patch.status = 'done';
  else if (input.status === 'failed') patch.status = 'failed';
  if (input.done !== undefined || input.total !== undefined) patch.progress = { done: input.done ?? t.progress?.done ?? 0, total: input.total ?? t.progress?.total ?? 0 };
  if (input.note) patch.note = input.note;
  upsertTask(patch);
  if (input.note) addTaskStep(t, { kind: 'update', text: input.note });
  if (patch.status) setTopicStatus(t.topicId, patch.status === 'needs_you' ? 'needs_you' : patch.status === 'done' ? 'done' : 'in_progress');
  return { ok: true };
}

export function reportToUser(text, ctx) {
  const task = ctx.task;
  addFeed({ kind: 'assistant', text, topicId: task.topicId, source: 'task', taskId: task.id });
  addTaskStep(task, { kind: 'report', text });
  mainNote(`Background task ${task.id} "${task.title}" posted to the user: ${text}`);
  notify({ title: topicOf(task)?.title || task.title, body: text.replace(/\s+/g, ' ').slice(0, 180), kind: 'task', url: '/?tab=chat' });
  return { ok: true, posted: true };
}

export function askUser(question, ctx) {
  const task = ctx.task;
  addFeed({ kind: 'assistant', text: question, topicId: task.topicId, source: 'task', taskId: task.id, ask: true });
  upsertTask({ id: task.id, status: 'needs_you', question, note: question });
  addTaskStep(task, { kind: 'question', text: question });
  setTopicStatus(task.topicId, 'needs_you');
  mainNote(`Background task ${task.id} "${task.title}" asked the user: ${question}`);
  notify({ title: topicOf(task)?.title || task.title, body: question, kind: 'task', url: `/?task=${task.id}` });
  ctx.stopAfterTool = true;
  return { status: 'waiting_for_user', note: 'Stop now. You will be resumed with the answer.' };
}

export function completeTask({ summary, post }, ctx) {
  const task = ctx.task;
  upsertTask({ id: task.id, status: 'done', note: summary, ...(task.progress ? { progress: { done: task.progress.total, total: task.progress.total } } : {}) });
  addTaskStep(task, { kind: 'done', text: summary });
  setTopicStatus(task.topicId, 'done');
  if (post !== false) addFeed({ kind: 'assistant', text: summary, topicId: task.topicId, source: 'task', taskId: task.id });
  mainNote(`Background task ${task.id} "${task.title}" finished: ${summary}`);
  notify({ title: task.title, body: summary.slice(0, 180), kind: 'task' });
  ctx.stopAfterTool = true;
  return { ok: true };
}

export function deleteTask(tid) {
  running.get(tid)?.abort.abort();
  db.data.tasks = db.data.tasks.filter((t) => t.id !== tid);
  broadcast('task.remove', { id: tid });
}

export const isTaskRunning = (tid) => running.has(tid);
