import path from 'node:path';
import webpush from 'web-push';
import { DATA_DIR, readJson, writeJsonAtomic, log } from './util.js';
import { db, save } from './db.js';
import { broadcast } from './bus.js';
import { getSettings } from './config.js';

// Notifications: in-app toast (always), Web Push to installed PWAs (phone lock screen),
// and optional ntfy.sh / self-hosted ntfy topic.
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let vapid = readJson(VAPID_FILE, null);
if (!vapid) {
  vapid = webpush.generateVAPIDKeys();
  writeJsonAtomic(VAPID_FILE, vapid);
}
webpush.setVapidDetails('mailto:owner@covo.local', vapid.publicKey, vapid.privateKey);

export const vapidPublicKey = () => vapid.publicKey;

export function addPushSub(sub, ua = '') {
  if (!sub?.endpoint) return;
  db.data.pushSubs = db.data.pushSubs.filter((s) => s.endpoint !== sub.endpoint);
  db.data.pushSubs.push({ ...sub, ua: String(ua).slice(0, 120), createdAt: Date.now() });
  save();
}
export function removePushSub(endpoint) {
  db.data.pushSubs = db.data.pushSubs.filter((s) => s.endpoint !== endpoint);
  save();
}

function inQuietHours() {
  const q = getSettings().notifications.quietHours;
  if (!q?.enabled) return false;
  const tz = getSettings().profile.timezone;
  const hm = new Date().toLocaleTimeString('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hour12: false });
  return q.from < q.to ? hm >= q.from && hm < q.to : hm >= q.from || hm < q.to;
}

// kind: approval | task | brief | info
export async function notify({ title, body, url = '/', tag, kind = 'info', urgent = false }) {
  const s = getSettings().notifications;
  broadcast('toast', { title, body, url, kind });
  if (kind === 'approval' && !s.notifyApprovals) return;
  if (kind === 'task' && !s.notifyTasks) return;
  if (kind === 'brief' && !s.notifyBrief) return;
  if (inQuietHours() && !urgent) return;
  const appName = getSettings().agent.name || 'Covo';
  const payload = JSON.stringify({ title: title || appName, body, url, tag: tag || kind, app: appName });
  if (s.webPush) {
    for (const sub of [...db.data.pushSubs]) {
      try { await webpush.sendNotification(sub, payload, { TTL: 3600 }); }
      catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) removePushSub(sub.endpoint);
        else log.warn('web push failed', e.message);
      }
    }
  }
  if (s.ntfyUrl) {
    try {
      await fetch(s.ntfyUrl, { method: 'POST', body: body || '', headers: { Title: encodeURIComponent(title || appName), Tags: kind, Priority: urgent ? 'high' : 'default' } });
    } catch (e) { log.warn('ntfy failed', e.message); }
  }
}
