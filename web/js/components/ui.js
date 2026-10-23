import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { Icon } from '../lib/icons.js';
import { t, getLang } from '../lib/i18n.js';
import { useStore, setUI, get } from '../store.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const loc = getLang() === 'ar' ? 'ar' : undefined;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return (getLang() === 'ar' ? 'أمس ' : 'Yesterday ') + d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
}
export function ago(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return getLang() === 'ar' ? 'الآن' : 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return fmtTime(ts);
}
export const money = (n, cur = 'USD') => { try { return new Intl.NumberFormat(getLang() === 'ar' ? 'ar' : 'en-US', { style: 'currency', currency: cur || 'USD' }).format(n); } catch { return `${cur} ${n}`; } };

export function Toggle({ on, onChange, label }) {
  return html`<button role="switch" aria-checked=${!!on} aria-label=${label} class=${cx('toggle', on && 'on')} onClick=${() => onChange(!on)}></button>`;
}

export function Seg({ value, options, onChange }) {
  return html`<div class="seg" role="tablist">${options.map((o) => html`
    <button role="tab" aria-selected=${value === o.id} class=${value === o.id ? 'on' : ''} onClick=${() => onChange(o.id)}>
      ${o.icon && html`<${Icon} name=${o.icon} size="sm" />`}${o.label}${o.n !== undefined && html`<span class="n">${o.n}</span>`}
    </button>`)}</div>`;
}

// Status glyph used for topic tags, chips and task rows.
export function StatusIcon({ status, emoji }) {
  if (status === 'done') return html`<span class="st done"><svg viewBox="0 0 24 24" class="icon"><path d="M20 6 9 17l-5-5"/></svg></span>`;
  if (status === 'needs_you') return html`<span class="st needs_you">${emoji ? html`<span class="emoji">${emoji}</span>` : html`<span class="dot"></span>`}</span>`;
  return html`<span class=${cx('st', status === 'in_progress' ? 'in_progress' : 'active')}><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 1-8.5 6"/></svg></span>`;
}

export function Avatar({ name, color, size = 36 }) {
  const initial = (name || 'U').trim().charAt(0).toUpperCase();
  return html`<span class="avatar" style=${`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;${color ? `background:${color};color:#fff` : ''}`}>${initial}</span>`;
}

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

// Bottom sheet on mobile, centered modal on desktop.
export function Sheet({ title, onClose, children, full, left, right, wide, small }) {
  useEscape(onClose);
  const layout = useStore((s) => s.ui.layout);
  const ref = useRef();
  const drag = useRef(null);
  if (layout === 'desktop') {
    return html`<div class="overlay" onClick=${onClose}></div>
      <div class=${cx('modal', small && 'sm')} style=${wide ? 'width:min(1100px,calc(100vw - 48px));height:calc(100vh - 48px)' : ''} role="dialog" aria-modal="true" aria-label=${title}>
        <div class="sheet-head">${left || html`<span class="sp"></span>`}<h3>${title}</h3>${right || html`<button class="icon-btn" aria-label=${t('Close')} onClick=${onClose}><${Icon} name="x" /></button>`}</div>
        <div class="sheet-body scroll">${children}</div>
      </div>`;
  }
  const onStart = (e) => { drag.current = { y: e.touches[0].clientY, dy: 0 }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    drag.current.dy = dy;
    if (ref.current) ref.current.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (drag.current && drag.current.dy > 110) onClose?.();
    else if (ref.current) ref.current.style.transform = '';
    drag.current = null;
  };
  return html`<div class="overlay" onClick=${onClose}></div>
    <div ref=${ref} class=${cx('sheet', full && 'full')} role="dialog" aria-modal="true" aria-label=${title}>
      <div onTouchStart=${onStart} onTouchMove=${onMove} onTouchEnd=${onEnd}>
        <div class="grab"></div>
        <div class="sheet-head">${left || html`<span class="sp"></span>`}<h3>${title}</h3>${right || html`<button class="icon-btn" aria-label=${t('Close')} onClick=${onClose}><${Icon} name="x" /></button>`}</div>
      </div>
      <div class="sheet-body scroll">${children}</div>
    </div>`;
}

export function Toasts() {
  const toasts = useStore((s) => s.ui.toasts);
  const name = useStore((s) => s.settings?.agent?.name || 'Covo');
  if (!toasts.length) return null;
  return html`<div class="toasts" aria-live="polite">${toasts.map((x) => html`
    <div class="toast" key=${x.id} onClick=${() => { setUI((u) => ({ toasts: u.toasts.filter((y) => y.id !== x.id) })); x.onClick?.(); }}>
      <span class="ti"><${MiniOrb} /></span>
      <div class="grow"><b>${x.title || name}</b>${x.body && html`<p>${x.body}</p>`}</div>
      <span class="now">${t('now') === 'now' ? 'now' : t('now')}</span>
    </div>`)}</div>`;
}

export function MiniOrb() {
  return html`<svg viewBox="0 0 64 64" width="30" height="30"><circle cx="32" cy="32" r="30" fill="var(--orb-bg)" stroke="var(--line)"/>
    <g transform="rotate(-14 32 32)" fill="none" stroke="var(--orb-ink)" stroke-width="2.4" stroke-linecap="round"><path d="M12 32 A20 7.5 0 0 1 52 32"/></g>
    <circle cx="32.5" cy="32.5" r="11.6" fill="var(--orb-blob)"/>
    <g transform="rotate(-14 32 32)"><path d="M52 32 A20 7.5 0 0 1 12 32" fill="none" stroke="var(--orb-ink)" stroke-width="2.4" stroke-linecap="round"/><circle cx="52" cy="32" r="3" fill="var(--orb-ink)"/></g></svg>`;
}

export function Confirm({ title, body, confirm = 'Delete', danger = true, onYes, onClose }) {
  return html`<${Sheet} title=${title} onClose=${onClose} small>
    <div style="padding:4px 18px 18px;display:flex;flex-direction:column;gap:14px">
      ${body && html`<p class="hint" style="font-size:var(--fs-md);margin:0">${body}</p>`}
      <div class="row" style="justify-content:flex-end">
        <button class="btn outline" onClick=${onClose}>${t('Cancel')}</button>
        <button class=${cx('btn', danger ? 'danger' : 'primary')} onClick=${() => { onYes(); onClose(); }}>${t(confirm)}</button>
      </div>
    </div>
  <//>`;
}

export function CopyBox({ text }) {
  const [ok, setOk] = useState(false);
  return html`<div class="codebox">${text}<button class="icon-btn sm" aria-label=${t('Copy')} onClick=${() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}><${Icon} name=${ok ? 'check' : 'copy'} size="sm" /></button></div>`;
}

export function useNow(ms = 30000) {
  const [, f] = useState(0);
  useEffect(() => { const i = setInterval(() => f((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

export const topicById = (id) => get().topics.find((x) => x.id === id);
