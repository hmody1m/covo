// Builds the standalone browser edition (no server needed) into dist/web.
// The same folder is what the Android app ships and what GitHub Pages hosts.
//   npm run build:web
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'web');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const shim = (f) => path.join(root, 'standalone', 'shims', f);
const SHIMS = {
  fs: shim('fs.js'), crypto: shim('crypto.js'), os: shim('os.js'), child_process: shim('child_process.js'), url: shim('url.js'),
  path: path.join(root, 'node_modules/path-browserify/index.js'), events: path.join(root, 'node_modules/events/events.js'),
  'web-push': shim('web-push.js'), nodemailer: shim('nodemailer.js'),
};
const nodeShims = {
  name: 'node-shims',
  setup(b) {
    b.onResolve({ filter: /^(node:)?(fs|crypto|os|child_process|url|path|events)$|^(web-push|nodemailer)$/ }, (a) => ({ path: SHIMS[a.path.replace(/^node:/, '')] }));
  },
};

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'web'), out, { recursive: true });

await esbuild.build({
  entryPoints: { 'covo-local': path.join(root, 'standalone/entry.js') },
  outdir: path.join(out, 'js/local'),
  bundle: true, format: 'esm', splitting: true, platform: 'browser', target: ['es2022'],
  chunkNames: 'chunks/[name]-[hash]', minify: true, legalComments: 'linked',
  inject: [shim('globals.js')],
  define: { 'import.meta.url': '"file:///app/server/util.js"', __COVO_VERSION__: JSON.stringify(pkg.version) },
  plugins: [nodeShims],
  logLevel: 'warning',
});

// Relative URLs so it works from any sub-path (GitHub Pages) or file-based WebViews.
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
html = html.replace(/(href|src)="\/(?!\/)/g, '$1="./').replace("from '/js/main.js'", "from './js/main.js'");
html = html.replace('<script type="module">', '<script>window.COVO_STANDALONE = true;</script>\n  <script type="module">');
fs.writeFileSync(path.join(out, 'index.html'), html);

fs.mkdirSync(path.join(out, 'legal'), { recursive: true });
for (const f of ['TERMS.md', 'PRIVACY.md', 'TRADEMARKS.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'SECURITY.md']) fs.copyFileSync(path.join(root, f), path.join(out, 'legal', f));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`dist/web ready (${(size(out) / 1e6).toFixed(1)} MB). Serve it with any static server, e.g. npx serve dist/web`);
