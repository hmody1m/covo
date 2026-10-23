import { html, useRef, useEffect, useLayoutEffect, useMemo } from '../../vendor/preact-htm.js';
import { useStore, setUI, get } from '../store.js';
import { renderMarkdown, splitBubbles, escapeHtml } from '../lib/md.js';
import { Icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { StatusIcon, fmtTime, cx, Sheet } from './ui.js';
import { api } from '../api.js';
import { toast } from '../store.js';
import { sendMessage } from './Composer.js';
import { ApprovalCard, ArtifactCard, EmailCard, TaskMini } from './Cards.js';

const STATUS_HTML = {
  done: '<span class="st done"><svg viewBox="0 0 24 24" class="icon"><path d="M20 6 9 17l-5-5"/></svg></span>',
  needs_you: '<span class="st needs_you"><span class="dot"></span></span>',
  in_progress: '<span class="st in_progress"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 1-8.5 6"/></svg></span>',
  active: '<span class="st active"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 1-8.5 6"/></svg></span>',
};

export function findTopic(label) {
  const l = label.toLowerCase().trim();
  const topics = get().topics;
  return topics.find((x) => x.title.toLowerCase() === l) || topics.find((x) => x.title.toLowerCase().startsWith(l)) || topics.find((x) => x.title.toLowerCase().includes(l));
}

const chip = (label) => {
  const tp = findTopic(label);
  const st = STATUS_HTML[tp?.status] || STATUS_HTML.active;
  return `<span class="chip" data-topic="${tp ? tp.id : ''}" role="button" tabindex="0">${st}${escapeHtml(label)}</span>`;
};

function TopicTag({ topic }) {
  return html`<div class="topic-tag" onClick=${() => setUI({ topicFilter: topic.id })} title=${topic.title}>
    <${StatusIcon} status=${topic.status} emoji=${topic.emoji} /><span>${topic.title}</span>
  </div>`;
}

function AssistantItem({ item, pacing, showTime }) {
  let parts = splitBubbles(item.text);
  if (item.streaming && pacing) parts = parts.slice(0, -1); // reveal complete paragraphs only
  if (!parts.length) return null;
  return html`<div class="msg" data-msg=${item.id} onContextMenu=${(e) => openMsgMenu(e, item)} ...${press(item)}>
    ${parts.map((p) => html`<div dir="auto" class=${cx('bubble ai', item.progress && 'progress')} dangerouslySetInnerHTML=${{ __html: renderMarkdown(p, { chip }) }}></div>`)}
    ${showTime && html`<span class="meta-time">${fmtTime(item.ts)}</span>`}
  </div>`;
}

function UserItem({ item, showTime }) {
  return html`<div class="msg me" data-msg=${item.id} onContextMenu=${(e) => openMsgMenu(e, item)} ...${press(item)}>
    ${item.attachments?.length > 0 && html`<div class="attachments">${item.attachments.map((a) => (/^image\//.test(a.type)
      ? html`<img src=${api.fileUrl(a)} alt=${a.name} />`
      : html`<span class="file-pill"><${Icon} name="file" size="sm" /><span>${a.name}</span></span>`))}</div>`}
    ${item.text && html`<div class="bubble me" dir="auto">${item.text}</div>`}
    ${item.via && html`<span class="meta-time">via ${item.via === 'telegram' ? 'Telegram' : item.via}</span>`}
    ${showTime && html`<span class="meta-time">${fmtTime(item.ts)}</span>`}
  </div>`;
}

// Long-press (mobile) or right-click (desktop) on a message → actions sheet.
let pressTimer = null;
const press = (item) => ({
  onTouchStart: () => { clearTimeout(pressTimer); pressTimer = setTimeout(() => { navigator.vibrate?.(10); setUI({ msgMenu: item.id }); }, 550); },
  onTouchMove: () => clearTimeout(pressTimer),
  onTouchEnd: () => clearTimeout(pressTimer),
});
function openMsgMenu(e, item) {
  if (window.getSelection?.().toString()) return; // let the user copy a selection normally
  e.preventDefault();
  setUI({ msgMenu: item.id });
}

export function MessageMenu() {
  const id = useStore((s) => s.ui.msgMenu);
  const item = useStore((s) => s.feed.find((f) => f.id === id));
  const feed = useStore((s) => s.feed);
  if (!id || !item) return null;
  const close = () => setUI({ msgMenu: null });
  const text = item.text || '';
  const lastUser = item.kind === 'user' ? item : [...feed.slice(0, feed.indexOf(item))].reverse().find((f) => f.kind === 'user');
  const act = (fn) => async () => { close(); try { await fn(); } catch (e) { toast({ title: 'Action failed', body: e.message }); } };
  return html`<${Sheet} title=${item.kind === 'user' ? 'Your message' : 'Message'} onClose=${close} small>
    <div class="stack" style="padding:0 12px 16px;gap:2px">
      ${text && html`<button class="topic-item" style="height:44px" onClick=${act(() => { navigator.clipboard?.writeText(text); toast({ title: t('Copied'), ms: 1200 }); })}><${Icon} name="copy" size="sm" /><span class="t">${t('Copy')}</span></button>`}
      ${text && navigator.share && html`<button class="topic-item" style="height:44px" onClick=${act(() => navigator.share({ text }))}><${Icon} name="share" size="sm" /><span class="t">Share</span></button>`}
      ${lastUser?.text && html`<button class="topic-item" style="height:44px" onClick=${act(() => sendMessage(lastUser.text, lastUser.attachments || []))}><${Icon} name="refresh" size="sm" /><span class="t">${item.kind === 'user' ? 'Send again' : 'Retry'}</span></button>`}
      ${item.kind === 'user' && text && html`<button class="topic-item" style="height:44px" onClick=${act(() => window.dispatchEvent(new CustomEvent('covo:compose', { detail: text })))}><${Icon} name="edit" size="sm" /><span class="t">${t('Edit')} & resend</span></button>`}
      <button class="topic-item" style="height:44px;color:var(--danger)" onClick=${act(() => api.del(`/api/feed/${item.id}`))}><${Icon} name="trash" size="sm" /><span class="t">Hide from thread</span></button>
      <p class="hint" style="padding:6px 10px 0">Hiding removes it from the screen; the agent's memory of the conversation is unchanged.</p>
    </div>
  <//>`;
}

function ToolItem({ item }) {
  const icon = item.status === 'running' ? '⏳' : item.status === 'error' ? '⚠️' : item.status === 'pending' ? '✋' : item.status === 'blocked' ? '⛔' : '✓';
  return html`<details class="tool-note"><summary>${icon} ${item.name}</summary>
    <pre>${JSON.stringify(item.input, null, 2)}</pre>${item.output && html`<pre>${item.output}</pre>`}</details>`;
}

function Typing() { return html`<div class="typing" aria-label="typing"><i></i><i></i><i></i></div>`; }

export function Feed({ variant = 'm' }) {
  const feed = useStore((s) => s.feed);
  const topics = useStore((s) => s.topics);
  const agentState = useStore((s) => s.agentState);
  const filter = useStore((s) => s.ui.topicFilter);
  const ap = useStore((s) => s.settings?.appearance || {});
  const dev = useStore((s) => s.settings?.developer?.enabled && s.settings?.developer?.showToolCalls);
  const name = useStore((s) => s.settings?.profile?.name || '');
  const agentName = useStore((s) => s.settings?.agent?.name || 'Covo');
  const scroller = useRef();
  const stick = useRef(true);
  const topicMap = useMemo(() => Object.fromEntries(topics.map((x) => [x.id, x])), [topics]);

  const items = feed.filter((f) => (f.kind !== 'tool' || dev) && (!filter || f.topicId === filter || (f.kind === 'user' && f.topicId === filter)));
  const last = items[items.length - 1];
  const busy = ['thinking', 'writing', 'working'].includes(agentState);
  const showTyping = !filter && busy && !(ap.revealPacing === false && last?.streaming && last.text);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const on = () => { stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { stick.current = true; }, [filter]);

  const onClick = (e) => {
    const c = e.target.closest?.('.chip[data-topic]');
    if (c && c.dataset.topic) setUI({ topicFilter: c.dataset.topic });
  };

  const out = [];
  let prevTopic = null;
  for (const it of items) {
    if (it.kind !== 'user' && it.topicId && it.topicId !== prevTopic && topicMap[it.topicId]) {
      out.push(html`<${TopicTag} key=${'tt' + it.id} topic=${topicMap[it.topicId]} />`);
    } else if (it.kind !== 'user' && !it.topicId && prevTopic) {
      out.push(html`<div class="feed-sep" key=${'sp' + it.id}></div>`);
    }
    if (it.kind !== 'user') prevTopic = it.topicId || null;
    const k = it.id;
    switch (it.kind) {
      case 'user': out.push(html`<${UserItem} key=${k} item=${it} showTime=${ap.showTimestamps} />`); break;
      case 'assistant': out.push(html`<${AssistantItem} key=${k} item=${it} pacing=${ap.revealPacing !== false} showTime=${ap.showTimestamps} />`); break;
      case 'approval': out.push(html`<${ApprovalCard} key=${k} id=${it.approvalId} />`); break;
      case 'artifact': out.push(html`<${ArtifactCard} key=${k} id=${it.artifactId} />`); break;
      case 'email': out.push(html`<${EmailCard} key=${k} item=${it} />`); break;
      case 'task': out.push(html`<${TaskMini} key=${k} id=${it.taskId} />`); break;
      case 'tool': out.push(html`<${ToolItem} key=${k} item=${it} />`); break;
      case 'event': out.push(html`<div class="event-note" key=${k}><${Icon} name="clock" size="sm" />${it.text}</div>`); break;
      case 'error': out.push(html`<div class="error-note" key=${k}>${it.text}${/Settings/.test(it.text) ? html` <a href="#" onClick=${(e) => { e.preventDefault(); setUI({ settings: 'model' }); }}>${t('Settings')} →</a>` : ''}</div>`); break;
    }
  }

  const ft = filter && topicMap[filter];
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
  return html`<div class=${cx(variant === 'd' ? 'd-scroll' : 'm-scroll', 'scroll')} ref=${scroller} onClick=${onClick}>
    <div class=${cx('feed', variant === 'd' && 'd-center')} style="flex:1;display:flex;flex-direction:column">
      ${ft && html`<div class="row" style="justify-content:center;margin:0 0 8px"><span class="pill"><${StatusIcon} status=${ft.status} emoji=${ft.emoji} />${ft.title}<button class="icon-btn sm" aria-label=${t('Clear filter')} onClick=${() => setUI({ topicFilter: null })}><${Icon} name="x" size="sm" /></button></span></div>`}
      ${!items.length && !busy ? html`<div class="empty-feed">
          <h2>${greet}${name ? `, ${name.split(' ')[0]}` : ''}.</h2>
          <div>${t('Ask {name} anything, or give it a job.', { name: agentName })}</div>
        </div>`
      : html`<div style="flex:1"></div>`}
      <div class="feed-inner">${out}${showTyping && html`<${Typing} />`}</div>
    </div>
  </div>`;
}
