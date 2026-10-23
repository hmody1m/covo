# Privacy

_Last updated: 2026-10-23_

**Short version:** Covo has no company servers, no accounts with us, no analytics, no tracking and no ads. Your data stays where you run Covo, and is sent only to the services **you** connect.

## Who is responsible for your data

Covo is self-hosted software. Whoever runs an installation (usually you) controls its data. The authors of Covo never receive it. If you run Covo for other people, you are responsible for their data and should give them your own privacy notice.

## What Covo stores, and where

| Edition | Where data lives |
|---|---|
| Server (Windows/macOS/Linux/VPS/Docker) | The `data/` folder on that machine (or the `DATA_DIR` you set) |
| Desktop app | Your user profile's app-data folder — Windows `%APPDATA%\Covo\data`, macOS `~/Library/Application Support/Covo/data`, Linux `~/.config/Covo/data` (tray menu → *Open data folder*) |
| Browser edition & Android app | The browser's / app's private storage (IndexedDB) on your device. Files you export are saved to your Downloads folder only when you press *Export* or *Download*. |

Stored data includes: your settings (including API keys and SMTP password, stored **unencrypted** on disk — protect the device and consider disk encryption), the conversation thread, the raw model transcript, topics, tasks and their activity logs, approvals, artifacts and their versions, memory, routines, uploaded files, push-subscription endpoints, a password hash (scrypt) and session/API/device token hashes.

**Delete everything:** Settings → Data → *Erase everything*, or delete the data folder / clear the app's storage.

## What leaves your device

Only what is needed for features you turn on:

| When | Sent to | What |
|---|---|---|
| You chat, or a task/routine runs | Your model provider (e.g. Anthropic, or an OpenAI-compatible endpoint you set) | The system prompt, the recent thread, a context block (time, topics, tasks, approvals, devices, artifact titles, memory), your messages and attachments, and tool results. Their privacy policy and data-retention rules apply. |
| The agent uses web search / web fetch (Claude) | Anthropic, which performs the search/fetch | Search queries and URLs |
| The agent uses `http_request` or an MCP server | The URL / server it calls | The request it makes |
| Push notifications are enabled | Your browser vendor's push service (e.g. Google, Apple, Mozilla) | End-to-end encrypted notification payloads (title + one line) |
| ntfy is configured | The ntfy server you set | Notification title and text (not encrypted by Covo) |
| Telegram is connected | Telegram | Messages exchanged with your bot, including agent replies and approval prompts |
| SMTP is configured and you press Send | Your mail server | The email you approved |
| A device runner is paired | Your Covo server | Commands/files the agent uses on that device (over your own connection; use HTTPS) |
| You press *Check for updates* | GitHub API | A request for the latest release (your IP address is visible to GitHub) |
| Desktop app: *Allow phone access* is on | Devices on your local network that you sign in from | The app over plain HTTP on your Wi‑Fi. Use it only on networks you trust, or put HTTPS in front (see `docs/DEPLOY_VPS.md`). |

The desktop app and Android app make **no** network requests on their own: no auto-update checks, crash reports or usage statistics. Desktop notifications are shown by your operating system and are not sent anywhere.

Covo **does not** load fonts, scripts, images or analytics from third parties: fonts are bundled. Agent-made artifacts (pages/dashboards) are shown in a sandbox and may load resources if the content asks for them.

## Cookies and local storage

The server edition and the desktop app set one first-party session cookie (`covo_session`, HttpOnly) to keep you signed in. All editions use local storage for your theme and language. No tracking cookies.

## Children

Covo is not intended for children. Use it only if you meet the age requirement of the AI provider you connect.

## Security

See `SECURITY.md`. Use a strong password, HTTPS when exposing the server, and keep approvals on for sensitive actions.

## Changes

This notice may change in new versions. The version included with your copy applies to it.

---

## بالعربي (ملخص)

- **ما عندنا سيرفرات ولا تتبع ولا إحصائيات ولا إعلانات.** بياناتك تبقى بالمكان اللي تشغّل بيه Covo.
- البيانات (الإعدادات ومنها مفاتيح API، المحادثة، المهام، الملفات، الذاكرة) تنحفظ بمجلد `data/` أو بتخزين التطبيق/المتصفح على جهازك — **بدون تشفير**، فاحمِ جهازك.
- تطلع بيانات فقط للخدمات اللي **أنت تربطها**: مزوّد النموذج (مثل Anthropic) يستلم المحادثة والسياق حتى يرد، وTelegram/البريد/الإشعارات إذا فعلتها.
- الخطوط مدمجة بالبرنامج، فما في أي طلب لـGoogle أو غيره.
- تطبيق الكمبيوتر وتطبيق الأندرويد ما يرسلون أي شي بنفسهم: لا تحديث تلقائي ولا تقارير أعطال ولا إحصائيات.
- تمسح كل شيء من: Settings → Data → Erase everything.
