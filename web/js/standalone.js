// Transport for the standalone browser edition: requests go straight to the
// Covo server core running inside this page (js/local/covo-local.js, built by
// scripts/build-web.mjs), and live events come from its in-page event bus.
const SETUP_KEY = 'covo:setup';

export async function localTransport() {
  const mod = await import('./local/covo-local.js');
  const srv = await mod.boot();
  const B = globalThis.Buffer;

  const reply = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  async function dispatch(method, path, body, headers = {}) {
    const url = new URL(path, 'http://local');
    // There is no login on a personal device: auth endpoints are answered locally.
    if (url.pathname === '/api/auth/status') return reply(200, { setup: localStorage.getItem(SETUP_KEY) === '1', authed: true, version: srv.bootstrap().version, appName: srv.config.getSettings().agent.name, standalone: true });
    if (url.pathname === '/api/auth/setup') {
      const b = typeof body === 'string' ? JSON.parse(body) : body || {};
      const patch = { profile: { name: (b.name || '').trim() } };
      if (b.language) patch.profile.language = b.language;
      if (b.timezone) patch.profile.timezone = b.timezone;
      if (b.theme) patch.appearance = { theme: b.theme };
      srv.config.updateSettings(patch);
      localStorage.setItem(SETUP_KEY, '1');
      return reply(200, { ok: true });
    }
    if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/logout') return reply(200, { ok: true });

    const m = srv.router.match(method, url.pathname);
    if (!m) return reply(404, { error: 'Not available in the browser edition' });
    let bytes;
    if (body === undefined || body === null) bytes = B.alloc(0);
    else if (body instanceof Blob) bytes = B.from(await body.arrayBuffer());
    else if (body instanceof ArrayBuffer) bytes = B.from(body);
    else bytes = B.from(typeof body === 'string' ? body : JSON.stringify(body));

    const listeners = {};
    const req = {
      method, url: url.pathname + url.search, socket: { remoteAddress: 'local' },
      headers: { host: location.host, 'user-agent': navigator.userAgent, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) },
      on(ev, cb) { (listeners[ev] ||= []).push(cb); return req; },
      destroy() {},
    };
    let finish;
    const done = new Promise((r) => (finish = r));
    const res = {
      headersSent: false, statusCode: 200, _h: {},
      setHeader(k, v) { this._h[k.toLowerCase()] = v; },
      writeHead(s, h = {}) { this.statusCode = s; for (const [k, v] of Object.entries(h)) this._h[k.toLowerCase()] = v; this.headersSent = true; },
      end(b) { finish({ status: this.statusCode, headers: this._h, body: b }); },
    };
    const run = Promise.resolve().then(() => m.route.handler(req, res, m.params));
    setTimeout(() => { (listeners.data || []).forEach((cb) => cb(bytes)); (listeners.end || []).forEach((cb) => cb()); }, 0);
    try { await run; } catch (e) { return reply(e.status || 500, { error: e.message || 'Error' }); }
    return done;
  }

  const decode = (r) => {
    const ct = r.headers['content-type'] || '';
    const text = typeof r.body === 'string' ? r.body : r.body ? new TextDecoder().decode(r.body) : '';
    return ct.includes('json') && text ? JSON.parse(text) : text;
  };

  return {
    static: true,
    local: true,
    async request(method, path, body, opts = {}) {
      const r = await dispatch(method, path, body, opts.headers);
      const data = decode(r);
      if (r.status >= 400) throw Object.assign(new Error(data?.error || `Error ${r.status}`), { status: r.status });
      return data;
    },
    async raw(method, path) {
      const r = await dispatch(method, path);
      const cd = r.headers['content-disposition'] || '';
      return { body: r.body, type: r.headers['content-type'] || 'application/octet-stream', filename: (cd.match(/filename="([^"]+)"/) || [])[1] };
    },
    connect(onEvent) {
      const h = (evt) => onEvent(evt);
      srv.bus.on('client', h);
      return () => srv.bus.off('client', h);
    },
    fileUrl: (file) => srv.fileUrl(file),
  };
}

// Android app / browser: optionally open a Covo server instead of the local edition.
export const SERVER_KEY = 'covo:serverUrl';
export async function maybeOpenServer() {
  const q = new URLSearchParams(location.search);
  if (q.get('disconnect')) { localStorage.removeItem(SERVER_KEY); history.replaceState(null, '', location.pathname); return false; }
  const saved = localStorage.getItem(SERVER_KEY);
  if (!saved) return false;
  try {
    await Promise.race([fetch(saved.replace(/\/$/, '') + '/api/auth/status', { mode: 'no-cors' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    location.replace(saved);
    return true;
  } catch {
    sessionStorage.setItem('covo:serverUnreachable', saved);
    return false;
  }
}
