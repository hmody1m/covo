import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { bus, broadcast } from '../bus.js';
import { db } from '../db.js';
import { DATA_DIR, id, log } from '../util.js';
import { getSettings, updateSettings } from '../config.js';
import * as core from '../agent/core.js';

// ─────────────────────────────────────────────────────────────────────────────
// Telegram bridge: talk to your agent from Telegram and approve actions with
// inline buttons. Uses long polling (no public URL or webhook needed).
// Settings → Tools & connectors → Telegram. Only paired chats are accepted.
// ─────────────────────────────────────────────────────────────────────────────

const API = process.env.TELEGRAM_API || 'https://api.telegram.org'; // override for tests
let state = { status: 'off', bot: null, error: '' };
let abort = null;
let offset = 0;
const sent = new Set(); // feed ids already delivered

const cfg = () => getSettings().integrations.telegram;
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function call(method, params = {}, signal) {
  const res = await fetch(`${API}/bot${cfg().botToken}/${method}`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram ${res.status}`);
  return j.result;
}

function setState(patch) {
  state = { ...state, ...patch };
  broadcast('integrations', publicStatus());
}

export function publicStatus() {
  const c = cfg();
  return { telegram: { ...state, enabled: !!c.enabled, hasToken: !!c.botToken, chats: c.chats || [], pairCode: c.pairCode || '' } };
}

export async function restartTelegram() {
  abort?.abort();
  abort = null;
  const c = cfg();
  if (!c.enabled || !c.botToken) { setState({ status: 'off', bot: null, error: '' }); return; }
  if (!c.pairCode) updateSettings({ integrations: { telegram: { pairCode: crypto.randomBytes(3).toString('hex').toUpperCase() } } });
  try {
    const me = await call('getMe');
    setState({ status: 'connected', bot: me.username, error: '' });
  } catch (e) {
    setState({ status: 'error', error: e.message });
    return;
  }
  const ac = new AbortController();
  abort = ac;
  poll(ac.signal);
}

async function poll(signal) {
  while (!signal.aborted) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] }, signal);
      for (const u of updates) {
        offset = u.update_id + 1;
        handle(u).catch((e) => log.warn('telegram update', e.message));
      }
    } catch (e) {
      if (signal.aborted) return;
      log.warn('telegram poll', e.message);
      setState({ status: 'error', error: e.message });
      await new Promise((r) => setTimeout(r, 5000));
      if (!signal.aborted) setState({ status: 'connected', error: '' });
    }
  }
}

const linked = (chatId) => (cfg().chats || []).some((c) => String(c.id) === String(chatId));
const send = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch((e) => log.warn('telegram send', e.message));
const toAll = (text, extra) => Promise.all((cfg().chats || []).map((c) => send(c.id, text, extra)));

async function handle(u) {
  if (u.callback_query) return onButton(u.callback_query);
  const m = u.message;
  if (!m) return;
  const chatId = m.chat.id;
  const text = (m.text || m.caption || '').trim();
  if (!linked(chatId)) {
    const code = cfg().pairCode;
    if (code && (text === `/start ${code}` || text.toUpperCase() === code)) {
      const chats = [...(cfg().chats || []), { id: chatId, name: [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.title || m.chat.username || String(chatId), linkedAt: Date.now() }];
      updateSettings({ integrations: { telegram: { chats, pairCode: crypto.randomBytes(3).toString('hex').toUpperCase() } } });
      broadcast('integrations', publicStatus());
      return send(chatId, `✅ Linked to <b>${esc(getSettings().agent.name || 'Covo')}</b>. Message me here anytime. Approvals will show up with buttons.`);
    }
    return send(chatId, 'This is a private assistant. To link it, open Covo → Settings → Tools & connectors → Telegram and send the pairing code shown there.');
  }
  if (text === '/stop') { core.stop(); return send(chatId, 'Stopped.'); }
  if (text === '/status' || text === '/start') {
    const pending = db.data.approvals.filter((a) => a.status === 'pending').length;
    const running = db.data.tasks.filter((t) => ['running', 'queued'].includes(t.status)).length;
    const needs = db.data.tasks.filter((t) => t.status === 'needs_you').length;
    return send(chatId, `<b>${esc(getSettings().agent.name || 'Covo')}</b> is ${esc(core.getState())}.\n${running} tasks in progress · ${needs + pending} need you.`);
  }
  const attachments = [];
  const photo = m.photo?.[m.photo.length - 1];
  const doc = m.document;
  if (photo || doc) {
    try {
      const f = await call('getFile', { file_id: (photo || doc).file_id });
      const res = await fetch(`${API}/file/bot${cfg().botToken}/${f.file_path}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = (doc?.file_name || path.basename(f.file_path)).replace(/[^\w.\- ]+/g, '_');
      const file = `${id('u_')}-${name}`;
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', file), buf);
      attachments.push({ file, name, type: doc?.mime_type || 'image/jpeg', size: buf.length });
    } catch (e) { log.warn('telegram file', e.message); }
  }
  if (!text && !attachments.length) return;
  core.userMessage({ text, attachments, source: 'telegram' });
}

async function onButton(q) {
  if (!linked(q.message?.chat?.id)) return call('answerCallbackQuery', { callback_query_id: q.id, text: 'Not linked' });
  const [kind, target, action] = String(q.data || '').split(':');
  let note = 'Done';
  try {
    if (kind === 'ap') { await core.decideApproval(target, action === 'approve' ? 'approve' : 'decline'); note = action === 'approve' ? '✅ Approved' : '✖️ Not now'; }
    else if (kind === 'em') { await core.emailAction(target, action === 'send' ? 'send' : 'dismiss', { via: 'mailto' }); note = action === 'send' ? '✅ Sent' : '✖️ Not sent'; }
  } catch (e) { note = 'Error: ' + e.message; }
  await call('answerCallbackQuery', { callback_query_id: q.id, text: note }).catch(() => {});
  await call('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: note, callback_data: 'noop' }]] } }).catch(() => {});
}

// Mirror the thread to Telegram: finished agent messages, approvals, email drafts, artifacts.
const topicTitle = (tid) => db.data.topics.find((t) => t.id === tid)?.title;
const plain = (md) => esc(md).replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const money = (a) => (a.amount != null ? ` · ${a.currency || 'USD'} ${a.amount}` : '');

function deliver(item) {
  if (!cfg().enabled || !cfg().botToken || !(cfg().chats || []).length || sent.has(item.id)) return;
  const head = item.topicId && topicTitle(item.topicId) ? `<i>${esc(topicTitle(item.topicId))}</i>\n` : '';
  if (item.kind === 'assistant' && !item.streaming && item.text?.trim()) {
    sent.add(item.id);
    return toAll(head + plain(item.text));
  }
  if (item.kind === 'approval') {
    const a = db.data.approvals.find((x) => x.id === item.approvalId);
    if (!a || a.status !== 'pending') return;
    sent.add(item.id);
    return toAll(`${head}🔔 <b>Needs your approval</b>\n${esc(a.title)}${esc(money(a))}${a.detail ? `\n${esc(a.detail)}` : ''}`, {
      reply_markup: { inline_keyboard: [[{ text: `✅ ${a.actionLabel || 'Approve'}`, callback_data: `ap:${a.id}:approve` }, { text: 'Not now', callback_data: `ap:${a.id}:decline` }]] },
    });
  }
  if (item.kind === 'email' && item.status === 'draft') {
    sent.add(item.id);
    return toAll(`${head}✉️ <b>Email draft</b>\nTo: ${esc(item.draft.to)}\nSubject: ${esc(item.draft.subject)}\n\n${esc(item.draft.body)}`, {
      reply_markup: { inline_keyboard: [[{ text: '✅ Send', callback_data: `em:${item.id}:send` }, { text: 'Not now', callback_data: `em:${item.id}:dismiss` }]] },
    });
  }
  if (item.kind === 'artifact') {
    const a = db.data.artifacts.find((x) => x.id === item.artifactId);
    if (!a) return;
    sent.add(item.id);
    return toAll(`${head}📄 <b>${esc(a.title)}</b>${a.summary ? `\n${esc(a.summary)}` : ''}\n<i>Open it in Covo → Make.</i>`);
  }
  if (item.kind === 'error') { sent.add(item.id); return toAll(`⚠️ ${esc(item.text)}`); }
}

bus.on('client', ({ type, data }) => {
  if ((type === 'feed.add' || type === 'feed.update') && data?.kind && data.kind !== 'user') deliver(data);
});

export function startTelegram() {
  // Don't re-send history after a restart.
  for (const f of db.data.feed) sent.add(f.id);
  restartTelegram();
}
