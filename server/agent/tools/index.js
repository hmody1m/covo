import { db, addFeed, upsertTopic, saveArtifact, readArtifact, save } from '../../db.js';
import { getSettings } from '../../config.js';
import { id, now, truncate } from '../../util.js';
import { broadcast } from '../../bus.js';
import { resolveTarget, runOnDevice, deviceName, listDevices } from '../../devices.js';
import { notify } from '../../notify.js';
import { sendEmail, emailConfigured } from '../../email.js';
import { mcpTools } from '../../mcp.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry. Each tool: { name, description, input_schema, category, run(input) }
// category feeds the approval policy (policy.js). `ctx` is per turn:
//   { scope: 'main'|'task', task, topicId, turnId, hooks }
// hooks are provided by the agent (createTask, messageTask, ...).
// ─────────────────────────────────────────────────────────────────────────────

const obj = (properties, required = []) => ({ type: 'object', properties, required });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const num = (description) => ({ type: 'number', description });
const bool = (description) => ({ type: 'boolean', description });
const deviceProp = { device: str('Optional device id or name to run on. Omit to use the default device.') };

function coreTools(ctx) {
  const s = getSettings();
  const b = s.tools.builtins;
  const tools = [];

  tools.push({
    name: 'set_topic',
    description: 'Label what you are about to write about. Creates the topic if new. Call before writing about a subject and whenever you switch subjects. Status shows as an icon next to the label.',
    input_schema: obj({ title: str('Short topic label, e.g. "Dubai showroom launch" or "Seed round: Atlas Capital"'), emoji: str('Optional single emoji for the topic'), status: str('in_progress | needs_you | done', { enum: ['in_progress', 'needs_you', 'done'] }) }, ['title']),
    category: 'auto',
    run: async ({ title, emoji, status }) => {
      const t = upsertTopic({ title, emoji, status });
      ctx.topicId = t.id;
      return { ok: true, topic_id: t.id };
    },
  });

  tools.push({
    name: 'request_approval',
    description: "Ask the user to approve an action you can't or shouldn't do on your own: payments, purchases, signatures, bookings, publishing. Shows a card with Approve / Not now. Returns immediately with pending_approval; you get an <event> with the decision later.",
    input_schema: obj({
      title: str('What is being approved, e.g. "Trade license renewal"'),
      detail: str('One line shown under the title, e.g. "Health permit fee"'),
      amount: num('Amount of money, if any'),
      currency: str('ISO currency code, default USD'),
      action_label: str('Approve button label, default "Approve"'),
      expires_in_minutes: num('Optional deadline in minutes'),
      kind: str('payment | purchase | signature | booking | publish | other'),
    }, ['title']),
    category: 'auto', // the tool itself *is* the approval
    run: async (input) => ctx.hooks.createApproval({ ...input, generic: true }, ctx),
  });

  if (b.email) {
    tools.push({
      name: 'draft_email',
      description: 'Draft an email for the user to review. Shows an email card with Send / Not now; the user sends it with one tap. Returns immediately; you get an <event> when they send or dismiss it.',
      input_schema: obj({ to: str('Recipient(s), e.g. "Layla <layla@atlas.example>" or a name if the address is unknown'), cc: str('Optional CC'), subject: str('Subject line'), body: str('Plain-text body, signed with the user\'s first name') }, ['to', 'subject', 'body']),
      category: 'auto',
      run: async ({ to, cc, subject, body }) => {
        const item = addFeed({ kind: 'email', topicId: ctx.topicId, source: ctx.scope, taskId: ctx.task?.id, draft: { to, cc: cc || '', subject, body }, status: 'draft' });
        return { status: 'drafted', card_id: item.id, note: 'The user will send or dismiss it. Do not send it yourself.' };
      },
    });
    if (emailConfigured()) tools.push({
      name: 'send_email',
      description: 'Send an email directly via the configured SMTP account. Prefer draft_email so the user can review. Requires approval.',
      input_schema: obj({ to: str('Recipient address(es)'), cc: str('Optional CC'), subject: str('Subject'), body: str('Plain-text body') }, ['to', 'subject', 'body']),
      category: 'messages',
      summarize: (i) => ({ title: `Send email to ${i.to}`, detail: i.subject }),
      run: async (i) => sendEmail(i),
    });
  }

  if (b.artifacts) {
    tools.push({
      name: 'create_artifact',
      description: 'Create something in the Make tab: a page, dashboard, deck, doc or checklist. Shows a card in the thread. HTML for page/dashboard/deck (single self-contained file), Markdown for doc/checklist.',
      input_schema: obj({
        title: str('Title, e.g. "Daily dashboard"'),
        kind: str('page | dashboard | deck | doc | checklist', { enum: ['page', 'dashboard', 'deck', 'doc', 'checklist'] }),
        content: str('Full HTML (page/dashboard/deck) or Markdown (doc/checklist)'),
        summary: str('One-line summary shown in lists'),
        refreshes: str('Optional refresh note, e.g. "Refreshes daily at 5:30 AM"'),
      }, ['title', 'kind', 'content']),
      category: 'auto',
      run: async ({ title, kind, content, summary, refreshes }) => {
        const a = saveArtifact({ title, kind, content, summary, topicId: ctx.topicId, refresh: refreshes || '' });
        addFeed({ kind: 'artifact', artifactId: a.id, topicId: ctx.topicId, source: ctx.scope, taskId: ctx.task?.id });
        return { ok: true, artifact_id: a.id, version: a.version };
      },
    });
    tools.push({
      name: 'update_artifact',
      description: 'Replace the content of an existing artifact (creates a new version). Shows the updated card.',
      input_schema: obj({ id: str('Artifact id'), content: str('New full content'), title: str('Optional new title'), summary: str('Optional new summary'), show_card: bool('Show the card in the thread (default true)') }, ['id', 'content']),
      category: 'auto',
      run: async ({ id: aid, content, title, summary, show_card }) => {
        if (!db.data.artifacts.find((x) => x.id === aid)) return { error: 'No artifact with that id' };
        const a = saveArtifact({ aid, title, content, summary });
        if (show_card !== false) addFeed({ kind: 'artifact', artifactId: a.id, topicId: ctx.topicId, source: ctx.scope, taskId: ctx.task?.id });
        return { ok: true, version: a.version };
      },
    });
    tools.push({
      name: 'read_artifact',
      description: 'Read an artifact\'s current content (or list all artifacts when id is omitted).',
      input_schema: obj({ id: str('Artifact id; omit to list') }),
      category: 'auto',
      run: async ({ id: aid }) => {
        if (!aid) return db.data.artifacts.map((a) => ({ id: a.id, title: a.title, kind: a.kind, version: a.version, updated: new Date(a.updatedAt).toISOString(), pinned: a.pinned }));
        const a = readArtifact(aid);
        return a ? { id: a.id, title: a.title, kind: a.kind, version: a.version, content: truncate(a.content, 60000) } : { error: 'Not found' };
      },
    });
  }

  if (b.tasks) {
    if (ctx.scope === 'main') {
      tools.push({
        name: 'create_task',
        description: 'Start a background task that keeps working after this reply (research, multi-step projects, monitoring). It reports back in this thread and shows in the Tasks tab.',
        input_schema: obj({ title: str('Short task title'), goal: str('Clear goal and definition of done, with all context the worker needs'), topic: str('Topic label to report under (defaults to current topic)'), total: num('Optional number of items/steps, for a progress counter') }, ['title', 'goal']),
        category: 'auto',
        run: async (input) => ctx.hooks.createTask(input, ctx),
      });
      tools.push({
        name: 'message_task',
        description: 'Send instructions or an answer to a running background task (steer it, answer its question, pause/cancel).',
        input_schema: obj({ id: str('Task id'), message: str('What to tell the task'), action: str('Optional: pause | resume | cancel', { enum: ['pause', 'resume', 'cancel'] }) }, ['id']),
        category: 'auto',
        run: async (input) => ctx.hooks.messageTask(input),
      });
    }
    tools.push({
      name: 'update_task',
      description: ctx.scope === 'task' ? 'Update this task: progress counts, status note, or a step for the activity log.' : 'Update a task by id: status, progress, note.',
      input_schema: obj({
        id: str('Task id (omit inside a background task to update the current one)'),
        status: str('in_progress | needs_you | done | failed', { enum: ['in_progress', 'needs_you', 'done', 'failed'] }),
        done: num('Items done'), total: num('Total items'),
        note: str('Short status line, e.g. "33 of 41 on track. 1 needs you today."'),
      }),
      category: 'auto',
      run: async (input) => ctx.hooks.updateTask(input, ctx),
    });
    if (ctx.scope === 'task') {
      tools.push({
        name: 'report_to_user',
        description: 'Post a short update in the main thread under this task\'s topic (each paragraph is a bubble). Use for results, risks and decisions; not for routine progress.',
        input_schema: obj({ text: str('Message, 1-3 short paragraphs') }, ['text']),
        category: 'auto',
        run: async ({ text }) => ctx.hooks.reportToUser(text, ctx),
      });
      tools.push({
        name: 'ask_user',
        description: 'Ask the user a question you need answered to continue. Posts it in the main thread, marks the task "needs you" and pauses until they answer.',
        input_schema: obj({ question: str('One short question') }, ['question']),
        category: 'auto',
        run: async ({ question }) => ctx.hooks.askUser(question, ctx),
      });
      tools.push({
        name: 'complete_task',
        description: 'Mark this task done with a one-sentence outcome (posted to the thread).',
        input_schema: obj({ summary: str('Outcome in one or two sentences'), post: bool('Post the summary in the main thread (default true)') }, ['summary']),
        category: 'auto',
        run: async (input) => ctx.hooks.completeTask(input, ctx),
      });
    }
  }

  if (b.memory) {
    tools.push({
      name: 'remember',
      description: 'Save a durable fact about the user, their work, people or preferences to long-term memory.',
      input_schema: obj({ fact: str('The fact, one sentence') }, ['fact']),
      category: 'auto',
      run: async ({ fact }) => {
        const m = { id: id('m_'), text: fact, createdAt: now(), source: 'agent' };
        db.data.memory.push(m); save(); broadcast('memory', db.data.memory);
        return { ok: true, id: m.id };
      },
    });
    tools.push({
      name: 'forget',
      description: 'Delete a memory by id (when it is wrong or outdated).',
      input_schema: obj({ id: str('Memory id') }, ['id']),
      category: 'auto',
      run: async ({ id: mid }) => {
        db.data.memory = db.data.memory.filter((m) => m.id !== mid); save(); broadcast('memory', db.data.memory);
        return { ok: true };
      },
    });
  }

  if (b.routines) {
    tools.push({
      name: 'schedule_routine',
      description: 'Schedule a recurring routine (runs a prompt at a time of day), e.g. a daily dashboard refresh or weekly review.',
      input_schema: obj({ title: str('Routine name'), prompt: str('What to do when it runs'), time: str('HH:MM, 24h, user timezone'), days: { type: 'array', items: { type: 'number' }, description: 'Days of week 0=Sun..6=Sat; omit for every day' }, as_task: bool('Run as a background task instead of in the thread') }, ['title', 'prompt', 'time']),
      category: 'auto',
      run: async ({ title, prompt, time, days, as_task }) => {
        const r = { id: id('r_'), title, prompt, time, days: days?.length ? days : [0, 1, 2, 3, 4, 5, 6], enabled: true, mode: as_task ? 'task' : 'main', createdAt: now(), lastRun: null };
        db.data.routines.push(r); save(); broadcast('routines', db.data.routines);
        return { ok: true, id: r.id };
      },
    });
    tools.push({
      name: 'delete_routine',
      description: 'Delete a scheduled routine by id.',
      input_schema: obj({ id: str('Routine id') }, ['id']),
      category: 'auto',
      run: async ({ id: rid }) => {
        db.data.routines = db.data.routines.filter((r) => r.id !== rid); save(); broadcast('routines', db.data.routines);
        return { ok: true };
      },
    });
  }

  if (b.notify) {
    tools.push({
      name: 'notify',
      description: 'Send a push notification to the user\'s phone/desktop (for things that need attention soon).',
      input_schema: obj({ title: str('Short title'), body: str('One sentence'), urgent: bool('Bypass quiet hours') }, ['body']),
      category: 'auto',
      run: async ({ title, body, urgent }) => { await notify({ title, body, kind: 'info', urgent }); return { ok: true }; },
    });
  }
  return tools;
}

function systemTools() {
  const s = getSettings();
  const b = s.tools.builtins;
  const tools = [];
  const onDevice = (tool, timeout) => async (input) => {
    const target = resolveTarget(input.device);
    if (!target) return { error: 'No device available. Pair a device (Settings → Devices) or allow this server to run tools (Settings → Devices → This server).' };
    const { device, ...rest } = input;
    const r = await runOnDevice(target, tool, rest, timeout);
    return { device: deviceName(target), ...r };
  };
  const anyDevice = () => listDevices().some((d) => d.online && d.enabled);
  if (!b.device || !anyDevice()) {
    // Still expose tools so the model can tell the user how to enable them; they return a clear error.
  }
  if (b.shell) tools.push({
    name: 'run_command',
    description: 'Run a shell command on a device (PowerShell on Windows, bash elsewhere). Returns exit code, stdout, stderr.',
    input_schema: obj({ command: str('The command'), cwd: str('Working directory (default: device work dir)'), timeout_sec: num('Timeout, default 120'), shell: str('powershell | cmd | bash (optional)'), ...deviceProp }, ['command']),
    category: 'shell',
    summarize: (i) => ({ title: 'Run a command', detail: i.command.slice(0, 300) }),
    run: async (i) => onDevice('run_command', ((i.timeout_sec || s.tools.shellTimeoutSec) + 10) * 1000)({ ...i, timeoutSec: i.timeout_sec || s.tools.shellTimeoutSec }),
  });
  if (b.files) {
    tools.push({
      name: 'read_file', description: 'Read a text or image file from a device (relative paths resolve from the work dir).',
      input_schema: obj({ path: str('File path'), ...deviceProp }, ['path']), category: 'files_read',
      run: onDevice('read_file'),
    });
    tools.push({
      name: 'list_dir', description: 'List a directory on a device.',
      input_schema: obj({ path: str('Directory (default: work dir)'), depth: num('Recursion depth, default 1'), ...deviceProp }), category: 'files_read',
      run: onDevice('list_dir'),
    });
    tools.push({
      name: 'write_file', description: 'Create or overwrite (or append to) a file on a device.',
      input_schema: obj({ path: str('File path'), content: str('Content'), append: bool('Append instead of overwrite'), ...deviceProp }, ['path', 'content']), category: 'files_write',
      summarize: (i) => ({ title: `${i.append ? 'Append to' : 'Write'} ${i.path}`, detail: `${(i.content || '').length} characters` }),
      run: onDevice('write_file'),
    });
  }
  if (b.device) {
    tools.push({ name: 'open', description: 'Open a URL, file or app on a device.', input_schema: obj({ target: str('URL, file path or app'), ...deviceProp }, ['target']), category: 'device', summarize: (i) => ({ title: 'Open on your device', detail: i.target }), run: onDevice('open') });
    tools.push({ name: 'screenshot', description: 'Take a screenshot of a device screen (returns the image).', input_schema: obj({ ...deviceProp }), category: 'device', summarize: () => ({ title: 'Take a screenshot', detail: 'See what is on your screen' }), run: onDevice('screenshot') });
    tools.push({ name: 'system_info', description: 'Get OS, user, memory and uptime of a device. Also lists all devices.', input_schema: obj({ ...deviceProp }), category: 'auto', run: async (i) => ({ devices: listDevices().map((d) => ({ id: d.id, name: d.name, online: d.online, enabled: d.enabled, platform: d.platform })), ...(resolveTarget(i.device) ? await onDevice('system_info')(i) : {}) }) });
    tools.push({ name: 'desktop_notify', description: 'Show a desktop notification on a device.', input_schema: obj({ title: str('Title'), body: str('Body'), ...deviceProp }, ['body']), category: 'auto', run: onDevice('desktop_notify') });
  }
  if (b.http) tools.push({
    name: 'http_request',
    description: 'Make an HTTP request from the server (APIs, webhooks). GET runs freely; other methods need approval. For reading web pages prefer web_fetch if available.',
    input_schema: obj({ url: str('URL'), method: str('GET | POST | PUT | PATCH | DELETE'), headers: { type: 'object', description: 'Headers' }, body: str('Request body (string/JSON)') }, ['url']),
    category: (i) => (!i.method || i.method.toUpperCase() === 'GET' ? 'network' : 'messages'),
    summarize: (i) => ({ title: `${(i.method || 'GET').toUpperCase()} request`, detail: i.url }),
    run: async ({ url, method = 'GET', headers, body }) => {
      const res = await fetch(url, { method: method.toUpperCase(), headers: headers || {}, body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : body, signal: AbortSignal.timeout(30_000) });
      const ct = res.headers.get('content-type') || '';
      let text = await res.text();
      if (ct.includes('html')) text = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      return { status: res.status, contentType: ct, body: truncate(text, 40000) };
    },
  });
  return tools;
}

export function buildTools(ctx) {
  return [...coreTools(ctx), ...systemTools(), ...mcpTools()];
}

// Convert a tool's return value into tool_result content blocks.
export function toResultBlocks(result) {
  if (result && Array.isArray(result.blocks)) return { content: result.blocks, isError: !!result.isError };
  if (result && result.image?.data) {
    const { image, ...rest } = result;
    return { content: [{ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }, { type: 'text', text: JSON.stringify(rest) }], isError: false };
  }
  const text = typeof result === 'string' ? result : JSON.stringify(result ?? { ok: true });
  return { content: [{ type: 'text', text: truncate(text, 60000) }], isError: !!(result && result.error) };
}
