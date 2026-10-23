import { renderMarkdown, escapeHtml } from './md.js';

// Turn an artifact into a standalone HTML document (used for previews and the viewer).
// HTML kinds are passed through; Markdown kinds get a clean editorial template.
export const HTML_KINDS = new Set(['page', 'dashboard', 'deck']);

const DOC_CSS = `
:root{--bg:#FBFBF8;--ink:#1d1c1a;--muted:#6f6d68;--line:#e7e5df;--accent:#C9614D}
@media (prefers-color-scheme:dark){:root{--bg:#1c1b19;--ink:#ecebe7;--muted:#a19f99;--line:#34322e}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Inter,Roboto,"Noto Sans Arabic",sans-serif;padding:28px 22px 60px;max-width:760px;margin:0 auto}
.eyebrow{font-size:11px;letter-spacing:.02em;color:var(--muted);margin-bottom:6px}
h1,h2,h3{font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-weight:500;line-height:1.2;letter-spacing:-.01em}
h1{font-size:30px;margin:.1em 0 .5em}h2{font-size:21px;margin:1.6em 0 .5em}h3{font-size:17px;margin:1.3em 0 .4em}
p{margin:.6em 0}a{color:var(--accent)}ul,ol{padding-inline-start:1.3em}li{margin:.3em 0}
li.task{list-style:none;margin-inline-start:-1.3em;display:flex;gap:.6em;align-items:flex-start}
li.task .box{flex:none;width:18px;height:18px;border:1.5px solid var(--line);border-radius:5px;display:inline-grid;place-items:center;font-size:12px;margin-top:.2em}
li.task.done .box{background:var(--ink);color:var(--bg);border-color:var(--ink)}li.task.done>span:last-child{color:var(--muted);text-decoration:line-through}
blockquote{margin:1em 0;padding:.2em 1em;border-inline-start:3px solid var(--accent);color:var(--muted)}
code{font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(127,127,127,.12);padding:.1em .35em;border-radius:5px}
pre{background:rgba(127,127,127,.1);padding:14px;border-radius:10px;overflow:auto}pre code{background:none;padding:0}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:8px 10px;text-align:start}th{color:var(--muted);font-weight:500}
.chip{background:rgba(59,111,216,.12);color:#3b6fd8;padding:0 .35em;border-radius:5px}
`;

export function artifactToHtml(a, { fonts = true } = {}) {
  const content = a.content ?? '';
  if (HTML_KINDS.has(a.kind) || /^\s*<!doctype html|^\s*<html/i.test(content)) return content;
  const body = renderMarkdown(content);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(a.title || 'Document')}</title>
${fonts ? '<link rel="stylesheet" href="/fonts/fonts.css">' : ''}
<style>${DOC_CSS}</style></head><body>${body}</body></html>`;
}
