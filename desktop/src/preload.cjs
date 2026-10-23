// Small, explicit bridge between the Covo UI and the desktop app (no Node access in the page).
const { contextBridge, ipcRenderer } = require('electron');

const listeners = {};
ipcRenderer.on('covo', (_e, type, data) => (listeners[type] || []).forEach((cb) => cb(data)));

contextBridge.exposeInMainWorld('covoDesktop', {
  platform: process.platform,
  signIn: () => ipcRenderer.invoke('covo:sign-in'),
  notify: (n) => ipcRenderer.invoke('covo:notify', n),
  info: () => ipcRenderer.invoke('covo:info'),
  on: (type, cb) => { (listeners[type] ||= []).push(cb); },
});
