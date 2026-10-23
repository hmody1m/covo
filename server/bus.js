import { EventEmitter } from 'node:events';

// Internal event bus. Every event is also forwarded to connected browser clients
// (see ws.js), so the UI updates live: feed items, tasks, approvals, orb state…
export const bus = new EventEmitter();
bus.setMaxListeners(100);

export function broadcast(type, data) {
  bus.emit('client', { type, data });
}
