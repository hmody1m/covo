import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { ROOT, log } from './util.js';
import { serveStatic, send, parseCookies } from './http.js';
import { router, authFromReq, VERSION } from './routes.js';
import { bus } from './bus.js';
import { deviceFromToken, sessionFromToken, apiTokenValid } from './auth.js';
import { attachDevice } from './devices.js';
import { reloadMcp } from './mcp.js';
import { startScheduler } from './scheduler.js';
import { startTelegram } from './integrations/telegram.js';
import { getState } from './agent/core.js';
import { getSettings, activeProvider } from './config.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const WEB = path.join(ROOT, 'web');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  try {
    const m = router.match(req.method, url.pathname);
    if (m) {
      if (!m.route.opts.public && !authFromReq(req)) return send(res, 401, { error: 'Not signed in' });
      return await m.route.handler(req, res, m.params);
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
    if (serveStatic(req, res, WEB, url.pathname)) return;
    // SPA fallback
    if (!path.extname(url.pathname)) return serveStatic(req, res, WEB, '/index.html');
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) log.error(`${req.method} ${url.pathname}`, e);
    send(res, status, { error: e.message || 'Server error' });
  }
});

// ── WebSockets: /ws for the app, /device for device runners ──
const wssApp = new WebSocketServer({ noServer: true });
const wssDevice = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/ws') {
    const ok = sessionFromToken(parseCookies(req).covo_session) || apiTokenValid(url.searchParams.get('token'));
    if (!ok) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
    wssApp.handleUpgrade(req, socket, head, (ws) => wssApp.emit('connection', ws, req));
  } else if (url.pathname === '/device') {
    const dev = deviceFromToken(url.searchParams.get('token'));
    wssDevice.handleUpgrade(req, socket, head, (ws) => {
      if (!dev) return ws.close(4401, 'bad token');
      attachDevice(dev, ws);
    });
  } else socket.destroy();
});

wssApp.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ type: 'hello', data: { state: getState(), version: VERSION, provider: activeProvider() } }));
});
bus.on('client', (evt) => {
  const msg = JSON.stringify(evt);
  for (const ws of wssApp.clients) if (ws.readyState === 1) ws.send(msg);
});
setInterval(() => {
  for (const ws of wssApp.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30_000);

server.listen(PORT, HOST, () => {
  const s = getSettings();
  log.info(`Covo v${VERSION} running → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (model: ${activeProvider()}, agent: ${s.agent.name})`);
  if (!fs.existsSync(path.join(ROOT, 'data', 'auth.json')) && !process.env.DATA_DIR) log.info('First run: open the URL above to create your password.');
});

startScheduler();
reloadMcp();
startTelegram();

const shutdown = () => { log.info('Shutting down…'); server.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => log.error('unhandledRejection', e));
