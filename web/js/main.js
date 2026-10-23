import { html, render, useEffect } from '../vendor/preact-htm.js';
import { api, useTransport } from './api.js';
import { useStore, set, setUI, get } from './store.js';
import { t, setLang } from './lib/i18n.js';
import { Icon } from './lib/icons.js';
import { applyAppearance } from './theme.js';
import { registerSW } from './push.js';
import { needsCount } from './needs.js';
import { Orb } from './components/Orb.js';
import { Feed, MessageMenu } from './components/Feed.js';
import { Composer, Suggestions } from './components/Composer.js';
import { TasksView, TaskDetail } from './components/Tasks.js';
import { MakeView, ArtifactViewer } from './components/Make.js';
import { Drawer, Sidebar, Overview, ProfileSheet, VoiceMode } from './components/Panels.js';
import { Settings } from './components/Settings.js';
import { Login, Setup } from './components/Auth.js';
import { Toasts, Avatar, cx } from './components/ui.js';
import { LegalSheet } from './components/Legal.js';
import { installNativeLinks } from './lib/native.js';

/* ───────────── layout detection ───────────── */
const wide = window.matchMedia('(min-width: 900px)');
function computeLayout() {
  const mode = get().settings?.appearance?.interfaceMode || 'auto';
  const layout = mode === 'auto' ? (wide.matches ? 'desktop' : 'mobile') : mode;
  if (layout !== get().ui.layout) setUI({ layout });
}
wide.addEventListener?.('change', computeLayout);

/* ───────────── shared pieces ───────────── */


function TabBar() {
  const tab = useStore((s) => s.ui.tab);
  const needs = useStore(needsCount);
  const go = (id) => setUI({ tab: id, topicFilter: null });
  return html`<nav class="tabbar" aria-label="Sections">
    <button class=${tab === 'chat' ? 'on' : ''} onClick=${() => go('chat')} aria-current=${tab === 'chat'}><${Icon} name="chat" />${t('Chat')}</button>
    <button class=${tab === 'tasks' ? 'on' : ''} onClick=${() => go('tasks')} aria-current=${tab === 'tasks'}><${Icon} name="tasks" />${t('Tasks')}${needs > 0 && html`<span class="count">${needs}</span>`}</button>
    <button class=${tab === 'make' ? 'on' : ''} onClick=${() => go('make')} aria-current=${tab === 'make'}><${Icon} name="make" />${t('Make')}</button>
  </nav>`;
}

function OfflineBar() {
  const online = useStore((s) => s.online);
  if (online) return null;
  return html`<div style="position:fixed;top:0;left:0;right:0;z-index:300;background:var(--warn-soft);color:var(--warn);text-align:center;font-size:var(--fs-xs);padding:4px">${t('Offline — reconnecting…')}</div>`;
}

const orbClick = () => {
  // Tap the orb: jump to what needs you, else show the overview / tasks.
  const s = get();
  if (s.ui.layout === 'desktop') { setUI({ panel: s.ui.panel === 'overview' ? 'none' : 'overview' }); return; }
  setUI({ tab: needsCount(s) ? 'tasks' : 'chat', topicFilter: null });
};

/* ───────────── mobile ───────────── */
function MobileApp() {
  const tab = useStore((s) => s.ui.tab);
  const p = useStore((s) => s.settings.profile);
  return html`<div class="m-app">
    <header class="m-header">
      <button class="circle-btn" aria-label="Menu" onClick=${() => setUI({ drawer: true })}><${Icon} name="menu" size="sm" /></button>
      <${Orb} onClick=${orbClick} />
      <button class="circle-btn" aria-label=${t('Profile')} onClick=${() => setUI({ profile: true })} style=${p.avatarColor ? `background:${p.avatarColor};color:#fff;border-color:transparent` : ''}>${(p.name || 'U').charAt(0).toUpperCase()}</button>
    </header>
    <main class="m-body">
      ${tab === 'chat' && html`<${Feed} variant="m" />`}
      ${tab === 'tasks' && html`<div class="m-page scroll"><${TasksView} /></div>`}
      ${tab === 'make' && html`<div class="m-page scroll"><${MakeView} /></div>`}
    </main>
    <div class="m-bottom">
      ${tab === 'chat' && html`<${Suggestions} /><${Composer} />`}
      <${TabBar} />
    </div>
  </div>`;
}

/* ───────────── desktop ───────────── */
function DesktopApp() {
  const tab = useStore((s) => s.ui.tab);
  const panel = useStore((s) => s.ui.panel);
  const viewer = useStore((s) => s.ui.viewer);
  const task = useStore((s) => s.ui.task);
  const right = viewer && panel === 'artifact' ? html`<${ArtifactViewer} id=${viewer.id} asPanel />`
    : task && panel === 'task' ? html`<${TaskDetail} id=${task} asPanel />`
    : panel === 'overview' ? html`<${Overview} />` : null;
  return html`<div class="d-app">
    <${Sidebar} />
    <main class="d-main">
      <header class="d-head">
        <${Orb} onClick=${orbClick} />
        <div class="right">
          <button class="icon-btn" title=${t('Overview')} aria-label=${t('Overview')} onClick=${() => setUI({ panel: panel === 'none' ? 'overview' : 'none', viewer: null, task: null })}><${Icon} name="panel" /></button>
        </div>
      </header>
      ${tab === 'chat' && html`<${Feed} variant="d" />
        <div class="d-bottom"><div class="d-center"><${Suggestions} /><${Composer} autoFocus /></div></div>`}
      ${tab === 'tasks' && html`<div class="d-page scroll" style="padding-top:96px"><div class="d-center"><${TasksView} /></div></div>`}
      ${tab === 'make' && html`<div class="d-page scroll" style="padding-top:96px"><div style="max-width:1100px;margin:0 auto"><${MakeView} /></div></div>`}
    </main>
    ${right}
  </div>`;
}

/* ───────────── root ───────────── */
function App() {
  const s = useStore((x) => x);
  if (s.settings) setLang(s.settings.profile?.language || 'en'); // before rendering children
  useEffect(() => { if (s.settings) { applyAppearance(s.settings.appearance, s.settings.profile); computeLayout(); } }, [s.settings]);

  if (s.boot === 'loading') return html`<div class="auth"><${Orb} state="thinking" /></div>`;
  if (s.boot === 'error') return html`<div class="auth"><div class="auth-card"><h1 style="font-size:var(--fs-2xl)">Can't reach the server</h1><p class="lead">${s.error}</p><button class="btn primary" onClick=${() => location.reload()}>${t('Retry')}</button></div></div>`;
  if (s.boot === 'setup') return html`<${Setup} /><${LegalSheet} />`;
  if (s.boot === 'login') return html`<${Login} appName=${s.appName} /><${LegalSheet} />`;
  const ui = s.ui;
  const mobile = ui.layout !== 'desktop';
  return html`
    <${OfflineBar} />
    ${mobile ? html`<${MobileApp} />` : html`<${DesktopApp} />`}
    ${mobile && ui.drawer && html`<${Drawer} />`}
    ${ui.profile && html`<${ProfileSheet} />`}
    ${mobile && ui.viewer && html`<${ArtifactViewer} id=${ui.viewer.id} />`}
    ${mobile && ui.task && html`<${TaskDetail} id=${ui.task} />`}
    ${!mobile && ui.viewer && ui.panel !== 'artifact' && html`<${ArtifactViewer} id=${ui.viewer.id} asPanel />`}
    <${Settings} />
    ${ui.voice && html`<${VoiceMode} />`}
    <${MessageMenu} />
    <${LegalSheet} />
    <${Toasts} />`;
}

/* ───────────── keyboard ───────────── */
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
  const s = get();
  if (s.boot !== 'ready') return;
  if (e.key === ',') { e.preventDefault(); setUI({ settings: s.ui.layout === 'desktop' ? 'profile' : 'general' }); }
  else if (e.key === '1') setUI({ tab: 'chat' });
  else if (e.key === '2') setUI({ tab: 'tasks' });
  else if (e.key === '3') setUI({ tab: 'make' });
  else if (e.key === '/') { const i = document.querySelector('.d-side input, .drawer input'); if (i) { e.preventDefault(); i.focus(); } }
  else if (e.key === 'Escape') setUI({ settings: null, viewer: null, task: null, profile: false, drawer: false, voice: false, legal: null });
});

/* ───────────── boot ───────────── */
export async function boot() {
  installNativeLinks();
  render(html`<${App} />`, document.getElementById('app'));
  try {
    if (window.COVO_STANDALONE) {
      // Browser / Android edition: run locally, unless the user connected a Covo server.
      const { localTransport, maybeOpenServer } = await import('./standalone.js');
      if (await maybeOpenServer()) return;
      useTransport(await localTransport());
    }
    const st = await api.get('/api/auth/status');
    set({ appName: st.appName });
    // Desktop app: the window signs itself in (desktop/main.cjs).
    if (window.covoDesktop && !st.desktop) return window.covoDesktop.signIn();
    if (!st.setup) return set({ boot: 'setup' });
    if (!st.authed) return set({ boot: 'login' });
    const b = await api.refresh(); // also opens the live connection (see wrapper below)
    window.covoDesktop?.on('settings', (id) => setUI({ settings: id || 'general' }));
    // deep links from notifications: /?approval=… /?task=… /?tab=…
    const q = new URLSearchParams(location.search);
    if (q.get('task')) setUI({ task: q.get('task'), panel: 'task' });
    if (q.get('tab')) setUI({ tab: q.get('tab') });
    if (q.get('approval')) { const ap = b.approvals.find((a) => a.id === q.get('approval')); if (ap?.topicId) setUI({ tab: 'chat' }); }
    if (q.toString()) history.replaceState(null, '', location.pathname);
  } catch (e) {
    set({ boot: 'error', error: e.message });
  }
}

// First successful refresh (after boot, login or setup) opens the live connection.
// Demo: the agent then proactively continues the story.
const origRefresh = api.refresh;
api.refresh = async () => { const b = await origRefresh(); if (!window.__covoConnected) { window.__covoConnected = true; api.connect(); registerSW(); if (b.provider === 'demo') api.post('/api/demo/start').catch(() => {}); } return b; };
