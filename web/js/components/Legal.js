import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { useStore, setUI } from '../store.js';
import { renderMarkdown } from '../lib/md.js';
import { Sheet } from './ui.js';

// Shows the project's legal documents (Terms, Privacy, Trademarks, Licenses…).
export const LEGAL_DOCS = {
  'TERMS.md': 'Terms of Use',
  'PRIVACY.md': 'Privacy',
  'TRADEMARKS.md': 'Trademarks & affiliation',
  'THIRD_PARTY_NOTICES.md': 'Open-source licenses',
  'LICENSE': 'License (MIT)',
  'SECURITY.md': 'Security',
};

export const openLegal = (name) => setUI({ legal: name });

export function LegalSheet() {
  const name = useStore((s) => s.ui.legal);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!name) return;
    setText('Loading…');
    fetch(`./legal/${name}`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
      .then((t) => setText(name === 'LICENSE' ? '```\n' + t + '\n```' : t))
      .catch((e) => setText(`Couldn't load ${name}: ${e.message}`));
  }, [name]);
  if (!name) return null;
  return html`<${Sheet} title=${LEGAL_DOCS[name] || name} onClose=${() => setUI({ legal: null })} full>
    <div class="legal-doc" dir="auto" dangerouslySetInnerHTML=${{ __html: renderMarkdown(text) }}></div>
  <//>`;
}
