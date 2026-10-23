import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { Icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { api } from '../api.js';
import { useStore, setUI, toast } from '../store.js';
import { Seg, StatusIcon, Sheet, ago, fmtTime, cx, Confirm } from './ui.js';
import { ApprovalCard } from './Cards.js';

export const groupOf = (t) => (t.status === 'needs_you' ? 'needs' : ['done', 'cancelled', 'failed'].includes(t.status) ? 'done' : 'progress');
const STATUS_LABEL = { running: 'In progress', queued: 'Queued', needs_you: 'Needs you', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', paused: 'Paused' };
const BADGE = { running: 'info', queued: 'no', needs_you: 'warn', done: 'ok', failed: 'bad', cancelled: 'no', paused: 'no' };

export function TaskRow({ task }) {
  const topic = useStore((s) => s.topics.find((x) => x.id === task.topicId));
  const g = groupOf(task);
  const pct = task.progress?.total ? Math.round((task.progress.done / task.progress.total) * 100) : null;
  return html`<button class="trow" onClick=${() => setUI({ task: task.id, panel: 'task' })}>
    <div class="h"><${StatusIcon} status=${g === 'needs' ? 'needs_you' : g === 'done' ? 'done' : 'in_progress'} emoji=${topic?.emoji} /><b>${task.title}</b><span class="when">${ago(task.updatedAt)}</span></div>
    ${topic && topic.title !== task.title && html`<div class="topic">${topic.title}</div>`}
    ${task.note && html`<div class="note">${task.note}</div>`}
    ${pct !== null && html`<div class="progress-row"><div class=${cx('bar', g === 'needs' && 'needs', g === 'done' && 'done')}><i style=${`width:${pct}%`}></i></div><span>${task.progress.done} / ${task.progress.total}</span></div>`}
  </button>`;
}

export function TasksView() {
  const tasks = useStore((s) => s.tasks);
  const provider = useStore((s) => s.provider);
  const [seg, setSeg] = useState(null);
  const [creating, setCreating] = useState(false);
  const counts = { needs: 0, progress: 0, done: 0 };
  for (const x of tasks) counts[groupOf(x)]++;
  const cur = seg || (counts.needs ? 'needs' : 'progress');
  const list = tasks.filter((x) => cur === 'all' || groupOf(x) === cur);
  return html`<div class="stack" style="gap:14px">
    <div class="row" style="justify-content:space-between"><h1 class="page-title" style="margin:0">${t('Tasks')}</h1>
      <button class="btn outline sm" onClick=${() => setCreating(true)}><${Icon} name="plus" size="sm" />${t('New task')}</button></div>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap">
      <${Seg} value=${cur} onChange=${setSeg} options=${[
        { id: 'needs', label: t('Needs you'), n: counts.needs },
        { id: 'progress', label: t('In progress'), n: counts.progress },
        { id: 'done', label: t('Done'), n: counts.done },
        { id: 'all', label: t('All') },
      ]} />
    </div>
    ${list.length ? html`<div class="list">${list.map((x) => html`<${TaskRow} key=${x.id} task=${x} />`)}</div>`
      : html`<div class="empty"><${Icon} name="tasks" /><div>${cur === 'needs' ? t('Nothing needs you right now.') : t('No tasks yet.')}</div></div>`}
    ${creating && html`<${NewTask} onClose=${() => setCreating(false)} demo=${provider === 'demo'} />`}
  </div>`;
}

function NewTask({ onClose, demo }) {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { await api.post('/api/tasks', { title, goal }); onClose(); toast({ title: t('New task'), body: title }); }
    catch (e) { toast({ title: 'Task', body: e.message }); }
    setBusy(false);
  };
  return html`<${Sheet} title=${t('New task')} onClose=${onClose} small>
    <div class="stack" style="padding:6px 18px 18px;gap:12px">
      ${demo && html`<div class="hint">Demo mode: connect a model in Settings → Model to run real background tasks.</div>`}
      <div class="field"><label>Title</label><input class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Compare 3 POS vendors" /></div>
      <div class="field"><label>Goal & definition of done</label><textarea class="textarea" rows="5" value=${goal} onInput=${(e) => setGoal(e.target.value)} placeholder="Research Toast, Square and Lightspeed for 12 cafés. Done when I have a 1-page comparison with pricing and a recommendation."></textarea>
        <div class="hint">The agent works on this in the background, reports back in Chat, and asks you when it needs a decision.</div></div>
      <button class="btn primary" disabled=${busy || !title || !goal} onClick=${create}>${t('Get started')}</button>
    </div>
  <//>`;
}

export function TaskDetail({ id, asPanel, onClose }) {
  const task = useStore((s) => s.tasks.find((x) => x.id === id));
  const topic = useStore((s) => s.topics.find((x) => x.id === task?.topicId));
  const approvals = useStore((s) => s.approvals.filter((a) => a.taskId === id && a.status === 'pending'));
  const [steps, setSteps] = useState(task?.steps || []);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { api.get(`/api/tasks/${id}`).then((r) => setSteps(r.steps || [])).catch(() => {}); }, [id, task?.updatedAt]);
  if (!task) return null;
  const close = onClose || (() => setUI({ task: null, panel: 'overview' }));
  const act = async (action, message) => {
    try { await api.post(`/api/tasks/${id}/action`, { action, message }); if (message) setMsg(''); }
    catch (e) { toast({ title: 'Task', body: e.message }); }
  };
  const pct = task.progress?.total ? Math.round((task.progress.done / task.progress.total) * 100) : null;
  const g = groupOf(task);
  const body = html`<div class="stack" style="padding:4px 18px 24px;gap:16px">
    <div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class=${`badge ${BADGE[task.status] || 'no'}`}>${t(STATUS_LABEL[task.status] || task.status)}</span>
        ${topic && html`<button class="pill" onClick=${() => { setUI({ topicFilter: topic.id, tab: 'chat' }); close(); }}><${StatusIcon} status=${topic.status} emoji=${topic.emoji} />${topic.title}</button>`}
        <span class="muted" style="font-size:var(--fs-xs)">${t('Updated {t}', { t: fmtTime(task.updatedAt) })}</span></div>
      <h2 class="serif" style="font-weight:500;font-size:var(--fs-2xl);margin:10px 0 4px">${task.title}</h2>
      ${task.note && html`<p style="margin:0;color:var(--ink-2)">${task.note}</p>`}
    </div>
    ${pct !== null && html`<div class="progress-row"><div class=${cx('bar', g === 'needs' && 'needs', g === 'done' && 'done')}><i style=${`width:${pct}%`}></i></div><span>${task.progress.done} / ${task.progress.total}</span></div>`}
    ${approvals.map((a) => html`<${ApprovalCard} id=${a.id} />`)}
    ${task.question && task.status === 'needs_you' && html`<div class="card" style="padding:12px 14px;max-width:none"><div class="label">${task.question}</div></div>`}
    ${!['done', 'cancelled'].includes(task.status) && html`<div class="field">
      <label>${task.status === 'needs_you' && task.question ? 'Your answer' : t('Steer')}</label>
      <div class="row"><input class="input" value=${msg} onInput=${(e) => setMsg(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && msg && act(undefined, msg)} placeholder=${task.question ? 'Answer…' : 'e.g. Focus on vendors with offline mode'} />
      <button class="btn primary" disabled=${!msg} onClick=${() => act(undefined, msg)}>${t('Send')}</button></div>
    </div>`}
    <div class="row" style="flex-wrap:wrap">
      ${['running', 'queued', 'needs_you'].includes(task.status) && html`<button class="btn outline sm" onClick=${() => act('pause')}><${Icon} name="pause" size="sm" />${t('Pause')}</button>`}
      ${task.status === 'paused' && html`<button class="btn outline sm" onClick=${() => act('resume')}><${Icon} name="play" size="sm" />${t('Resume')}</button>`}
      ${task.status === 'failed' && html`<button class="btn outline sm" onClick=${() => act('retry')}><${Icon} name="refresh" size="sm" />${t('Retry')}</button>`}
      ${!['done', 'cancelled', 'failed'].includes(task.status) && html`<button class="btn ghost sm" onClick=${() => act('cancel')}>${t('Cancel')}</button>`}
      <button class="btn ghost sm" onClick=${() => { setUI({ topicFilter: task.topicId, tab: 'chat' }); close(); }}><${Icon} name="chat" size="sm" />${t('Open in chat')}</button>
      <span class="grow"></span>
      <button class="icon-btn" aria-label=${t('Delete')} onClick=${() => setConfirm(true)}><${Icon} name="trash" size="sm" /></button>
    </div>
    <div>
      <div class="label" style="margin-bottom:10px">${t('Activity')}</div>
      <ul class="timeline">${[...steps].reverse().map((s) => html`<li class=${s.kind}><time>${fmtTime(s.ts)}</time>${s.text}</li>`)}</ul>
      ${task.goal && html`<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">Goal</summary><p class="hint" style="white-space:pre-wrap">${task.goal}</p></details>`}
    </div>
    ${confirm && html`<${Confirm} title="Delete task?" body="The activity log will be removed. Artifacts it made stay in Make." onYes=${async () => { await api.del(`/api/tasks/${id}`); close(); }} onClose=${() => setConfirm(false)} />`}
  </div>`;
  if (asPanel) return html`<div class="d-panel"><div class="panel-head"><h3>${task.title}</h3><button class="icon-btn" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button></div><div class="panel-body scroll" style="padding-top:12px">${body}</div></div>`;
  return html`<${Sheet} title=${t('Tasks')} onClose=${close}>${body}<//>`;
}
