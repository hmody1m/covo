import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from '../../config.js';
import { log } from '../../util.js';

// Claude via the official Anthropic SDK (streaming manual tool loop lives in loop.js).
// Canonical message format across the app is Anthropic content blocks.

let client = null;
let clientKey = '';
function getClient() {
  const a = getSettings().provider.anthropic;
  const key = a.apiKey || process.env.ANTHROPIC_API_KEY;
  const sig = key + '|' + (a.baseURL || '');
  if (!client || clientKey !== sig) {
    // In the standalone browser/Android edition the key belongs to the person using this device and never
    // leaves it except to call the API directly, so direct browser access is intended there.
    const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    client = new Anthropic({ apiKey: key, baseURL: a.baseURL || undefined, maxRetries: 3, dangerouslyAllowBrowser: inBrowser });
    clientKey = sig;
  }
  return client;
}

// Models with adaptive thinking / effort / progress updates (current generation).
const MODERN = /^claude-(fable-5|mythos-5|opus-5|sonnet-5|haiku-5|opus-4-[6-8]|sonnet-4-6)/;
const FALLBACK_OK = /^claude-(fable-5-1|opus-5-5|opus-5$|opus-5-|sonnet-5-5)/;

let degraded = false; // set when the API rejects beta features; we retry without them

function buildParams({ system, messages, tools, effort, maxTokens }) {
  const s = getSettings();
  const a = s.provider.anthropic;
  const model = a.model || 'claude-opus-5-5';
  const modern = MODERN.test(model);
  const params = {
    model,
    max_tokens: maxTokens || a.maxTokens || 32000,
    system: [{ type: 'text', text: system, ...(a.promptCaching ? { cache_control: { type: 'ephemeral' } } : {}) }],
    messages,
  };
  if (a.promptCaching) params.cache_control = { type: 'ephemeral' }; // auto-cache the conversation prefix
  const toolList = [...tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))];
  if (modern && a.webSearch) toolList.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 8 });
  if (modern && a.webFetch) toolList.push({ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 });
  if (toolList.length) params.tools = toolList;
  const betas = [];
  if (modern) {
    params.thinking = { type: 'adaptive' };
    if (effort) params.output_config = { effort };
    if (!degraded) {
      if (a.progressUpdates) { params.thinking.display = 'updates'; betas.push('thinking-display-updates-2026-08-18'); }
      // Keep long append-only threads valid even if the system prompt / tools changed between turns.
      params.thinking.block_binding = { prefix_mismatch_behavior: 'drop_block' };
      betas.push('thinking-binding-controls-2026-08-01');
      if (a.refusalFallback && FALLBACK_OK.test(model) && !a.baseURL) { params.fallbacks = 'default'; betas.push('server-side-fallback-2026-07-01'); }
    }
  }
  // Developer overrides (Settings → Developer → Request overrides JSON)
  try {
    const ov = JSON.parse(s.developer.requestOverrides || '{}');
    if (ov && typeof ov === 'object') Object.assign(params, ov);
  } catch {}
  return { params, betas };
}

// One model call. Streams text + progress notes, returns the final assistant message.
export async function anthropicTurn({ system, messages, tools, effort, maxTokens, signal, onText, onProgress, onBlockStart }) {
  const c = getClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { params, betas } = buildParams({ system, messages, tools, effort, maxTokens });
    try {
      const stream = betas.length
        ? c.beta.messages.stream({ ...params, betas }, { signal })
        : c.messages.stream(params, { signal });
      let blockType = null;
      for await (const ev of stream) {
        if (ev.type === 'content_block_start') {
          blockType = ev.content_block.type;
          onBlockStart?.(ev.content_block);
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta.type === 'text_delta') onText?.(ev.delta.text);
          else if (ev.delta.type === 'thinking_delta' && ev.delta.thinking) onProgress?.(ev.delta.thinking);
        } else if (ev.type === 'content_block_stop') {
          if (blockType === 'thinking') onProgress?.(null); // end of a progress note
          blockType = null;
        }
      }
      const msg = await stream.finalMessage();
      return { content: msg.content, stop_reason: msg.stop_reason, stop_details: msg.stop_details, usage: msg.usage, model: msg.model };
    } catch (e) {
      // If a beta feature isn't available for this account/model/proxy, degrade once and retry.
      if (!degraded && attempt === 0 && e instanceof Anthropic.BadRequestError && betas.length) {
        log.warn('Anthropic rejected beta features, retrying without them:', e.message);
        degraded = true;
        continue;
      }
      throw e;
    }
  }
}

export async function anthropicTest() {
  const c = getClient();
  const a = getSettings().provider.anthropic;
  const r = await c.messages.create({ model: a.model || 'claude-opus-5-5', max_tokens: 64, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Reply with exactly: ready' }] }).catch(async (e) => {
    if (e instanceof Anthropic.BadRequestError) return c.messages.create({ model: a.model, max_tokens: 64, messages: [{ role: 'user', content: 'Reply with exactly: ready' }] });
    throw e;
  });
  const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ok: true, model: r.model, reply: text.trim() };
}

export async function anthropicModels() {
  try {
    const c = getClient();
    const out = [];
    for await (const m of c.models.list({ limit: 100 })) out.push({ id: m.id, name: m.display_name });
    return out;
  } catch { return []; }
}

export function resetAnthropicDegraded() { degraded = false; }
export { Anthropic };
