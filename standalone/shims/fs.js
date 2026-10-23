// In-memory file system persisted to IndexedDB, so the unmodified server code
// (config.js, db.js, artifacts, uploads…) runs inside the browser.
import { Buffer } from 'buffer';

const files = new Map(); // path -> Uint8Array | string
const dirs = new Set(['/']);
const dirty = new Set();
const removed = new Set();
let dbp = null;
let timer = null;

const norm = (p) => ('/' + String(p).replace(/\\/g, '/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
const parent = (p) => p.slice(0, p.lastIndexOf('/')) || '/';

function idb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open('covo-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

export async function fsReady() {
  try {
    const db = await idb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        files.set(c.key, c.value);
        let d = parent(c.key);
        while (d !== '/') { dirs.add(d); d = parent(d); }
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Storage unavailable, running in memory only:', e);
  }
  addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());
}

function schedule() { clearTimeout(timer); timer = setTimeout(flushNow, 300); }
export async function flushNow() {
  clearTimeout(timer);
  if (!dirty.size && !removed.size) return;
  const put = [...dirty]; const del = [...removed];
  dirty.clear(); removed.clear();
  try {
    const db = await idb();
    const tx = db.transaction('files', 'readwrite');
    const st = tx.objectStore('files');
    for (const p of put) if (files.has(p)) st.put(files.get(p), p);
    for (const p of del) st.delete(p);
  } catch (e) { console.warn('Could not persist', e); }
}

const toStore = (data) => (typeof data === 'string' ? data : new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data));
const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });

export function existsSync(p) { p = norm(p); return files.has(p) || dirs.has(p); }
export function mkdirSync(p) { p = norm(p); while (p !== '/') { dirs.add(p); p = parent(p); } }
export function readFileSync(p, enc) {
  p = norm(p);
  if (!files.has(p)) throw enoent(p);
  const v = files.get(p);
  const encoding = typeof enc === 'string' ? enc : enc?.encoding;
  if (typeof v === 'string') return encoding ? v : Buffer.from(v, 'utf8');
  const b = Buffer.from(v);
  return encoding ? b.toString(encoding) : b;
}
export function writeFileSync(p, data) { p = norm(p); mkdirSync(parent(p)); files.set(p, toStore(data)); dirty.add(p); removed.delete(p); schedule(); }
export function appendFileSync(p, data) { const prev = existsSync(p) ? readFileSync(p, 'utf8') : ''; writeFileSync(p, prev + (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'))); }
export function renameSync(a, b) { a = norm(a); b = norm(b); if (!files.has(a)) throw enoent(a); files.set(b, files.get(a)); files.delete(a); dirty.add(b); dirty.delete(a); removed.add(a); removed.delete(b); schedule(); }
export function rmSync(p) {
  p = norm(p);
  for (const k of [...files.keys()]) if (k === p || k.startsWith(p + '/')) { files.delete(k); dirty.delete(k); removed.add(k); }
  for (const d of [...dirs]) if (d === p || d.startsWith(p + '/')) dirs.delete(d);
  schedule();
}
export const unlinkSync = rmSync;
export function statSync(p) {
  p = norm(p);
  if (files.has(p)) { const v = files.get(p); return { size: typeof v === 'string' ? v.length : v.byteLength, isDirectory: () => false, isFile: () => true, mtimeMs: Date.now() }; }
  if (dirs.has(p)) return { size: 0, isDirectory: () => true, isFile: () => false, mtimeMs: Date.now() };
  throw enoent(p);
}
export function readdirSync(p, opts) {
  p = norm(p);
  const names = new Map();
  const pre = p === '/' ? '/' : p + '/';
  for (const k of files.keys()) if (k.startsWith(pre)) { const n = k.slice(pre.length).split('/')[0]; names.set(n, names.get(n) || k.slice(pre.length).includes('/')); }
  for (const d of dirs) if (d.startsWith(pre) && d !== p) names.set(d.slice(pre.length).split('/')[0], true);
  return [...names.entries()].map(([name, isDir]) => (opts?.withFileTypes ? { name, isDirectory: () => isDir, isFile: () => !isDir } : name));
}
export function createReadStream() { throw new Error('Not available in the browser edition'); }

// Blob URL for a stored file (used to show uploaded images).
const urlCache = new Map();
export function fileBlobUrl(p, type) {
  p = norm(p);
  if (urlCache.has(p)) return urlCache.get(p);
  if (!files.has(p)) return '';
  const v = files.get(p);
  const u = URL.createObjectURL(new Blob([v], { type: type || 'application/octet-stream' }));
  urlCache.set(p, u);
  return u;
}

export default { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, rmSync, unlinkSync, statSync, readdirSync, createReadStream };
