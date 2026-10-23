// Tiny, safe Markdown renderer (escape first, then format). Shared by the browser
// and the server. Supports: paragraphs, headings, bold/italic/strike, inline code,
// fenced code, links, bullet/numbered/task lists, blockquotes, tables, hr,
// and [[Topic]] chips (rendered via the `chip` callback).

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeUrl(u) {
  const url = u.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
  return '#';
}

export function inline(text, opts = {}) {
  let s = escapeHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) => (opts.chip ? opts.chip(t) : `<span class="chip">${t}</span>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${safeUrl(u.replace(/&amp;/g, '&'))}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

export function renderMarkdown(src, opts = {}) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map((l) => inline(l, opts)).join('<br>')}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (/^\s*```/.test(line)) {
      flush();
      const lang = line.trim().slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    if ((m = line.match(/^<div class="eyebrow">(.*)<\/div>\s*$/))) { flush(); out.push(`<div class="eyebrow">${inline(m[1], opts)}</div>`); i++; continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2], opts)}</h${m[1].length}>`); i++; continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${inline(h, opts)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, opts)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+[.)]/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        let txt = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) txt += ' ' + lines[i++].trim();
        const task = txt.match(/^\[( |x|X)\]\s+(.*)$/);
        if (task) items.push(`<li class="task${task[1] !== ' ' ? ' done' : ''}"><span class="box">${task[1] !== ' ' ? '✓' : ''}</span><span>${inline(task[2], opts)}</span></li>`);
        else items.push(`<li>${inline(txt, opts)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join('\n');
}

// Split assistant text into chat bubbles: one per paragraph, but keep lists,
// code blocks and tables together with their paragraph.
export function splitBubbles(text) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const parts = [];
  let buf = [];
  let inCode = false;
  for (const line of t.split('\n')) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    if (!inCode && !line.trim()) {
      if (buf.length) { parts.push(buf.join('\n')); buf = []; }
      continue;
    }
    buf.push(line);
  }
  if (buf.length) parts.push(buf.join('\n'));
  // Merge list items separated by blank lines into a single bubble.
  const merged = [];
  for (const p of parts) {
    const isList = /^\s*([-*+]|\d+[.)])\s+/.test(p);
    const prev = merged[merged.length - 1];
    if (isList && prev && /^\s*([-*+]|\d+[.)])\s+/m.test(prev.split('\n').slice(-1)[0])) merged[merged.length - 1] = prev + '\n' + p;
    else merged.push(p);
  }
  return merged;
}
