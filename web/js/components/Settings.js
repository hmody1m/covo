import { html } from '../../vendor/preact-htm.js';
import { useStore, setUI } from '../store.js';
import { Icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { cx } from './ui.js';
import { api } from '../api.js';
import * as S from './settings/sections.js';

export const SECTIONS = [
  { id: 'profile', icon: 'user', label: 'Profile', C: S.ProfileSection },
  { id: 'appearance', icon: 'palette', label: 'Appearance', C: S.AppearanceSection },
  { id: 'model', icon: 'sparkle', label: 'Model & provider', C: S.ModelSection },
  { id: 'agent', icon: 'bot', label: 'Agent & autonomy', C: S.AgentSection },
  { id: 'prompt', icon: 'code', label: 'System prompt', C: S.PromptSection },
  { id: 'memory', icon: 'brain', label: 'Memory', C: S.MemorySection },
  { id: 'routines', icon: 'clock', label: 'Routines', C: S.RoutinesSection },
  { id: 'tools', icon: 'plug', label: 'Tools & connectors', C: S.ToolsSection },
  { id: 'devices', icon: 'cpu', label: 'Devices', C: S.DevicesSection },
  { id: 'notifications', icon: 'bell', label: 'Notifications', C: S.NotificationsSection },
  { id: 'security', icon: 'lock', label: 'Security & access', C: S.SecuritySection, serverOnly: true },
  { id: 'data', icon: 'database', label: 'Data', C: S.DataSection },
  { id: 'developer', icon: 'terminal', label: 'Developer', C: S.DeveloperSection },
  { id: 'about', icon: 'info', label: 'About', C: S.AboutSection },
];

// Desktop: two-pane modal. Mobile: full-screen list → page stack.
const visible = () => SECTIONS.filter((x) => !(x.serverOnly && api.isLocal()));

export function Settings() {
  const section = useStore((s) => s.ui.settings);
  const layout = useStore((s) => s.ui.layout);
  const ready = useStore((s) => !!s.settings);
  if (!section || !ready) return null;
  const close = () => setUI({ settings: null });
  const cur = SECTIONS.find((x) => x.id === section);
  const nav = html`<nav class="stack" style="gap:2px">${visible().map((x) => html`
    <button class=${cx('topic-item', cur?.id === x.id && layout === 'desktop' && 'on')} style="height:38px" onClick=${() => setUI({ settings: x.id })}>
      <${Icon} name=${x.icon} size="sm" /><span class="t">${t(x.label)}</span>${layout !== 'desktop' && html`<${Icon} name="right" size="sm" cls="flip-rtl muted" />`}
    </button>`)}</nav>`;

  if (layout === 'desktop') {
    const C = (cur || SECTIONS[0]).C;
    return html`<div class="overlay" onClick=${close}></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label=${t('Settings')}>
        <div class="set-shell">
          <div class="set-nav scroll"><h2>${t('Settings')}</h2>${nav}</div>
          <div class="set-main"><div class="row" style="justify-content:flex-end;padding:10px 12px 0"><button class="icon-btn" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button></div>
            <div class="scroll" style="flex:1;min-height:0"><${C} key=${section} /></div></div>
        </div>
      </div>`;
  }
  // mobile: "general" = the list
  const showList = section === 'general' || !cur;
  return html`<div class="sheet full" style="top:0;border-radius:0;animation:none" role="dialog" aria-modal="true" aria-label=${t('Settings')}>
    <div class="sheet-head" style="padding-top:calc(env(safe-area-inset-top) + 8px)">
      ${showList ? html`<span class="sp"></span>` : html`<button class="icon-btn" aria-label=${t('Back')} onClick=${() => setUI({ settings: 'general' })}><${Icon} name="left" cls="flip-rtl" /></button>`}
      <h3>${showList ? t('Settings') : t(cur.label)}</h3>
      <button class="icon-btn" aria-label=${t('Close')} onClick=${close}><${Icon} name="x" /></button>
    </div>
    <div class="sheet-body scroll">${showList ? html`<div style="padding:4px 12px 30px">${nav}</div>` : html`<${cur.C} key=${section} />`}</div>
  </div>`;
}
