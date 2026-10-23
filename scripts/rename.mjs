// Rename the product and/or set your GitHub repository everywhere in one step.
//   node scripts/rename.mjs --name "Nova" --repo yourname/nova
// Updates code, docs, manifests, build configs. Review the diff with `git diff` afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const brandSrc = fs.readFileSync(path.join(root, 'web/js/brand.js'), 'utf8');
const oldName = brandSrc.match(/name: '([^']+)'/)[1];
const oldRepo = brandSrc.match(/repo: '([^']+)'/)[1];
const newName = args.name || oldName;
const newRepo = args.repo ? `https://github.com/${args.repo.replace(/^https:\/\/github.com\//, '')}` : oldRepo;
if (newName === oldName && newRepo === oldRepo) { console.log('Usage: node scripts/rename.mjs --name "NewName" --repo owner/repo'); process.exit(0); }

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pairs = [[oldRepo, newRepo], [oldRepo.replace('https://github.com/', ''), newRepo.replace('https://github.com/', '')]];
if (newName !== oldName) pairs.push([oldName, newName], [oldName.toUpperCase(), newName.toUpperCase().replace(/[^A-Z0-9]/g, '_')], [slug(oldName), slug(newName)]);
const SKIP = new Set(['node_modules', '.git', 'dist', 'data', 'fonts', 'vendor', 'android', 'release', 'app']);
const EXT = /\.(js|mjs|cjs|json|md|html|css|webmanifest|yml|yaml|sh|bat|ps1|txt|xml|gradle|properties)$|^(Caddyfile|Dockerfile|LICENSE|\.env\.example)$/;
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!EXT.test(e.name) || e.name === 'package-lock.json' || p.endsWith('scripts/rename.mjs')) continue;
    const s = fs.readFileSync(p, 'utf8');
    let t = s;
    for (const [a, b] of pairs) t = t.split(a).join(b);
    if (t !== s) { fs.writeFileSync(p, t); n++; }
  }
})(root);
// Files named after the product (e.g. device/covo-device.js).
const renamed = [];
if (newName !== oldName) {
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.includes(slug(oldName))) { const q = path.join(dir, e.name.split(slug(oldName)).join(slug(newName))); fs.renameSync(p, q); renamed.push(path.relative(root, q)); }
    }
  })(root);
}

// Android app: display name and application id. The Java package (namespace) stays as it is.
const edit = (f, fn) => { if (fs.existsSync(f)) { const s = fs.readFileSync(f, 'utf8'); const t = fn(s); if (t !== s) { fs.writeFileSync(f, t); n++; } } };
if (newName !== oldName) {
  const andr = path.join(root, 'mobile/android/app');
  edit(path.join(andr, 'src/main/res/values/strings.xml'), (s) => s.replace(/(<string name="(?:app_name|title_activity_main)">)[^<]*/g, `$1${newName}`));
  edit(path.join(andr, 'build.gradle'), (s) => s.replace(/applicationId "[^"]+"/, `applicationId "app.${slug(newName).replace(/-/g, '')}.mobile"`));
}
console.log(`Updated ${n} files: "${oldName}" → "${newName}", repo → ${newRepo}`);
if (renamed.length) console.log('Renamed:', renamed.join(', '));
console.log('Next: regenerate icons if you changed the logo (brand/render-icons.cjs), then run npm test.');
