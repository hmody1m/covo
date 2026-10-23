import crypto from 'node:crypto';
import path from 'node:path';
import { DATA_DIR, id, now, readJson, writeJsonAtomic } from './util.js';
import { getSettings } from './config.js';

// Owner account, browser sessions, API tokens (for external integrations) and
// device tokens (for remote device runners). Stored in data/auth.json.
const FILE = path.join(DATA_DIR, 'auth.json');
const auth = Object.assign({ passwordHash: '', salt: '', localSetup: false, sessions: [], apiTokens: [], deviceTokens: [] }, readJson(FILE, {}));
const persist = () => writeJsonAtomic(FILE, auth);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');

export const isSetup = () => !!auth.passwordHash || !!auth.localSetup;
export const hasPassword = () => !!auth.passwordHash;
// Desktop app: set up without a password (the app window signs itself in).
export function markLocalSetup() { auth.localSetup = true; persist(); }

export function setPassword(pw) {
  if (!pw || pw.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  auth.salt = crypto.randomBytes(16).toString('hex');
  auth.passwordHash = scrypt(pw, auth.salt);
  auth.sessions = []; // sign everyone out
  persist();
}

export function checkPassword(pw) {
  if (!auth.passwordHash) return false;
  const a = Buffer.from(scrypt(pw || '', auth.salt), 'hex');
  const b = Buffer.from(auth.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- login rate limiting (per IP) ---
const attempts = new Map();
export function rateLimited(ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  return a.until > now();
}
export function noteFailure(ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) { a.until = now() + 60_000 * Math.min(15, a.n - 4); }
  attempts.set(ip, a);
}
export function noteSuccess(ip) { attempts.delete(ip); }

// --- sessions ---
export function createSession(ua = '', { desktop = false } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  auth.sessions.push({ id: id('s_'), tokenHash: sha(token), createdAt: now(), lastSeen: now(), ua: String(ua).slice(0, 160), ...(desktop ? { desktop: true } : {}) });
  persist();
  return token;
}
export function sessionFromToken(token) {
  if (!token) return null;
  const h = sha(token);
  const s = auth.sessions.find((x) => x.tokenHash === h);
  if (!s) return null;
  const maxAge = (getSettings().security.sessionDays || 30) * 86400_000;
  if (now() - s.lastSeen > maxAge) { revokeSession(s.id); return null; }
  if (now() - s.lastSeen > 60_000) { s.lastSeen = now(); persist(); }
  return s;
}
export function revokeSession(sid) {
  auth.sessions = auth.sessions.filter((s) => s.id !== sid);
  persist();
}
export function revokeAllSessions(exceptId) {
  auth.sessions = auth.sessions.filter((s) => s.id === exceptId);
  persist();
}
export const listSessions = () => auth.sessions.map(({ tokenHash, ...s }) => s);

// --- API tokens (Bearer) for connecting external apps/scripts ---
export function createApiToken(name) {
  const token = 'covo_' + crypto.randomBytes(24).toString('base64url');
  const t = { id: id('tok_'), name: name || 'API token', tokenHash: sha(token), createdAt: now(), lastUsed: null };
  auth.apiTokens.push(t);
  persist();
  return { ...publicToken(t), token };
}
const publicToken = ({ tokenHash, ...t }) => t;
export const listApiTokens = () => auth.apiTokens.map(publicToken);
export function revokeApiToken(tid) { auth.apiTokens = auth.apiTokens.filter((t) => t.id !== tid); persist(); }
export function apiTokenValid(token) {
  if (!token) return false;
  const h = sha(token);
  const t = auth.apiTokens.find((x) => x.tokenHash === h);
  if (t) { t.lastUsed = now(); persist(); }
  return !!t;
}

// --- device tokens (remote runners on your PC/phone/servers) ---
export function createDeviceToken(name) {
  const token = 'dev_' + crypto.randomBytes(24).toString('base64url');
  const d = { id: id('d_'), name: name || 'My computer', tokenHash: sha(token), createdAt: now() };
  auth.deviceTokens.push(d);
  persist();
  return { id: d.id, name: d.name, token };
}
export function deviceFromToken(token) {
  if (!token) return null;
  const h = sha(token);
  return auth.deviceTokens.find((d) => d.tokenHash === h) || null;
}
export function listDeviceTokens() { return auth.deviceTokens.map(({ tokenHash, ...d }) => d); }
export function revokeDeviceToken(did) { auth.deviceTokens = auth.deviceTokens.filter((d) => d.id !== did); persist(); }
export function renameDevice(did, name) { const d = auth.deviceTokens.find((x) => x.id === did); if (d) { d.name = name; persist(); } }
