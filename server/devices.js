import os from 'node:os';
import { id, now, log } from './util.js';
import { broadcast } from './bus.js';
import { listDeviceTokens } from './auth.js';
import { getSettings } from './config.js';
import { execDeviceTool, systemInfo } from '../device/tools.js';

// Live connections from device runners (device/covo-device.js).
const live = new Map(); // deviceId -> { ws, info, tools, workdir, connectedAt, lastSeen, pending: Map }

export function attachDevice(dev, ws) {
  const prev = live.get(dev.id);
  if (prev) try { prev.ws.close(4000, 'replaced'); } catch {}
  const entry = { ws, info: {}, tools: [], workdir: '', name: dev.name, connectedAt: now(), lastSeen: now(), pending: new Map() };
  live.set(dev.id, entry);
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    entry.lastSeen = now();
    if (msg.type === 'hello') {
      entry.info = msg.info || {};
      entry.tools = msg.tools || [];
      entry.workdir = msg.workdir || '';
      if (msg.name) entry.name = msg.name;
      log.info(`device connected: ${entry.name} (${entry.info.platform || '?'})`);
      broadcast('devices', listDevices());
    } else if (msg.type === 'result') {
      const p = entry.pending.get(msg.callId);
      if (p) { entry.pending.delete(msg.callId); clearTimeout(p.timer); msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error || 'Device error')); }
    }
  });
  ws.on('close', () => {
    if (live.get(dev.id) === entry) live.delete(dev.id);
    for (const p of entry.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Device disconnected')); }
    log.info(`device disconnected: ${entry.name}`);
    broadcast('devices', listDevices());
  });
}

export function disconnectDevice(did) {
  const e = live.get(did);
  if (e) try { e.ws.close(4401, 'revoked'); } catch {}
}

// In the desktop app the "server" is the user's own computer.
const DESKTOP = process.env.COVO_DESKTOP === '1';
const HERE = DESKTOP ? 'this computer' : 'this server';

export function listDevices() {
  const s = getSettings();
  const server = {
    id: 'server', name: `${os.hostname()} (${HERE})`, kind: 'server', online: true, desktop: DESKTOP,
    enabled: !!s.tools.serverExecution, platform: process.platform, info: systemInfo(), workdir: s.tools.workDir,
  };
  const paired = listDeviceTokens().map((d) => {
    const e = live.get(d.id);
    return { id: d.id, name: e?.name || d.name, kind: 'runner', online: !!e, enabled: true, platform: e?.info?.platform || '', info: e?.info || null, tools: e?.tools || [], workdir: e?.workdir || '', lastSeen: e?.lastSeen || null, createdAt: d.createdAt };
  });
  return [server, ...paired];
}

// Pick where a computer tool runs: explicit device > default setting > first online runner > server.
export function resolveTarget(requested) {
  const s = getSettings();
  const want = requested || s.devices.defaultTarget || 'auto';
  if (want === 'server') return s.tools.serverExecution ? 'server' : null;
  if (want !== 'auto') {
    if (live.has(want)) return want;
    const byName = [...live.entries()].find(([, e]) => e.name.toLowerCase() === String(want).toLowerCase());
    if (byName) return byName[0];
    return null;
  }
  const first = [...live.keys()][0];
  if (first) return first;
  return s.tools.serverExecution ? 'server' : null;
}

export async function runOnDevice(target, tool, input, timeoutMs = 180_000) {
  const s = getSettings();
  if (target === 'server') {
    return execDeviceTool(tool, input, { workDir: s.tools.workDir, blockedCommands: s.tools.blockedCommands });
  }
  const e = live.get(target);
  if (!e) throw new Error('Device is offline');
  if (e.tools.length && !e.tools.includes(tool)) throw new Error(`Tool ${tool} is disabled on device ${e.name}`);
  const callId = id('c_');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { e.pending.delete(callId); reject(new Error('Device call timed out')); }, timeoutMs);
    e.pending.set(callId, { resolve, reject, timer });
    e.ws.send(JSON.stringify({ type: 'call', callId, tool, input }));
  });
}

export function deviceName(target) {
  if (target === 'server') return HERE;
  return live.get(target)?.name || target;
}
