// Generates the Android launcher icons and splash screens from the brand mark.
//   NODE_PATH=$(npm root -g) node brand/render-android.cjs   (needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const res = path.join(root, 'mobile/android/app/src/main/res');
const BG = '#F9F9F6';
const MARK = `
  <g transform="rotate(-14 256 256)" fill="none" stroke="#141413" stroke-width="15" stroke-linecap="round"><path d="M96 256 A160 60 0 0 1 416 256"/></g>
  <circle cx="258" cy="258" r="93" fill="#CF6652"/>
  <g transform="rotate(-14 256 256)"><path d="M416 256 A160 60 0 0 1 96 256" fill="none" stroke="#141413" stroke-width="15" stroke-linecap="round"/><circle cx="416" cy="256" r="21" fill="#141413"/></g>`;
const mark = (scale) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${MARK}</g>`;
const icon = {
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BG}"/>${mark(0.86)}</svg>`,
  round: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${BG}"/>${mark(0.8)}</svg>`,
  fg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${mark(0.7)}</svg>`,
};
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
const splash = (w, h) => {
  const s = Math.min(w, h) * 0.34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BG}"/><svg x="${(w - s) / 2}" y="${(h - s) / 2}" width="${s}" height="${s}" viewBox="0 0 512 512">${mark(1)}</svg></svg>`;
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const shoot = async (svg, w, h, out) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (const [d, k] of Object.entries(D)) {
    await shoot(icon.square, 48 * k, 48 * k, path.join(res, `mipmap-${d}/ic_launcher.png`));
    await shoot(icon.round, 48 * k, 48 * k, path.join(res, `mipmap-${d}/ic_launcher_round.png`));
    await shoot(icon.fg, 108 * k, 108 * k, path.join(res, `mipmap-${d}/ic_launcher_foreground.png`));
    const [w, h] = SPLASH[d];
    await shoot(splash(w, h), w, h, path.join(res, `drawable-port-${d}/splash.png`));
    await shoot(splash(h, w), h, w, path.join(res, `drawable-land-${d}/splash.png`));
  }
  await shoot(splash(480, 320), 480, 320, path.join(res, 'drawable/splash.png'));
  fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  await b.close();
  console.log('Android icons + splash screens written to', path.relative(root, res));
})();
