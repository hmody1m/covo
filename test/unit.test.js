import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, splitBubbles, escapeHtml } from '../web/js/lib/md.js';
import { artifactToHtml } from '../web/js/lib/artifact-html.js';

test('markdown escapes HTML (no XSS from model output)', () => {
  const out = renderMarkdown('<img src=x onerror=alert(1)> **bold** [x](javascript:alert(1))');
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;img'));
  assert.ok(out.includes('<strong>bold</strong>'));
  assert.ok(!out.includes('javascript:'), 'unsafe link schemes are neutralized');
});

test('markdown renders lists, tables, task lists and topic chips', () => {
  const out = renderMarkdown('- [[Hiring]]: done\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] ok\n- [ ] todo', { chip: (t) => `<chip>${t}</chip>` });
  assert.match(out, /<ul><li><chip>Hiring<\/chip>: done<\/li><li>two<\/li><\/ul>/);
  assert.match(out, /<table>/);
  assert.match(out, /class="task done"/);
});

test('splitBubbles: one bubble per paragraph, keeps lists and code together', () => {
  assert.deepEqual(splitBubbles('One.\n\nTwo.\n\nThree.'), ['One.', 'Two.', 'Three.']);
  assert.equal(splitBubbles('```\na\n\nb\n```').length, 1);
  assert.equal(splitBubbles('- a\n\n- b').length, 1);
});

test('escapeHtml', () => assert.equal(escapeHtml(`<"'&>`), '&lt;&quot;&#39;&amp;&gt;'));

test('artifactToHtml passes HTML kinds through and wraps Markdown', () => {
  assert.equal(artifactToHtml({ kind: 'page', content: '<!doctype html><p>x</p>' }), '<!doctype html><p>x</p>');
  const doc = artifactToHtml({ kind: 'doc', title: 'T', content: '# Hello' });
  assert.match(doc, /<h1>Hello<\/h1>/);
  assert.ok(!doc.includes('googleapis'), 'no third-party font requests');
});
