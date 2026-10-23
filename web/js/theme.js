import { setLang } from './lib/i18n.js';

// Apply appearance settings to <html>: theme, density, font, motion, sizes, accent, language/RTL.
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let current = {};

export function resolveTheme(theme) {
  if (theme === 'system' || !theme) return mq?.matches ? 'classic-dark' : 'classic';
  return theme;
}

export function applyAppearance(a = {}, profile) {
  current = { ...current, ...a };
  const el = document.documentElement;
  const theme = resolveTheme(current.theme);
  el.dataset.theme = theme;
  el.dataset.density = current.density || 'comfortable';
  el.dataset.font = current.font || 'default';
  el.dataset.motion = current.reduceMotion ? 'off' : 'on';
  el.style.setProperty('--app-fs', `${current.fontSize || 15}px`);
  el.style.setProperty('--bubble-radius', `${current.bubbleRadius ?? 18}px`);
  if (current.accent) { el.style.setProperty('--accent', current.accent); el.style.setProperty('--orb-blob', current.accent); }
  else { el.style.removeProperty('--accent'); el.style.removeProperty('--orb-blob'); }
  if (profile) {
    setLang(profile.language || 'en');
    el.lang = profile.language || 'en';
    el.dir = profile.language === 'ar' ? 'rtl' : 'ltr';
  }
  try { localStorage.setItem('covo:appearance', JSON.stringify({ theme: current.theme, lang: profile?.language })); } catch {}
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  });
}

mq?.addEventListener?.('change', () => { if (!current.theme || current.theme === 'system') applyAppearance({}); });
