# البنية (للمطوّر)

```
 Browser / PWA (mobile + desktop)                Your PCs
 ┌──────────────────────────────┐               ┌──────────────────┐
 │ web/  Preact+htm (no build)  │               │ device runner    │
 │ store ← WS events            │               │ (covo-device.js) │
 └──────┬───────────────┬───────┘               └────────┬─────────┘
   REST │          WS /ws│                       WS /device│
 ┌──────▼───────────────▼──────────────────────────────────▼───────┐
 │ server/index.js  (node:http + ws)                              │
 │  routes.js ── auth.js ── config.js ── db.js (data/*.json)      │
 │  agent/core.js   main thread queue · approvals · email · routines
 │  agent/loop.js   streaming tool loop (provider-agnostic)       │
 │  agent/tasks.js  background workers (own transcripts)          │
 │  agent/tools     registry + policy.js (Ask/Auto/Block)         │
 │  providers/      anthropic.js (official SDK) · openai.js        │
 │  devices.js · mcp.js · notify.js (web-push, ntfy) · scheduler.js│
 └────────────────────────────────────────────────────────────────┘
```

### نفس الكود، خمس نسخ
| النسخة | كيف تشغّل نفس `server/` |
|---|---|
| سيرفر | `node server/index.js` |
| تطبيق سطح المكتب | `desktop/src/main.cjs` (Electron) يستورد `server/index.js` داخل نفس العملية، على `127.0.0.1`، والنافذة تدخل بمفتاح عشوائي لكل تشغيل (`/api/auth/desktop`) |
| نسخة المتصفح | `standalone/entry.js` + shims (fs→IndexedDB، crypto، path…) تبنى بـesbuild إلى `dist/web/js/local/` وتشتغل داخل الصفحة؛ `web/js/standalone.js` يوصل الواجهة بها بدل HTTP/WS |
| تطبيق أندرويد | Capacitor يغلّف `dist/web` (`mobile/`) + جسر صغير `MainActivity.java` (حفظ الملفات، فتح الروابط) |
| Device runner | `device/covo-device.js` يتصل بالسيرفر وينفذ الأدوات |

التفاصيل والبناء: [EDITIONS.md](EDITIONS.md).

## المبادئ
1. **خيط واحد، مبني على الأحداث.** رسالة المستخدم أو حدث (موافقة، مهمة، روتين) ⇒ طابور ⇒ دور واحد بالمرة. لا شيء "يتجمد" بانتظارك: الموافقة ترجع للنموذج `pending_approval` فوراً، وقرارك يفتح دور جديد بحدث `<event>`.
2. **فصل الواجهة عن السجل.** `db.feed` = ما تشوفه (فقاعات، بطاقات). `db.transcript` = رسائل الـAPI الخام (append-only، تحفظ thinking blocks كما هي). هذا يخلي الواجهة حرة والسجل صالح للـcaching.
3. **السياق المتغير داخل رسالة المستخدم** (`<context>`) والـsystem ثابت.
4. **الأمان بالكود** (policy.js + blocked commands + allow-list على الجهاز)، مو بالبرومبت.
5. **بدون build**: الواجهة ES modules مباشرة. عدّل ملف ← Refresh.

## Claude (providers/anthropic.js)
- SDK الرسمي `@anthropic-ai/sdk`، streaming يدوي مع `finalMessage()`.
- `thinking: {type: "adaptive", display: "updates"}` ⇒ ملاحظات بين الأدوات تصير فقاعات.
- `output_config.effort` من الإعدادات (chat: medium، مهام: high).
- `block_binding.prefix_mismatch_behavior: "drop_block"` ⇒ إذا عدّلت البرومبت أو الأدوات بنص المحادثة، ما يصير خطأ.
- `fallbacks: "default"` لنماذج 5.x على API Anthropic المباشر.
- caching تلقائي (`cache_control` على الـsystem + المحادثة).
- إذا رفض الـAPI ميزة beta، يعيد المحاولة بدونها مرة وحدة (degrade).
- `web_search_20260209` و `web_fetch_20260209` كأدوات سيرفر.

## إضافة أداة
بـ `server/agent/tools/index.js`:
```js
tools.push({
  name: 'get_weather',
  description: 'Current weather for a city.',
  input_schema: obj({ city: str('City name') }, ['city']),
  category: 'network',            // فئة الموافقة: auto | network | shell | files_write | messages | payments | device | mcp
  summarize: (i) => ({ title: 'Check weather', detail: i.city }),  // نص بطاقة الموافقة
  run: async ({ city }) => (await fetch(`https://wttr.in/${city}?format=j1`)).json(),
});
```

## إضافة مزوّد نموذج
اكتب `providers/x.js` يصدّر `xTurn({system, messages, tools, maxTokens, signal, onText, onProgress})` ويرجع `{content, stop_reason, usage}` بصيغة Anthropic، وأضفه بـ `loop.js → callModel` و `config.js → activeProvider`.

## البيانات (data/)
| الملف | المحتوى |
|---|---|
| `settings.json` | كل الإعدادات (فيها المفاتيح — احمِ المجلد) |
| `auth.json` | hash كلمة السر، الجلسات، التوكنات، توكنات الأجهزة |
| `db.json` | الخيط، السجل، المواضيع، المهام، الموافقات، الذاكرة، الروتينات |
| `artifacts/<id>/v<n>.txt` | محتوى كل نسخة ملف |
| `uploads/` | المرفقات والصور |
| `vapid.json` | مفاتيح Web Push |
| `workspace/` | مجلد عمل الوكيل على السيرفر |
