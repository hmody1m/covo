<div dir="rtl">

# Covo — بديل مفتوح المصدر لـ Claude Duet

وكيل ذكاء اصطناعي مستقل **تشغّله أنت**: يعطيك ملخص كل صباح، يشتغل بالخلفية، يبني صفحات وعروض ووثائق ولوحات، يشتغل على كمبيوترك، ويسألك فقط لما يكون القرار قرارك.

> **تنبيه:** Covo مشروع مستقل من المجتمع، **ما له أي علاقة بشركة Anthropic** ولا هي تدعمه أو ترعاه. "Claude" و"Claude Duet" علامات تجارية لـ Anthropic، نذكرها فقط لوصف المشروع، ولأنه يقدر يستعمل Claude API **بمفتاحك الخاص**. المشروع ما يحتوي أي كود أو شعار أو صور تابعة لهم. التفاصيل: [TRADEMARKS.md](TRADEMARKS.md).

![Covo على الموبايل](docs/screen-mobile.png)

## التحميل

| النسخة | الملف | مناسبة لـ |
|---|---|---|
| **تطبيق ويندوز** | `Covo-Setup-…-x64.exe` (مثبّت) أو `Covo-Portable-…-x64.exe` (بدون تثبيت) | الشغل على كمبيوترك: الوكيل يشتغل على نفس الجهاز وبموافقتك |
| **ماك / لينكس** | `.dmg` · `.AppImage` · `.deb` | نفس الشي |
| **تطبيق أندرويد** | `Covo-…-android.apk` | Covo بجيبك، أو تفتح سيرفرك الخاص |
| **نسخة المتصفح** | `Covo-…-web.zip` أو موقع GitHub Pages للمشروع | تجربة بدون تثبيت؛ كل شي يبقى بمتصفحك |
| **سيرفر** | هذا المستودع (`npm start` أو Docker أو سكربت VPS) | وكيل شغّال دائماً توصله من كل أجهزتك |

كل الملفات بصفحة [**Releases**](https://github.com/hmody1m/covo/releases) ومعها `SHA256SUMS.txt` للتحقق. إذا ويندوز طلع رسالة *Windows protected your PC* اضغط **More info ← Run anyway**. نزّل فقط من الصفحة الرسمية.

## المزايا
- **خيط واحد مستمر مقسّم بمواضيع**، رقاقات حالة داخل النص، فقاعات تطلع وحدة وحدة، و**كرة متحركة** تبين شنو يسوي الوكيل.
- تبويبات **Chat · Tasks · Make**: مهام بالخلفية بتقدّم حي، وملفات (صفحات، عروض، وثائق، لوحات) بمعاينة ونسخ سابقة.
- **بطاقات موافقة** للدفع والرسائل والأوامر والملفات (Approve / Not now)، و**مسودات بريد** (Send / Not now / تعديل).
- **وكيل مستقل حقيقي**: مهام بالخلفية، روتينات مجدولة، ذاكرة، بحث وجلب الويب، MCP، Claude افتراضياً أو أي نموذج متوافق مع OpenAI (Ollama, LM Studio, OpenRouter…).
- **يشتغل على جهازك**: PowerShell/bash، ملفات، تطبيقات، لقطات شاشة — على نفس الجهاز أو أي كمبيوتر تربطه.
- **الأمان بالكود مو بالبرومت**: Ask / Auto / Block لكل فئة، 3 مستويات استقلالية، أوامر ممنوعة، صندوق معزول للملفات المولّدة.
- **أنت المطوّر**: System prompt كامل قابل للتعديل من الإعدادات.
- **11 ثيم**، عربي/إنجليزي مع RTL، وضع صوتي، PWA بإشعارات شاشة القفل، **ربط Telegram** بأزرار موافقة، تصدير.
- **Demo مدمج** بقصة خيالية كاملة بدون مفتاح.
- **خصوصية**: ما عندنا سيرفرات ولا حسابات ولا تتبع. [PRIVACY.md](PRIVACY.md)

## البدء السريع

**تطبيق ويندوز:** شغّل المثبّت ← *Get started* ← اسمك ← اختر **Claude** والصق مفتاح من [console.anthropic.com](https://console.anthropic.com/settings/keys) (أو نموذج محلي أو الـDemo) ← اختر ثيم. التطبيق يبقى بالـTray ويكمل شغله لو سكرت النافذة. من الـTray ← **Allow phone access** تقدر تفتحه من موبايلك على نفس الواي فاي (بعد ما تحط كلمة سر من Settings ← Security).

**سيرفر:**
```bash
npm install
npm start            # ← http://localhost:8787
```
على ويندوز بدون أوامر: دبل كليك على `start.bat`. التفاصيل: [docs/DEPLOY_WINDOWS.md](docs/DEPLOY_WINDOWS.md)

**VPS مع HTTPS تلقائي:** `sudo bash scripts/vps/install.sh` — التفاصيل: [docs/DEPLOY_VPS.md](docs/DEPLOY_VPS.md)

**خلّي الوكيل يشتغل على كمبيوترك:** Settings ← Devices ← فعّل *Let the agent use this computer*، أو **Pair a device** لأي كمبيوتر ثاني: [docs/DEVICES.md](docs/DEVICES.md)

## البناء بنفسك
```bash
npm run build:web     # نسخة المتصفح ← dist/web
npm run dist:win      # مثبّت ويندوز + نسخة محمولة ← release/
npm run apk           # تطبيق أندرويد (يحتاج JDK 21 + Android SDK)
npm test
```
لما تسوي tag مثل `v1.0.0` على GitHub، كل النسخ تنبني وتنشر تلقائياً. التفاصيل: [docs/EDITIONS.md](docs/EDITIONS.md)

## عدّل كل شي
| تريد تغيّر | المكان |
|---|---|
| شخصية الوكيل وردوده | Settings ← **System prompt** أو `server/agent/prompt.js` |
| الأدوات | `server/agent/tools/index.js` |
| الألوان والثيمات | `web/css/tokens.css` |
| الواجهة | `web/js/components/*` (بدون build — عدّل وسوي refresh) |
| الاسم والشعار والروابط | `node scripts/rename.mjs --name "اسمك" --repo you/repo` |
| كل زر وشنو يطلع بعده | [docs/USER_FLOWS.md](docs/USER_FLOWS.md) |

## آراء ومساهمات
فكرة أو مشكلة أو سؤال: [افتح Issue](https://github.com/hmody1m/covo/issues/new/choose) (أو من داخل التطبيق: Settings ← About). الثغرات الأمنية تنرسل بشكل خاص: [SECURITY.md](SECURITY.md). المساهمات مرحب بيها: [CONTRIBUTING.md](CONTRIBUTING.md).

## قانوني
- رخصة [MIT](LICENSE).
- [شروط الاستخدام](TERMS.md) · [الخصوصية](PRIVACY.md) · [العلامات التجارية](TRADEMARKS.md) · [تراخيص الطرف الثالث](THIRD_PARTY_NOTICES.md) · [الأمان](SECURITY.md)
- تستعمل مزوّدي الذكاء الاصطناعي بحسابك وبشروطهم (مثل [سياسة الاستخدام لـ Anthropic](https://www.anthropic.com/legal/aup))، والتكلفة عليك عند المزوّد.
- ردود الذكاء الاصطناعي ممكن تغلط. الموافقات مفعّلة افتراضياً لكل شي يصرف فلوس أو يرسل رسائل أو يغيّر بجهازك.
- شركة الـDemo والأسماء والأرقام كلها خيالية.

</div>
