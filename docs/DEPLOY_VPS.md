# التشغيل على VPS (24/7 مع HTTPS)

أي VPS بـ 1 vCPU و 1GB RAM يكفي (Ubuntu 22.04/24.04 أو Debian 12). الوكيل نفسه يشتغل عند مزوّد النموذج، فالسيرفر خفيف.

## 1. الدومين
أنشئ سجل DNS من نوع **A**: `covo.example.com` ← IP السيرفر. (HTTPS ضروري للإشعارات والمايك وتثبيت التطبيق على الآيفون.)

## 2. التثبيت التلقائي
```bash
git clone <your-fork> covo && cd covo      # أو ارفع الملفات بـ scp
sudo bash scripts/vps/install.sh
```
يسألك:
- **الدومين** (أو فارغ للتشغيل على `IP:8787` بدون HTTPS).
- **الوضع**: `1` Docker + Caddy (موصى به) أو `2` Node.js أصلي + systemd (+ Caddy).

## 3. يدوياً بـ Docker
```bash
cp docker/.env.example docker/.env
nano docker/.env                       # COVO_DOMAIN=covo.example.com
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
docker compose -f docker/docker-compose.yml logs -f covo
```
البيانات بـ volume اسمه `covo-data` (يبقى مع التحديثات).

## 4. يدوياً بدون Docker
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs
npm install --omit=dev
PORT=8787 HOST=127.0.0.1 DATA_DIR=/var/lib/covo SECURE_COOKIES=1 node server/index.js
```
وخلفه Caddy:
```
covo.example.com {
  reverse_proxy 127.0.0.1:8787
}
```
(Nginx يشتغل أيضاً — تأكد من تمرير WebSocket: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.)

## 5. أول مرة
افتح `https://covo.example.com` ← أنشئ كلمة السر بسرعة (أول من يفتح الرابط ينشئ الحساب).

## 6. خلي الوكيل يشتغل على جهازك الشخصي
السيرفر على VPS، لكن تريده يستعمل كمبيوترك؟ Settings ← Devices ← **Pair a device** — شوف [DEVICES.md](DEVICES.md).
> لا تفعّل "Let the agent use this server" على VPS مشترك إلا إذا تعرف شنو تسوي.

## الأمان
- `SECURE_COOKIES=1` (مضبوط بالـcompose) حتى تكون الكوكيز HTTPS فقط.
- غيّر كلمة السر من Settings ← Security. محاولات الدخول الخاطئة تُقفل مؤقتاً.
- جدار ناري: `ufw allow 22,80,443/tcp && ufw enable` (لا تفتح 8787 مباشرة إذا تستعمل Caddy).

## التحديث
```bash
git pull && docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
# أو بدون Docker: git pull && npm install && sudo systemctl restart covo
```

## النسخ الاحتياطي
```bash
docker run --rm -v docker_covo-data:/d -v $PWD:/b alpine tar czf /b/covo-backup.tgz -C /d .
```
أو من التطبيق: Settings ← Data ← Export.
