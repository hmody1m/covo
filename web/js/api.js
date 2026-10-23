import { store, set, setUI, mutate, upsert, toast } from './store.js';

// REST + WebSocket client. In the static preview build a mock transport
// (mock.js) replaces the network so the whole UI runs without a server.
let transport = null;

const http = {
  async request(method, path, body, opts = {}) {
    const headers = {};
    let payload = body;
    if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    Object.assign(headers, opts.headers || {});
    const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
      if (res.status === 401 && !path.startsWith('/api/auth')) set({ boot: 'login' });
      throw Object.assign(new Error((data && data.error) || res.statusText), { status: res.status });
    }
    return data;
  },
  connect(onEvent) {
    let ws, retry = 800, closed = false;
    const open = () => {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      ws.onopen = () => { retry = 800; set({ online: true }); };
      ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch {} };
      ws.onclose = () => {
        if (closed) return;
        set({ online: false });
        setTimeout(() => { if (!closed) { open(); api.refresh().catch(() => {}); } }, retry);
        retry = Math.min(retry * 1.7, 10000);
      };
    };
    open();
    return () => { closed = true; ws?.close(); };
  },
};

export function useTransport(t) { transport = t; }
const T = () => transport || http;

export const api = {
  get: (p) => T().request('GET', p),
  post: (p, b) => T().request('POST', p, b ?? {}),
  put: (p, b) => T().request('PUT', p, b),
  patch: (p, b) => T().request('PATCH', p, b),
  del: (p) => T().request('DELETE', p),
  upload: (file) => T().request('POST', '/api/uploads', file, { headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) } }),
  raw: (method, p) => T().raw(method, p),
  isLocal: () => !!transport?.local,
  isStatic: () => !!transport?.static,
  // URL for an uploaded file (server: /uploads/…, standalone: blob URL from local storage).
  fileUrl: (a) => a.url && !a.url.startsWith('/uploads/') ? a.url : transport?.fileUrl ? transport.fileUrl(a.file) : `/uploads/${encodeURIComponent(a.file)}`,

  async refresh() {
    const b = await api.get('/api/bootstrap');
    set({
      settings: b.settings, provider: b.provider, agentState: b.state, version: b.version,
      feed: b.feed, topics: b.topics, tasks: b.tasks, artifacts: b.artifacts, approvals: b.approvals,
      memory: b.memory, routines: b.routines, devices: b.devices, mcp: b.mcp, usage: b.usage,
      suggestions: b.suggestions || [], emailConfigured: b.emailConfigured, vapidKey: b.vapidKey,
      categories: b.categories, presets: b.presets, server: b.server, integrations: b.integrations || {}, boot: 'ready',
    });
    return b;
  },

  connect() { return T().connect(handleEvent); },
};

let deltaBuf = new Map();
let deltaTimer = null;
function flushDeltas() {
  deltaTimer = null;
  if (!deltaBuf.size) return;
  const buf = deltaBuf;
  deltaBuf = new Map();
  mutate((s) => {
    s.feed = s.feed.map((f) => (buf.has(f.id) ? { ...f, text: (f.text || '') + buf.get(f.id) } : f));
  });
}

function handleEvent({ type, data }) {
  switch (type) {
    case 'hello': set({ agentState: data.state, provider: data.provider }); break;
    case 'feed.add': flushDeltas(); mutate((s) => { if (!s.feed.some((f) => f.id === data.id)) s.feed = [...s.feed, data]; }); break;
    case 'feed.update': flushDeltas(); mutate((s) => { s.feed = upsert(s.feed, data); }); break;
    case 'feed.delta':
      deltaBuf.set(data.id, (deltaBuf.get(data.id) || '') + data.delta);
      if (!deltaTimer) deltaTimer = setTimeout(flushDeltas, 50);
      break;
    case 'feed.remove': mutate((s) => { s.feed = s.feed.filter((f) => f.id !== data.id); }); break;
    case 'topic.add': case 'topic.update': mutate((s) => { s.topics = upsert(s.topics, data); }); break;
    case 'task.upsert': mutate((s) => { const i = s.tasks.findIndex((t) => t.id === data.id); s.tasks = i >= 0 ? s.tasks.map((t) => (t.id === data.id ? data : t)) : [data, ...s.tasks]; }); break;
    case 'task.remove': mutate((s) => { s.tasks = s.tasks.filter((t) => t.id !== data.id); }); break;
    case 'task.state': mutate((s) => { s.tasks = s.tasks.map((t) => (t.id === data.id ? { ...t, liveState: data.state } : t)); }); break;
    case 'artifact.upsert': mutate((s) => { const i = s.artifacts.findIndex((a) => a.id === data.id); s.artifacts = i >= 0 ? s.artifacts.map((a) => (a.id === data.id ? data : a)) : [data, ...s.artifacts]; }); break;
    case 'artifact.remove': mutate((s) => { s.artifacts = s.artifacts.filter((a) => a.id !== data.id); }); break;
    case 'approval.upsert': mutate((s) => { s.approvals = upsert(s.approvals, data); }); break;
    case 'memory': set({ memory: data }); break;
    case 'routines': set({ routines: data }); break;
    case 'devices': set({ devices: data }); break;
    case 'mcp': set({ mcp: data }); break;
    case 'integrations': set({ integrations: data }); break;
    case 'usage': set({ usage: data }); break;
    case 'agent.state': set({ agentState: data.state }); break;
    case 'suggestions': set({ suggestions: data }); break;
    case 'provider': set({ provider: data }); break;
    case 'settings.changed': set({ settings: data }); break;
    case 'toast': {
      // In-app notification banner (lock-screen style card).
      const visible = document.visibilityState === 'visible';
      if (visible && data.kind !== 'info') toast({ title: data.title, body: data.body, url: data.url });
      // Desktop app: native notification when the window is hidden, minimized or in the background.
      if (window.covoDesktop && (!visible || !document.hasFocus())) { window.covoDesktop.notify({ title: data.title || 'Covo', body: data.body || '', url: data.url || '' }); break; }
      // Browser edition has no push server: show a local system notification while the app is in the background.
      if (!visible && transport?.local && 'Notification' in window && Notification.permission === 'granted') {
        const opts = { body: data.body || '', icon: './icons/icon-192.png', tag: data.kind };
        navigator.serviceWorker?.getRegistration().then((r) => (r ? r.showNotification(data.title || 'Covo', opts) : new Notification(data.title || 'Covo', opts))).catch(() => {});
      }
      break;
    }
    case 'reload': api.refresh().catch(() => {}); break;
  }
}

export { store };
