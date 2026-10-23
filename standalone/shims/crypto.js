import { Buffer } from 'buffer';
import { hash as sha256, pbkdf2 } from 'fast-sha256';

export function randomBytes(n) { const b = Buffer.alloc(n); globalThis.crypto.getRandomValues(b); return b; }
export function createHash() {
  const parts = [];
  return {
    update(d) { parts.push(Buffer.from(d)); return this; },
    digest(enc) { const h = Buffer.from(sha256(Buffer.concat(parts))); return enc ? h.toString(enc) : h; },
  };
}
// The browser edition has no server password; PBKDF2-SHA256 stands in for scrypt.
export function scryptSync(pw, salt, len) { return Buffer.from(pbkdf2(Buffer.from(String(pw)), Buffer.from(String(salt)), 20000, len)); }
export function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; }
export default { randomBytes, createHash, scryptSync, timingSafeEqual };
