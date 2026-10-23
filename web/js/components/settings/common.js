import { html, useState, useEffect, useRef } from '../../../vendor/preact-htm.js';
import { api } from '../../api.js';
import { set, get, toast } from '../../store.js';
import { t } from '../../lib/i18n.js';
import { Toggle } from '../ui.js';

// Save a partial settings patch (debounced per call site when needed).
export async function saveSettings(patch, { quiet = true } = {}) {
  // optimistic local merge
  const cur = structuredClone(get().settings || {});
  const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k], v); else a[k] = v; } return a; };
  set({ settings: merge(cur, structuredClone(patch)) });
  try {
    const r = await api.put('/api/settings', patch);
    set({ settings: r.settings, provider: r.provider });
    if (!quiet) toast({ title: t('Saved'), ms: 1400 });
    return r;
  } catch (e) {
    toast({ title: 'Settings not saved', body: e.message });
    throw e;
  }
}

export function useDebounced(fn, ms = 600) {
  const timer = useRef();
  return (...args) => { clearTimeout(timer.current); timer.current = setTimeout(() => fn(...args), ms); };
}

export function Item({ icon, title, desc, children, onClick, col }) {
  return html`<div class=${`item${onClick ? ' link' : ''}${col ? ' col' : ''}`} onClick=${onClick}>
    ${col ? html`<div class="txt"><b>${title}</b>${desc && html`<small>${desc}</small>`}</div>${children}` : html`<div class="txt"><b>${title}</b>${desc && html`<small>${desc}</small>`}</div>${children}`}
  </div>`;
}

export function ToggleItem({ title, desc, value, onChange }) {
  return html`<${Item} title=${title} desc=${desc}><${Toggle} on=${!!value} label=${title} onChange=${onChange} /><//>`;
}

export function SelectItem({ title, desc, value, options, onChange, width = 180 }) {
  return html`<${Item} title=${title} desc=${desc}>
    <select class="select" style=${`width:${width}px`} value=${value} onChange=${(e) => onChange(e.target.value)}>
      ${options.map((o) => html`<option value=${o.id ?? o}>${o.name ?? o}</option>`)}
    </select>
  <//>`;
}

// Text input that saves on blur / Enter
export function TextItem({ title, desc, value, onSave, type = 'text', placeholder, width = 260, col }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  const commit = () => { if (String(v) !== String(value ?? '')) onSave(type === 'number' ? Number(v) : v); };
  const input = html`<input class="input" style=${col ? '' : `width:${width}px;max-width:55vw`} type=${type} value=${v} placeholder=${placeholder} onInput=${(e) => setV(e.target.value)} onBlur=${commit} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} autocomplete="off" spellcheck="false" />`;
  return html`<${Item} title=${title} desc=${desc} col=${col}>${input}<//>`;
}

export function Group({ title, children, cls = '' }) {
  return html`<div class=${`group ${cls}`}>${title && html`<h4>${title}</h4>`}${children}</div>`;
}

export function Page({ title, desc, children }) {
  return html`<div class="set-content"><h2>${title}</h2>${desc && html`<div class="hint" style="margin-bottom:12px">${desc}</div>`}${children}</div>`;
}
