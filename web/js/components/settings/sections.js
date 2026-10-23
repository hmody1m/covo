import { html, useState, useEffect } from '../../../vendor/preact-htm.js';
import { api } from '../../api.js';
import { useStore, setUI, toast, get } from '../../store.js';
import { t, LANGUAGES } from '../../lib/i18n.js';
import { Icon } from '../../lib/icons.js';
import { Toggle, Seg, Confirm, CopyBox, cx, fmtTime, Avatar } from '../ui.js';
import { saveSettings, Item, ToggleItem, SelectItem, TextItem, Group, Page } from './common.js';
import { enablePush } from '../../push.js';
import { BRAND, repoApi } from '../../brand.js';
import { LEGAL_DOCS, openLegal } from '../Legal.js';
import { saveBlob } from '../../lib/native.js';

const S = () => get().settings;

/* ═════════════ Profile ═════════════ */
export function ProfileSection() {
  const p = useStore((s) => s.settings.profile);
  const agent = useStore((s) => s.settings.agent);
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = []; }
  if (p.timezone && !zones.includes(p.timezone)) zones = [p.timezone, ...zones];
  const COLORS = ['', '#CF6652', '#3B6FD8', '#2E9B57', '#7A5CD6', '#DD8A2C', '#1E9A93', '#1D1C1A'];
  return html`<${Page} title=${t('Profile')} desc="How your agent knows you. Your name appears in the system prompt as {{user_name}}.">
    <${Group}>
      <div class="item"><${Avatar} name=${p.name} color=${p.avatarColor} size=${44} /><div class="row" style="flex-wrap:wrap;gap:6px">${COLORS.map((c) => html`
        <button aria-label=${c || 'default'} onClick=${() => saveSettings({ profile: { avatarColor: c } })} style=${`width:26px;height:26px;border-radius:50%;border:2px solid ${p.avatarColor === c ? 'var(--ink)' : 'var(--line)'};background:${c || 'var(--surface-2)'}`}></button>`)}</div></div>
      <${TextItem} title=${t('Name')} value=${p.name} onSave=${(v) => saveSettings({ profile: { name: v } })} placeholder="Sara" />
      <${TextItem} title="Email" desc="Used as your signature context; not shared." value=${p.email} onSave=${(v) => saveSettings({ profile: { email: v } })} placeholder="you@company.com" />
      <${SelectItem} title=${t('Language')} desc="Interface language. Arabic switches the layout to right-to-left." value=${p.language} options=${LANGUAGES} onChange=${(v) => saveSettings({ profile: { language: v } })} />
      <${SelectItem} title=${t('Timezone')} desc="Used for routines, the morning brief and times in replies." value=${p.timezone} options=${zones} onChange=${(v) => saveSettings({ profile: { timezone: v } })} width=${230} />
    <//>
    <${Group} title="Agent">
      <${TextItem} title="Agent name" desc="What your agent calls itself ({{agent_name}}). Shown in the app header and notifications." value=${agent.name} onSave=${(v) => saveSettings({ agent: { name: v || 'Covo' } })} />
    <//>
  <//>`;
}

/* ═════════════ Appearance ═════════════ */
export const THEMES = [
  { id: 'classic', name: 'Classic', c: ['#F9F9F6', '#ECECE9', '#FAC9BE', '#CF6652'] },
  { id: 'classic-dark', name: 'Classic Dark', c: ['#171615', '#2A2926', '#5B3227', '#E2826D'] },
  { id: 'system', name: 'System', c: ['#F9F9F6', '#2A2926', '#FAC9BE', '#CF6652'] },
  { id: 'sand', name: 'Sand', c: ['#F4EFE6', '#E9E1D3', '#EFC7AE', '#B8582E'] },
  { id: 'ocean', name: 'Ocean', c: ['#F5F8FA', '#E6EDF2', '#C9E1FB', '#1F7AE0'] },
  { id: 'forest', name: 'Forest', c: ['#F4F6F1', '#E5EADF', '#CFE3C8', '#3F7A4F'] },
  { id: 'lavender', name: 'Lavender', c: ['#F6F4FA', '#ECE8F4', '#F5CFD6', '#7A5CD6'] },
  { id: 'midnight', name: 'Midnight', c: ['#0F1422', '#1D2538', '#34407A', '#8EA8FF'] },
  { id: 'graphite', name: 'Graphite', c: ['#1B1C1E', '#2C2D31', '#46474E', '#D9D9DE'] },
  { id: 'oled', name: 'OLED Black', c: ['#000000', '#161616', '#4A2219', '#FF8A70'] },
  { id: 'contrast', name: 'High contrast', c: ['#FFFFFF', '#EDEDED', '#FFD2C7', '#B3261E'] },
];

export function AppearanceSection() {
  const a = useStore((s) => s.settings.appearance);
  const set = (patch) => saveSettings({ appearance: patch });
  return html`<${Page} title=${t('Appearance')} desc="Themes, type and motion. Changes apply instantly on every device.">
    <${Group} title=${t('Theme')}>
      <div class="theme-grid">${THEMES.map((th) => html`
        <button class=${cx('theme-sw', a.theme === th.id && 'on')} onClick=${() => set({ theme: th.id })} aria-pressed=${a.theme === th.id}>
          <div class="pv" style=${`background:${th.c[0]}`}><i style=${`width:70%;background:${th.c[1]}`}></i><i style=${`width:50%;align-self:flex-end;background:${th.c[2]}`}></i><i style=${`width:22px;height:22px;border-radius:50%;background:${th.c[3]};margin-top:auto`}></i></div>
          <div class="nm">${th.name}${a.theme === th.id && html`<${Icon} name="check" size="sm" />`}</div>
        </button>`)}</div>
      <${Item} title=${t('Accent color')} desc="Override the theme's accent (buttons, links, the orb).">
        <div class="row"><input type="color" value=${a.accent || '#CF6652'} onChange=${(e) => set({ accent: e.target.value })} style="width:42px;height:32px;border:0;background:none;padding:0" aria-label=${t('Accent color')} />
        ${a.accent && html`<button class="btn ghost sm" onClick=${() => set({ accent: '' })}>${t('Reset')}</button>`}</div>
      <//>
    <//>
    <${Group} title="Layout">
      <${Item} title=${t('Interface')} desc="Auto picks the phone layout on small screens and the desktop layout on large ones.">
        <${Seg} value=${a.interfaceMode} onChange=${(v) => set({ interfaceMode: v })} options=${[{ id: 'auto', label: t('Auto') }, { id: 'mobile', label: t('Mobile'), icon: 'phone' }, { id: 'desktop', label: t('Desktop'), icon: 'monitor' }]} />
      <//>
      <${Item} title=${t('Density')}><${Seg} value=${a.density} onChange=${(v) => set({ density: v })} options=${[{ id: 'compact', label: t('Compact') }, { id: 'comfortable', label: t('Comfortable') }, { id: 'spacious', label: t('Spacious') }]} /><//>
    <//>
    <${Group} title="Text">
      <${Item} title=${t('Text size')} desc=${`${a.fontSize}px`}>
        <input type="range" min="13" max="20" step="1" value=${a.fontSize} onChange=${(e) => set({ fontSize: Number(e.target.value) })} style="width:180px" aria-label=${t('Text size')} />
      <//>
      <${SelectItem} title=${t('Font')} value=${a.font} onChange=${(v) => set({ font: v })} options=${[{ id: 'default', name: 'Inter + Source Serif (default)' }, { id: 'system', name: 'System UI' }, { id: 'serif', name: 'Serif' }, { id: 'mono', name: 'Monospace' }]} width=${220} />
      <${Item} title="Bubble roundness" desc=${`${a.bubbleRadius}px`}>
        <input type="range" min="6" max="24" step="1" value=${a.bubbleRadius} onChange=${(e) => set({ bubbleRadius: Number(e.target.value) })} style="width:180px" aria-label="Bubble roundness" />
      <//>
    <//>
    <${Group} title="Motion & chat">
      <${ToggleItem} title="Animated orb" desc="The coral orb shows what the agent is doing: idle, thinking, writing, working, waiting." value=${a.orbAnimation} onChange=${(v) => set({ orbAnimation: v })} />
      <${ToggleItem} title="Reveal replies bubble by bubble" desc="Complete bubbles pop in one at a time with typing dots. Off = stream text live." value=${a.revealPacing} onChange=${(v) => set({ revealPacing: v })} />
      <${ToggleItem} title="Show timestamps" value=${a.showTimestamps} onChange=${(v) => set({ showTimestamps: v })} />
      <${ToggleItem} title="Reduce motion" desc="Turn off all animations." value=${a.reduceMotion} onChange=${(v) => set({ reduceMotion: v })} />
    <//>
  <//>`;
}

/* ═════════════ Model & provider ═════════════ */
const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (recommended)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (fastest)' },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1 (most capable)' },
];
const OPENAI_PRESETS = [
  { name: 'Ollama (local)', url: 'http://localhost:11434/v1' },
  { name: 'LM Studio (local)', url: 'http://localhost:1234/v1' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { name: 'Together', url: 'https://api.together.xyz/v1' },
];

function SecretItem({ title, desc, value, onSave, placeholder }) {
  const [v, setV] = useState('');
  const [show, setShow] = useState(false);
  return html`<${Item} title=${title} desc=${desc} col>
    <div class="row"><input class="input grow" type=${show ? 'text' : 'password'} placeholder=${value || placeholder} value=${v} onInput=${(e) => setV(e.target.value)} autocomplete="off" spellcheck="false" />
      <button class="icon-btn" aria-label="Show" onClick=${() => setShow(!show)}><${Icon} name=${show ? 'eyeOff' : 'eye'} size="sm" /></button>
      <button class="btn primary sm" disabled=${!v} onClick=${async () => { await onSave(v.trim()); setV(''); toast({ title: t('Saved'), ms: 1200 }); }}>${t('Save')}</button></div>
    ${value && html`<span class="hint">Saved: ${value}</span>`}
  <//>`;
}

export function ModelSection() {
  const p = useStore((s) => s.settings.provider);
  const active = useStore((s) => s.provider);
  const [test, setTest] = useState(null);
  const [models, setModels] = useState([]);
  const a = p.anthropic, o = p.openai;
  const setP = (patch) => saveSettings({ provider: patch });
  const runTest = async () => { setTest({ busy: true }); try { setTest(await api.post('/api/settings/test')); } catch (e) { setTest({ ok: false, error: e.message }); } };
  const modelOpts = [...CLAUDE_MODELS, ...models.filter((m) => !CLAUDE_MODELS.some((c) => c.id === m.id)).map((m) => ({ id: m.id, name: m.name || m.id }))];
  if (a.model && !modelOpts.some((m) => m.id === a.model)) modelOpts.push({ id: a.model, name: a.model });
  return html`<${Page} title=${t('Model & provider')} desc="The brain behind your agent. Claude is recommended; any OpenAI-compatible endpoint (Ollama, LM Studio, OpenRouter…) also works.">
    <${Group}>
      <${Item} title="Provider" desc=${active === 'demo' ? 'Currently running the scripted demo.' : `Active: ${active}`}>
        <${Seg} value=${p.type} onChange=${(v) => setP({ type: v })} options=${[{ id: 'anthropic', label: 'Claude' }, { id: 'openai', label: 'OpenAI-compatible' }, { id: 'demo', label: 'Demo' }]} />
      <//>
    <//>
    ${p.type === 'anthropic' && html`
      <${Group} title="Anthropic (Claude)">
        <${SecretItem} title="API key" desc=${html`Use your own key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. It's stored only on your device/server and sent only to the API. Your use of Claude is subject to Anthropic's <a href="https://www.anthropic.com/legal/aup" target="_blank" rel="noopener">Usage Policy</a> and terms.`} value=${a.apiKey} placeholder="sk-ant-…" onSave=${(v) => setP({ anthropic: { apiKey: v } })} />
        <${Item} title="Model" desc="Opus 5.5 is the default: best for autonomous, multi-step work.">
          <div class="row"><select class="select" style="width:250px;max-width:50vw" value=${a.model} onChange=${(e) => (e.target.value === '__custom' ? null : setP({ anthropic: { model: e.target.value } }))}>
            ${modelOpts.map((m) => html`<option value=${m.id}>${m.name}</option>`)}</select>
          <button class="icon-btn" title="Load models from your account" aria-label="Load models" onClick=${async () => { const m = await api.get('/api/models').catch(() => []); setModels(m); toast({ title: `${m.length} models loaded`, ms: 1500 }); }}><${Icon} name="refresh" size="sm" /></button></div>
        <//>
        <${TextItem} title="Custom model id" desc="Overrides the list above (e.g. a newer model)." value=${a.model} onSave=${(v) => v && setP({ anthropic: { model: v } })} />
        <${SelectItem} title="Effort — chat" desc="How hard Claude thinks on normal replies. Higher = smarter but slower and pricier." value=${a.effort} onChange=${(v) => setP({ anthropic: { effort: v } })} options=${['low', 'medium', 'high', 'xhigh', 'max']} width=${140} />
        <${SelectItem} title="Effort — background tasks & routines" value=${a.taskEffort} onChange=${(v) => setP({ anthropic: { taskEffort: v } })} options=${['low', 'medium', 'high', 'xhigh', 'max']} width=${140} />
        <${TextItem} title="Max output tokens" type="number" value=${a.maxTokens} onSave=${(v) => setP({ anthropic: { maxTokens: v } })} width=${140} />
      <//>
      <${Group} title="Claude features">
        <${ToggleItem} title="Web search" desc="Let Claude search the web (server tool, billed per search)." value=${a.webSearch} onChange=${(v) => setP({ anthropic: { webSearch: v } })} />
        <${ToggleItem} title="Web fetch" desc="Let Claude read web pages it finds or you mention." value=${a.webFetch} onChange=${(v) => setP({ anthropic: { webFetch: v } })} />
        <${ToggleItem} title="Progress updates" desc="Short notes between tool calls show up as chat bubbles (\"On it. Pulling from…\")." value=${a.progressUpdates} onChange=${(v) => setP({ anthropic: { progressUpdates: v } })} />
        <${ToggleItem} title="Refusal fallback" desc="If a safety filter declines a request, retry automatically on Anthropic's recommended fallback model." value=${a.refusalFallback} onChange=${(v) => setP({ anthropic: { refusalFallback: v } })} />
        <${ToggleItem} title="Prompt caching" desc="Reuses the cached prompt + history between turns. Much cheaper for long threads." value=${a.promptCaching} onChange=${(v) => setP({ anthropic: { promptCaching: v } })} />
        <${TextItem} title="Base URL" desc="Advanced: proxy or gateway. Leave empty for api.anthropic.com." value=${a.baseURL} placeholder="https://api.anthropic.com" onSave=${(v) => setP({ anthropic: { baseURL: v } })} />
      <//>`}
    ${p.type === 'openai' && html`
      <${Group} title="OpenAI-compatible endpoint">
        <${Item} title="Presets"><div class="row" style="flex-wrap:wrap;justify-content:flex-end">${OPENAI_PRESETS.map((x) => html`<button class="btn outline sm" onClick=${() => setP({ openai: { baseURL: x.url } })}>${x.name}</button>`)}</div><//>
        <${TextItem} title="Base URL" value=${o.baseURL} onSave=${(v) => setP({ openai: { baseURL: v } })} width=${300} />
        <${SecretItem} title="API key" desc="Leave empty for local servers like Ollama." value=${o.apiKey} placeholder="sk-…" onSave=${(v) => setP({ openai: { apiKey: v } })} />
        <${TextItem} title="Model" desc="e.g. llama3.1, qwen2.5:14b, deepseek-chat. Must support tool calling for agent features." value=${o.model} onSave=${(v) => setP({ openai: { model: v } })} />
        <${TextItem} title="Max output tokens" type="number" value=${o.maxTokens} onSave=${(v) => setP({ openai: { maxTokens: v } })} width=${140} />
      <//>`}
    ${p.type === 'demo' && html`<${Group}><div class="item"><div class="txt"><b>Demo mode</b><small>Plays a scripted sample story so you can try the whole UI without a model. Switch to Claude to run your real agent.</small></div></div><//>`}
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <button class="btn primary" onClick=${runTest} disabled=${test?.busy}>${test?.busy ? 'Testing…' : 'Test connection'}</button>
      ${test && !test.busy && html`<span class=${`badge ${test.ok ? 'ok' : 'bad'}`} style="white-space:normal">${test.ok ? `✓ ${test.model}: "${test.reply}"` : `✗ ${test.error}`}</span>`}
    </div>
  <//>`;
}

/* ═════════════ Agent & autonomy ═════════════ */
const AUTONOMY = [
  { id: 'supervised', title: 'Supervised', desc: 'Asks before anything that changes something: files, commands, messages, money. Reads freely.' },
  { id: 'balanced', title: 'Balanced (recommended)', desc: 'Follows the approval table below. Works on its own, asks for the important things.' },
  { id: 'autonomous', title: 'Autonomous', desc: 'Runs everything on its own except payments and messages sent as you. Use with paired devices you trust.' },
];

export function AgentSection() {
  const a = useStore((s) => s.settings.agent);
  const [warn, setWarn] = useState(false);
  const cats = useStore((s) => s.categories);
  const set = (patch) => saveSettings({ agent: patch });
  return html`<${Page} title=${t('Agent & autonomy')} desc="How independently your agent works, and what it must ask you first.">
    <${Group} title="Autonomy level">
      <div class="stack" style="padding:12px 16px">${AUTONOMY.map((x) => html`
        <button class=${cx('choice', a.autonomy === x.id && 'on')} onClick=${() => (x.id === 'autonomous' && a.autonomy !== 'autonomous' ? setWarn(true) : set({ autonomy: x.id }))}>
          <${Icon} name=${x.id === 'supervised' ? 'hand' : x.id === 'balanced' ? 'shield' : 'zap'} />
          <div><b>${x.title}</b><small>${x.desc}</small></div>
        </button>`)}</div>
    <//>
    <${Group} title="Approvals — what needs your OK">
      ${Object.entries(cats).map(([k, label]) => html`<${Item} title=${label}>
        <${Seg} value=${a.approvals[k] || 'ask'} onChange=${(v) => set({ approvals: { [k]: v } })} options=${[{ id: 'ask', label: t('Ask') }, { id: 'auto', label: t('Auto') }, { id: 'block', label: t('Block') }]} />
      <//>`)}
      <${TextItem} title="Approval expiry (minutes)" desc="Unanswered tool approvals expire after this long." type="number" value=${a.approvalExpiryMin} onSave=${(v) => set({ approvalExpiryMin: v })} width=${100} />
    <//>
    <${Group} title="Behavior">
      <${ToggleItem} title="Show progress as bubbles" desc="Display the agent's between-step notes in the thread." value=${a.progressBubbles} onChange=${(v) => set({ progressBubbles: v })} />
      <${ToggleItem} title="Remember automatically" desc="Let the agent save durable facts to Memory." value=${a.autoMemory} onChange=${(v) => set({ autoMemory: v })} />
      <${TextItem} title="Max steps per turn" desc="Safety limit on tool calls in one turn." type="number" value=${a.maxSteps} onSave=${(v) => set({ maxSteps: v })} width=${100} />
      <${TextItem} title="Background tasks at once" type="number" value=${a.maxConcurrentTasks} onSave=${(v) => set({ maxConcurrentTasks: v })} width=${100} />
      <${TextItem} title="Context window (messages)" desc="How much of the thread is sent each turn." type="number" value=${a.contextMessages} onSave=${(v) => set({ contextMessages: v })} width=${100} />
    <//>
    ${warn && html`<${Confirm} title="Turn on Autonomous mode?" danger=${false} confirm="I understand, turn it on"
      body="The agent will run commands, change files, call services and use connected devices without asking you first (payments and messages sent as you still ask). You are responsible for what it does. Use it only with devices and accounts you can afford to have changed, and keep backups."
      onYes=${() => set({ autonomy: 'autonomous' })} onClose=${() => setWarn(false)} />`}
  <//>`;
}

/* ═════════════ System prompt ═════════════ */
export function PromptSection() {
  const sp = useStore((s) => s.settings.systemPrompt);
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [extra, setExtra] = useState(sp.extra || '');
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const load = async () => { const d = await api.get('/api/prompt'); setData(d); setText(d.template); setDirty(false); };
  useEffect(() => { load(); }, []);
  if (!data) return html`<${Page} title=${t('System prompt')}><div class="hint">Loading…</div><//>`;
  const usingCustom = !!(sp.custom && sp.custom.trim());
  const save = async () => { await saveSettings({ systemPrompt: { custom: text } }, { quiet: false }); await load(); };
  const resetTo = async (preset) => { await saveSettings({ systemPrompt: { custom: '', preset } }, { quiet: false }); await load(); };
  return html`<${Page} title=${t('System prompt')} desc="Full control over how your agent thinks and talks. You're the developer: edit anything.">
    <${Group}>
      <${Item} title="Base preset" desc=${usingCustom ? 'You are using a custom prompt (preset ignored).' : 'Pick a starting point. Edit below to make it yours.'}>
        <select class="select" style="width:220px" value=${sp.preset} onChange=${(e) => resetTo(e.target.value)}>
          ${Object.entries(data.presets).map(([k, v]) => html`<option value=${k}>${v.name}</option>`)}</select>
      <//>
      <div class="item col">
        <div class="row" style="justify-content:space-between"><div class="txt"><b>Prompt template</b><small>Variables: ${data.variables.map((v) => html`<code style="margin-inline-end:6px">{{${v}}}</code>`)}</small></div>
          <${Seg} value=${preview ? 'p' : 'e'} onChange=${(v) => setPreview(v === 'p')} options=${[{ id: 'e', label: t('Edit') }, { id: 'p', label: 'Preview' }]} /></div>
        ${preview
          ? html`<pre class="textarea code" style="white-space:pre-wrap;max-height:520px;overflow:auto;margin:0">${data.rendered}</pre>`
          : html`<textarea class="textarea code" spellcheck="false" value=${text} onInput=${(e) => { setText(e.target.value); setDirty(true); }} style="min-height:420px" dir="auto"></textarea>`}
        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <span class="hint">${text.length.toLocaleString()} characters · ~${Math.round(text.length / 4).toLocaleString()} tokens</span>
          <div class="row">
            ${usingCustom && html`<button class="btn ghost sm" onClick=${() => resetTo(sp.preset)}>Reset to preset</button>`}
            <button class="btn primary sm" disabled=${!dirty} onClick=${save}>${t('Save')}</button></div>
        </div>
      </div>
    <//>
    <${Group} title="Extra instructions">
      <div class="item col">
        <div class="hint">Appended to whatever prompt is active — a safe place for your house rules ("Always reply in Iraqi Arabic", "Sign emails as Mo").</div>
        <textarea class="textarea" rows="5" value=${extra} onInput=${(e) => setExtra(e.target.value)} dir="auto"></textarea>
        <div class="row" style="justify-content:flex-end"><button class="btn primary sm" disabled=${extra === (sp.extra || '')} onClick=${() => saveSettings({ systemPrompt: { extra } }, { quiet: false }).then(load)}>${t('Save')}</button></div>
      </div>
    <//>
  <//>`;
}

/* ═════════════ Memory ═════════════ */
export function MemorySection() {
  const memory = useStore((s) => s.memory);
  const auto = useStore((s) => s.settings.agent.autoMemory);
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(null);
  const add = async () => { if (!text.trim()) return; await api.post('/api/memory', { text }); setText(''); };
  return html`<${Page} title=${t('Memory')} desc="Durable facts your agent knows about you and your work. Sent with every turn.">
    <${Group}>
      <${ToggleItem} title="Remember automatically" desc="The agent saves useful facts as it works." value=${auto} onChange=${(v) => saveSettings({ agent: { autoMemory: v } })} />
      <div class="item"><input class="input grow" value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && add()} placeholder="e.g. Layla is our partner at Atlas Capital (layla@atlas.example)" dir="auto" /><button class="btn primary sm" onClick=${add} disabled=${!text.trim()}>${t('Add')}</button></div>
    <//>
    <${Group} title=${`${memory.length} memories`}>
      ${!memory.length && html`<div class="item"><span class="hint">Nothing yet.</span></div>`}
      ${[...memory].reverse().map((m) => html`<div class="item">
        ${edit?.id === m.id
          ? html`<input class="input grow" value=${edit.text} onInput=${(e) => setEdit({ ...edit, text: e.target.value })} onKeyDown=${async (e) => { if (e.key === 'Enter') { await api.patch(`/api/memory/${m.id}`, { text: edit.text }); setEdit(null); } }} dir="auto" />
             <button class="btn primary sm" onClick=${async () => { await api.patch(`/api/memory/${m.id}`, { text: edit.text }); setEdit(null); }}>${t('Save')}</button>`
          : html`<div class="txt"><b style="font-weight:400" dir="auto">${m.text}</b><small>${m.source === 'agent' ? 'Saved by agent' : 'Added by you'} · ${fmtTime(m.createdAt)}</small></div>
             <button class="icon-btn sm" aria-label=${t('Edit')} onClick=${() => setEdit({ id: m.id, text: m.text })}><${Icon} name="edit" size="sm" /></button>`}
        <button class="icon-btn sm" aria-label=${t('Delete')} onClick=${() => api.del(`/api/memory/${m.id}`)}><${Icon} name="trash" size="sm" /></button>
      </div>`)}
    <//>
  <//>`;
}

/* ═════════════ Routines ═════════════ */
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function RoutineForm({ r, onDone }) {
  const [f, setF] = useState(r || { title: '', prompt: '', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], mode: 'main', enabled: true });
  const save = async () => {
    try { r ? await api.patch(`/api/routines/${r.id}`, f) : await api.post('/api/routines', f); onDone(); }
    catch (e) { toast({ title: 'Routine', body: e.message }); }
  };
  return html`<div class="item col" style="background:var(--surface)">
    <div class="row"><input class="input grow" placeholder="Title (e.g. Weekly review)" value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} /><input class="input" type="time" style="width:120px" value=${f.time} onInput=${(e) => setF({ ...f, time: e.target.value })} /></div>
    <textarea class="textarea" rows="3" placeholder="What should the agent do? (e.g. Review last week's numbers and post 3 takeaways)" value=${f.prompt} onInput=${(e) => setF({ ...f, prompt: e.target.value })} dir="auto"></textarea>
    <div class="row" style="flex-wrap:wrap;justify-content:space-between">
      <div class="row" style="gap:4px">${DAYS.map((d, i) => html`<button class=${cx('btn sm', f.days.includes(i) ? 'primary' : 'outline')} style="width:32px;padding:0" onClick=${() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })}>${d}</button>`)}</div>
      <${Seg} value=${f.mode} onChange=${(v) => setF({ ...f, mode: v })} options=${[{ id: 'main', label: 'In chat' }, { id: 'task', label: 'Background task' }]} />
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost sm" onClick=${onDone}>${t('Cancel')}</button><button class="btn primary sm" disabled=${!f.title || !f.prompt} onClick=${save}>${t('Save')}</button></div>
  </div>`;
}

export function RoutinesSection() {
  const routines = useStore((s) => s.routines);
  const tz = useStore((s) => s.settings.profile.timezone);
  const [edit, setEdit] = useState(null);
  return html`<${Page} title=${t('Routines')} desc=${`Scheduled jobs your agent runs on its own, in your timezone (${tz}). The morning brief is a routine.${api.isLocal() ? ' In this standalone edition, routines run while the app is open.' : ''}`}>
    <${Group}>
      ${routines.map((r) => edit === r.id ? html`<${RoutineForm} r=${r} onDone=${() => setEdit(null)} />` : html`<div class="item" style="align-items:flex-start">
        <${Icon} name="clock" />
        <div class="txt"><b>${r.title} · ${r.time}</b><small>${r.days?.length === 7 ? 'Every day' : (r.days || []).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')} · ${r.mode === 'task' ? 'background task' : 'in chat'}${r.lastRun ? ` · last run ${fmtTime(r.lastRun)}` : ''}</small><small dir="auto">${r.prompt}</small>
          <div class="row" style="gap:2px;margin:6px 0 0 -8px">
            <button class="btn ghost sm" onClick=${() => api.post(`/api/routines/${r.id}/run`).then(() => toast({ title: r.title, body: 'Running now', ms: 1500 }))}><${Icon} name="play" size="sm" />${t('Run now')}</button>
            <button class="btn ghost sm" onClick=${() => setEdit(r.id)}><${Icon} name="edit" size="sm" />${t('Edit')}</button>
            <button class="btn ghost sm" onClick=${() => api.del(`/api/routines/${r.id}`)}><${Icon} name="trash" size="sm" />${t('Delete')}</button>
          </div></div>
        <${Toggle} on=${r.enabled} onChange=${(v) => api.patch(`/api/routines/${r.id}`, { enabled: v })} label="Enabled" />
      </div>`)}
      ${edit === 'new' ? html`<${RoutineForm} onDone=${() => setEdit(null)} />` : html`<div class="item link" onClick=${() => setEdit('new')}><${Icon} name="plus" /><div class="txt"><b>${t('Add')} routine</b></div></div>`}
    <//>
  <//>`;
}

/* ═════════════ Tools & connectors ═════════════ */
const BUILTINS = [
  ['artifacts', 'Make (artifacts)', 'Pages, dashboards, decks, docs and checklists.'],
  ['tasks', 'Background tasks', 'Long-running jobs that report back.'],
  ['memory', 'Memory', 'Save and forget facts.'],
  ['routines', 'Routines', 'Let the agent schedule recurring jobs.'],
  ['email', 'Email', 'Draft emails (and send via SMTP if configured).'],
  ['notify', 'Push notifications', 'Ping your phone when something needs you.'],
  ['shell', 'Run commands', 'PowerShell / bash on a paired device or this server.'],
  ['files', 'Files', 'Read, write and list files on devices.'],
  ['device', 'Device control', 'Open apps/URLs, screenshots, desktop notifications.'],
  ['http', 'HTTP requests', 'Call APIs and webhooks from the server.'],
];

function McpForm({ cfg, onDone }) {
  const [f, setF] = useState(cfg || { id: 'mcp_' + Math.random().toString(36).slice(2, 8), name: '', command: '', args: [], env: {}, url: '', enabled: true, trusted: false });
  const [argsText, setArgs] = useState((f.args || []).join('\n'));
  const [envText, setEnv] = useState(Object.entries(f.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
  const save = async () => {
    const next = { ...f, args: argsText.split('\n').map((x) => x.trim()).filter(Boolean), env: Object.fromEntries(envText.split('\n').map((l) => l.trim()).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) };
    const list = (S().tools.mcpServers || []).filter((x) => x.id !== next.id);
    await saveSettings({ tools: { mcpServers: [...list, next] } }, { quiet: false });
    onDone();
  };
  return html`<div class="item col" style="background:var(--surface)">
    <div class="row"><input class="input grow" placeholder="Name (e.g. github)" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></div>
    <div class="field"><label>Command (stdio) — or leave empty and use URL</label><input class="input" placeholder="npx" value=${f.command} onInput=${(e) => setF({ ...f, command: e.target.value })} spellcheck="false" /></div>
    <div class="field"><label>Arguments (one per line)</label><textarea class="textarea code" style="min-height:70px" placeholder=${'-y\n@modelcontextprotocol/server-github'} value=${argsText} onInput=${(e) => setArgs(e.target.value)}></textarea></div>
    <div class="field"><label>Environment (KEY=value per line)</label><textarea class="textarea code" style="min-height:60px" placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_…" value=${envText} onInput=${(e) => setEnv(e.target.value)}></textarea></div>
    <div class="field"><label>URL (Streamable HTTP server)</label><input class="input" placeholder="https://example.com/mcp" value=${f.url} onInput=${(e) => setF({ ...f, url: e.target.value })} spellcheck="false" /></div>
    <div class="row" style="justify-content:space-between"><label class="row" style="font-size:var(--fs-sm)"><${Toggle} on=${f.trusted} onChange=${(v) => setF({ ...f, trusted: v })} /> Trusted (run its tools without asking)</label>
      <div class="row"><button class="btn ghost sm" onClick=${onDone}>${t('Cancel')}</button><button class="btn primary sm" disabled=${!f.name || (!f.command && !f.url)} onClick=${save}>${t('Save')}</button></div></div>
  </div>`;
}

export function ToolsSection() {
  const tools = useStore((s) => s.settings.tools);
  const email = useStore((s) => s.settings.email);
  const mcp = useStore((s) => s.mcp);
  const emailOk = useStore((s) => s.emailConfigured);
  const [edit, setEdit] = useState(null);
  const [blocked, setBlocked] = useState((tools.blockedCommands || []).join('\n'));
  const setT = (patch) => saveSettings({ tools: patch });
  const removeMcp = (id) => setT({ mcpServers: tools.mcpServers.filter((x) => x.id !== id) });
  return html`<${Page} title=${t('Tools & connectors')} desc="What your agent can use. Sensitive tools still follow the approval rules in Agent & autonomy.">
    <${Group} title="Built-in tools">
      ${BUILTINS.filter(([k]) => !(api.isLocal() && ['shell', 'files', 'device'].includes(k))).map(([k, title, desc]) => html`<${ToggleItem} title=${title} desc=${desc} value=${tools.builtins[k]} onChange=${(v) => setT({ builtins: { [k]: v } })} />`)}
    <//>
    ${!api.isLocal() && html`<${Group} title="Connected services (MCP)">
      <div class="item"><div class="txt"><small>Connect any Model Context Protocol server: GitHub, Google Drive, Slack, databases, browsers, your own scripts. Their tools become available to the agent.</small></div>
        <button class="btn outline sm" onClick=${() => api.post('/api/mcp/reload').then(() => toast({ title: 'MCP reloaded', ms: 1200 }))}><${Icon} name="refresh" size="sm" />Reload</button></div>
      ${(tools.mcpServers || []).map((c) => edit === c.id ? html`<${McpForm} cfg=${c} onDone=${() => setEdit(null)} />` : html`<div class="item">
        <${Icon} name="plug" />
        <div class="txt"><b>${c.name}</b><small>${c.url || [c.command, ...(c.args || [])].join(' ')}</small>
          ${(() => { const st = mcp.find((m) => m.id === c.id); return st ? html`<small><span class=${`badge ${st.status === 'ready' ? 'ok' : st.status === 'error' ? 'bad' : 'no'}`}>${st.status}</span> ${st.error || (st.tools.length ? `${st.tools.length} tools: ${st.tools.slice(0, 6).join(', ')}${st.tools.length > 6 ? '…' : ''}` : '')}</small>` : c.enabled === false ? html`<small>disabled</small>` : null; })()}</div>
        <button class="icon-btn sm" aria-label=${t('Edit')} onClick=${() => setEdit(c.id)}><${Icon} name="edit" size="sm" /></button>
        <button class="icon-btn sm" aria-label=${t('Delete')} onClick=${() => removeMcp(c.id)}><${Icon} name="trash" size="sm" /></button>
        <${Toggle} on=${c.enabled !== false} onChange=${(v) => setT({ mcpServers: tools.mcpServers.map((x) => (x.id === c.id ? { ...x, enabled: v } : x)) })} />
      </div>`)}
      ${edit === 'new' ? html`<${McpForm} onDone=${() => setEdit(null)} />` : html`<div class="item link" onClick=${() => setEdit('new')}><${Icon} name="plus" /><div class="txt"><b>Add MCP server</b></div></div>`}
    <//>`}
    ${!api.isStatic() && html`<${TelegramGroup} />`}
    ${!api.isLocal() && html`<${Group} title=${html`Email (SMTP) ${emailOk ? html`<span class="badge ok">connected</span>` : html`<span class="badge no">not set — Send opens your mail app</span>`}`}>
      <${TextItem} title="SMTP host" value=${email.smtpHost} placeholder="smtp.gmail.com" onSave=${(v) => saveSettings({ email: { smtpHost: v } })} />
      <${TextItem} title="Port" type="number" value=${email.smtpPort} onSave=${(v) => saveSettings({ email: { smtpPort: v } })} width=${100} />
      <${ToggleItem} title="Use TLS (port 465)" value=${email.secure} onChange=${(v) => saveSettings({ email: { secure: v } })} />
      <${TextItem} title="Username" value=${email.user} onSave=${(v) => saveSettings({ email: { user: v } })} />
      <${SecretItem} title="Password / app password" value=${email.pass} placeholder="••••" onSave=${(v) => saveSettings({ email: { pass: v } })} />
      <${TextItem} title="From" value=${email.from} placeholder="Sara <sara@example.com>" onSave=${(v) => saveSettings({ email: { from: v } })} />
    <//>`}
    ${!api.isLocal() && html`<${Group} title="Command safety">
      <${TextItem} title="Command timeout (seconds)" type="number" value=${tools.shellTimeoutSec} onSave=${(v) => setT({ shellTimeoutSec: v })} width=${100} />
      <div class="item col"><div class="txt"><b>Blocked commands</b><small>Any command containing one of these lines is refused, even if approved.</small></div>
        <textarea class="textarea code" style="min-height:110px" value=${blocked} onInput=${(e) => setBlocked(e.target.value)}></textarea>
        <div class="row" style="justify-content:flex-end"><button class="btn primary sm" onClick=${() => setT({ blockedCommands: blocked.split('\n').map((x) => x.trim()).filter(Boolean) })}>${t('Save')}</button></div></div>
    <//>`}
  <//>`;
}

/* ═════════════ Telegram ═════════════ */
function TelegramGroup() {
  const tg = useStore((s) => s.settings.integrations?.telegram || {});
  const st = useStore((s) => s.integrations?.telegram || {});
  const set = (patch) => saveSettings({ integrations: { telegram: patch } });
  const link = st.bot && st.pairCode ? `https://t.me/${st.bot}?start=${st.pairCode}` : '';
  return html`<${Group} title=${html`Telegram ${st.status === 'connected' ? html`<span class="badge ok">@${st.bot}</span>` : st.status === 'error' ? html`<span class="badge bad">error</span>` : ''}`}>
    <div class="item"><div class="txt"><small>Chat with your agent and approve actions from Telegram, wherever you are. Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> (send /newbot), then paste its token here. Only chats you pair can talk to it.</small></div></div>
    <${SecretItem} title="Bot token" value=${tg.botToken} placeholder="123456:ABC-…" onSave=${(v) => set({ botToken: v, enabled: true })} />
    <${ToggleItem} title="Enabled" desc=${st.error || (st.status === 'connected' ? 'Connected. New replies, approvals and email drafts are sent to paired chats.' : 'Off')} value=${tg.enabled} onChange=${(v) => set({ enabled: v })} />
    ${st.status === 'connected' && html`<div class="item col">
      <div class="txt"><b>Pair a chat</b><small>Open the link on your phone and press Start — or send this code to @${st.bot}:</small></div>
      <${CopyBox} text=${st.pairCode} />
      ${link && html`<a class="btn primary sm" style="align-self:flex-start" href=${link} target="_blank" rel="noopener">Open in Telegram</a>`}
    </div>`}
    ${(tg.chats || []).map((c) => html`<div class="item"><${Icon} name="chat" /><div class="txt"><b>${c.name}</b><small>Paired ${fmtTime(c.linkedAt)}</small></div>
      <button class="btn ghost sm" onClick=${() => set({ chats: tg.chats.filter((x) => x.id !== c.id) })}>Unlink</button></div>`)}
  <//>`;
}

/* ═════════════ Devices ═════════════ */
// Browser / Android edition: devices need a Covo server; offer to connect to one.
function ConnectServer() {
  const inApp = /CovoApp/.test(navigator.userAgent);
  const [url, setUrl] = useState(localStorage.getItem('covo:serverUrl') || '');
  const unreachable = sessionStorage.getItem('covo:serverUnreachable');
  const go = () => {
    let u = url.trim();
    if (!u) return;
    // Bare LAN addresses (192.168.1.5:8787, from the desktop app's tray) are plain HTTP; domains get HTTPS.
    if (!/^https?:\/\//.test(u)) u = (/^(\d{1,3}\.){3}\d{1,3}|:\d+$/.test(u) ? 'http://' : 'https://') + u;
    if (inApp) localStorage.setItem('covo:serverUrl', u); // the Android app remembers it and opens it on launch
    location.href = u;
  };
  return html`<${Page} title=${t('Devices')} desc="You're using the standalone edition: everything runs inside this app and stays on this device.">
    <${Group} title="Use your computers">
      <div class="item"><div class="txt"><small>To let the agent run commands, manage files and use your PCs, run Covo as a <b>desktop app</b> or on a <b>server/VPS</b> — then connect this app to it. Your server keeps its own data and settings.</small></div></div>
      ${unreachable && html`<div class="item"><span class="badge bad">Couldn't reach ${unreachable} — showing the local edition.</span></div>`}
      <div class="item"><input class="input grow" placeholder="https://covo.example.com" value=${url} onInput=${(e) => setUrl(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && go()} inputmode="url" autocapitalize="off" spellcheck="false" />
        <button class="btn primary sm" disabled=${!url.trim()} onClick=${go}>Connect</button></div>
      <div class="item"><div class="txt"><small>${inApp ? 'The app will open your server from now on. To come back to the local edition, open your profile there and choose “Use on this device instead”.' : 'Tip: on your server you can install Covo as an app (browser menu → Install) to get notifications.'}</small></div></div>
    <//>
  <//>`;
}

export function DevicesSection() {
  if (api.isLocal()) return html`<${ConnectServer} />`;
  const devices = useStore((s) => s.devices);
  const tools = useStore((s) => s.settings.tools);
  const def = useStore((s) => s.settings.devices.defaultTarget);
  const server = useStore((s) => s.server);
  const [pair, setPair] = useState(null);
  const [name, setName] = useState('My computer');
  const [confirm, setConfirm] = useState(null);
  const doPair = async () => { const r = await api.post('/api/devices/pair', { name }); setPair(r); };
  const srv = devices.find((d) => d.id === 'server');
  return html`<${Page} title=${t('Devices')} desc=${`Where your agent can act: ${srv?.desktop ? 'this computer' : 'this server'}, and any computer you pair (Windows, macOS, Linux). Every sensitive action still asks you first.`}>
    <${Group} title=${srv?.desktop ? 'This computer' : 'This server'}>
      <${ToggleItem} title=${`Let the agent use ${srv?.name || 'this server'}`} desc=${srv?.desktop ? `Run commands and work with files on this computer (${server.platform}). Each sensitive action still asks you first.` : `Run commands and files on the machine running Covo (${server.platform}). Turn on when Covo runs on your own PC; keep off on a shared VPS.`} value=${tools.serverExecution} onChange=${(v) => saveSettings({ tools: { serverExecution: v } })} />
      <${TextItem} title="Work folder" desc=${`Default folder for files and commands on ${srv?.desktop ? "this computer" : "this server"}.`} value=${tools.workDir} onSave=${(v) => saveSettings({ tools: { workDir: v } })} width=${300} />
    <//>
    <${Group} title="Paired devices">
      ${devices.filter((d) => d.kind === 'runner').map((d) => html`<div class="item">
        <${Icon} name=${/win|darwin|linux/.test(d.platform) ? 'monitor' : 'cpu'} />
        <div class="txt"><b>${d.name}</b><small>${d.online ? `Online · ${d.platform} · ${d.info?.hostname || ''}${d.workdir ? ` · ${d.workdir}` : ''}` : `Offline${d.lastSeen ? ` · last seen ${fmtTime(d.lastSeen)}` : ''}`}</small></div>
        <span class="pill"><span class=${cx('d', d.online && 'on')}></span>${d.online ? 'online' : 'offline'}</span>
        <button class="icon-btn sm" aria-label="Revoke" title="Revoke" onClick=${() => setConfirm(d)}><${Icon} name="trash" size="sm" /></button>
      </div>`)}
      ${!devices.some((d) => d.kind === 'runner') && html`<div class="item"><span class="hint">No paired devices yet. Pair your PC so the agent can work on it — even when Covo runs on a VPS.</span></div>`}
      <div class="item col">
        ${!pair ? html`<div class="row"><input class="input grow" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Device name" /><button class="btn primary sm" onClick=${doPair}><${Icon} name="link" size="sm" />Pair a device</button></div>`
        : html`<div class="stack" style="gap:10px">
          <b>Pair "${pair.name}"</b>
          <div class="hint">1. Install Node.js 20+ on that computer. 2. Download the runner (3 files) into a folder. 3. Run the command. The token is shown once.</div>
          <div class="row" style="flex-wrap:wrap">${['covo-device.js', 'tools.js', 'package.json', 'start-device.bat', 'start-device.sh'].map((f) => html`<a class="btn outline sm" href=${`/device/${f}`} download>${f}</a>`)}</div>
          <div class="label">Windows (PowerShell)</div>
          <${CopyBox} text=${`npm install; node covo-device.js --server ${pair.server} --token ${pair.token} --name "${pair.name}"`} />
          <div class="label">macOS / Linux</div>
          <${CopyBox} text=${`npm install && node covo-device.js --server ${pair.server} --token ${pair.token} --name "${pair.name}"`} />
          <div class="hint">Behind a VPS with HTTPS, use your https:// address. The runner reconnects automatically and can be added to startup (see docs/DEVICES.md).</div>
          <button class="btn outline sm" onClick=${() => setPair(null)}>Done</button>
        </div>`}
      </div>
    <//>
    <${Group} title="Default device">
      <${SelectItem} title="Run computer tools on" desc=${`Auto = first online paired device, else ${srv?.desktop ? 'this computer' : 'this server'} (if allowed).`} value=${def} onChange=${(v) => saveSettings({ devices: { defaultTarget: v } })} options=${[{ id: 'auto', name: 'Auto' }, ...devices.map((d) => ({ id: d.id, name: d.name }))]} width=${240} />
    <//>
    ${confirm && html`<${Confirm} title="Revoke device?" body=${`"${confirm.name}" will be disconnected and its token stops working.`} confirm="Revoke" onYes=${() => api.del(`/api/devices/${confirm.id}`)} onClose=${() => setConfirm(null)} />`}
  <//>`;
}

/* ═════════════ Notifications ═════════════ */
export function NotificationsSection() {
  const n = useStore((s) => s.settings.notifications);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const set = (patch) => saveSettings({ notifications: patch });
  const secure = window.isSecureContext;
  return html`<${Page} title=${t('Notifications')} desc="Lock-screen pings like “Morning, Sara. 5 things in progress and 2 that need you.”">
    <${Group} title="This device">
      <${Item} title="Push notifications" desc=${!secure ? 'Needs HTTPS (or localhost). On a VPS use the Caddy setup; on your phone install the app to the home screen.' : perm === 'granted' ? 'Enabled on this device.' : perm === 'denied' ? 'Blocked in browser settings.' : 'Allow notifications on this device.'}>
        <button class="btn primary sm" disabled=${!secure || perm === 'denied'} onClick=${async () => { try { await enablePush(); setPerm(Notification.permission); toast({ title: 'Notifications on', ms: 1500 }); } catch (e) { toast({ title: 'Push', body: e.message }); } }}>${perm === 'granted' ? 'Re-subscribe' : 'Enable'}</button>
      <//>
      <${Item} title="Send a test"><button class="btn outline sm" onClick=${() => api.post('/api/push/test').then((r) => toast({ title: 'Sent', body: `${r.subscribers} subscribed device(s)`, ms: 2000 }))}>Test</button><//>
    <//>
    <${Group} title="Notify me about">
      <${ToggleItem} title="Approvals" desc="Payments, messages and actions waiting for your OK." value=${n.notifyApprovals} onChange=${(v) => set({ notifyApprovals: v })} />
      <${ToggleItem} title="Task updates" desc="Results, questions and finished tasks." value=${n.notifyTasks} onChange=${(v) => set({ notifyTasks: v })} />
      <${ToggleItem} title="Morning brief" value=${n.notifyBrief} onChange=${(v) => set({ notifyBrief: v })} />
      <${ToggleItem} title="Web Push" desc="Send to installed apps / browsers." value=${n.webPush} onChange=${(v) => set({ webPush: v })} />
    <//>
    <${Group} title="Quiet hours">
      <${ToggleItem} title="Enable quiet hours" desc="Hold non-urgent notifications overnight." value=${n.quietHours.enabled} onChange=${(v) => set({ quietHours: { enabled: v } })} />
      <${Item} title="From – to"><div class="row"><input class="input" type="time" style="width:120px" value=${n.quietHours.from} onChange=${(e) => set({ quietHours: { from: e.target.value } })} /><span>–</span><input class="input" type="time" style="width:120px" value=${n.quietHours.to} onChange=${(e) => set({ quietHours: { to: e.target.value } })} /></div><//>
    <//>
    <${Group} title="ntfy (optional)">
      <${TextItem} title="ntfy topic URL" desc="Also send to ntfy.sh or your own ntfy server — works on any phone without installing the PWA." value=${n.ntfyUrl} placeholder="https://ntfy.sh/my-secret-covo-topic" onSave=${(v) => set({ ntfyUrl: v })} width=${320} />
    <//>
  <//>`;
}

/* ═════════════ Security ═════════════ */
export function SecuritySection() {
  const [data, setData] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [newTok, setNewTok] = useState(null);
  const [tokName, setTokName] = useState('');
  const days = useStore((s) => s.settings.security.sessionDays);
  const load = () => api.get('/api/security').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  const change = async () => {
    try { await api.post('/api/security/password', pw); setPw({ current: '', next: '' }); toast({ title: data?.hasPassword ? 'Password changed' : 'Password set', body: 'Other sessions were signed out.' }); load(); }
    catch (e) { toast({ title: 'Password', body: e.message }); }
  };
  return html`<${Page} title=${t('Security & access')} desc="Who can open your agent, and how outside apps connect to it.">
    <${Group} title="Password">
      <div class="item col">
        ${data && !data.hasPassword && html`<div class="hint" style="margin:0">No password yet: only this app can open Covo. Set one to sign in from your phone or another computer.</div>`}
        ${data?.hasPassword !== false && !data?.desktop && html`<input class="input" type="password" placeholder="Current password" value=${pw.current} onInput=${(e) => setPw({ ...pw, current: e.target.value })} autocomplete="current-password" />`}
        <input class="input" type="password" placeholder="New password (6+ characters)" value=${pw.next} onInput=${(e) => setPw({ ...pw, next: e.target.value })} autocomplete="new-password" />
        <div class="row" style="justify-content:flex-end"><button class="btn primary sm" disabled=${(data?.hasPassword !== false && !data?.desktop && !pw.current) || pw.next.length < 6} onClick=${change}>${data?.hasPassword === false ? 'Set password' : 'Change password'}</button></div>
        <div class="hint">${data?.desktop ? 'The desktop app doesn\'t need the old password: just set a new one. Needed to open Covo from your phone (tray → Allow phone access).' : html`Forgot it? On the server run <code>npm run reset-password -- newpass</code>.`}</div>
      </div>
      <${TextItem} title="Stay signed in (days)" type="number" value=${days} onSave=${(v) => saveSettings({ security: { sessionDays: v } })} width=${100} />
    <//>
    <${Group} title="Signed-in sessions">
      ${data?.sessions.map((s) => html`<div class="item"><${Icon} name=${/Mobile|Android|iPhone/.test(s.ua) ? 'phone' : 'monitor'} /><div class="txt"><b style="font-weight:400">${s.ua.slice(0, 70) || 'Unknown device'}</b><small>Last active ${fmtTime(s.lastSeen)} · since ${fmtTime(s.createdAt)}</small></div>
        <button class="btn ghost sm" onClick=${() => api.del(`/api/security/sessions/${s.id}`).then(load)}>${t('Sign out')}</button></div>`)}
      <div class="item"><div class="txt"></div><button class="btn outline sm" onClick=${() => api.post('/api/security/signout-others').then(load)}>Sign out all other sessions</button></div>
    <//>
    <${Group} title="API tokens">
      <div class="item"><div class="txt"><small>Connect scripts, shortcuts (iOS Shortcuts, Tasker), n8n/Zapier or other apps. Send <code>Authorization: Bearer covo_…</code>. See docs/API.md.</small></div></div>
      ${data?.tokens.map((x) => html`<div class="item"><${Icon} name="key" /><div class="txt"><b>${x.name}</b><small>Created ${fmtTime(x.createdAt)}${x.lastUsed ? ` · last used ${fmtTime(x.lastUsed)}` : ''}</small></div><button class="btn ghost sm" onClick=${() => api.del(`/api/security/tokens/${x.id}`).then(load)}>Revoke</button></div>`)}
      ${newTok && html`<div class="item col"><b>Copy your token now — it won't be shown again.</b><${CopyBox} text=${newTok.token} />
        <div class="hint">Example:</div><${CopyBox} text=${`curl -X POST ${location.origin}/api/messages -H "Authorization: Bearer ${newTok.token}" -H "Content-Type: application/json" -d '{"text":"What needs me today?"}'`} /></div>`}
      <div class="item"><input class="input grow" placeholder="Token name (e.g. iPhone Shortcut)" value=${tokName} onInput=${(e) => setTokName(e.target.value)} /><button class="btn primary sm" onClick=${async () => { setNewTok(await api.post('/api/security/tokens', { name: tokName || 'API token' })); setTokName(''); load(); }}>Create</button></div>
    <//>
  <//>`;
}

/* ═════════════ Data ═════════════ */
// In the standalone edition there is no server URL to link to: fetch through the transport and save a blob.
const downloadVia = (path) => async (e) => {
  if (!api.isStatic()) return;
  e.preventDefault();
  const r = await api.raw('GET', path);
  saveBlob(new Blob([r.body], { type: r.type }), r.filename || path.split('/').pop());
};
export function DataSection() {
  const server = useStore((s) => s.server);
  const [confirm, setConfirm] = useState(null);
  const importFile = async (f) => {
    if (!f) return;
    try { await api.post('/api/import', await f.arrayBuffer()); toast({ title: 'Backup restored' }); }
    catch (e) { toast({ title: 'Import failed', body: e.message }); }
  };
  return html`<${Page} title=${t('Data')} desc=${html`${api.isLocal() ? "Everything lives on this device, in the app's private storage." : html`Everything lives on ${window.covoDesktop ? 'this computer' : 'your server'} in <code>${server.dataDir}</code>.`} Nothing is sent anywhere except to the services you connect.`}>
    <${Group} title="Backup">
      <${Item} title="Export everything" desc="Settings, thread, tasks, memory, routines, artifacts metadata (JSON)."><a class="btn outline sm" href="/api/export" download onClick=${downloadVia('/api/export')}><${Icon} name="download" size="sm" />${t('Download')}</a><//>
      <${Item} title="Export the conversation" desc="The whole thread as a readable Markdown file."><a class="btn outline sm" href="/api/export/thread.md" download onClick=${downloadVia('/api/export/thread.md')}><${Icon} name="download" size="sm" />Markdown</a><//>
      <${Item} title="Restore from backup" desc="Replaces current data."><label class="btn outline sm"><${Icon} name="upload" size="sm" />Import<input type="file" accept="application/json" hidden onChange=${(e) => importFile(e.target.files[0])} /></label><//>
    <//>
    <${Group} title="Reset" cls="danger-zone">
      <${Item} title="Clear the thread" desc="Deletes chat history and topics. Keeps tasks, artifacts, memory and settings."><button class="btn danger sm" onClick=${() => setConfirm('conversation')}>Clear</button><//>
      <${Item} title="Restart the demo" desc="Plays the sample story from the start."><button class="btn outline sm" onClick=${() => setConfirm('demo')}>Restart</button><//>
      <${Item} title="Erase everything" desc=${api.isLocal() ? 'Removes all data and settings on this device.' : 'Removes all data and settings (your password stays).'}><button class="btn danger sm" onClick=${() => setConfirm('all')}>Erase</button><//>
    <//>
    ${confirm && html`<${Confirm} title=${confirm === 'all' ? 'Erase everything?' : confirm === 'demo' ? 'Restart the demo?' : 'Clear the thread?'} body="This can't be undone. Export a backup first if you might need it." confirm=${confirm === 'demo' ? 'Restart' : 'Delete'} onYes=${() => api.post('/api/reset', { scope: confirm }).then(() => toast({ title: 'Done', ms: 1200 }))} onClose=${() => setConfirm(null)} />`}
  <//>`;
}

/* ═════════════ Developer ═════════════ */
export function DeveloperSection() {
  const d = useStore((s) => s.settings.developer);
  const usage = useStore((s) => s.usage);
  const [logs, setLogs] = useState([]);
  const [raw, setRaw] = useState('');
  const [ov, setOv] = useState(d.requestOverrides || '{}');
  const loadLogs = () => api.get('/api/logs').then(setLogs).catch(() => {});
  useEffect(() => { loadLogs(); setRaw(JSON.stringify(get().settings, null, 2)); }, []);
  const saveRaw = async () => { try { await saveSettings(JSON.parse(raw), { quiet: false }); } catch (e) { toast({ title: 'Invalid JSON', body: e.message }); } };
  const saveOv = async () => { try { JSON.parse(ov); await saveSettings({ developer: { requestOverrides: ov } }, { quiet: false }); } catch (e) { toast({ title: 'Invalid JSON', body: e.message }); } };
  return html`<${Page} title=${t('Developer')} desc="Full access. Everything here is also editable in data/settings.json and the source code (MIT).">
    <${Group}>
      <${ToggleItem} title="Developer mode" desc="Shows tool calls in the thread and token usage." value=${d.enabled} onChange=${(v) => saveSettings({ developer: { enabled: v } })} />
      <${ToggleItem} title="Show tool calls" value=${d.showToolCalls} onChange=${(v) => saveSettings({ developer: { showToolCalls: v } })} />
      <${ToggleItem} title="Show usage" value=${d.showUsage} onChange=${(v) => saveSettings({ developer: { showUsage: v } })} />
    <//>
    ${usage && html`<${Group} title="Usage (all time)"><div class="item"><div class="txt"><small>${usage.requests} model requests · ${usage.inputTokens.toLocaleString()} input · ${usage.outputTokens.toLocaleString()} output · ${usage.cacheReadTokens.toLocaleString()} cache-read · ${usage.cacheWriteTokens.toLocaleString()} cache-write tokens</small></div></div><//>`}
    <${Group} title="Request overrides (JSON merged into every Claude request)">
      <div class="item col"><textarea class="textarea code" style="min-height:90px" value=${ov} onInput=${(e) => setOv(e.target.value)}></textarea>
        <div class="row" style="justify-content:space-between"><span class="hint">e.g. {"max_tokens": 64000} or {"metadata": {"user_id": "sara"}}</span><button class="btn primary sm" onClick=${saveOv}>${t('Save')}</button></div></div>
    <//>
    <${Group} title="Raw settings (secrets masked; leave masked values to keep them)">
      <div class="item col"><textarea class="textarea code" style="min-height:300px" value=${raw} onInput=${(e) => setRaw(e.target.value)}></textarea>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost sm" onClick=${() => setRaw(JSON.stringify(get().settings, null, 2))}>Reload</button><button class="btn primary sm" onClick=${saveRaw}>${t('Save')}</button></div></div>
    <//>
    <${Group} title="Server log">
      <div class="item col"><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" onClick=${loadLogs}><${Icon} name="refresh" size="sm" />Refresh</button></div>
        <pre class="textarea code" style="min-height:220px;max-height:420px;overflow:auto;margin:0;white-space:pre-wrap">${logs.slice(-200).map((l) => `${new Date(l.ts).toLocaleTimeString()} ${l.level.toUpperCase()} ${l.msg}`).join('\n')}</pre></div>
    <//>
  <//>`;
}

/* ═════════════ About ═════════════ */
const edition = () => window.covoDesktop ? `Desktop app (${{ win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[window.covoDesktop.platform] || window.covoDesktop.platform})`
  : /CovoApp/.test(navigator.userAgent) ? (api.isLocal() ? 'Android app · runs on this phone' : 'Android app · connected to your server')
  : api.isLocal() ? 'Browser edition · runs in this browser' : 'Server · open from any browser';

export function AboutSection() {
  const s = useStore((x) => x);
  const [upd, setUpd] = useState(null);
  const check = async () => {
    setUpd({ busy: true });
    try {
      const r = await fetch(`${repoApi()}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status === 404 ? 'No releases published yet' : `GitHub ${r.status}`);
      const j = await r.json();
      const latest = String(j.tag_name || '').replace(/^v/, '');
      setUpd({ latest, url: j.html_url, newer: latest && latest !== s.version });
    } catch (e) { setUpd({ error: e.message }); }
  };
  const link = (path) => `${BRAND.repo}${path}`;
  return html`<${Page} title=${t('About')}>
    <${Group}>
      <${Item} title=${BRAND.name} desc="Open-source, self-hosted autonomous AI agent. MIT licensed — fork it, change it, ship it."><span class="pill">v${s.version}</span><//>
      <${Item} title="Edition" desc=${edition()} />
      <${Item} title="Designed and built by" desc="Ethos — concept, product design, interface, agent architecture and every edition." />
      ${s.server?.hostname && html`<${Item} title="Running on" desc=${`${s.server.hostname} · ${s.server.platform} · Node ${s.server.node}`} />`}
      <${Item} title="Model" desc=${s.provider === 'demo' ? 'Demo mode' : `${s.provider} · ${s.settings.provider?.[s.provider]?.model || ''}`} />
      <${Item} title="Updates" desc=${upd?.busy ? 'Checking…' : upd?.error ? upd.error : upd?.latest ? (upd.newer ? `Version ${upd.latest} is available.` : 'You have the latest version.') : 'Checks GitHub for a newer release (only when you press the button).'}>
        ${upd?.newer ? html`<a class="btn primary sm" href=${upd.url} target="_blank" rel="noopener">Download</a>` : html`<button class="btn outline sm" onClick=${check} disabled=${upd?.busy}>Check for updates</button>`}
      <//>
    <//>
    <${Group} title="Feedback">
      <${Item} title="Send feedback or an idea" desc="Opens the project's GitHub page in your browser."><a class="btn outline sm" href=${link('/issues/new/choose')} target="_blank" rel="noopener">Open</a><//>
      <${Item} title="Report a bug"><a class="btn outline sm" href=${link('/issues/new?template=bug_report.yml')} target="_blank" rel="noopener">Report</a><//>
      <${Item} title="Report a security issue" desc="Privately, never in a public issue."><a class="btn outline sm" href=${link('/security/advisories/new')} target="_blank" rel="noopener">Report</a><//>
      <${Item} title="Source code"><a class="btn outline sm" href=${BRAND.repo} target="_blank" rel="noopener">GitHub</a><//>
    <//>
    <${Group} title="Legal">
      ${Object.entries(LEGAL_DOCS).map(([f, title]) => html`<div class="item link" onClick=${() => openLegal(f)}><div class="txt"><b>${title}</b></div><${Icon} name="right" size="sm" cls="flip-rtl" /></div>`)}
    <//>
    <${Group} title="Keyboard (desktop)">
      <div class="item"><div class="txt"><small><span class="kbd">Enter</span> send · <span class="kbd">Shift</span>+<span class="kbd">Enter</span> new line · <span class="kbd">/</span> search · <span class="kbd">,</span> settings · <span class="kbd">1</span>/<span class="kbd">2</span>/<span class="kbd">3</span> Chat/Tasks/Make · <span class="kbd">Esc</span> close</small></div></div>
    <//>
    <p class="legal-note" style="margin:18px 0 0">${BRAND.name} is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Anthropic, PBC. "Claude" is a trademark of Anthropic, PBC; other names belong to their owners.</p>
  <//>`;
}
