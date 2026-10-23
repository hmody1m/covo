import { db, save, addFeed, updateFeed, upsertTopic, setTopicStatus, saveArtifact, addApproval, upsertTask, resetDb } from '../db.js';
import { broadcast } from '../bus.js';
import { getSettings } from '../config.js';
import { id, now, sleep } from '../util.js';
import { createDemo } from '../../web/js/demo/engine.js';

// Server-side host for the scripted demo (web/js/demo/engine.js).
const meta = () => (db.data.meta ||= {});

const host = {
  addFeed: (item) => addFeed(item),
  updateFeed: (fid, patch) => updateFeed(fid, patch),
  upsertTopic: (t) => upsertTopic(t),
  setTopicStatus: (tid, s) => setTopicStatus(tid, s),
  saveArtifact: ({ ts, ...a }) => {
    const art = saveArtifact(a);
    if (ts) { art.updatedAt = ts; art.createdAt = ts; art.versions[art.versions.length - 1].ts = ts; save(); broadcast('artifact.upsert', art); }
    return art;
  },
  addApproval: (a) => addApproval(a),
  upsertTask: (t) => {
    if (!t.id && t.title) {
      const ex = db.data.tasks.find((x) => x.title === t.title);
      if (ex) return upsertTask({ ...t, id: ex.id });
    }
    return upsertTask(t);
  },
  setState: (s) => broadcast('agent.state', { state: s }),
  sleep,
  getStep: () => meta().demoStep || 'brief',
  setStep: (s) => { meta().demoStep = s; save(); },
  setSuggestions: (list) => { meta().suggestions = list; save(); broadcast('suggestions', list); },
  userName: () => getSettings().profile.name,
  addRoutine: (r) => {
    if (db.data.routines.some((x) => x.title === r.title)) return;
    db.data.routines.push({ id: id('r_'), days: [0, 1, 2, 3, 4, 5, 6], enabled: true, createdAt: now(), lastRun: null, ...r });
    save();
    broadcast('routines', db.data.routines);
  },
  loadIds: () => meta().demoIds || {},
  saveIds: (ids) => { meta().demoIds = ids; save(); },
  reset: () => { resetDb(false); meta().seeded = true; broadcast('reload', {}); },
};

const engine = createDemo(host);

export const demo = {
  seed() { engine.seed(); meta().seeded = true; save(); },
  start: () => engine.start(),
  handle: (items) => engine.handle(items),
  onApproval: (ap, d) => engine.onApproval(ap, d),
  onEmail: (it, a) => engine.onEmail(it, a),
  stop: () => engine.stop(),
};
