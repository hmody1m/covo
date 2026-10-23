import { spawn } from 'node:child_process';
import { log } from './util.js';
import { getSettings } from './config.js';
import { broadcast } from './bus.js';

// Minimal Model Context Protocol client. Supports stdio servers (command + args)
// and Streamable HTTP servers (url). Configure in Settings → Tools & connectors → MCP.
const PROTOCOL = '2025-06-18';
const servers = new Map(); // id -> { cfg, status, error, tools, call(name,args) , close() }

function stdioClient(cfg) {
  const isWin = process.platform === 'win32';
  const child = spawn(cfg.command, cfg.args || [], { env: { ...process.env, ...(cfg.env || {}) }, shell: isWin, windowsHide: true });
  let buf = '';
  let nextId = 1;
  const pending = new Map();
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message || 'MCP error')) : p.resolve(msg.result);
      }
    }
  });
  child.stderr.on('data', (d) => log.debug(`[mcp:${cfg.name}]`, String(d).trim()));
  const exited = new Promise((r) => child.on('exit', r));
  const request = (method, params, timeout = 60_000) => new Promise((resolve, reject) => {
    const mid = nextId++;
    const timer = setTimeout(() => { pending.delete(mid); reject(new Error(`MCP ${method} timed out`)); }, timeout);
    pending.set(mid, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mid, method, params }) + '\n');
  });
  const notifyMsg = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  child.on('error', (e) => { for (const p of pending.values()) p.reject(e); pending.clear(); });
  return { request, notify: notifyMsg, close: () => { try { child.kill(); } catch {} }, exited };
}

function httpClient(cfg) {
  let sessionId = null;
  let nextId = 1;
  const post = async (body) => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(cfg.headers || {}) };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const res = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) sessionId = sid;
    if (res.status === 202) return null;
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`);
    if (ct.includes('text/event-stream')) {
      const datas = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
      for (const d of datas) { try { const m = JSON.parse(d); if (m.id === body.id) return m; } catch {} }
      return null;
    }
    return text ? JSON.parse(text) : null;
  };
  return {
    request: async (method, params) => {
      const m = await post({ jsonrpc: '2.0', id: nextId++, method, params });
      if (m?.error) throw new Error(m.error.message || 'MCP error');
      return m?.result;
    },
    notify: (method, params) => post({ jsonrpc: '2.0', method, params }).catch(() => {}),
    close: () => {},
    exited: new Promise(() => {}),
  };
}

async function start(cfg) {
  const entry = { cfg, status: 'starting', error: '', tools: [] };
  servers.set(cfg.id, entry);
  emit();
  try {
    const client = cfg.url ? httpClient(cfg) : stdioClient(cfg);
    entry.client = client;
    await client.request('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'covo', version: '1.0.0' } });
    client.notify('notifications/initialized', {});
    const res = await client.request('tools/list', {});
    entry.tools = (res?.tools || []).map((t) => ({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || { type: 'object', properties: {} } }));
    entry.status = 'ready';
    client.exited.then(() => { if (servers.get(cfg.id) === entry) { entry.status = 'stopped'; emit(); } });
    log.info(`MCP "${cfg.name}" ready with ${entry.tools.length} tools`);
  } catch (e) {
    entry.status = 'error';
    entry.error = e.message;
    log.warn(`MCP "${cfg.name}" failed: ${e.message}`);
  }
  emit();
}

export async function reloadMcp() {
  for (const s of servers.values()) s.client?.close();
  servers.clear();
  const list = (getSettings().tools.mcpServers || []).filter((s) => s.enabled !== false && (s.command || s.url));
  await Promise.all(list.map(start));
}

function emit() { broadcast('mcp', mcpStatus()); }

export function mcpStatus() {
  return [...servers.values()].map((s) => ({ id: s.cfg.id, name: s.cfg.name, status: s.status, error: s.error, tools: s.tools.map((t) => t.name) }));
}

const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

// Tools exposed to the agent: mcp__<server>__<tool>
export function mcpTools() {
  const out = [];
  for (const s of servers.values()) {
    if (s.status !== 'ready') continue;
    for (const t of s.tools) {
      out.push({
        name: `mcp__${safe(s.cfg.name)}__${safe(t.name)}`.slice(0, 64),
        description: `[${s.cfg.name}] ${t.description}`.slice(0, 1000),
        input_schema: t.inputSchema?.type === 'object' ? t.inputSchema : { type: 'object', properties: {} },
        category: s.cfg.trusted ? 'auto' : 'mcp',
        run: async (input) => {
          const r = await s.client.request('tools/call', { name: t.name, arguments: input || {} }, 180_000);
          const blocks = [];
          for (const c of r?.content || []) {
            if (c.type === 'text') blocks.push({ type: 'text', text: c.text });
            else if (c.type === 'image') blocks.push({ type: 'image', source: { type: 'base64', media_type: c.mimeType, data: c.data } });
            else blocks.push({ type: 'text', text: JSON.stringify(c).slice(0, 4000) });
          }
          if (r?.structuredContent && !blocks.length) blocks.push({ type: 'text', text: JSON.stringify(r.structuredContent) });
          return { blocks: blocks.length ? blocks : [{ type: 'text', text: '(no content)' }], isError: !!r?.isError };
        },
      });
    }
  }
  return out;
}
