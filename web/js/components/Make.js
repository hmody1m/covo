import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { Icon, KIND_ICON } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { api } from '../api.js';
import { useStore, setUI, toast, mutate, get } from '../store.js';
import { Sheet, Confirm, fmtTime, cx } from './ui.js';
import { ArtifactCard, localDoc } from './Cards.js';
import { artifactToHtml } from '../lib/artifact-html.js';
import { sendMessage } from './Composer.js';
import { saveBlob } from '../lib/native.js';

const FILTERS = [
  { id: 'all', label: 'Everything' }, { id: 'pinned', label: 'Pinned' }, { id: 'dashboard', label: 'Dashboards' },
  { id: 'page', label: 'Pages' }, { id: 'deck', label: 'Decks' }, { id: 'doc', label: 'Docs' }, { id: 'checklist', label: 'Checklists' },
];

const TEMPLATES = [
  { icon: 'chart', title: 'Morning dashboard', prompt: 'Build me one page I can check every morning. Is the business healthy, and where should I look?' },
  { icon: 'deck', title: 'Pitch deck', prompt: 'Make a 10-slide deck about ' },
  { icon: 'doc', title: 'One-page brief', prompt: 'Write a one-page brief on ' },
  { icon: 'list', title: 'Checklist', prompt: 'Make a checklist for ' },
  { icon: 'file', title: 'Landing page', prompt: 'Build a simple landing page for ' },
  { icon: 'globe', title: 'Research report', prompt: 'Research and write a short report on ' },
];

export function compose(text) {
  setUI({ tab: 'chat', viewer: null });
  setTimeout(() => window.dispatchEvent(new CustomEvent('covo:compose', { detail: text })), 60);
}

export function MakeView() {
  const arts = useStore((s) => s.artifacts);
  const [f, setF] = useState('all');
  const [tpl, setTpl] = useState(false);
  const list = arts.filter((a) => f === 'all' || (f === 'pinned' ? a.pinned : a.kind === f)).sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  const kinds = new Set(arts.map((a) => a.kind));
  return html`<div class="stack" style="gap:14px">
    <div class="row" style="justify-content:space-between"><h1 class="page-title" style="margin:0">${t('Make')}</h1>
      <button class="btn primary sm" onClick=${() => setTpl(true)}><${Icon} name="sparkle" size="sm" />${t('Make something')}</button></div>
    <div class="row">
      <div class="suggestions" style="padding:0 0 2px;flex:1">${FILTERS.filter((x) => x.id === 'all' || (x.id === 'pinned' ? arts.some((a) => a.pinned) : kinds.has(x.id))).map((x) => html`
        <button style=${f === x.id ? 'background:var(--primary);color:var(--primary-ink);border-color:var(--primary)' : ''} onClick=${() => setF(x.id)}>${t(x.label)}</button>`)}</div>
    </div>
    ${list.length ? html`<div class="grid-cards">${list.map((a) => html`<${ArtifactCard} key=${a.id} id=${a.id} />`)}</div>`
      : html`<div class="empty"><${Icon} name="make" /><div>${t('Nothing made yet.')}</div></div>`}
    ${tpl && html`<${Sheet} title=${t('Make something')} onClose=${() => setTpl(false)} small>
      <div class="list" style="padding:4px 14px 18px">${TEMPLATES.map((x) => html`
        <button class="trow" onClick=${() => { setTpl(false); compose(x.prompt); }}>
          <div class="h"><${Icon} name=${x.icon} /><b>${x.title}</b><${Icon} name="right" size="sm" cls="flip-rtl" /></div>
          <div class="note">${x.prompt}…</div>
        </button>`)}</div>
    <//>`}
  </div>`;
}

export function ArtifactViewer({ id, asPanel }) {
  const a = useStore((s) => s.artifacts.find((x) => x.id === id));
  const [v, setV] = useState(null);
  const [ask, setAsk] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [full, setFull] = useState(null);
  const isStatic = api.isStatic();
  useEffect(() => { setV(null); }, [id]);
  useEffect(() => {
    if (!a) return;
    if (isStatic) api.get(`/api/artifacts/${id}${v ? `?v=${v}` : ''}`).then(setFull).catch(() => {});
  }, [id, v, a?.version]);
  if (!a) return null;
  const close = () => setUI({ viewer: null, panel: 'overview' });
  const version = v || a.version;
  const src = `/a/${a.id}?v=${version}`;
  const askChange = () => {
    if (!ask.trim()) return;
    sendMessage(`About "${a.title}" (artifact ${a.id}): ${ask.trim()}`);
    setAsk('');
    close();
  };
  const pin = async () => { mutate((s) => { s.artifacts = s.artifacts.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)); }); api.patch(`/api/artifacts/${a.id}`, { pinned: !a.pinned }).catch(() => {}); };
  const frame = isStatic
    ? html`<iframe class="viewer-frame" title=${a.title} sandbox="allow-scripts allow-popups" srcdoc=${full ? localDoc(full) : ''}></iframe>`
    : html`<iframe class="viewer-frame" title=${a.title} sandbox="allow-scripts allow-popups allow-forms allow-modals" src=${src}></iframe>`;
  const actions = html`
    ${a.versions?.length > 1 && html`<select class="select" style="width:auto;height:32px;font-size:var(--fs-sm)" value=${version} onChange=${(e) => setV(Number(e.target.value))} aria-label="Version">
      ${[...a.versions].reverse().map((x) => html`<option value=${x.v}>v${x.v} · ${fmtTime(x.ts)}</option>`)}</select>`}
    <button class="icon-btn" aria-label=${a.pinned ? t('Unpin') : t('Pin')} title=${a.pinned ? t('Unpin') : t('Pin')} onClick=${pin} style=${a.pinned ? 'color:var(--accent)' : ''}><${Icon} name="pin" size="sm" /></button>
    ${!isStatic && html`<a class="icon-btn" href=${src} target="_blank" rel="noopener" aria-label=${t('Open')} title=${t('Open')}><${Icon} name="external" size="sm" /></a>
    <a class="icon-btn" href=${`/a/${a.id}/download`} aria-label=${t('Download')} title=${t('Download')}><${Icon} name="download" size="sm" /></a>`}
    ${isStatic && html`<button class="icon-btn" aria-label=${t('Download')} title=${t('Download')} onClick=${async () => { const r = await api.raw('GET', `/a/${a.id}/download`); saveBlob(new Blob([r.body], { type: r.type }), r.filename || a.title); }}><${Icon} name="download" size="sm" /></button>`}
    <button class="icon-btn" aria-label=${t('Delete')} title=${t('Delete')} onClick=${() => setConfirm(true)}><${Icon} name="trash" size="sm" /></button>`;
  const footer = html`<div class="viewer-bar">
    <input value=${ask} onInput=${(e) => setAsk(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && askChange()} placeholder="Ask for changes…" aria-label="Ask for changes" dir="auto" />
    <button class="send-btn" disabled=${!ask.trim()} aria-label=${t('Send')} onClick=${askChange}><${Icon} name="up" /></button>
  </div>`;
  const dlg = confirm && html`<${Confirm} title="Delete this?" body=${`"${a.title}" and all its versions will be deleted.`} onYes=${async () => { await api.del(`/api/artifacts/${a.id}`); close(); }} onClose=${() => setConfirm(false)} />`;
  if (asPanel) {
    return html`<div class="d-panel wide">
      <div class="panel-head"><${Icon} name=${KIND_ICON[a.kind] || 'file'} size="sm" /><h3>${a.title}</h3>${actions}<button class="icon-btn" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button></div>
      ${a.refresh && html`<div class="hint" style="padding:6px 16px;border-bottom:1px solid var(--line)">${a.refresh}</div>`}
      <div class="panel-body">${frame}</div>${footer}${dlg}
    </div>`;
  }
  return html`<${Sheet} title=${a.title} onClose=${close} full>
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="row" style="padding:0 10px 6px;justify-content:flex-end;gap:2px">${a.refresh && html`<span class="hint grow" style="padding-inline-start:6px">${a.refresh}</span>`}${actions}</div>
      <div style="flex:1;min-height:0;border-top:1px solid var(--line)">${frame}</div>
      ${footer}
    </div>${dlg}
  <//>`;
}
