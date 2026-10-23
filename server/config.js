import path from 'node:path';
import fs from 'node:fs';
import { DATA_DIR, deepMerge, readJson, writeJsonAtomic } from './util.js';
import { bus } from './bus.js';

const FILE = path.join(DATA_DIR, 'settings.json');

let systemTz = 'UTC';
try { systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}

export const DEFAULT_SETTINGS = {
  profile: { name: '', email: '', avatarColor: '', timezone: systemTz, language: 'en' },
  appearance: {
    theme: 'classic',         // see web/css/tokens.css
    accent: '',               // optional hex override
    fontSize: 15,
    density: 'comfortable',   // compact | comfortable | spacious
    interfaceMode: 'auto',    // auto | mobile | desktop
    font: 'default',          // default | system | serif | mono
    orbAnimation: true,
    reduceMotion: false,
    showTimestamps: false,
    bubbleRadius: 18,
    revealPacing: true,       // reveal assistant bubbles one at a time with typing dots
  },
  provider: {
    type: 'demo',             // anthropic | openai | demo
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseURL: '',
      model: 'claude-opus-5-5',
      effort: 'medium',       // chat turns
      taskEffort: 'high',     // background tasks & routines
      maxTokens: 32000,
      webSearch: true,
      webFetch: true,
      progressUpdates: true,  // thinking.display = "updates" → between-tool notes become bubbles
      refusalFallback: true,  // server-side fallbacks: "default"
      promptCaching: true,
    },
    openai: { baseURL: 'http://localhost:11434/v1', apiKey: '', model: 'llama3.1', maxTokens: 4096 },
  },
  agent: {
    name: 'Covo',
    autonomy: 'balanced',     // supervised | balanced | autonomous
    approvals: {              // ask | auto | block
      messages: 'ask', payments: 'ask', shell: 'ask', files_write: 'ask', files_read: 'auto',
      network: 'auto', device: 'ask', mcp: 'ask',
    },
    approvalExpiryMin: 30,
    maxSteps: 40,
    maxConcurrentTasks: 3,
    contextMessages: 120,
    progressBubbles: true,
    autoMemory: true,
    proactive: true,
  },
  systemPrompt: { custom: '', preset: 'default', extra: '' },
  tools: {
    builtins: { shell: true, files: true, http: true, artifacts: true, tasks: true, memory: true, routines: true, notify: true, email: true, device: true },
    serverExecution: process.env.COVO_DESKTOP === '1' || process.platform === 'win32' || process.platform === 'darwin',
    workDir: path.join(DATA_DIR, 'workspace'),
    shellTimeoutSec: 120,
    blockedCommands: ['rm -rf /', 'mkfs', 'format c:', ':(){ :|:& };:', 'shutdown', 'Remove-Item -Recurse C:\\'],
    mcpServers: [],           // [{ id, name, command, args:[], env:{}, enabled, sensitive }]
  },
  email: { smtpHost: '', smtpPort: 587, secure: false, user: '', pass: '', from: '' },
  devices: { defaultTarget: 'auto' }, // auto | server | <deviceId>
  integrations: {
    telegram: { enabled: false, botToken: '', chats: [], pairCode: '' }, // chats: [{ id, name, linkedAt }]
  },
  notifications: {
    webPush: true, ntfyUrl: '', notifyApprovals: true, notifyTasks: true, notifyBrief: true,
    quietHours: { enabled: false, from: '22:00', to: '07:00' },
  },
  security: { sessionDays: 30 },
  developer: { enabled: false, showToolCalls: true, showUsage: true, requestOverrides: '{}' },
};

const SECRET_PATHS = [['provider', 'anthropic', 'apiKey'], ['provider', 'openai', 'apiKey'], ['email', 'pass'], ['integrations', 'telegram', 'botToken']];

let settings = deepMerge(structuredClone(DEFAULT_SETTINGS), readJson(FILE, {}));
fs.mkdirSync(settings.tools.workDir, { recursive: true });

export function getSettings() {
  return settings;
}

export function saveSettings() {
  writeJsonAtomic(FILE, settings);
}

function getPath(obj, p) { return p.reduce((o, k) => (o ? o[k] : undefined), obj); }
function setPath(obj, p, v) { const last = p[p.length - 1]; const parent = p.slice(0, -1).reduce((o, k) => (o[k] ??= {}), obj); parent[last] = v; }

export function mask(v) {
  if (!v) return '';
  return '••••' + String(v).slice(-4);
}

// Settings safe to send to the browser (secrets masked).
export function publicSettings() {
  const s = structuredClone(settings);
  for (const p of SECRET_PATHS) setPath(s, p, mask(getPath(settings, p)));
  return s;
}

export function updateSettings(patch) {
  const incoming = structuredClone(patch || {});
  // Keep secrets if the client sent back the masked value.
  for (const p of SECRET_PATHS) {
    const v = getPath(incoming, p);
    if (typeof v === 'string' && v.startsWith('••••')) setPath(incoming, p, getPath(settings, p));
  }
  deepMerge(settings, incoming);
  // arrays are replaced wholesale by deepMerge; that is what we want for mcpServers / blockedCommands
  if (settings.tools.workDir) fs.mkdirSync(settings.tools.workDir, { recursive: true });
  saveSettings();
  bus.emit('settings.changed', publicSettings());
  return publicSettings();
}

export function replaceSettings(full) {
  settings = deepMerge(structuredClone(DEFAULT_SETTINGS), full || {});
  saveSettings();
  bus.emit('settings.changed', publicSettings());
}

export function resetSettings() {
  settings = structuredClone(DEFAULT_SETTINGS);
  saveSettings();
  bus.emit('settings.changed', publicSettings());
}

// Which provider actually runs: falls back to demo when no key is configured.
export function activeProvider() {
  const p = settings.provider;
  if (p.type === 'anthropic' && (p.anthropic.apiKey || process.env.ANTHROPIC_API_KEY)) return 'anthropic';
  if (p.type === 'openai' && p.openai.baseURL && p.openai.model) return 'openai';
  return 'demo';
}
