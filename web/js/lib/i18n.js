// UI translations. Keys are the English strings, so adding a language is just
// adding a dictionary here. t('Hello {name}', { name }) interpolates {vars}.
const AR = {
  'Chat': 'الدردشة', 'Tasks': 'المهام', 'Make': 'إنشاء', 'Message': 'رسالة',
  'Approve': 'موافقة', 'Not now': 'ليس الآن', 'Paid': 'مدفوع', 'Approved': 'تمت الموافقة', 'Declined': 'مرفوض', 'Expired': 'منتهي',
  'Expires in {n} min': 'ينتهي خلال {n} د', 'Expires in {n} h': 'ينتهي خلال {n} س', 'Expired.': 'انتهت المهلة.',
  'Email': 'بريد', 'To': 'إلى', 'Subject': 'الموضوع', 'Send': 'إرسال', 'Sent': 'تم الإرسال', 'Dismissed': 'تم التجاهل', 'Failed: {e}': 'فشل: {e}',
  'Updated {t}': 'حُدّث {t}', 'Pinned': 'مثبّت', 'Pin': 'تثبيت', 'Unpin': 'إلغاء التثبيت',
  'Needs you': 'يحتاجك', 'In progress': 'قيد التنفيذ', 'Done': 'منجز', 'All': 'الكل', 'Paused': 'متوقف مؤقتاً', 'Failed': 'فشل', 'Queued': 'بالانتظار', 'Cancelled': 'ملغى',
  'Settings': 'الإعدادات', 'Search': 'بحث', 'Topics': 'المواضيع', 'Routines': 'الروتينات', 'Devices': 'الأجهزة', 'Sign out': 'تسجيل الخروج',
  'Profile': 'الملف الشخصي', 'Appearance': 'المظهر', 'Model & provider': 'النموذج والمزوّد', 'Agent & autonomy': 'الوكيل والاستقلالية', 'System prompt': 'موجّه النظام',
  'Memory': 'الذاكرة', 'Tools & connectors': 'الأدوات والموصلات', 'Notifications': 'الإشعارات', 'Security & access': 'الأمان والوصول', 'Data': 'البيانات', 'Developer': 'المطوّر', 'About': 'حول',
  'Save': 'حفظ', 'Saved': 'تم الحفظ', 'Cancel': 'إلغاء', 'Delete': 'حذف', 'Edit': 'تعديل', 'Add': 'إضافة', 'Close': 'إغلاق', 'Back': 'رجوع', 'Copy': 'نسخ', 'Copied': 'تم النسخ', 'Open': 'فتح', 'Download': 'تنزيل', 'Run now': 'تشغيل الآن', 'Retry': 'إعادة المحاولة', 'Reset': 'إعادة ضبط',
  'Theme': 'السمة', 'Accent color': 'لون التمييز', 'Text size': 'حجم النص', 'Density': 'الكثافة', 'Interface': 'الواجهة', 'Font': 'الخط', 'Language': 'اللغة', 'Timezone': 'المنطقة الزمنية', 'Name': 'الاسم',
  'Auto': 'تلقائي', 'Mobile': 'موبايل', 'Desktop': 'سطح المكتب', 'Compact': 'مضغوط', 'Comfortable': 'مريح', 'Spacious': 'واسع', 'System': 'النظام',
  'Ask': 'اسأل', 'Block': 'منع', 'Supervised': 'تحت الإشراف', 'Balanced': 'متوازن', 'Autonomous': 'مستقل',
  'Stop': 'إيقاف', 'Attach': 'إرفاق', 'Dictate': 'إملاء', 'Voice mode': 'وضع الصوت', 'Listening…': 'أستمع…', 'Thinking…': 'أفكر…', 'Speaking…': 'أتحدث…', 'Tap to talk': 'اضغط للتحدث',
  'Sign in': 'تسجيل الدخول', 'Password': 'كلمة المرور', 'Continue': 'متابعة', 'Get started': 'ابدأ', 'Wrong password': 'كلمة المرور خاطئة',
  'New task': 'مهمة جديدة', 'Make something': 'أنشئ شيئاً', 'Steer': 'توجيه', 'Pause': 'إيقاف مؤقت', 'Resume': 'استئناف', 'Activity': 'النشاط', 'Open in chat': 'فتح في الدردشة',
  'Nothing needs you right now.': 'لا شيء يحتاجك الآن.', 'No tasks yet.': 'لا مهام بعد.', 'Nothing made yet.': 'لم يُنشأ شيء بعد.',
  'Demo mode': 'وضع العرض', 'Connect a model': 'اربط نموذجاً', 'Offline — reconnecting…': 'غير متصل — جارٍ إعادة الاتصال…',
  'Everything': 'كل شيء', 'Pages': 'صفحات', 'Dashboards': 'لوحات', 'Decks': 'عروض', 'Docs': 'مستندات', 'Checklists': 'قوائم',
  'Good morning': 'صباح الخير', 'Good afternoon': 'مساء الخير', 'Good evening': 'مساء الخير',
  'Ask {name} anything, or give it a job.': 'اسأل {name} أي شيء، أو كلّفه بمهمة.',
  'Overview': 'نظرة عامة', 'Waiting for approval': 'بانتظار الموافقة', 'Recent': 'الأحدث', 'Clear filter': 'إلغاء التصفية',
};

const DICTS = { en: {}, ar: AR };
let lang = 'en';

export function setLang(l) { lang = DICTS[l] ? l : 'en'; }
export function getLang() { return lang; }
export const isRTL = () => lang === 'ar';

export function t(key, vars) {
  let s = DICTS[lang]?.[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

export const LANGUAGES = [{ id: 'en', name: 'English' }, { id: 'ar', name: 'العربية' }];
