// Computer-control tools. Shared by:
//   • the server (when "Allow the agent to use this server" is on), and
//   • device/covo-device.js, the runner you start on any PC you want the agent to control.
// Pure Node.js, no dependencies, works on Windows / macOS / Linux.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IS_WIN = process.platform === 'win32';
const MAX_OUT = 60_000;

function clip(s) {
  s = String(s || '');
  return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + `\n…[truncated ${s.length - MAX_OUT} chars]` : s;
}

export function resolvePath(p, baseDir) {
  if (!p) return baseDir;
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
  return path.resolve(baseDir, p);
}

export function isBlocked(command, blocked = []) {
  const c = command.toLowerCase().replace(/\s+/g, ' ');
  return blocked.find((b) => b && c.includes(String(b).toLowerCase()));
}

export function runCommand({ command, cwd, timeoutSec = 120, shell }, opts = {}) {
  return new Promise((resolve) => {
    const blocked = isBlocked(command, opts.blockedCommands);
    if (blocked) return resolve({ ok: false, exitCode: -1, stdout: '', stderr: `Blocked by policy (matches "${blocked}")` });
    const dir = resolvePath(cwd || '', opts.workDir || os.homedir());
    let exe, args;
    const sh = shell || (IS_WIN ? 'powershell' : 'bash');
    if (IS_WIN && sh === 'powershell') { exe = 'powershell.exe'; args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]; }
    else if (IS_WIN && sh === 'cmd') { exe = 'cmd.exe'; args = ['/d', '/s', '/c', command]; }
    else { exe = fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'; args = ['-lc', command]; }
    let stdout = '', stderr = '', done = false;
    let child;
    try { child = spawn(exe, args, { cwd: fs.existsSync(dir) ? dir : os.homedir(), env: process.env, windowsHide: true }); }
    catch (e) { return resolve({ ok: false, exitCode: -1, stdout: '', stderr: e.message }); }
    const timer = setTimeout(() => { if (!done) { try { child.kill('SIGKILL'); } catch {} stderr += `\n[killed after ${timeoutSec}s timeout]`; } }, timeoutSec * 1000);
    child.stdout.on('data', (d) => { stdout += d; if (stdout.length > MAX_OUT * 2) stdout = stdout.slice(-MAX_OUT * 2); });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > MAX_OUT * 2) stderr = stderr.slice(-MAX_OUT * 2); });
    child.on('error', (e) => { stderr += e.message; });
    child.on('close', (code) => {
      done = true; clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code, cwd: dir, stdout: clip(stdout), stderr: clip(stderr) });
    });
  });
}

export function readFile({ path: p, encoding = 'utf8', maxBytes = 200_000 }, opts = {}) {
  const file = resolvePath(p, opts.workDir || os.homedir());
  const st = fs.statSync(file);
  if (st.isDirectory()) return listDir({ path: p }, opts);
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) && st.size < 4_500_000) {
    const mt = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { path: file, size: st.size, image: { media_type: mt, data: fs.readFileSync(file).toString('base64') } };
  }
  const buf = fs.readFileSync(file);
  const slice = buf.subarray(0, maxBytes);
  return { path: file, size: st.size, truncated: buf.length > maxBytes, content: slice.toString(encoding === 'base64' ? 'base64' : 'utf8') };
}

export function writeFile({ path: p, content = '', append = false, encoding = 'utf8' }, opts = {}) {
  const file = resolvePath(p, opts.workDir || os.homedir());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = encoding === 'base64' ? Buffer.from(content, 'base64') : content;
  if (append) fs.appendFileSync(file, data); else fs.writeFileSync(file, data);
  return { path: file, bytes: Buffer.byteLength(data), appended: !!append };
}

export function listDir({ path: p = '.', depth = 1 }, opts = {}) {
  const root = resolvePath(p, opts.workDir || os.homedir());
  const out = [];
  const walk = (dir, d) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { out.push(`! ${dir}: ${e.message}`); return; }
    for (const e of entries.slice(0, 400)) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full) || e.name;
      if (e.isDirectory()) { out.push(rel + '/'); if (d < depth) walk(full, d + 1); }
      else { let size = 0; try { size = fs.statSync(full).size; } catch {} out.push(`${rel}  (${size} B)`); }
      if (out.length > 1500) return;
    }
  };
  walk(root, 1);
  return { path: root, entries: out };
}

export function systemInfo() {
  return {
    hostname: os.hostname(), platform: process.platform, release: os.release(), arch: os.arch(),
    user: os.userInfo().username, home: os.homedir(), cpus: os.cpus().length,
    memoryGB: +(os.totalmem() / 1e9).toFixed(1), freeMemoryGB: +(os.freemem() / 1e9).toFixed(1),
    uptimeHours: +(os.uptime() / 3600).toFixed(1), node: process.version,
  };
}

export async function openTarget({ target }) {
  const cmd = IS_WIN ? `Start-Process "${String(target).replace(/"/g, '`"')}"` : process.platform === 'darwin' ? `open "${String(target).replace(/"/g, '\\"')}"` : `xdg-open "${String(target).replace(/"/g, '\\"')}" >/dev/null 2>&1 &`;
  const r = await runCommand({ command: cmd, timeoutSec: 20 });
  return { opened: r.ok, target, error: r.ok ? undefined : r.stderr };
}

export async function screenshot(_input, opts = {}) {
  const file = path.join(os.tmpdir(), `covo-shot-${Date.now()}.png`);
  let cmd;
  if (IS_WIN) {
    cmd = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}',[System.Drawing.Imaging.ImageFormat]::Png)`;
  } else if (process.platform === 'darwin') {
    cmd = `screencapture -x "${file}"`;
  } else {
    cmd = `(command -v gnome-screenshot >/dev/null && gnome-screenshot -f "${file}") || (command -v import >/dev/null && import -window root "${file}") || (command -v scrot >/dev/null && scrot "${file}")`;
  }
  const r = await runCommand({ command: cmd, timeoutSec: 30 }, opts);
  if (!fs.existsSync(file)) return { ok: false, error: 'Screenshot not available on this machine (no display or no screenshot tool). ' + (r.stderr || '') };
  const data = fs.readFileSync(file).toString('base64');
  fs.rmSync(file, { force: true });
  return { ok: true, image: { media_type: 'image/png', data } };
}

export async function notifyDesktop({ title, body }) {
  let cmd;
  const t = String(title || 'Covo').replace(/["'`$]/g, ''), b = String(body || '').replace(/["'`$]/g, '');
  if (IS_WIN) cmd = `Add-Type -AssemblyName System.Windows.Forms; $n=New-Object System.Windows.Forms.NotifyIcon; $n.Icon=[System.Drawing.SystemIcons]::Information; $n.Visible=$true; $n.ShowBalloonTip(8000,'${t}','${b}',[System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep 9; $n.Dispose()`;
  else if (process.platform === 'darwin') cmd = `osascript -e 'display notification "${b}" with title "${t}"'`;
  else cmd = `notify-send "${t}" "${b}" || true`;
  const r = await runCommand({ command: cmd, timeoutSec: 15 });
  return { shown: r.ok };
}

// Single dispatch used by both the server and the remote runner.
export const DEVICE_TOOLS = {
  run_command: runCommand,
  read_file: readFile,
  write_file: writeFile,
  list_dir: listDir,
  system_info: systemInfo,
  open: openTarget,
  screenshot,
  desktop_notify: notifyDesktop,
};

export async function execDeviceTool(name, input, opts) {
  const fn = DEVICE_TOOLS[name];
  if (!fn) throw new Error(`Unknown device tool: ${name}`);
  return await fn(input || {}, opts || {});
}
