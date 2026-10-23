# Editions & builds

Covo is one codebase (`server/` + `web/`) shipped five ways. They share the same UI, settings, demo and data format, so a backup from one restores in another (Settings → Data).

| Edition | Folder | Agent runs | Data lives | Reach it from other devices |
|---|---|---|---|---|
| Server | repo root | Node.js process (`npm start`, Docker, Windows service) | `data/` or `DATA_DIR` | Yes: browser/PWA, password |
| Desktop app | `desktop/` | Inside the app (Electron runs the same server) | App-data folder (`%APPDATA%\Covo\data`, `~/Library/Application Support/Covo/data`, `~/.config/Covo/data`) | Optional: tray → *Allow phone access* (needs a password) |
| Android app | `mobile/` | Inside the app (browser edition) — or opens your own server | App storage | No (it *is* the other device) |
| Browser edition | `dist/web` (built) | Inside the browser tab | Browser storage (IndexedDB) | No |
| Device runner | `device/` | — (executes tools for a server) | `device.config.json` | Connects out to a server |

## Server
See [DEPLOY_WINDOWS.md](DEPLOY_WINDOWS.md) and [DEPLOY_VPS.md](DEPLOY_VPS.md).

## Desktop app (Windows / macOS / Linux)

```bash
npm run desktop        # development: stages the app and opens it
npm run dist:win       # release/Covo-Setup-x.y.z-x64.exe + Covo-Portable-x.y.z-x64.exe
npm run dist:linux     # release/Covo-x.y.z-linux-x86_64.AppImage + .deb
npm run dist:mac       # on a Mac: .dmg + .zip
```

How it works:
- `desktop/scripts/stage.mjs` copies `server/`, `web/`, `device/` and the legal files into `desktop/app/` and installs production dependencies.
- `desktop/src/main.cjs` starts the Covo server **in the app process** (`127.0.0.1`, port 8787 or the next free one), then opens it in a window. The window signs itself in with a random per-launch key (`/api/auth/desktop`), so no password is needed on this computer.
- "This server" becomes **This computer**: the agent can run commands and use files here (Settings → Devices), with approvals.
- The app keeps running in the tray when its window is closed (change it in the tray menu). Notifications use the operating system.
- `desktop/src/preload.cjs` exposes a tiny bridge (`window.covoDesktop`: notify, sign-in, open settings). The page has no Node.js access.
- Windows icon/version info is set by `desktop/scripts/after-pack.cjs` (pure JS, works from any OS). Building the NSIS installer on Linux/macOS needs Wine (`apt install wine64 wine32:i386`); on Windows nothing extra is needed.

Code signing (recommended for public releases): set `CSC_LINK` / `CSC_KEY_PASSWORD` (Windows) or the Apple variables before `dist:*`; electron-builder picks them up.

## Android app

Requirements: JDK 21 and the Android SDK (`platforms;android-36`, `build-tools;36.0.0`), `ANDROID_HOME` set.

```bash
npm run apk            # builds dist/web, syncs it into mobile/android, assembleRelease
```
Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

Signing: create a key once and keep it safe (you need the **same** key for every update):
```bash
keytool -genkeypair -v -keystore covo-release.jks -alias covo -keyalg RSA -keysize 4096 -validity 10000
```
Then create `mobile/android/keystore.properties` (git-ignored):
```
storeFile=/absolute/path/covo-release.jks
storePassword=…
keyAlias=covo
keyPassword=…
```
In CI, set repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Without them the workflow publishes a debug-signed APK.

How it works:
- Capacitor wraps `dist/web` (the browser edition), so the app works offline with no server; the agent calls your model provider directly.
- Settings → Devices → enter your server address → **Connect** opens your own Covo server inside the app from then on (profile → *Use on this device instead* switches back).
- `MainActivity.java` adds a small bridge for what a WebView can't do: saving exports to Downloads, opening outside links in the browser, and downloading files from your server. It only answers the top-level page (per-launch key), never agent-made artifacts.
- No permissions beyond Internet (plus legacy storage on Android 9 and older for downloads).
- Limits: routines run while the app is open; for alerts when it's closed use ntfy or Telegram from a server.

Icons and splash screens: `NODE_PATH=$(npm root -g) node brand/render-android.cjs`.

## Browser edition

```bash
npm run build:web      # → dist/web
npx serve dist/web     # or any static host
```
The unmodified server core is bundled with esbuild (`standalone/entry.js`) and runs in the page: storage is IndexedDB, files are blobs, and the agent calls your model provider from the browser (Anthropic allows this with your key; other providers must allow CORS). Commands, files on disk, device pairing, Web Push and SMTP are server-only and hidden here.

GitHub Pages: enable *Settings → Pages → Source: GitHub Actions*; `.github/workflows/pages.yml` publishes `dist/web` on every push to `main`.

## Releases

Push a tag like `v1.2.0` (matching `package.json`) and `.github/workflows/release.yml` builds: Windows installer + portable, Linux AppImage + deb, macOS dmg, Android APK, the browser-edition zip and a source zip, writes `SHA256SUMS.txt`, and creates a GitHub Release with all of them.
