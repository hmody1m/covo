import { useState, useEffect } from '../vendor/preact-htm.js';

// Global app state with a tiny subscription hook. Updates are batched per frame.
export const store = {
  s: {
    boot: 'loading', // loading | setup | login | ready | error
    error: '',
    settings: null, provider: 'demo', agentState: 'idle', online: true, version: '',
    feed: [], topics: [], tasks: [], artifacts: [], approvals: [], memory: [], routines: [],
    devices: [], mcp: [], usage: null, suggestions: [], emailConfigured: false, vapidKey: '', categories: {}, presets: {}, server: {},
    ui: {
      tab: 'chat', drawer: false, profile: false, settings: null, viewer: null, task: null,
      topicFilter: null, toasts: [], voice: false, panel: 'overview', layout: 'mobile', search: '', legal: null, msgMenu: null,
    },
  },
};

const listeners = new Set();
let scheduled = false;
let version = 0; // bumps on every change
function flush() {
  if (!scheduled) return;
  scheduled = false;
  for (const l of [...listeners]) l();
}
// Batch to the next frame; the timer fallback keeps state flowing in background tabs
// (where requestAnimationFrame is paused).
function notify() {
  version++;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
  setTimeout(flush, 40);
}

export function set(patch) { Object.assign(store.s, typeof patch === 'function' ? patch(store.s) : patch); notify(); }
export function setUI(patch) { store.s.ui = { ...store.s.ui, ...(typeof patch === 'function' ? patch(store.s.ui) : patch) }; notify(); }
export function mutate(fn) { fn(store.s); notify(); }
export const get = () => store.s;

export function useStore(selector = (s) => s) {
  const [, force] = useState(0);
  const seen = version;
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    // Changes that happened between render and subscription would otherwise be missed.
    if (version !== seen) l();
    return () => listeners.delete(l);
  }, []);
  return selector(store.s);
}

// helpers
export function upsert(list, item, key = 'id') {
  const i = list.findIndex((x) => x[key] === item[key]);
  if (i >= 0) { const copy = list.slice(); copy[i] = { ...list[i], ...item }; return copy; }
  return [...list, item];
}

let toastId = 0;
export function toast(t) {
  const id = ++toastId;
  setUI((u) => ({ toasts: [...u.toasts.slice(-2), { id, ...t }] }));
  setTimeout(() => setUI((u) => ({ toasts: u.toasts.filter((x) => x.id !== id) })), t.ms || 4500);
}
