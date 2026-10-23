# API — اربط Covo بأي شيء

كل شيء بالواجهة متاح عبر REST + WebSocket. للاستعمال الخارجي (سكربتات، iOS Shortcuts، n8n، Zapier، Home Assistant…) أنشئ توكن: Settings ← Security ← **API tokens**، ثم:
```
Authorization: Bearer covo_xxxxxxxx
```

## أمثلة سريعة
```bash
B=https://covo.example.com; T=covo_xxx
# أرسل رسالة للوكيل (يرد بالخيط كأنك كتبتها)
curl -X POST $B/api/messages -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"text":"What needs me today?"}'
# كل الحالة (الخيط، المهام، الموافقات، الملفات…)
curl $B/api/bootstrap -H "Authorization: Bearer $T"
# وافق على موافقة
curl -X POST $B/api/approvals/ap_123 -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"decision":"approve"}'
# أنشئ مهمة خلفية
curl -X POST $B/api/tasks -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"title":"Weekly numbers","goal":"Pull last week revenue and post 3 takeaways"}'
```

## Endpoints
| Method | Path | الوصف |
|---|---|---|
| GET | `/api/auth/status` | `{setup, authed, version}` (عام) |
| POST | `/api/auth/setup` · `/login` · `/logout` | الحساب (عام) |
| GET | `/api/bootstrap` | كل الحالة |
| POST | `/api/messages` | `{text, attachments?}` — رسالة جديدة |
| POST | `/api/stop` | إيقاف الدور الحالي |
| POST | `/api/approvals/:id` | `{decision: "approve" \| "decline"}` |
| POST | `/api/emails/:feedId` | `{action: "send" \| "dismiss" \| "update", draft?, via?}` |
| GET/POST/DELETE | `/api/tasks/:id` · `/api/tasks` | تفاصيل/إنشاء/حذف مهمة |
| POST | `/api/tasks/:id/action` | `{action?: pause\|resume\|cancel\|retry, message?}` |
| GET/PATCH/DELETE | `/api/artifacts/:id` | `?v=2` لنسخة سابقة · `{pinned, title}` |
| GET | `/a/:id` · `/a/:id/download` | الملف معروض (معزول) / تنزيل |
| GET/PUT | `/api/settings` | الإعدادات (الأسرار مخفية؛ أرسل القيمة المخفية كما هي للإبقاء عليها) |
| POST | `/api/settings/test` | اختبار النموذج |
| GET | `/api/prompt` | القالب الحالي + النص النهائي + القوالب |
| GET/POST/PATCH/DELETE | `/api/memory[/:id]` | الذاكرة |
| GET/POST/PATCH/DELETE | `/api/routines[/:id]` · POST `/api/routines/:id/run` | الروتينات |
| GET | `/api/devices` · POST `/api/devices/pair` · DELETE `/api/devices/:id` | الأجهزة |
| GET | `/api/mcp` · POST `/api/mcp/reload` | خوادم MCP |
| POST | `/api/uploads` | جسم خام + `X-Filename` ⇒ `{file, name, type, size}` لاستعماله بـ attachments |
| POST | `/api/push/subscribe` · `/api/push/test` | Web Push |
| GET | `/api/export` · POST `/api/import` · POST `/api/reset` `{scope: conversation\|demo\|all}` | البيانات |
| GET | `/api/logs` | سجل السيرفر |

## WebSocket — الأحداث المباشرة
`wss://host/ws` (كوكي الجلسة أو `?token=covo_…`). كل رسالة: `{"type": "...", "data": {...}}`
| type | متى |
|---|---|
| `feed.add` / `feed.update` / `feed.delta` / `feed.remove` | عنصر بالخيط (delta = نص يتدفق) |
| `agent.state` | `idle · thinking · writing · working · waiting` (حالة الكرة) |
| `topic.add` / `topic.update` | المواضيع وحالتها |
| `task.upsert` / `task.state` / `task.remove` | المهام |
| `approval.upsert` | الموافقات |
| `artifact.upsert` / `artifact.remove` | الملفات |
| `memory` · `routines` · `devices` · `mcp` · `usage` · `settings.changed` · `provider` | تحديثات كاملة |
| `toast` | إشعار داخل التطبيق |
| `reload` | أعد تحميل الحالة |

## بروتوكول الأجهزة (`/device?token=dev_…`)
```
runner → {"type":"hello","name":"Office PC","info":{…},"tools":[…],"workdir":"…"}
server → {"type":"call","callId":"c_1","tool":"run_command","input":{"command":"dir"}}
runner → {"type":"result","callId":"c_1","ok":true,"result":{…}}
```
تقدر تكتب runner بأي لغة (Python، Go…) بنفس البروتوكول.
