// Covo desktop app: runs the Covo server on this computer and shows it in its own window.
// The agent works directly on this PC (Settings → Devices → "This computer"), with your approvals.
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog, Notification, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

app.setName('Covo');
if (process.platform === 'win32') app.setAppUserModelId('app.covo.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// Packaged / staged: server sits next to this file. Dev (npm run desktop): repo root.
const ROOT = [__dirname, path.join(__dirname, '..', '..')].find((d) => fs.existsSync(path.join(d, 'server', 'index.js')));
const USER = app.getPath('userData');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(USER, 'data');
const PREFS_FILE = path.join(USER, 'desktop.json');
const ICON = path.join(ROOT, 'web', 'icons', 'icon-192.png');
const KEY = crypto.randomBytes(24).toString('base64url');

const prefs = Object.assign({ port: 8787, lan: false, closeToTray: process.platform !== 'darwin', startAtLogin: false, bounds: null, trayHintShown: false }, readJson(PREFS_FILE));
function savePrefs() { try { fs.mkdirSync(USER, { recursive: true }); fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2)); } catch {} }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } }

let win = null;
let tray = null;
let origin = '';
let quitting = false;

const portFree = (port, host) => new Promise((resolve) => {
  const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
  s.listen(port, host);
});

async function startServer() {
  const host = prefs.lan ? '0.0.0.0' : '127.0.0.1';
  let port = Number(prefs.port) || 8787;
  for (let i = 0; i < 20 && !(await portFree(port, host)); i++) port++;
  Object.assign(process.env, { PORT: String(port), HOST: host, DATA_DIR, COVO_DESKTOP_KEY: KEY, COVO_DESKTOP: '1' });
  await import(pathToFileURL(path.join(ROOT, 'server', 'index.js')).href);
  origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/api/auth/status')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The Covo server did not start.');
}

const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${new URL(origin).port}`);
const signInUrl = () => `${origin}/api/auth/desktop?key=${encodeURIComponent(KEY)}`;

function createWindow({ show = true } = {}) {
  const b = prefs.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 840, x: b.x, y: b.y, minWidth: 380, minHeight: 560,
    show: false, backgroundColor: '#F9F9F6', icon: ICON, title: 'Covo', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => { if (show) win.show(); });
  win.loadURL(signInUrl());

  // Same-origin pages (an artifact opened in a new tab) get their own window; everything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin + '/')) return { action: 'allow', overrideBrowserWindowOptions: { width: 1100, height: 800, icon: ICON, autoHideMenuBar: true, backgroundColor: '#FFFFFF' } };
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); } });

  const keepBounds = () => { if (!win.isMinimized()) prefs.bounds = { ...(win.isMaximized() ? prefs.bounds : win.getBounds()), maximized: win.isMaximized() }; };
  win.on('resize', keepBounds);
  win.on('move', keepBounds);
  win.on('close', (e) => {
    savePrefs();
    if (quitting || !prefs.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!prefs.trayHintShown && Notification.isSupported()) {
      new Notification({ title: 'Covo is still running', body: 'Your agent keeps working in the background. Find it in the tray.', icon: ICON }).show();
      prefs.trayHintShown = true; savePrefs();
    }
  });
  win.on('closed', () => { win = null; });
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
const openSettings = (id) => { showWindow(); win.webContents.send('covo', 'settings', id); };

async function hasPassword() {
  try { return !!JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'auth.json'), 'utf8')).passwordHash; } catch { return false; }
}
function workDir() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf8')).tools.workDir || path.join(DATA_DIR, 'workspace'); } catch { return path.join(DATA_DIR, 'workspace'); }
}

async function toggleLan() {
  if (!prefs.lan && !(await hasPassword())) {
    const r = await dialog.showMessageBox({ type: 'info', buttons: ['Set a password', 'Cancel'], defaultId: 0, title: 'Phone access', message: 'Set a password first', detail: 'Your phone signs in with a password. Set one in Settings → Security & access, then turn on phone access.' });
    if (r.response === 0) openSettings('security');
    return;
  }
  const r = await dialog.showMessageBox({ type: 'question', buttons: ['Restart Covo', 'Cancel'], defaultId: 0, title: 'Phone access', message: prefs.lan ? 'Turn off access from other devices?' : 'Allow phones and computers on the same Wi‑Fi to open Covo?', detail: prefs.lan ? 'Covo will only be reachable from this computer.' : 'They sign in with your password. Covo restarts to apply this. Your firewall may ask for permission.' });
  if (r.response !== 0) return;
  prefs.lan = !prefs.lan; savePrefs();
  quitting = true; app.relaunch(); app.exit(0);
}

function setLoginItem(on) {
  prefs.startAtLogin = on; savePrefs();
  app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] });
}

function buildTray() {
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: process.platform === 'darwin' ? 18 : 16 }));
    tray.setToolTip('Covo');
    tray.on('click', showWindow);
  }
  const lan = prefs.lan ? lanAddresses() : [];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Covo', click: showWindow },
    { label: 'Settings…', click: () => openSettings('general') },
    { type: 'separator' },
    { label: 'Allow phone access (same Wi‑Fi)', type: 'checkbox', checked: prefs.lan, click: () => { buildTray(); toggleLan(); } },
    ...lan.map((u) => ({ label: `Copy ${u}`, click: () => clipboard.writeText(u) })),
    { label: 'Start when I sign in', type: 'checkbox', checked: prefs.startAtLogin, click: (i) => setLoginItem(i.checked) },
    { label: 'Keep running when the window is closed', type: 'checkbox', checked: prefs.closeToTray, click: (i) => { prefs.closeToTray = i.checked; savePrefs(); } },
    { type: 'separator' },
    { label: 'Open work folder', click: () => shell.openPath(workDir()) },
    { label: 'Open data folder', click: () => shell.openPath(DATA_DIR) },
    { type: 'separator' },
    { label: 'Quit Covo', click: () => { quitting = true; app.quit(); } },
  ]));
}

function buildMenu() {
  const help = [
    { label: 'Documentation', click: () => shell.openExternal('https://github.com/hmody1m/covo#readme') },
    { label: 'Report an issue', click: () => shell.openExternal('https://github.com/hmody1m/covo/issues/new/choose') },
    { type: 'separator' },
    { label: 'Terms, privacy & licenses', click: () => openSettings('about') },
    { label: 'Open data folder', click: () => shell.openPath(DATA_DIR) },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => openSettings('general') },
      { label: 'Allow phone access…', click: toggleLan },
      { type: 'separator' },
      { label: 'Close window', accelerator: 'CmdOrCtrl+W', click: () => win?.close() },
      { label: 'Quit Covo', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: help },
  ]));
}

// Renderer bridge (desktop/src/preload.cjs).
ipcMain.handle('covo:sign-in', () => { win?.loadURL(signInUrl()); });
ipcMain.handle('covo:notify', (_e, { title, body, url } = {}) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: String(title || 'Covo').slice(0, 120), body: String(body || '').slice(0, 400), icon: ICON });
  n.on('click', () => { showWindow(); if (url && url.startsWith('/')) win.loadURL(origin + url); });
  n.show();
});
ipcMain.handle('covo:info', () => ({ version: app.getVersion(), dataDir: DATA_DIR, lan: prefs.lan, addresses: prefs.lan ? lanAddresses() : [] }));

app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('before-quit', () => { quitting = true; savePrefs(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !prefs.closeToTray) app.quit(); });

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (e) {
    dialog.showErrorBox('Covo could not start', `${e.stack || e.message}\n\nData folder: ${DATA_DIR}`);
    app.exit(1);
    return;
  }
  buildMenu();
  buildTray();
  createWindow({ show: !process.argv.includes('--hidden') });
});
