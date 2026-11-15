# وهج Live · Wahj Live

بث مباشر للألعاب من الهاتف — آيفون وأندرويد — بتأخير أقل من ثانية عبر Cloudflare Realtime SFU.

- **server/** — Cloudflare Worker: الحسابات، البثوث، غرف الدردشة (Durable Objects)، وكيل SFU، والواجهة (`src/` → `build.py` → `app.html`).
- **ios/** — تطبيق WKWebView + إضافة ReplayKit للبث (WebRTC، صوت اللعبة + المايك، درع الخصوصية، شات فوق اللعبة PiP).
- **android/** — تطبيق WebView + خدمة MediaProjection (صوت اللعبة، عدم الإزعاج التلقائي، فقاعة الكاميرا، شات عائم).
- **tests/e2e.py** — اختبار حي: متصفح يبث ومتصفح آخر يشاهد.

Secrets: `CLOUDFLARE_API_TOKEN` (Workers + Calls: Edit)، `CLOUDFLARE_ACCOUNT_ID`.
