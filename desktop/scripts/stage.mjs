// Copies the Covo server + UI into desktop/app (the folder electron-builder packages)
// and installs its production dependencies.   npm run stage   (from desktop/)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const root = path.resolve(desktop, '..');
const app = path.join(desktop, 'app');
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
for (const d of ['server', 'web', 'device']) fs.cpSync(path.join(root, d), path.join(app, d), { recursive: true, filter: (f) => !/node_modules|device\.config\.json$/.test(f) });
for (const f of ['LICENSE', 'TERMS.md', 'PRIVACY.md', 'TRADEMARKS.md', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'README.md']) fs.copyFileSync(path.join(root, f), path.join(app, f));
for (const f of ['main.cjs', 'preload.cjs']) fs.copyFileSync(path.join(desktop, 'src', f), path.join(app, f));

fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
  name: 'covo', productName: 'Covo', version: rootPkg.version, description: 'Covo — your open-source AI partner, as a desktop app.',
  author: { name: 'Covo contributors' }, license: rootPkg.license, homepage: 'https://github.com/hmody1m/covo',
  type: 'module', main: 'main.cjs', dependencies: rootPkg.dependencies,
}, null, 2));
execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts', { cwd: app, stdio: 'inherit' });
console.log('desktop/app staged (v' + rootPkg.version + ')');
