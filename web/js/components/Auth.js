import { html, useState } from '../../vendor/preact-htm.js';
import { api } from '../api.js';
import { set } from '../store.js';
import { t, setLang, getLang } from '../lib/i18n.js';
import { Icon } from '../lib/icons.js';
import { Orb } from './Orb.js';
import { Seg, cx } from './ui.js';
import { THEMES } from './settings/sections.js';
import { applyAppearance } from '../theme.js';
import { openLegal } from './Legal.js';

const LegalNote = ({ action = 'continuing' }) => html`<p class="legal-note">By ${action} you agree to the <a onClick=${() => openLegal('TERMS.md')}>Terms of Use</a> and <a onClick=${() => openLegal('PRIVACY.md')}>Privacy notice</a>.<br />Covo is an independent open-source project, not affiliated with Anthropic.</p>`;

export function Login({ appName }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api.post('/api/auth/login', { password: pw }); await api.refresh(); }
    catch (e2) { setErr(e2.status === 401 ? t('Wrong password') : e2.message); }
    setBusy(false);
  };
  return html`<div class="auth"><form class="auth-card" onSubmit=${submit}>
    <${Orb} state="idle" />
    <h1>${appName || 'Covo'}</h1>
    <p class="lead">Welcome back.</p>
    <input class="input" type="password" autofocus placeholder=${t('Password')} value=${pw} onInput=${(e) => setPw(e.target.value)} autocomplete="current-password" aria-label=${t('Password')} />
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn primary block" disabled=${busy || !pw}>${busy ? '…' : t('Sign in')}</button>
    <p class="legal-note"><a onClick=${() => openLegal('TERMS.md')}>Terms</a> · <a onClick=${() => openLegal('PRIVACY.md')}>Privacy</a></p>
  </form></div>`;
}

export function Setup() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', password: '', confirm: '', brain: 'claude', apiKey: '', baseURL: 'http://localhost:11434/v1', model: 'llama3.1', theme: 'classic', language: getLang() });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (patch) => setF({ ...f, ...patch });
  const steps = 5;

  const finish = async () => {
    setBusy(true); setErr('');
    try {
      await api.post('/api/auth/setup', { password: f.password, name: f.name, language: f.language, theme: f.theme, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (f.brain === 'claude' && f.apiKey) await api.put('/api/settings', { provider: { type: 'anthropic', anthropic: { apiKey: f.apiKey.trim() } } });
      if (f.brain === 'local') await api.put('/api/settings', { provider: { type: 'openai', openai: { baseURL: f.baseURL, model: f.model } } });
      setStep(4);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const card = (body) => html`<div class="auth"><div class="auth-card">
    <div class="steps-dots">${Array.from({ length: steps }, (_, i) => html`<i class=${i === step ? 'on' : ''}></i>`)}</div>${body}</div></div>`;

  if (step === 0) return card(html`
    <${Orb} state="idle" />
    <h1>Meet Covo.</h1>
    <p class="lead">An autonomous agent that runs things end to end — briefs you every morning, works in the background, and asks you only when it matters.</p>
    <div class="row" style="justify-content:center"><${Seg} value=${f.language} onChange=${(v) => { setLang(v); document.documentElement.dir = v === 'ar' ? 'rtl' : 'ltr'; up({ language: v }); }} options=${[{ id: 'en', label: 'English' }, { id: 'ar', label: 'العربية' }]} /></div>
    <button class="btn primary block" onClick=${() => setStep(1)}>${t('Get started')}</button>
    <${LegalNote} />`);

  if (step === 1) {
    const local = !!window.COVO_STANDALONE || !!window.covoDesktop;
    const ok = f.name.trim() && (local || (f.password.length >= 6 && f.password === f.confirm));
    return card(html`
      <h1 style="font-size:var(--fs-2xl)">Who's this for?</h1>
      <p class="lead">${local ? 'Your name personalizes the agent. Everything stays on this device.' : "Your name personalizes the agent. The password protects it — you'll use it on every device."}</p>
      <div class="field"><label>Your name</label><input class="input" value=${f.name} onInput=${(e) => up({ name: e.target.value })} placeholder="Sara" autofocus /></div>
      ${!local && html`<div class="field"><label>Password</label><input class="input" type="password" value=${f.password} onInput=${(e) => up({ password: e.target.value })} autocomplete="new-password" placeholder="6+ characters" /></div>
      <div class="field"><label>Confirm password</label><input class="input" type="password" value=${f.confirm} onInput=${(e) => up({ confirm: e.target.value })} autocomplete="new-password" /></div>
      ${f.confirm && f.password !== f.confirm && html`<div class="err">Passwords don't match</div>`}`}
      <div class="row"><button class="btn ghost" onClick=${() => setStep(0)}>${t('Back')}</button><button class="btn primary grow" disabled=${!ok} onClick=${() => setStep(2)}>${t('Continue')}</button></div>`);
  }

  if (step === 2) return card(html`
    <h1 style="font-size:var(--fs-2xl)">Choose its brain</h1>
    <p class="lead">You can change this anytime in Settings → Model.</p>
    <button class=${cx('choice', f.brain === 'claude' && 'on')} onClick=${() => up({ brain: 'claude' })}><${Icon} name="sparkle" /><div><b>Claude (recommended)</b><small>Best for autonomous, multi-step work. Needs an Anthropic API key.</small></div></button>
    ${f.brain === 'claude' && html`<input class="input" type="password" placeholder="sk-ant-… (optional now)" value=${f.apiKey} onInput=${(e) => up({ apiKey: e.target.value })} autocomplete="off" />
      <div class="hint">Get a key at console.anthropic.com → API keys. It's stored only on your server.</div>`}
    <button class=${cx('choice', f.brain === 'local' && 'on')} onClick=${() => up({ brain: 'local' })}><${Icon} name="cpu" /><div><b>Local or other model</b><small>Ollama, LM Studio, OpenRouter… any OpenAI-compatible endpoint${window.COVO_STANDALONE ? ' that allows browser access (CORS)' : ''}.</small></div></button>
    ${f.brain === 'local' && html`<input class="input" placeholder="Base URL" value=${f.baseURL} onInput=${(e) => up({ baseURL: e.target.value })} /><input class="input" placeholder="Model" value=${f.model} onInput=${(e) => up({ model: e.target.value })} />`}
    <button class=${cx('choice', f.brain === 'demo' && 'on')} onClick=${() => up({ brain: 'demo' })}><${Icon} name="play" /><div><b>Try the demo first</b><small>Plays a sample story so you can explore the UI.</small></div></button>
    <div class="row"><button class="btn ghost" onClick=${() => setStep(1)}>${t('Back')}</button><button class="btn primary grow" onClick=${() => setStep(3)}>${t('Continue')}</button></div>`);

  if (step === 3) return card(html`
    <h1 style="font-size:var(--fs-2xl)">Pick a look</h1>
    <p class="lead">Eleven themes, all editable. You can change it anytime.</p>
    <div class="theme-grid" style="padding:0;grid-template-columns:repeat(3,1fr)">${THEMES.slice(0, 9).map((th) => html`
      <button class=${cx('theme-sw', f.theme === th.id && 'on')} onClick=${() => { up({ theme: th.id }); applyAppearance({ theme: th.id }); }}>
        <div class="pv" style=${`background:${th.c[0]};height:56px`}><i style=${`width:70%;background:${th.c[1]}`}></i><i style=${`width:50%;align-self:flex-end;background:${th.c[2]}`}></i></div>
        <div class="nm" style="font-size:var(--fs-xs)">${th.name}</div></button>`)}</div>
    ${err && html`<div class="err">${err}</div>`}
    <div class="row"><button class="btn ghost" onClick=${() => setStep(2)}>${t('Back')}</button><button class="btn primary grow" disabled=${busy} onClick=${finish}>${busy ? '…' : t('Continue')}</button></div>`);

  return card(html`
    <${Orb} state="writing" />
    <h1 style="font-size:var(--fs-2xl)">You're set${f.name ? `, ${f.name.split(' ')[0]}` : ''}.</h1>
    <div class="stack" style="gap:10px;font-size:var(--fs-md);color:var(--ink-2)">
      <div class="row" style="align-items:flex-start"><${Icon} name="chat" /><span><b style="color:var(--ink)">Chat</b> is one continuous thread. Give it jobs in plain words.</span></div>
      <div class="row" style="align-items:flex-start"><${Icon} name="tasks" /><span><b style="color:var(--ink)">Tasks</b> shows what's running in the background and what needs you.</span></div>
      <div class="row" style="align-items:flex-start"><${Icon} name="make" /><span><b style="color:var(--ink)">Make</b> holds the pages, decks and docs it builds.</span></div>
      <div class="row" style="align-items:flex-start"><${Icon} name="cpu" /><span>Pair your PC in <b style="color:var(--ink)">Settings → Devices</b> so it can work on your computer.</span></div>
    </div>
    <button class="btn primary block" onClick=${() => api.refresh().then(() => set({ boot: 'ready' }))}>Open Covo</button>`);
}
