import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { Icon, KIND_ICON } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { api } from '../api.js';
import { useStore, setUI, toast, mutate } from '../store.js';
import { artifactToHtml } from '../lib/artifact-html.js';
import { fmtTime, money, cx, useNow } from './ui.js';

/* ───────────── Approval card ───────────── */
export function ApprovalCard({ id }) {
  const ap = useStore((s) => s.approvals.find((a) => a.id === id));
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  useNow(15000);
  if (!ap) return null;
  const pending = ap.status === 'pending';
  const decide = async (decision) => {
    setBusy(decision);
    try { await api.post(`/api/approvals/${id}`, { decision }); }
    catch (e) { toast({ title: 'Approval failed', body: e.message }); }
    setBusy('');
  };
  let right;
  if (pending && ap.expiresAt) {
    const mins = Math.max(0, Math.round((ap.expiresAt - Date.now()) / 60000));
    right = html`<span class="expires">${mins >= 120 ? t('Expires in {n} h', { n: Math.round(mins / 60) }) : t('Expires in {n} min', { n: mins })}</span>`;
  } else if (ap.status === 'approved') right = html`<span class="badge ok">${['payment', 'purchase'].includes(ap.kind) ? t('Paid') : t('Approved')}</span>`;
  else if (ap.status === 'declined') right = html`<span class="badge no">${t('Declined')}</span>`;
  else if (ap.status === 'expired') right = html`<span class="badge no">${t('Expired')}</span>`;
  const hasAmount = ap.amount !== null && ap.amount !== undefined;
  const toolDetail = ap.tool && html`<div class="detail-code">${ap.tool.name}\n${JSON.stringify(ap.tool.input, null, 2)}</div>`;
  return html`<div class="card ap" data-status=${ap.status}>
    <div class="top">
      ${hasAmount ? html`<span class="amount">${money(ap.amount, ap.currency)}</span>` : html`<span class="amount" style="font-size:var(--fs-base)">${ap.title}</span>`}
      ${right}
    </div>
    ${hasAmount && html`<div class="title">${ap.title}</div>`}
    ${(ap.detail || ap.tool) && html`<div class="line" onClick=${() => setOpen(!open)}>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ap.detail || ap.tool.name}</span>
      <${Icon} name=${open ? 'down' : 'right'} size="sm" cls="flip-rtl" />
    </div>`}
    ${open && toolDetail}
    ${open && ap.result && html`<div class="detail-code">${ap.result}</div>`}
    ${pending && html`<div class="actions">
      <button class="btn primary block" disabled=${!!busy} onClick=${() => decide('approve')}>${busy === 'approve' ? '…' : t(ap.actionLabel || 'Approve')}</button>
      <button class="btn outline block" disabled=${!!busy} onClick=${() => decide('decline')}>${t('Not now')}</button>
    </div>`}
  </div>`;
}

/* ───────────── Artifact card ───────────── */
// Browser edition renders artifacts inline (srcdoc, opaque origin). Static hosts often don't send CORS
// headers for fonts, so drop the font link there; artifacts fall back to system fonts.
export const localDoc = (a) => artifactToHtml(a).replace(/<link rel="stylesheet" href="\/fonts\/fonts\.css">/g, '');
export function ArtifactPreview({ a, height: fixed = 150 }) {
  const ref = useRef();
  const [w, setW] = useState(320);
  const isStatic = api.isStatic();
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width && setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const scale = w / 390;
  const height = a.kind === 'deck' ? Math.round(w * 0.625) : fixed;
  if (a.preview?.stats) {
    return html`<div class="preview art-quick" style=${`height:${height}px`} ref=${ref}>
      <div class="ey">${a.title}</div>
      <div class="h">${a.preview.headline}</div>
      <div class="tiles">${a.preview.stats.map(([k, v]) => html`<div><small>${k}</small><b>${v}</b></div>`)}</div>
    </div>`;
  }
  const [content, setContent] = useState(null);
  useEffect(() => { if (isStatic && !a.preview?.stats) api.get(`/api/artifacts/${a.id}`).then((x) => setContent(x.content)).catch(() => {}); }, [a.id, a.version]);
  const src = isStatic ? undefined : `/a/${a.id}?v=${a.version}`;
  const srcdoc = isStatic ? localDoc({ ...a, content: content || '' }) : undefined;
  return html`<div class="preview" ref=${ref} style=${`height:${height}px`}>
    <iframe title=${a.title} tabindex="-1" loading="lazy" sandbox="allow-scripts" src=${src} srcdoc=${srcdoc}
      style=${`width:390px;height:${Math.ceil(height / scale)}px;transform:scale(${scale})`}></iframe>
    <div class="shade"></div>
  </div>`;
}

export function ArtifactCard({ id }) {
  const a = useStore((s) => s.artifacts.find((x) => x.id === id));
  if (!a) return html`<div class="card"><div class="art"><div class="foot"><span class="muted">${t('Deleted')}</span></div></div></div>`;
  const open = () => setUI({ viewer: { id: a.id }, panel: 'artifact' });
  const pin = async (e) => {
    e.stopPropagation();
    mutate((s) => { s.artifacts = s.artifacts.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)); });
    try { await api.patch(`/api/artifacts/${a.id}`, { pinned: !a.pinned }); } catch {}
  };
  return html`<div class="card art">
    <div onClick=${open}><${ArtifactPreview} a=${a} /></div>
    <div class="foot" onClick=${open}>
      <div class="grow"><div class="t">${a.title}</div><div class="s">${t('Updated {t}', { t: fmtTime(a.updatedAt) })}</div></div>
      <button class="icon-btn sm" aria-label=${a.pinned ? t('Unpin') : t('Pin')} onClick=${pin} style=${a.pinned ? 'color:var(--accent)' : ''}><${Icon} name="pin" size="sm" /></button>
      <span class="icon-btn sm"><${Icon} name="right" size="sm" cls="flip-rtl" /></span>
    </div>
  </div>`;
}

/* ───────────── Email card ───────────── */
export function EmailCard({ item }) {
  const emailConfigured = useStore((s) => s.emailConfigured);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(item.draft);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (!edit) setDraft(item.draft); }, [item.draft, edit]);
  const isDraft = item.status === 'draft' || item.status === 'failed';
  const save = async () => { await api.post(`/api/emails/${item.id}`, { action: 'update', draft }); setEdit(false); };
  const act = async (action) => {
    setBusy(action);
    try {
      if (edit) await save();
      let via;
      if (action === 'send' && !emailConfigured && !item.demo) {
        via = 'mailto';
        const d = edit ? draft : item.draft;
        const to = /@/.test(d.to) ? d.to.replace(/.*<([^>]+)>.*/, '$1') : '';
        window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}${d.cc ? `&cc=${encodeURIComponent(d.cc)}` : ''}`, '_blank');
      }
      await api.post(`/api/emails/${item.id}`, { action, via });
    } catch (e) { toast({ title: 'Email', body: e.message }); }
    setBusy('');
  };
  const copy = () => { navigator.clipboard?.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`); toast({ title: t('Copied'), ms: 1500 }); };
  return html`<div class="card em">
    <div class="hd"><span class="ico"><${Icon} name="mail" size="sm" /></span><span class="grow">${t('Email')}</span>
      <button class="icon-btn sm" aria-label=${t('Copy')} onClick=${copy}><${Icon} name="copy" size="sm" /></button>
      ${isDraft && html`<button class="icon-btn sm" aria-label=${t('Edit')} onClick=${() => (edit ? save() : setEdit(true))} style=${edit ? 'color:var(--accent)' : ''}><${Icon} name=${edit ? 'check' : 'edit'} size="sm" /></button>`}
    </div>
    <div class="f">${edit ? html`<input value=${draft.to} onInput=${(e) => setDraft({ ...draft, to: e.target.value })} aria-label=${t('To')} />` : html`${t('To')}: ${item.draft.to}`}</div>
    ${item.draft.cc && !edit && html`<div class="f">Cc: ${item.draft.cc}</div>`}
    <div class="f">${edit ? html`<input value=${draft.subject} onInput=${(e) => setDraft({ ...draft, subject: e.target.value })} aria-label=${t('Subject')} />` : html`${t('Subject')}: ${item.draft.subject}`}</div>
    <div class="body">${edit ? html`<textarea value=${draft.body} onInput=${(e) => setDraft({ ...draft, body: e.target.value })}></textarea>` : item.draft.body}</div>
    ${isDraft ? html`<div class="actions">
        <button class="btn outline" disabled=${!!busy} onClick=${() => act('dismiss')}>${t('Not now')}</button>
        <button class="btn primary" disabled=${!!busy} onClick=${() => act('send')}>${busy === 'send' ? '…' : t('Send')}</button>
      </div>
      ${item.status === 'failed' && html`<div class="sent" style="color:var(--danger)">${t('Failed: {e}', { e: item.error || '' })}</div>`}`
    : html`<div class="sent"><${Icon} name=${item.status === 'sent' ? 'checkCircle' : 'x'} size="sm" /> ${item.status === 'sent' ? t('Sent') : t('Dismissed')}</div>`}
  </div>`;
}

/* ───────────── Task card (in thread) ───────────── */
export function TaskMini({ id }) {
  const task = useStore((s) => s.tasks.find((x) => x.id === id));
  if (!task) return null;
  return html`<button class="card taskcard" onClick=${() => setUI({ task: id, panel: 'task' })}>
    <${Icon} name="tasks" /><div class="grow" style="text-align:start"><b>${task.title}</b><div class="muted" style="font-size:var(--fs-xs)">${task.note || task.status}</div></div><${Icon} name="right" size="sm" cls="flip-rtl" />
  </button>`;
}

export { KIND_ICON };
