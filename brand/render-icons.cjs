// Regenerates every PNG/ICO icon from brand/*.svg (dev tool; needs Playwright: npx playwright).
//   node brand/render-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const svg = (f) => fs.readFileSync(path.join(root, 'brand', f), 'utf8');
const jobs = [
  ['logo.svg', 192, 'web/icons/icon-192.png'],
  ['logo.svg', 512, 'web/icons/icon-512.png'],
  ['logo-maskable.svg', 512, 'web/icons/icon-maskable-512.png'],
  ['logo.svg', 180, 'web/icons/apple-touch-icon.png'],
  ['logo.svg', 32, 'web/icons/favicon-32.png'],
  ['logo.svg', 1024, 'brand/logo-1024.png'],
  ['logo.svg', 512, 'desktop/build/icon.png'],
  ['logo.svg', 256, 'desktop/build/icon-256.png'],
  ['logo-maskable.svg', 1024, 'brand/android-foreground-1024.png'],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [src, size, out] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg(src).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
    await p.screenshot({ path: path.join(root, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('✓', out);
  }
  await b.close();
})();
