# الأجهزة — خلي الوكيل يشتغل على كمبيوترك

Covo يقدر يستعمل:
1. **السيرفر نفسه** (إذا مشغّله على كمبيوترك) — Settings ← Devices ← *Let the agent use this server*.
2. **أي كمبيوتر تربطه** (Windows / macOS / Linux) عبر الـ**device runner** — حتى لو Covo على VPS.

## الأدوات المتاحة على الجهاز
| الأداة | شنو تسوي | فئة الموافقة |
|---|---|---|
| `run_command` | أمر PowerShell (Windows) أو bash | Run commands |
| `read_file` / `list_dir` | قراءة ملف (الصور تُرسل للنموذج كصور) / عرض مجلد | Read files |
| `write_file` | إنشاء/تعديل/إلحاق ملف | Write & delete files |
| `open` | فتح رابط، ملف، أو تطبيق | Control devices |
| `screenshot` | لقطة للشاشة (يشوفها النموذج) | Control devices |
| `system_info` | معلومات الجهاز وقائمة الأجهزة | بدون موافقة |
| `desktop_notify` | إشعار سطح المكتب | بدون موافقة |

الموافقات تُضبط من Settings ← **Agent & autonomy**. الأوامر الممنوعة من Settings ← Tools ← *Blocked commands* (وبملف `device.config.json` على الجهاز نفسه).

## الربط خطوة بخطوة
1. بالتطبيق: Settings ← **Devices** ← اكتب اسم (مثلاً "Office PC") ← **Pair a device**.
2. يظهر **توكن** (مرة وحدة) + أزرار تنزيل الملفات: `covo-device.js`, `tools.js`, `package.json`, `start-device.bat`, `start-device.sh`. نزّلها بمجلد واحد على الجهاز (أو انسخ مجلد `device/` من المشروع).
3. نصّب Node.js 20+ على الجهاز.
4. شغّل الأمر الظاهر، مثل:
   ```powershell
   npm install; node covo-device.js --server https://covo.example.com --token dev_xxx --name "Office PC"
   ```
5. بالتطبيق يصير الجهاز **online** بالأخضر. جرّب بالدردشة: *"Take a screenshot of my PC and tell me what's open"*.

## ملف إعداد بدل الخيارات
انسخ `device.config.example.json` إلى `device.config.json`:
```json
{
  "server": "https://covo.example.com",
  "token": "dev_…",
  "name": "Office PC",
  "workdir": "C:\\Users\\me\\Documents",
  "allow": "run_command,read_file,write_file,list_dir,system_info,open,screenshot,desktop_notify",
  "blockedCommands": ["format c:", "shutdown"]
}
```
ثم دبل كليك `start-device.bat` (Windows) أو `./start-device.sh`.
`allow` يحدد الأدوات المسموحة على هذا الجهاز تحديداً (طبقة أمان إضافية فوق موافقات التطبيق).

## تشغيل تلقائي مع Windows
`Win + R` ← `shell:startup` ← ضع اختصار لـ `start-device.bat`.
(macOS: أضف `start-device.sh` إلى Login Items. Linux: خدمة systemd --user.)

## الأمان
- التوكن = صلاحية على الجهاز. إذا تسرّب: Settings ← Devices ← 🗑 (يفصل فوراً).
- الاتصال عبر WebSocket على نفس دومين التطبيق — استعمل HTTPS (wss) على الإنترنت.
- الـrunner لا يفتح أي منفذ على جهازك؛ هو يتصل بالسيرفر.

## أي جهاز يُستعمل؟
Settings ← Devices ← *Run computer tools on*: **Auto** (أول جهاز متصل، وإلا السيرفر إذا مسموح) أو جهاز محدد. الوكيل يقدر يختار جهاز بالاسم أيضاً ("run it on Office PC").
