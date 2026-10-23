# Security

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private reporting instead: repository → **Security** → **Report a vulnerability**. Include steps to reproduce and the affected version. You'll get an acknowledgement as soon as a maintainer sees it; fixes are released as new versions and credited if you wish.

## Supported versions

Only the latest release receives security fixes.

## Security model (what protects you)

- **Approvals in code, not in the prompt.** Every tool has a category (commands, files, messages, payments, devices, MCP…). Settings → Agent & autonomy decides *Ask / Auto / Block* per category; "Ask" tools don't run until you press Approve. Prompt text cannot bypass this.
- **Blocked commands.** A deny-list is checked on the server and again on each device runner (`device.config.json`).
- **Device allow-lists.** Each paired device decides which tools it accepts (`allow`), regardless of what the server asks.
- **Sandboxed artifacts.** Agent-made pages run in an opaque-origin sandbox (`Content-Security-Policy: sandbox`) and can't call the Covo API with your session.
- **Authentication.** scrypt password hash, HttpOnly SameSite session cookie (`Secure` when `SECURE_COOKIES=1`), login rate limiting, hashed API/device tokens shown once, revocable sessions.
- **Desktop app.** The server listens only on `127.0.0.1` unless you turn on *Allow phone access*. The app window signs itself in with a random key created at each launch (never stored). Other devices can connect only after you set a password **and** turn on *Allow phone access*.
- **Android app.** The native bridge (saving files, opening links) only answers the top-level app page, using a per-launch key that sandboxed artifact frames can't read. The app asks for no special permissions beyond Internet.
- **Untrusted content.** The default system prompt tells the agent to treat web pages, files, emails and tool output as data, not instructions. This reduces — but cannot eliminate — prompt-injection risk, which is why approvals matter.

## Hardening checklist

1. Expose the server only over **HTTPS** (Caddy/Docker setup in `docs/DEPLOY_VPS.md`) and set `SECURE_COOKIES=1`.
2. Use a long password; sign out old sessions (Settings → Security).
3. Keep **Run commands**, **Write files**, **Messages** and **Payments** on *Ask*. Use *Autonomous* only with devices and accounts you can afford to have changed.
4. Don't enable "Let the agent use this server" on a shared VPS.
5. Give MCP servers and device runners the minimum access they need; prefer a dedicated work folder.
6. Protect the data folder (it holds API keys): full-disk encryption, regular backups (Settings → Data → Export).
7. Revoke API/device tokens you no longer use.
