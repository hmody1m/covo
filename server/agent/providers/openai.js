import { getSettings } from '../../config.js';

// Any OpenAI-compatible Chat Completions endpoint: Ollama, LM Studio, vLLM,
// OpenRouter, Groq, etc. Converts to/from the app's canonical Anthropic-style blocks.

function toOpenAI(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      out.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      const parts = [];
      for (const b of m.content) {
        if (b.type === 'tool_result') {
          const c = typeof b.content === 'string' ? b.content : (b.content || []).map((x) => (x.type === 'text' ? x.text : '[image]')).join('\n');
          out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: c });
        } else if (b.type === 'text') parts.push({ type: 'text', text: b.text });
        else if (b.type === 'image' && b.source?.type === 'base64') parts.push({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
      }
      if (parts.length) out.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    }
  }
  return out;
}

export async function openaiTurn({ system, messages, tools, maxTokens, signal, onText }) {
  const o = getSettings().provider.openai;
  const body = {
    model: o.model,
    messages: toOpenAI(system, messages),
    max_tokens: maxTokens || o.maxTokens || 4096,
    stream: true,
    ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
  };
  const res = await fetch(o.baseURL.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let text = '';
  const calls = {};
  let finish = null, usage = null, buf = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.usage) usage = j.usage;
      const ch = j.choices?.[0];
      if (!ch) continue;
      if (ch.delta?.content) { text += ch.delta.content; onText?.(ch.delta.content); }
      for (const tc of ch.delta?.tool_calls || []) {
        const c = (calls[tc.index] ??= { id: tc.id, name: '', args: '' });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.args += tc.function.arguments;
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    }
  }
  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const c of Object.values(calls)) {
    let input = {};
    try { input = c.args ? JSON.parse(c.args) : {}; } catch { input = { _raw: c.args }; }
    content.push({ type: 'tool_use', id: c.id || 'call_' + Math.random().toString(36).slice(2), name: c.name, input });
  }
  const stop_reason = Object.keys(calls).length ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end_turn';
  return { content, stop_reason, usage };
}

export async function openaiTest() {
  const r = await openaiTurn({ system: 'You are a test.', messages: [{ role: 'user', content: 'Reply with exactly: ready' }], tools: [], maxTokens: 20 });
  return { ok: true, model: getSettings().provider.openai.model, reply: r.content.map((b) => b.text || '').join('').trim() };
}
