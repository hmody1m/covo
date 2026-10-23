// End-to-end agent loop against a mock Anthropic Messages API (SSE) and a mock Telegram Bot API.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer, waitFor, freePort } from './helpers.js';

const sse = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify({ type: ev, ...data })}\n\n`);
const userText = (m) => (typeof m.content === 'string' ? m.content : m.content.map((b) => (b.type === 'text' ? b.text.replace(/<context>[\s\S]*?<\/context>/, '') : b.type === 'tool_result' ? `[tool_result] ${JSON.stringify(b.content)}` : '')).join('\n'));
const requests = [];

function plan(body) {
  const last = [...body.messages].reverse().find((m) => m.role === 'user');
  const txt = userText(last);
  const isResult = Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result');
  if (isResult) {
    if (txt.includes('pending_approval')) return [{ text: 'Waiting on your OK to run that.' }];
    return [{ text: 'Here it is.\n\nIt updates daily.' }];
  }
  if (/APPROVED/.test(txt)) return [{ text: 'Ran it. Exit code 0.' }];
  if (/dashboard/i.test(txt)) return [{ progress: 'On it.' }, { tool: 'set_topic', input: { title: 'Daily dashboard' } }, { tool: 'create_artifact', input: { title: 'Daily', kind: 'dashboard', content: '<h1>ok</h1>' } }];
  if (/run/i.test(txt)) return [{ tool: 'run_command', input: { command: 'echo covo-ok' } }];
  return [{ text: 'Hello from the mock.' }];
}

let mock, mockUrl, tg, tgUrl, s;
const tgSent = [];
const tgQueue = [];
before(async () => {
  const port = await freePort();
  mock = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const body = JSON.parse(b || '{}');
      requests.push({ headers: req.headers, body });
      if (!body.stream) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'ready' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } })); }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sse(res, 'message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } });
      let i = 0, tool = false;
      for (const blk of plan(body)) {
        if (blk.progress) { sse(res, 'content_block_start', { index: i, content_block: { type: 'thinking', thinking: '', signature: '' } }); sse(res, 'content_block_delta', { index: i, delta: { type: 'thinking_delta', thinking: blk.progress } }); sse(res, 'content_block_delta', { index: i, delta: { type: 'signature_delta', signature: 's' } }); }
        else if (blk.text) { sse(res, 'content_block_start', { index: i, content_block: { type: 'text', text: '' } }); sse(res, 'content_block_delta', { index: i, delta: { type: 'text_delta', text: blk.text } }); }
        else { tool = true; sse(res, 'content_block_start', { index: i, content_block: { type: 'tool_use', id: `tu_${requests.length}_${i}`, name: blk.tool, input: {} } }); sse(res, 'content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(blk.input) } }); }
        sse(res, 'content_block_stop', { index: i++ });
      }
      sse(res, 'message_delta', { delta: { stop_reason: tool ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 5 } });
      sse(res, 'message_stop', {});
      res.end();
    });
  }).listen(port);
  mockUrl = `http://127.0.0.1:${port}`;

  const tport = await freePort();
  tg = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
      const method = req.url.split('/').pop();
      const body = b ? JSON.parse(b) : {};
      const ok = (result) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
      if (method === 'getMe') return ok({ username: 'covo_test_bot' });
      if (method === 'getUpdates') { await new Promise((r) => setTimeout(r, 200)); return ok(tgQueue.splice(0)); }
      if (method === 'sendMessage') { tgSent.push(body); return ok({ message_id: tgSent.length }); }
      return ok(true);
    });
  }).listen(tport);
  tgUrl = `http://127.0.0.1:${tport}`;

  s = await startServer({ TELEGRAM_API: tgUrl });
  await s.req('POST', '/api/auth/setup', { password: 'secret123', name: 'Sara' });
  await s.req('PUT', '/api/settings', { provider: { type: 'anthropic', anthropic: { apiKey: 'sk-test', baseURL: mockUrl } }, tools: { serverExecution: true } });
});
after(async () => { mock.close(); tg.close(); await s.stop(); });

const feed = async () => (await s.req('GET', '/api/bootstrap')).body.feed;

test('switching from demo to a real model starts clean', async () => {
  const b = (await s.req('GET', '/api/bootstrap')).body;
  assert.equal(b.provider, 'anthropic');
  assert.equal(b.tasks.length, 0);
});

test('chat turn streams a reply; request uses adaptive thinking, effort and caching', async () => {
  await s.req('POST', '/api/messages', { text: 'hi' });
  await waitFor(async () => (await feed()).some((f) => f.text === 'Hello from the mock.'));
  const r = requests.at(-1);
  assert.equal(r.body.model, 'claude-opus-5-5');
  assert.equal(r.body.thinking.type, 'adaptive');
  assert.ok(r.body.output_config.effort);
  assert.ok(r.body.system[0].cache_control);
  assert.match(userText(r.body.messages.at(-1)) + JSON.stringify(r.body.messages.at(-1)), /<context>/);
});

test('tools: set_topic + create_artifact; progress note moves under the new topic', async () => {
  await s.req('POST', '/api/messages', { text: 'make a dashboard' });
  const f = await waitFor(async () => { const x = await feed(); return x.some((i) => i.kind === 'artifact') && x; });
  const b = (await s.req('GET', '/api/bootstrap')).body;
  const topic = b.topics.find((t) => t.title === 'Daily dashboard');
  assert.ok(topic);
  assert.equal(f.find((i) => i.text === 'On it.').topicId, topic.id);
  assert.equal(b.artifacts[0].title, 'Daily');
});

test('approval gate: command waits for approval, runs after Approve, agent continues', async () => {
  await s.req('POST', '/api/messages', { text: 'run a check' });
  const ap = await waitFor(async () => (await s.req('GET', '/api/bootstrap')).body.approvals.find((a) => a.status === 'pending'));
  assert.equal(ap.tool.name, 'run_command');
  await s.req('POST', `/api/approvals/${ap.id}`, { decision: 'approve' });
  await waitFor(async () => (await feed()).some((f) => f.text === 'Ran it. Exit code 0.'));
  const done = (await s.req('GET', '/api/bootstrap')).body.approvals.find((a) => a.id === ap.id);
  assert.match(done.result, /covo-ok/);
});

test('telegram: pairing, inbound message, outbound reply', async () => {
  await s.req('PUT', '/api/settings', { integrations: { telegram: { botToken: '1:test', enabled: true } } });
  const st = await waitFor(async () => { const t = (await s.req('GET', '/api/bootstrap')).body.integrations.telegram; return t.status === 'connected' && t; });
  tgQueue.push({ update_id: 1, message: { chat: { id: 42, first_name: 'Sara' }, text: 'hello?' } });
  await waitFor(() => tgSent.some((m) => /private assistant/.test(m.text)));
  tgQueue.push({ update_id: 2, message: { chat: { id: 42, first_name: 'Sara' }, text: `/start ${st.pairCode}` } });
  await waitFor(() => tgSent.some((m) => /Linked/.test(m.text)));
  tgQueue.push({ update_id: 3, message: { chat: { id: 42, first_name: 'Sara' }, text: 'hi from telegram' } });
  await waitFor(async () => (await feed()).some((f) => f.kind === 'user' && f.via === 'telegram'));
  await waitFor(() => tgSent.some((m) => /Hello from the mock/.test(m.text) && m.chat_id === 42));
});
