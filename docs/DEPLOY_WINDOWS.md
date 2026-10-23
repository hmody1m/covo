# التشغيل على Windows

## المتطلبات
- Windows 10/11
- Node.js 20 أو أحدث (السكربت ينصّبه تلقائياً عبر winget)

## الطريقة 0 — تطبيق سطح المكتب (الأسهل، بدون Node.js)
1. نزّل `Covo-Setup-x.y.z-x64.exe` من صفحة **Releases** (أو `Covo-Portable-…exe` إذا ما تريد تثبيت).
2. إذا طلعت رسالة *Windows protected your PC*: **More info ← Run anyway** (النسخة غير موقّعة رقمياً بعد).
3. افتح **Covo** من سطح المكتب. أول مرة: اسمك ← المزوّد (Claude/محلي/Demo) ← ثيم. ما يحتاج كلمة سر لأن النافذة تدخل تلقائياً.
4. التطبيق يشغّل السيرفر داخله على `127.0.0.1:8787` ويبقى بالـ**Tray** لما تسكّر النافذة (يكمل المهام والروتينات).
5. قائمة الـTray: *Open Covo* · *Settings* · **Allow phone access (same Wi‑Fi)** (يحتاج كلمة سر من Settings ← Security، ويعيد تشغيل التطبيق ويعرض رابط مثل `http://192.168.1.5:8787` للنسخ) · *Start when I sign in* · *Keep running when the window is closed* · *Open work folder* · *Open data folder* · *Quit*.
6. البيانات: `%APPDATA%\Covo\data` (تبقى بعد إلغاء التثبيت؛ احذفها يدوياً إذا تريد).
7. الوكيل يشتغل على هذا الكمبيوتر مباشرة (Settings ← Devices ← *This computer*)، وكل إجراء حساس يطلب موافقتك.

> تريد تبني الـexe بنفسك؟ `npm run dist:win` (على ويندوز مباشرة، أو لينكس مع Wine). الناتج بمجلد `release/`.

## الطريقة 1 — سكربت التثبيت (سيرفر Node.js)
1. فك ضغط المشروع بمكان ثابت، مثل `C:\Covo`.
2. كليك يمين على `scripts\windows\install-windows.ps1` ← **Run with PowerShell**.
   - إذا ظهر تحذير سياسة التنفيذ: افتح PowerShell واكتب
     `powershell -ExecutionPolicy Bypass -File C:\Covo\scripts\windows\install-windows.ps1`
3. السكربت:
   - ينصّب Node.js LTS إذا مو موجود.
   - ينصّب المكتبات (`npm install`).
   - ينشئ اختصار **Covo** على سطح المكتب وقائمة ابدأ.
   - يسألك: **تشغيل تلقائي عند الدخول؟** (يشغّل السيرفر مخفي بالخلفية).
   - يسألك: **فتح الجدار الناري للموبايل؟** (يفتح المنفذ 8787 للشبكة الخاصة فقط ويعرض لك عنوان IP).

## الطريقة 2 — يدوي
```bat
cd C:\Covo
npm install
start.bat
```
`start.bat` يفتح المتصفح على `http://localhost:8787`.

## خدمة Windows حقيقية (تشتغل قبل تسجيل الدخول)
شغّل PowerShell كمسؤول:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\install-service.ps1
```
يستعمل NSSM وينشئ خدمة باسم `Covo` (تديرها من `services.msc`).

## خلي الوكيل يشتغل على نفس الكمبيوتر
Settings ← **Devices** ← فعّل **Let the agent use … (this server)**. (مفعّل افتراضياً على Windows وmacOS.)
الأوامر تُنفّذ عبر PowerShell داخل مجلد العمل (`data\workspace` افتراضياً — غيّره من نفس الصفحة).
كل أمر يحتاج موافقتك إلا إذا غيّرت "Run commands" إلى Auto في Agent & autonomy.

## الوصول من الموبايل
- **نفس الواي فاي**: `http://192.168.x.x:8787` (يظهر بنهاية المثبّت). الإشعارات والمايك يحتاجون HTTPS، فاستعمل إحدى الطرق التالية للحصول عليهم.
- **Tailscale** (موصى به): نصّبه على الكمبيوتر والموبايل ← افتح `http://اسم-الجهاز:8787`. لتفعيل HTTPS: `tailscale serve --bg 8787` ثم افتح `https://اسم-الجهاز.ts.net`.
- **Cloudflare Tunnel** (رابط عام مؤقت):
  ```powershell
  winget install Cloudflare.cloudflared
  cloudflared tunnel --url http://localhost:8787
  ```

## متغيرات البيئة (اختياري)
انسخ `.env.example` إلى `.env`:
```
PORT=8787
DATA_DIR=./data
ANTHROPIC_API_KEY=sk-ant-...
```

## التحديث
استبدل الملفات (احتفظ بمجلد `data\`) ثم `npm install`.

## النسخ الاحتياطي
كل شيء بمجلد `data\`. أو من التطبيق: Settings ← Data ← **Export everything**.
