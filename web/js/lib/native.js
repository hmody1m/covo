// Native app helpers. Android app (mobile/): window.CovoAndroid bridge from MainActivity.java.
const android = () => (window.CovoAndroid && window.CovoAndroidKey ? window.CovoAndroid : null);

// Save a file the user asked for. A WebView can't download blob: URLs, so the Android app saves natively.
export async function saveBlob(blob, name) {
  const A = android();
  if (A) {
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return A.saveFile(window.CovoAndroidKey, name, blob.type || 'application/octet-stream', b64);
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

// Android app: links to other sites open in the browser (or mail app), not inside Covo.
export function installNativeLinks() {
  if (!window.CovoAndroid) return;
  const external = (href) => {
    try { const u = new URL(href, location.href); return /^(https?|mailto|tel):$/.test(u.protocol) && u.origin !== location.origin; } catch { return false; }
  };
  const open = (href) => android()?.openExternal(window.CovoAndroidKey, new URL(href, location.href).href);
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && external(a.href)) { e.preventDefault(); open(a.href); }
  }, true);
  const winOpen = window.open.bind(window);
  window.open = (url, ...rest) => (url && external(String(url)) ? (open(String(url)), null) : winOpen(url, ...rest));
}
