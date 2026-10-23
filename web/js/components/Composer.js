import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { Icon } from '../lib/icons.js';
import { t, getLang } from '../lib/i18n.js';
import { api } from '../api.js';
import { useStore, setUI, mutate, toast, get } from '../store.js';
import { cx } from './ui.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function sendMessage(text, attachments = []) {
  text = (text || '').trim();
  if (!text && !attachments.length) return;
  setUI({ topicFilter: null });
  if (get().ui.tab !== 'chat') setUI({ tab: 'chat' });
  return api.post('/api/messages', { text, attachments }).catch((e) => toast({ title: 'Not sent', body: e.message }));
}

export function Suggestions() {
  const list = useStore((s) => s.suggestions);
  if (!list?.length) return null;
  return html`<div class="suggestions">${list.map((s) => html`<button onClick=${() => sendMessage(s)}>${s}</button>`)}</div>`;
}

export function Composer({ autoFocus }) {
  const [text, setText] = useState('');
  const [atts, setAtts] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [dictating, setDictating] = useState(false);
  const agentState = useStore((s) => s.agentState);
  const layout = useStore((s) => s.ui.layout);
  const ta = useRef();
  const fileIn = useRef();
  const rec = useRef();
  const busy = ['thinking', 'writing', 'working'].includes(agentState);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);
  useEffect(() => { if (autoFocus && layout === 'desktop') ta.current?.focus(); }, []);
  // Let other components prefill the composer (e.g. "Ask for changes").
  useEffect(() => {
    const h = (e) => { setText(e.detail || ''); setTimeout(() => ta.current?.focus(), 0); };
    window.addEventListener('covo:compose', h);
    return () => window.removeEventListener('covo:compose', h);
  }, []);

  const submit = () => {
    if (uploading) return;
    if (!text.trim() && !atts.length) return;
    sendMessage(text, atts);
    setText(''); setAtts([]);
    rec.current?.stop();
  };
  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && layout === 'desktop') { e.preventDefault(); submit(); }
  };
  const onFiles = async (files) => {
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { toast({ title: 'File too large', body: `${f.name} is over 25 MB` }); continue; }
      setUploading((n) => n + 1);
      try {
        const r = await api.upload(f);
        setAtts((a) => [...a, { ...r, url: r.url || (f.type.startsWith('image/') ? URL.createObjectURL(f) : '') }]);
      } catch (e) { toast({ title: 'Upload failed', body: e.message }); }
      setUploading((n) => n - 1);
    }
  };
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); onFiles(files); }
  };
  const dictate = () => {
    if (!SR) { toast({ title: t('Dictate'), body: 'Speech recognition is not supported in this browser. Try Chrome, Edge or Safari.' }); return; }
    if (dictating) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = getLang() === 'ar' ? 'ar-IQ' : navigator.language || 'en-US';
    r.interimResults = true; r.continuous = true;
    const base = text ? text + ' ' : '';
    r.onresult = (ev) => { let s = ''; for (const res of ev.results) s += res[0].transcript; setText(base + s); };
    r.onend = () => setDictating(false);
    r.onerror = () => setDictating(false);
    rec.current = r; r.start(); setDictating(true);
  };

  const hasContent = text.trim() || atts.length;
  return html`<div>
    ${atts.length > 0 && html`<div class="composer-atts">${atts.map((a, i) => html`<span class="file-pill"><${Icon} name=${a.type?.startsWith('image/') ? 'image' : 'file'} size="sm" /><span>${a.name}</span><button class="icon-btn sm" aria-label=${t('Delete')} onClick=${() => setAtts(atts.filter((_, j) => j !== i))}><${Icon} name="x" size="sm" /></button></span>`)}</div>`}
    <div class="composer" onDragOver=${(e) => e.preventDefault()} onDrop=${(e) => { e.preventDefault(); onFiles([...e.dataTransfer.files]); }}>
      <button class="icon-btn" aria-label=${t('Attach')} title=${t('Attach')} onClick=${() => fileIn.current.click()}><${Icon} name=${uploading ? 'refresh' : 'plus'} /></button>
      <input type="file" multiple hidden ref=${fileIn} onChange=${(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
      <textarea ref=${ta} rows="1" placeholder=${t('Message')} value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${onKey} onPaste=${onPaste} aria-label=${t('Message')} dir="auto"></textarea>
      <button class=${cx('icon-btn', dictating && 'mic-on')} aria-label=${t('Dictate')} title=${t('Dictate')} onClick=${dictate}><${Icon} name="mic" /></button>
      ${hasContent
        ? html`<button class="send-btn" aria-label=${t('Send')} onClick=${submit}><${Icon} name="up" /></button>`
        : busy
          ? html`<button class="send-btn" aria-label=${t('Stop')} title=${t('Stop')} onClick=${() => api.post('/api/stop')}><${Icon} name="stop" size="sm" /></button>`
          : html`<button class="send-btn" aria-label=${t('Voice mode')} title=${t('Voice mode')} onClick=${() => setUI({ voice: true })}><${Icon} name="wave" size="sm" /></button>`}
    </div>
  </div>`;
}
