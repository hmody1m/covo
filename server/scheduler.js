import { db } from './db.js';
import { getSettings } from './config.js';
import { log } from './util.js';
import { runRoutine, expireApprovals } from './agent/core.js';

// Fires routines at their HH:MM in the user's timezone and expires stale approvals.
function localParts(tz) {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { hm: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`, dow, day: `${parts.year}-${parts.month}-${parts.day}` };
}

function tick() {
  try {
    const tz = getSettings().profile.timezone;
    const { hm, dow, day } = localParts(tz);
    for (const r of db.data.routines) {
      if (!r.enabled || r.time !== hm) continue;
      if (r.days && r.days.length && !r.days.includes(dow)) continue;
      const key = `${day} ${hm}`;
      if (r.lastKey === key) continue;
      r.lastKey = key;
      log.info(`routine fired: ${r.title}`);
      runRoutine(r);
    }
    expireApprovals();
  } catch (e) {
    log.error('scheduler', e);
  }
}

export function startScheduler() {
  setInterval(tick, 15_000);
  tick();
}
