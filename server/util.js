import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader (no dependency). Existing env vars win.
export function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadDotEnv();

export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const d of ['uploads', 'artifacts', 'backups']) fs.mkdirSync(path.join(DATA_DIR, d), { recursive: true });

export const id = (prefix = '') => prefix + crypto.randomBytes(8).toString('hex');
export const now = () => Date.now();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function deepMerge(target, src) {
  if (!src || typeof src !== 'object') return target;
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

export function writeJsonAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function truncate(s, n = 4000) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + `\n…[truncated ${s.length - n} chars]` : s;
}

export function fmtTime(ts, tz, locale = 'en-US') {
  try {
    return new Date(ts).toLocaleString(locale, { timeZone: tz || undefined, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return new Date(ts).toString();
  }
}

// Ring-buffer logger that the Developer settings page can read.
const LOG_MAX = 500;
const logs = [];
export const log = {
  _push(level, args) {
    const line = { ts: Date.now(), level, msg: args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ') };
    logs.push(line);
    if (logs.length > LOG_MAX) logs.shift();
    const out = `[${new Date(line.ts).toISOString()}] ${level.toUpperCase()} ${line.msg}`;
    (level === 'error' ? console.error : console.log)(out);
  },
  info: (...a) => log._push('info', a),
  warn: (...a) => log._push('warn', a),
  error: (...a) => log._push('error', a),
  debug: (...a) => { if (process.env.DEBUG) log._push('debug', a); },
  all: () => logs.slice(),
};
