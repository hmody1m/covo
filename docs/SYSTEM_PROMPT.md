# System prompt — كيف يفكر الوكيل وكيف يرد

المحرر الكامل: **Settings ← System prompt**. التغيير يتطبق من الرسالة الجاية.
المصدر: `server/agent/prompt.js` (القوالب) + `server/agent/context.js` (السياق لكل دور).

## كيف يُبنى الطلب للنموذج
```
system  = القالب (Default / Operator / Arabic / Minimal أو نصك المخصص)
          + {{extra}}  ← "Extra instructions" من الإعدادات
          [+ ملحق المهمة الخلفية إذا كان الطلب من مهمة]
tools   = الأدوات المفعّلة + أدوات MCP + web_search/web_fetch (Claude)
messages= الخيط (append-only) — كل رسالة منك تبدأ بكتلة:
          <context>
          Now: Friday, October 23, 2026 at 9:41 AM (Asia/Baghdad)
          User: Sara
          Topics: Dubai showroom launch [needs_you]; …
          Tasks: - k_… "Dubai launch plan" needs_you 29/36 — …
          Waiting for approval: - ap_… "Trade license renewal" USD 480 …
          Devices: server "…" online win32; d_… "Office PC" online
          Artifacts: a_… "Seed deck" (deck v2); …
          Routines: …
          Memory: - m_…: Layla is our partner at Atlas Capital …
          </context>
          ثم رسالتك
```
ليش السياق مو داخل الـsystem؟ حتى يبقى الـsystem ثابت ⇒ **prompt caching** يشتغل (أرخص وأسرع بكثير) والتاريخ يبقى append-only.

## المتغيرات
| المتغير | القيمة |
|---|---|
| `{{agent_name}}` | Settings ← Profile ← Agent name (افتراضي Covo) |
| `{{user_name}}` | Settings ← Profile ← Name |
| `{{environment}}` | اسم ونظام السيرفر + المنطقة الزمنية + ملاحظة عن كتلة السياق |
| `{{extra}}` | Extra instructions |

## لماذا الردود قصيرة ومرتبة كفقاعات؟
القالب الافتراضي يفرض:
- **كل فقرة = فقاعة**، فكرة وحدة، 1-3 جمل قصيرة، 1-4 فقاعات بالرد.
- يبدأ بالنتيجة/الحالة. بدون تحيات أو حشو أو "Let me know if…".
- سؤال واحد كحد أقصى، قصير ("Send from you?", "Better?").
- قوائم فقط للملخصات: `- [[Topic]]: …` (تتحول لرقاقات حالة).
- `set_topic` قبل كل موضوع ⇒ وسم الموضوع فوق الفقاعات.
- المحتوى الطويل ⇒ `create_artifact` + فقاعة وحدة تصفه.
- الرسائل والفلوس ⇒ `draft_email` / `request_approval` ⇒ بطاقات Approve / Send.
- ملاحظات التقدم بين الأدوات ("On it. Pulling from…") تظهر كفقاعات (ميزة `display: "updates"` في Claude).

## الأدوات التي يعرفها الوكيل
`set_topic`, `request_approval`, `draft_email`, `send_email`, `create_artifact`, `update_artifact`, `read_artifact`, `create_task`, `message_task`, `update_task`, `remember`, `forget`, `schedule_routine`, `delete_routine`, `notify`, `run_command`, `read_file`, `write_file`, `list_dir`, `open`, `screenshot`, `system_info`, `desktop_notify`, `http_request`, `web_search`, `web_fetch`, + كل أدوات MCP (`mcp__server__tool`).
داخل المهام الخلفية فقط: `report_to_user`, `ask_user`, `complete_task`.

## الموافقات (لا تعتمد على البرومبت)
حتى لو عدّلت البرومبت، الأدوات الحساسة تمر على `server/agent/policy.js`: الفئة ⇒ Ask/Auto/Block من الإعدادات. "Ask" ⇒ بطاقة موافقة، والأداة لا تُنفذ إلا بعد ضغطك Approve. يعني الأمان مو "طلب مهذب" من النموذج، هو قفل بالكود.

## أمثلة تعديل
**رد بالعراقي دائماً** — Extra instructions:
```
Always reply in Iraqi Arabic dialect. Keep numbers and names in English.
```
**مساعد مبرمج على جهازك** — اختر القالب *Computer operator* أو أضف:
```
You are also my senior engineer. When I ask for code changes, work inside C:\Projects using run_command and write_file, run the tests, and only report the outcome.
```
**توقيع الإيميلات**:
```
Sign every email as "Sara — Lumen Home".
```

## إضافة قالب جديد بالكود
بـ `server/agent/prompt.js`:
```js
const SALES = `You are {{agent_name}}, {{user_name}}'s sales agent…`;
export const PRESETS = { …, sales: { name: 'Sales agent', text: SALES } };
```
يظهر تلقائياً بقائمة القوالب.
