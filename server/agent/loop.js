import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, id, log, truncate } from '../util.js';
import { addFeed, updateFeed, addUsage, save } from '../db.js';
import { broadcast } from '../bus.js';
import { getSettings, activeProvider } from '../config.js';
import { anthropicTurn, Anthropic } from './providers/anthropic.js';
import { openaiTurn } from './providers/openai.js';
import { buildTools, toResultBlocks } from './tools/index.js';
import { decide } from './policy.js';

// ─────────────────────────────────────────────────────────────────────────────
// Provider-agnostic agent loop (streaming manual tool loop).
// transcript: array of API messages, appended in place (append-only history).
// ctx: { scope, task, topicId, turnId, hooks, stopAfterTool }
// ─────────────────────────────────────────────────────────────────────────────

const UPLOADS = path.join(DATA_DIR, 'uploads');

// Images are stored as files and referenced from the transcript to keep db.json small.
function materialize(messages) {
  const fix = (b) => {
    if ((b?.type === 'image' || b?.type === 'document') && b.source?.type === 'ref') {
      try {
        const data = fs.readFileSync(path.join(DATA_DIR, b.source.path)).toString('base64');
        return { type: b.type, source: { type: 'base64', media_type: b.source.media_type, data } };
      } catch { return { type: 'text', text: `[${b.type} no longer available]` }; }
    }
    if (b?.type === 'tool_result' && Array.isArray(b.content)) return { ...b, content: b.content.map(fix) };
    return b;
  };
  return messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.map(fix) } : m));
}

function externalizeImages(blocks) {
  return blocks.map((b) => {
    if (b?.type === 'image' && b.source?.type === 'base64') {
      const ext = (b.source.media_type || 'image/png').split('/')[1] || 'png';
      const name = `${id('img_')}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(b.source.data, 'base64'));
      return { type: 'image', source: { type: 'ref', path: `uploads/${name}`, media_type: b.source.media_type } };
    }
    return b;
  });
}

// Window the transcript without splitting tool_use / tool_result pairs.
export function windowed(transcript, max) {
  if (transcript.length <= max) return transcript;
  let start = transcript.length - max;
  const isToolResultMsg = (m) => m.role === 'user' && Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result');
  while (start < transcript.length && (transcript[start].role !== 'user' || isToolResultMsg(transcript[start]))) start++;
  return transcript.slice(start);
}

async function callModel(args) {
  const p = activeProvider();
  if (p === 'anthropic') return anthropicTurn(args);
  if (p === 'openai') return openaiTurn(args);
  throw new Error('No model configured');
}

export async function runLoop({ transcript, system, ctx, effort, signal, onStateChange }) {
  const s = getSettings();
  const maxSteps = s.agent.maxSteps || 40;
  const posted = []; // assistant texts posted to the thread this run
  const showTools = s.developer.enabled && s.developer.showToolCalls;
  let steps = 0;

  for (; steps < maxSteps; steps++) {
    if (signal?.aborted) break;
    const tools = buildTools(ctx);
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    let textItem = null;
    let progressItem = null;
    const stepItems = []; // feed items created from this model response
    const topicAtStart = ctx.topicId;
    const feedBase = () => ({ topicId: ctx.topicId, source: ctx.scope, taskId: ctx.task?.id, turnId: ctx.turnId });

    onStateChange?.('thinking');
    let result;
    try {
      result = await callModel({
        system,
        messages: materialize(windowed(transcript, s.agent.contextMessages || 120)),
        tools,
        effort,
        signal,
        onBlockStart: (block) => { if (block.type === 'text') textItem = null; },
        onText: (delta) => {
          onStateChange?.('writing');
          if (ctx.scope === 'task') { (ctx._taskText ??= ''); ctx._taskText += delta; return; } // tasks speak via report_to_user
          if (!textItem) { textItem = addFeed({ kind: 'assistant', text: '', streaming: true, ...feedBase() }); stepItems.push(textItem); }
          textItem.text += delta;
          broadcast('feed.delta', { id: textItem.id, delta });
        },
        onProgress: (delta) => {
          if (!s.agent.progressBubbles) return;
          if (delta === null) {
            if (progressItem) { updateFeed(progressItem.id, { text: progressItem.text.trim(), streaming: false }); posted.push(progressItem.text); }
            progressItem = null;
            return;
          }
          if (ctx.scope === 'task') return;
          if (!progressItem) { progressItem = addFeed({ kind: 'assistant', text: '', streaming: true, progress: true, ...feedBase() }); stepItems.push(progressItem); }
          progressItem.text += delta;
          broadcast('feed.delta', { id: progressItem.id, delta });
        },
      });
    } catch (e) {
      if (textItem) updateFeed(textItem.id, { streaming: false });
      if (signal?.aborted || e?.name === 'AbortError' || e instanceof Anthropic.APIUserAbortError) break;
      throw e;
    }

    addUsage(result.usage);
    if (textItem) { updateFeed(textItem.id, { text: textItem.text, streaming: false, usage: s.developer.enabled ? result.usage : undefined }); posted.push(textItem.text); }
    // Text blocks interleaved with server tools: make sure every text block became an item.
    const assistantContent = result.content;
    transcript.push({ role: 'assistant', content: assistantContent });
    save();

    if (result.stop_reason === 'refusal') {
      addFeed({ kind: 'error', text: 'The model declined this request (safety filter). Try rephrasing it.', ...feedBase() });
      break;
    }
    if (result.stop_reason === 'pause_turn') continue;

    const uses = assistantContent.filter((b) => b.type === 'tool_use');
    if (!uses.length) break;
    if (result.stop_reason === 'max_tokens') {
      addFeed({ kind: 'error', text: 'The reply was cut off (max tokens). Raise "Max output tokens" in Settings → Model.', ...feedBase() });
      // still answer the tool calls so the transcript stays valid
    }

    onStateChange?.('working');
    const results = await Promise.all(uses.map(async (u) => {
      const tool = toolMap.get(u.name);
      let toolItem = null;
      if (showTools) toolItem = addFeed({ kind: 'tool', name: u.name, input: u.input, status: 'running', ...feedBase() });
      const finish = (content, isError, status) => {
        if (toolItem) updateFeed(toolItem.id, { status: status || (isError ? 'error' : 'done'), output: truncate(content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'), 4000) });
        return { type: 'tool_result', tool_use_id: u.id, content: externalizeImages(content), ...(isError ? { is_error: true } : {}) };
      };
      if (!tool) return finish([{ type: 'text', text: `Unknown tool ${u.name}` }], true);
      if (result.stop_reason === 'max_tokens') return finish([{ type: 'text', text: 'Tool input was truncated (max_tokens); not executed.' }], true);
      const input = u.input && typeof u.input === 'object' ? u.input : {};
      const missing = (tool.input_schema.required || []).filter((k) => input[k] === undefined || input[k] === null);
      if (missing.length) return finish([{ type: 'text', text: `Invalid input: missing ${missing.join(', ')}` }], true);
      const category = typeof tool.category === 'function' ? tool.category(input) : tool.category;
      const decision = decide(category);
      if (decision === 'block') return finish([{ type: 'text', text: `Blocked: the user's settings don't allow "${category}" actions. Tell them if this was needed.` }], true, 'blocked');
      if (decision === 'ask') {
        const summary = tool.summarize ? tool.summarize(input) : { title: u.name, detail: JSON.stringify(input).slice(0, 200) };
        const pending = await ctx.hooks.createApproval({ title: summary.title, detail: summary.detail, kind: category, tool: { name: u.name, input } }, ctx);
        return finish([{ type: 'text', text: JSON.stringify(pending) }], false, 'pending');
      }
      try {
        const out = await tool.run(input);
        const { content, isError } = toResultBlocks(out);
        return finish(content, isError);
      } catch (e) {
        log.warn(`tool ${u.name} failed:`, e.message);
        return finish([{ type: 'text', text: `Error: ${e.message}` }], true);
      }
    }));
    transcript.push({ role: 'user', content: results });
    save();
    // set_topic usually comes after the opening note ("On it…") in the same response:
    // move that note under the new topic so the label sits above it.
    if (ctx.topicId !== topicAtStart) for (const it of stepItems) updateFeed(it.id, { topicId: ctx.topicId });
    if (ctx.stopAfterTool) break;
  }
  if (steps >= maxSteps) addFeed({ kind: 'error', text: `Stopped after ${maxSteps} steps (Settings → Agent → Max steps).`, topicId: ctx.topicId, source: ctx.scope });
  return { posted, steps, taskText: ctx._taskText || '' };
}
