import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Icon, KIND_ICON } from '../lib/icons.js';
import { t, getLang } from '../lib/i18n.js';
import { api } from '../api.js';
import { useStore, setUI, get, toast } from '../store.js';
import { StatusIcon, Avatar, Toggle, Seg, Sheet, fmtTime, cx } from './ui.js';
import { Orb } from './Orb.js';
import { ApprovalCard } from './Cards.js';
import { TaskRow, groupOf } from './Tasks.js';
import { sendMessage } from './Composer.js';
import { saveSettings } from './settings/common.js';
import { needsCount } from '../needs.js';

/* ───────────── shared: search ───────────── */
function useSearch(q) {
  const s = useStore((x) => x);
  if (!q.trim()) return null;
  const l = q.toLowerCase();
  return {
    topics: s.topics.filter((x) => x.title.toLowerCase().includes(l)).slice(0, 6),
    tasks: s.tasks.filter((x) => (x.title + ' ' + (x.note || '')).toLowerCase().includes(l)).slice(0, 6),
    artifacts: s.artifacts.filter((x) => (x.title + ' ' + (x.summary || '')).toLowerCase().includes(l)).slice(0, 6),
    messages: s.feed.filter((f) => f.text && f.text.toLowerCase().includes(l)).slice(-6).reverse(),
  };
}

function SearchResults({ r, done }) {
  if (!r) return null;
  const go = (fn) => () => { fn(); done?.(); };
  const empty = !r.topics.length && !r.tasks.length && !r.artifacts.length && !r.messages.length;
  if (empty) return html`<div class="hint" style="padding:8px 12px">No results.</div>`;
  return html`<div class="stack" style="gap:2px;padding:4px 0">
    ${r.topics.map((x) => html`<button class="topic-item" onClick=${go(() => setUI({ topicFilter: x.id, tab: 'chat' }))}><${StatusIcon} status=${x.status} emoji=${x.emoji} /><span class="t">${x.title}</span></button>`)}
    ${r.tasks.map((x) => html`<button class="topic-item" onClick=${go(() => setUI({ task: x.id, panel: 'task' }))}><${Icon} name="tasks" size="sm" /><span class="t">${x.title}</span></button>`)}
    ${r.artifacts.map((x) => html`<button class="topic-item" onClick=${go(() => setUI({ viewer: { id: x.id }, panel: 'artifact' }))}><${Icon} name=${KIND_ICON[x.kind] || 'file'} size="sm" /><span class="t">${x.title}</span></button>`)}
    ${r.messages.map((x) => html`<button class="topic-item" onClick=${go(() => setUI({ topicFilter: x.topicId || null, tab: 'chat' }))}><${Icon} name="chat" size="sm" /><span class="t">${x.text.replace(/\s+/g, ' ').slice(0, 80)}</span></button>`)}
  </div>`;
}

export function TopicList({ onPick, compact }) {
  const topics = useStore((s) => s.topics.filter((x) => !x.archived));
  const filter = useStore((s) => s.ui.topicFilter);
  const sorted = [...topics].sort((a, b) => (a.status === 'needs_you' ? -1 : 0) - (b.status === 'needs_you' ? -1 : 0) || b.updatedAt - a.updatedAt).slice(0, compact ? 12 : 40);
  if (!sorted.length) return html`<div class="hint" style="padding:4px 10px">Topics appear as your agent works.</div>`;
  return sorted.map((x) => html`<button class=${cx('topic-item', filter === x.id && 'on')} onClick=${() => { setUI({ topicFilter: filter === x.id ? null : x.id, tab: 'chat' }); onPick?.(); }}>
    <${StatusIcon} status=${x.status} emoji=${x.emoji} /><span class="t">${x.title}</span></button>`);
}

/* ───────────── Mobile drawer (hamburger) ───────────── */
export function Drawer() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const r = useSearch(q);
  const close = () => setUI({ drawer: false });
  const needs = needsCount(s);
  const online = s.devices.filter((d) => d.online && d.enabled).length;
  const nav = (tab) => () => { setUI({ tab, drawer: false, topicFilter: null }); };
  return html`<div class="overlay" onClick=${close}></div>
  <nav class="drawer" aria-label="Menu">
    <div class="row" style="padding:12px 12px 8px"><${Orb} size=${34} /><b class="serif grow" style="font-size:var(--fs-xl);font-weight:500">${s.settings?.agent?.name || 'Covo'}</b>
      <button class="icon-btn" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button></div>
    <div style="padding:0 12px 8px"><div class="composer" style="padding:2px 8px"><${Icon} name="search" size="sm" cls="muted" /><input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder=${t('Search')} style="flex:1;border:0;outline:0;background:transparent;height:34px" /></div></div>
    <div class="scroll" style="flex:1;min-height:0">
      ${r ? html`<div style="padding:0 8px"><${SearchResults} r=${r} done=${close} /></div>` : html`
      ${s.provider === 'demo' && html`<div style="margin:4px 12px 8px;padding:12px;border-radius:var(--r-md);background:var(--accent-soft)">
        <b style="font-size:var(--fs-sm)">${t('Demo mode')}</b><div class="hint" style="color:var(--ink-2);margin:2px 0 8px">You're watching a scripted demo. Connect Claude to run your own agent.</div>
        <button class="btn primary sm" onClick=${() => setUI({ drawer: false, settings: 'model' })}>${t('Connect a model')}</button></div>`}
      <div class="nav">
        <button class=${s.ui.tab === 'chat' ? 'on' : ''} onClick=${nav('chat')}><${Icon} name="chat" />${t('Chat')}</button>
        <button class=${s.ui.tab === 'tasks' ? 'on' : ''} onClick=${nav('tasks')}><${Icon} name="tasks" />${t('Tasks')}${needs > 0 && html`<span class="count">${needs}</span>`}</button>
        <button class=${s.ui.tab === 'make' ? 'on' : ''} onClick=${nav('make')}><${Icon} name="make" />${t('Make')}</button>
      </div>
      <div class="side-sec"><h4>${t('Topics')}</h4><${TopicList} onPick=${close} /></div>
      <div class="side-sec"><h4>${t('Routines')}</h4>
        ${s.routines.map((x) => html`<button class="topic-item" onClick=${() => setUI({ drawer: false, settings: 'routines' })}><${Icon} name="clock" size="sm" /><span class="t">${x.title}</span><span class="muted" style="font-size:var(--fs-xs)">${x.enabled ? x.time : 'off'}</span></button>`)}
      </div>`}
    </div>
    <div style="border-top:1px solid var(--line);padding:8px" class="stack">
      <button class="topic-item" onClick=${() => setUI({ drawer: false, settings: 'devices' })}><${Icon} name="cpu" size="sm" /><span class="t">${t('Devices')}</span><span class="pill"><span class=${cx('d', online && 'on')}></span>${online} online</span></button>
      <button class="topic-item" onClick=${() => setUI({ drawer: false, settings: 'general' })}><${Icon} name="settings" size="sm" /><span class="t">${t('Settings')}</span></button>
    </div>
  </nav>`;
}

/* ───────────── Desktop sidebar ───────────── */
export function Sidebar() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const r = useSearch(q);
  const needs = needsCount(s);
  const online = s.devices.filter((d) => d.online && d.enabled).length;
  const p = s.settings?.profile || {};
  return html`<aside class="d-side">
    <div class="brand"><${Orb} /><b class="grow">${s.settings?.agent?.name || 'Covo'}</b>
      ${s.provider === 'demo' && html`<button class="badge warn" onClick=${() => setUI({ settings: 'model' })} title=${t('Connect a model')}>${t('Demo mode')}</button>`}</div>
    <div style="padding:0 10px 6px"><div class="composer" style="padding:0 8px;box-shadow:none;border-radius:var(--r-md)"><${Icon} name="search" size="sm" cls="muted" /><input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder=${t('Search')} style="flex:1;min-width:0;border:0;outline:0;background:transparent;height:34px;font-size:var(--fs-md)" /></div></div>
    <div class="scroll" style="flex:1;min-height:0">
      ${r ? html`<div style="padding:0 8px"><${SearchResults} r=${r} done=${() => setQ('')} /></div>` : html`
      <div class="nav">
        <button class=${s.ui.tab === 'chat' ? 'on' : ''} onClick=${() => setUI({ tab: 'chat', topicFilter: null })}><${Icon} name="chat" />${t('Chat')}</button>
        <button class=${s.ui.tab === 'tasks' ? 'on' : ''} onClick=${() => setUI({ tab: 'tasks' })}><${Icon} name="tasks" />${t('Tasks')}${needs > 0 && html`<span class="count">${needs}</span>`}</button>
        <button class=${s.ui.tab === 'make' ? 'on' : ''} onClick=${() => setUI({ tab: 'make' })}><${Icon} name="make" />${t('Make')}</button>
      </div>
      <div class="side-sec"><h4>${t('Topics')}</h4><${TopicList} /></div>
      <div class="side-sec"><h4>${t('Routines')}<button class="icon-btn sm" aria-label="Edit routines" onClick=${() => setUI({ settings: 'routines' })}><${Icon} name="plus" size="sm" /></button></h4>
        ${s.routines.map((x) => html`<button class="topic-item" onClick=${() => setUI({ settings: 'routines' })}><${Icon} name="clock" size="sm" /><span class="t">${x.title}</span><span class="muted" style="font-size:var(--fs-xs)">${x.enabled ? x.time : 'off'}</span></button>`)}
      </div>`}
    </div>
    <div class="foot">
      <button class="topic-item" onClick=${() => setUI({ settings: 'devices' })}><${Icon} name="cpu" size="sm" /><span class="t">${t('Devices')}</span><span class="pill"><span class=${cx('d', online && 'on')}></span>${online}</span></button>
      <button class="topic-item" onClick=${() => setUI({ settings: 'general' })}><${Icon} name="settings" size="sm" /><span class="t">${t('Settings')}</span><span class="kbd">,</span></button>
      <button class="me-row" onClick=${() => setUI({ profile: true })}><span class="av"><${Avatar} name=${p.name} color=${p.avatarColor} size=${30} /></span><span class="grow"><b style="font-size:var(--fs-md);font-weight:500">${p.name || 'You'}</b><small>${s.provider === 'demo' ? t('Demo mode') : s.settings?.provider?.[s.provider]?.model || s.provider}</small></span></button>
    </div>
  </aside>`;
}

/* ───────────── Desktop right panel: overview ───────────── */
export function Overview() {
  const s = useStore((x) => x);
  const pending = s.approvals.filter((a) => a.status === 'pending');
  const needsTasks = s.tasks.filter((x) => x.status === 'needs_you');
  const prog = s.tasks.filter((x) => groupOf(x) === 'progress');
  const pinned = s.artifacts.filter((a) => a.pinned).slice(0, 6);
  const recent = s.artifacts.slice(0, 4);
  const dev = s.settings?.developer?.enabled && s.settings?.developer?.showUsage;
  return html`<div class="d-panel">
    <div class="panel-head"><h3>${t('Overview')}</h3><button class="icon-btn" aria-label=${t('Close')} onClick=${() => setUI({ panel: 'none' })}><${Icon} name="x" /></button></div>
    <div class="panel-body scroll"><div class="ov">
      <div class="stat-row">
        <div class="stat"><b>${needsCount(s)}</b><small>${t('Needs you')}</small></div>
        <div class="stat"><b>${prog.length}</b><small>${t('In progress')}</small></div>
        <div class="stat"><b>${s.artifacts.length}</b><small>${t('Make')}</small></div>
      </div>
      ${pending.length > 0 && html`<div><h5>${t('Waiting for approval')}</h5><div class="stack">${pending.map((a) => html`<${ApprovalCard} id=${a.id} />`)}</div></div>`}
      ${needsTasks.length > 0 && html`<div><h5>${t('Needs you')}</h5><div class="list">${needsTasks.map((x) => html`<${TaskRow} task=${x} />`)}</div></div>`}
      ${prog.length > 0 && html`<div><h5>${t('In progress')}</h5><div class="list">${prog.slice(0, 6).map((x) => html`<${TaskRow} task=${x} />`)}</div></div>`}
      ${(pinned.length ? pinned : recent).length > 0 && html`<div><h5>${pinned.length ? t('Pinned') : t('Recent')}</h5><div class="stack" style="gap:2px">${(pinned.length ? pinned : recent).map((a) => html`
        <button class="topic-item" onClick=${() => setUI({ viewer: { id: a.id }, panel: 'artifact' })}><${Icon} name=${KIND_ICON[a.kind] || 'file'} size="sm" /><span class="t">${a.title}</span><span class="muted" style="font-size:var(--fs-xs)">${fmtTime(a.updatedAt)}</span></button>`)}</div></div>`}
      ${dev && s.usage && html`<div><h5>Usage (all time)</h5><div class="hint">${s.usage.requests} requests · ${s.usage.inputTokens.toLocaleString()} in · ${s.usage.outputTokens.toLocaleString()} out · ${s.usage.cacheReadTokens.toLocaleString()} cache reads</div></div>`}
    </div></div>
  </div>`;
}

/* ───────────── Profile sheet (tap "M") ───────────── */
let installEvt = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

export function ProfileSheet() {
  const s = useStore((x) => x);
  const p = s.settings?.profile || {};
  const ap = s.settings?.appearance || {};
  const close = () => setUI({ profile: false });
  const mode = ['classic', 'classic-dark', 'system'].includes(ap.theme) ? ap.theme : 'custom';
  const signOut = async () => { await api.post('/api/auth/logout').catch(() => {}); location.reload(); };
  return html`<${Sheet} title=${t('Profile')} onClose=${close} small>
    <div class="stack" style="padding:4px 16px 20px;gap:14px">
      <div class="row" style="gap:12px"><${Avatar} name=${p.name} color=${p.avatarColor} size=${52} />
        <div class="grow"><b style="font-size:var(--fs-lg)">${p.name || 'You'}</b><div class="hint">${p.email || (s.provider === 'demo' ? t('Demo mode') : `${s.provider} · ${s.settings?.provider?.[s.provider]?.model || ''}`)}</div></div>
        <button class="btn outline sm" onClick=${() => setUI({ profile: false, settings: 'profile' })}>${t('Edit')}</button></div>
      <div class="group" style="margin:0">
        <div class="item"><${Icon} name="palette" /><div class="txt"><b>${t('Theme')}</b></div>
          <${Seg} value=${mode} onChange=${(v) => v !== 'custom' && saveSettings({ appearance: { theme: v } })} options=${[{ id: 'classic', label: '', icon: 'sun' }, { id: 'classic-dark', label: '', icon: 'moon' }, { id: 'system', label: '', icon: 'monitor' }]} /></div>
        <div class="item"><${Icon} name="globe" /><div class="txt"><b>${t('Language')}</b></div>
          <${Seg} value=${p.language || 'en'} onChange=${(v) => saveSettings({ profile: { language: v } })} options=${[{ id: 'en', label: 'EN' }, { id: 'ar', label: 'ع' }]} /></div>
        <div class="item"><${Icon} name="code" /><div class="txt"><b>${t('Developer')}</b><small>Show tool calls, raw events and token usage</small></div>
          <${Toggle} on=${s.settings?.developer?.enabled} onChange=${(v) => saveSettings({ developer: { enabled: v } })} /></div>
        <div class="item link" onClick=${() => setUI({ profile: false, settings: 'general' })}><${Icon} name="settings" /><div class="txt"><b>${t('Settings')}</b></div><${Icon} name="right" size="sm" cls="flip-rtl" /></div>
        ${installEvt && html`<div class="item link" onClick=${() => installEvt.prompt()}><${Icon} name="download" /><div class="txt"><b>Install app</b><small>Add to your home screen / desktop</small></div></div>`}
      </div>
      ${/CovoApp/.test(navigator.userAgent) && !api.isLocal() && html`<button class="btn outline" onClick=${() => { location.href = 'https://localhost/?disconnect=1'; }}><${Icon} name="phone" size="sm" />Use on this device instead</button>`}
      ${!api.isStatic() && html`<button class="btn outline" onClick=${signOut}><${Icon} name="logout" size="sm" />${t('Sign out')}</button>`}
    </div>
  <//>`;
}

/* ───────────── Voice mode ───────────── */
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const plain = (md) => md.replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[*_`#>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

export function VoiceMode() {
  const [phase, setPhase] = useState(SR ? 'listening' : 'unsupported');
  const [cap, setCap] = useState('');
  const recRef = useRef(null);
  const lastId = useRef(null);
  const sentAt = useRef(0);
  const feed = useStore((s) => s.feed);
  const agentState = useStore((s) => s.agentState);
  const lang = getLang();
  const close = () => { recRef.current?.abort?.(); speechSynthesis?.cancel(); setUI({ voice: false }); };

  const listen = () => {
    if (!SR) return;
    const r = new SR();
    r.lang = lang === 'ar' ? 'ar-IQ' : navigator.language || 'en-US';
    r.interimResults = true; r.continuous = false;
    let finalText = '';
    r.onresult = (ev) => { let s = ''; for (const res of ev.results) { s += res[0].transcript; if (res.isFinal) finalText = s; } setCap(s); };
    r.onend = () => {
      if (finalText.trim()) { setPhase('thinking'); sentAt.current = Date.now(); sendMessage(finalText.trim()); }
      else if (phase !== 'ended') setTimeout(() => recRef.current === r && listen(), 300);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed') { setPhase('denied'); } };
    recRef.current = r;
    setPhase('listening'); setCap('');
    try { r.start(); } catch {}
  };
  useEffect(() => { if (SR) listen(); return () => { recRef.current?.abort?.(); speechSynthesis?.cancel(); }; }, []);
  // When the agent finishes replying, read the new assistant text aloud, then listen again.
  useEffect(() => {
    if (phase !== 'thinking' || ['thinking', 'writing', 'working'].includes(agentState)) return;
    const replies = feed.filter((f) => f.kind === 'assistant' && f.ts >= sentAt.current - 1000 && !f.streaming);
    if (!replies.length) return;
    const text = plain(replies.map((r) => r.text).join('\n\n'));
    if (lastId.current === replies[replies.length - 1].id) return;
    lastId.current = replies[replies.length - 1].id;
    setCap(text);
    setPhase('speaking');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ar' ? 'ar' : navigator.language || 'en-US';
    u.onend = () => listen();
    speechSynthesis.speak(u);
  }, [agentState, feed, phase]);

  const orbState = phase === 'listening' ? 'listening' : phase === 'thinking' ? 'thinking' : phase === 'speaking' ? 'writing' : 'idle';
  return html`<div class="voice" role="dialog" aria-label=${t('Voice mode')}>
    <${Orb} state=${orbState} onClick=${() => phase === 'speaking' ? (speechSynthesis.cancel(), listen()) : null} />
    <div class="cap">${phase === 'unsupported' ? 'Voice mode needs speech recognition (Chrome, Edge or Safari).' : phase === 'denied' ? 'Microphone access was denied.' : cap || (phase === 'listening' ? t('Listening…') : phase === 'thinking' ? t('Thinking…') : t('Speaking…'))}</div>
    <div class="ctrls">
      <button aria-label=${t('Dictate')} onClick=${() => { speechSynthesis.cancel(); listen(); }}><${Icon} name="mic" /></button>
      <button class="end" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button>
    </div>
  </div>`;
}
