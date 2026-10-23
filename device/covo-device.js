#!/usr/bin/env node
// Covo device runner — lets your Covo server (local or VPS) use THIS computer.
//
//   node covo-device.js --server https://covo.example.com --token dev_xxx [--name "Office PC"] [--workdir C:\Users\me]
//
// or set COVO_SERVER / COVO_DEVICE_TOKEN / COVO_DEVICE_NAME / COVO_WORKDIR env vars.
// Get a token from the app: Settings → Devices → Pair a device.
// Every sensitive action is still approved by you in the app (see Settings → Agent → Approvals).
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execDeviceTool, systemInfo } from './tools.js';

let WebSocket;
try { ({ default: WebSocket } = await import('ws')); }
catch { console.error('Missing dependency "ws". Run: npm install   (inside the device folder)'); process.exit(1); }

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));

// Optional config file next to the script
const cfgFile = path.join(here, 'device.config.json');
const fileCfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};

const SERVER = (args.server || process.env.COVO_SERVER || fileCfg.server || 'http://localhost:8787').replace(/\/$/, '');
const TOKEN = args.token || process.env.COVO_DEVICE_TOKEN || fileCfg.token;
const NAME = args.name || process.env.COVO_DEVICE_NAME || fileCfg.name || os.hostname();
const WORKDIR = args.workdir || process.env.COVO_WORKDIR || fileCfg.workdir || os.homedir();
const ALLOW = new Set((args.allow || process.env.COVO_ALLOW || fileCfg.allow || 'run_command,read_file,write_file,list_dir,system_info,open,screenshot,desktop_notify').split(','));
const BLOCKED = fileCfg.blockedCommands || ['rm -rf /', 'mkfs', 'format c:', 'shutdown'];

if (!TOKEN) {
  console.error('No device token. Create one in the app: Settings → Devices → Pair a device, then run:\n  node covo-device.js --server ' + SERVER + ' --token dev_...');
  process.exit(1);
}

const wsUrl = SERVER.replace(/^http/, 'ws') + '/device?token=' + encodeURIComponent(TOKEN);
let backoff = 1000;

function connect() {
  console.log(`[covo-device] connecting to ${SERVER} as "${NAME}"…`);
  const ws = new WebSocket(wsUrl);
  let ping;
  ws.on('open', () => {
    backoff = 1000;
    console.log('[covo-device] connected ✔  (Ctrl+C to stop)');
    ws.send(JSON.stringify({ type: 'hello', name: NAME, info: systemInfo(), tools: [...ALLOW], workdir: WORKDIR }));
    ping = setInterval(() => { try { ws.send(JSON.stringify({ type: 'ping' })); } catch {} }, 25_000);
  });
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== 'call') return;
    const { callId, tool, input } = msg;
    console.log(`[covo-device] ▶ ${tool} ${JSON.stringify(input).slice(0, 160)}`);
    try {
      if (!ALLOW.has(tool)) throw new Error(`Tool "${tool}" is disabled on this device`);
      const result = await execDeviceTool(tool, input, { workDir: WORKDIR, blockedCommands: BLOCKED });
      ws.send(JSON.stringify({ type: 'result', callId, ok: true, result }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'result', callId, ok: false, error: e.message }));
    }
  });
  ws.on('close', (code) => {
    clearInterval(ping);
    if (code === 4401) { console.error('[covo-device] token rejected. Pair again from Settings → Devices.'); process.exit(1); }
    console.log(`[covo-device] disconnected (${code}). Reconnecting in ${Math.round(backoff / 1000)}s…`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  });
  ws.on('error', (e) => console.error('[covo-device]', e.message));
}
connect();
