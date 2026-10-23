import { api } from './api.js';
import { get } from './store.js';

// Service worker + Web Push subscription (lock-screen notifications on phones/desktops).
export async function registerSW() {
  // Android app (CovoApp): files are served by the app itself, and a WebView has no Web Push.
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || /CovoApp/.test(navigator.userAgent)) return null;
  try { return await navigator.serviceWorker.register('./sw.js', { scope: './' }); } catch { return null; }
}

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
}

export async function enablePush() {
  if (window.covoDesktop) return true; // desktop app: native notifications from the app itself
  if (/CovoApp/.test(navigator.userAgent)) throw new Error('The Android app shows alerts while it is open. For alerts when it is closed, use ntfy (below) or Telegram (Settings → Tools & connectors).');
  if (!('Notification' in window)) throw new Error('This browser does not support notifications. On iPhone, add the app to your Home Screen first.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission was not granted.');
  if (api.isLocal()) return true; // browser edition: local notifications only
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  if (!reg || !('pushManager' in reg)) throw new Error('Push is not available here (needs HTTPS).');
  const key = get().vapidKey || (await api.get('/api/push/key')).key;
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe().catch(() => {});
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api.post('/api/push/subscribe', sub.toJSON());
  return true;
}
