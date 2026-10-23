import { db } from '../db.js';
import { getSettings } from '../config.js';
import { listDevices } from '../devices.js';
import { fmtTime, truncate } from '../util.js';

// The <context> block prepended to every user turn / event. Keeping volatile state
// here (instead of in the system prompt) keeps the prompt cache warm.
export function buildContext() {
  const s = getSettings();
  const tz = s.profile.timezone;
  const L = [];
  L.push(`Now: ${fmtTime(Date.now(), tz)} (${tz || 'server time'})`);
  if (s.profile.name) L.push(`User: ${s.profile.name}`);

  const topics = [...db.data.topics].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 15);
  if (topics.length) L.push('Topics: ' + topics.map((t) => `${t.title} [${t.status}]`).join('; '));

  const tasks = db.data.tasks.filter((t) => !['done', 'cancelled'].includes(t.status) || Date.now() - t.updatedAt < 86400_000).slice(0, 15);
  if (tasks.length) {
    L.push('Tasks:');
    for (const t of tasks) L.push(`- ${t.id} "${t.title}" ${t.status}${t.progress ? ` ${t.progress.done}/${t.progress.total}` : ''}${t.note ? ` — ${truncate(t.note, 140)}` : ''}${t.question ? ` — waiting for answer: ${truncate(t.question, 160)}` : ''}`);
  }

  const pending = db.data.approvals.filter((a) => a.status === 'pending');
  if (pending.length) {
    L.push('Waiting for approval:');
    for (const a of pending) L.push(`- ${a.id} "${a.title}"${a.amount ? ` ${a.currency || 'USD'} ${a.amount}` : ''}${a.expiresAt ? ` (expires ${fmtTime(a.expiresAt, tz)})` : ''}`);
  }

  const drafts = db.data.feed.filter((f) => f.kind === 'email' && f.status === 'draft').slice(-5);
  if (drafts.length) L.push('Unsent email drafts: ' + drafts.map((d) => `"${d.draft.subject}" to ${d.draft.to}`).join('; '));

  const devices = listDevices().filter((d) => d.kind === 'runner' || d.enabled);
  L.push('Devices: ' + (devices.length ? devices.map((d) => `${d.id === 'server' ? 'server' : d.id} "${d.name}" ${d.online ? 'online' : 'offline'}${d.platform ? ` ${d.platform}` : ''}`).join('; ') : 'none (computer tools unavailable until a device is paired or server execution is enabled)'));

  const arts = db.data.artifacts.slice(0, 12);
  if (arts.length) L.push('Artifacts: ' + arts.map((a) => `${a.id} "${a.title}" (${a.kind} v${a.version})`).join('; '));

  const routines = db.data.routines.filter((r) => r.enabled);
  if (routines.length) L.push('Routines: ' + routines.map((r) => `${r.id} "${r.title}" at ${r.time}`).join('; '));

  if (db.data.memory.length) {
    L.push('Memory:');
    let used = 0;
    for (const m of [...db.data.memory].reverse()) {
      const line = `- ${m.id}: ${m.text}`;
      used += line.length;
      if (used > 6000) break;
      L.push(line);
    }
  }
  return `<context>\n${L.join('\n')}\n</context>`;
}
