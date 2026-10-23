# نظام التصميم

الملف: `web/css/tokens.css`. ثلاث طبقات:

```
Primitives  (--n-50 #F9F9F6, --coral-500 #CF6652, --fs-base 15px, --r-lg 16px …)
     ↓
Semantic    (--bg, --ink, --bubble-ai, --bubble-me, --accent, --primary, --orb-blob …)  ← يتغير لكل ثيم
     ↓
Component   (--bubble-radius, --card-bg, --tabbar-bg, --composer-radius, --orb-size …)
```
القاعدة: المكونات (`app.css`) تستعمل **Semantic/Component فقط**، ما في ألوان ثابتة.

## الألوان الأساسية
| الدور | القيمة |
|---|---|
| الخلفية | `#F9F9F6` |
| فقاعة الوكيل | `#ECECE9` |
| فقاعة المستخدم | `#FAC9BE` |
| البطاقات | `#FCFCFA` / أبيض |
| الكرة | `#CF6652` + حبر `#141413` |
| رقاقة الموضوع | خلفية `#DBE3F5` نص `#3B6FD8` |
| زر أساسي | أسود `#141413` |
| شارة Paid | `#D7EFDF` / `#237A44` |

## الخطوط
- واجهة: **Inter** (عربي: IBM Plex Sans Arabic)
- عناوين: **Source Serif 4** (عربي: Noto Naskh Arabic)

## الثيمات
`classic` · `classic-dark` · `sand` · `ocean` · `forest` · `lavender` · `midnight` · `graphite` · `oled` · `contrast` (+ `system` يختار classic/classic-dark حسب الجهاز).

### إضافة ثيم
1. بـ `tokens.css` انسخ بلوك `[data-theme="sand"] { … }` وغيّر الاسم والقيم.
2. بـ `web/js/components/settings/sections.js` أضف للمصفوفة `THEMES`: `{ id: 'mine', name: 'Mine', c: [bg, bubble, userBubble, accent] }`.

## الحركة
- الكرة: SMIL لتشكيل الكتلة + CSS للخط (sway/draw) — `Orb.js`.
- الفقاعات: `pop` 320ms، نقاط الكتابة 1.2s.
- كله يتوقف مع *Reduce motion* أو `prefers-reduced-motion`.

## المقاسات
- الموبايل < 900px: رأس عائم (زر 36px، كرة 56px)، تبويبات حبة بالأسفل (78×46).
- الديسكتوب ≥ 900px: شريط جانبي 272px، عمود الدردشة 780px، لوحة يمين 440px (العارض 58vw).
