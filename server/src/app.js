"use strict";
/* ================= Wahj Live — app ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n, cls = "") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
/* ===== illustrated art (gifts + canvas effects), no emoji ===== */
const ART = {
  boom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="a"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#fff36b"/><stop offset=".65" stop-color="#ff8a00"/><stop offset="1" stop-color="#ff1e3c"/></radialGradient></defs><path fill="url(#a)" d="M50 2l9 22 20-12-6 23 24 2-19 15 17 17-24-1 3 24-19-14-12 21-6-24-22 9 11-21-21-11 23-6-12-20 22 6z"/></svg>`,
  horn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffc400"/><stop offset="1" stop-color="#d47a00"/></linearGradient></defs><path fill="url(#a)" d="M8 44h14l50-28v68L22 56H8z"/><ellipse cx="72" cy="50" rx="8" ry="34" fill="#ffdd55"/><ellipse cx="72" cy="50" rx="4" ry="26" fill="#a85d00"/><rect x="14" y="56" width="10" height="20" rx="4" fill="#d47a00"/><path d="M84 30q10 20 0 40M90 22q16 28 0 56" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/></svg>`,
  ghost: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c8b6ff"/></linearGradient></defs><path fill="url(#a)" d="M20 92V45a30 30 0 0 1 60 0v47l-10-8-10 8-10-8-10 8-10-8z"/><ellipse cx="39" cy="45" rx="6" ry="9" fill="#1a1033"/><ellipse cx="61" cy="45" rx="6" ry="9" fill="#1a1033"/><ellipse cx="50" cy="65" rx="7" ry="5" fill="#1a1033"/></svg>`,
  petal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe0ef"/><stop offset="1" stop-color="#ff6fae"/></linearGradient></defs><path fill="url(#a)" d="M50 6C78 26 84 60 50 94 16 60 22 26 50 6z"/></svg>`,
  g_rose: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="a" cx=".4" cy=".35"><stop offset="0" stop-color="#ff7a9a"/><stop offset=".6" stop-color="#e8133f"/><stop offset="1" stop-color="#8a0020"/></radialGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7dff8f"/><stop offset="1" stop-color="#0d8a3a"/></linearGradient></defs><path d="M50 52v44" stroke="#14a04a" stroke-width="5" stroke-linecap="round"/><path fill="url(#b)" d="M50 78c-14-2-22-12-20-20 10 0 18 8 20 20zM50 70c12-4 22-2 24 6-10 4-18 2-24-6z"/><circle cx="50" cy="32" r="26" fill="url(#a)"/><path d="M50 14c8 6 10 16 2 22-6 4-14 0-12-8 1-6 8-6 9-2" stroke="#7a0018" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M30 28c4 12 14 18 22 18M70 26c-2 12-10 18-18 20" stroke="#a5002a" stroke-width="2.5" fill="none" opacity=".7"/></svg>`,
  g_heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ad5"/><stop offset=".5" stop-color="#ff2e88"/><stop offset="1" stop-color="#c3005a"/></linearGradient></defs><path fill="url(#a)" d="M50 90S8 64 8 34a21 21 0 0 1 42-8 21 21 0 0 1 42 8c0 30-42 56-42 56z"/><ellipse cx="30" cy="30" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 30 30)"/></svg>`,
  g_controller: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b38cff"/><stop offset=".5" stop-color="#7c5cff"/><stop offset="1" stop-color="#00c8ff"/></linearGradient></defs><path fill="url(#a)" d="M28 26h44c14 0 24 12 26 30l2 18c1 10-10 16-18 8l-12-12H30L18 82c-8 8-19 2-18-8l2-18c2-18 12-30 26-30z"/><path fill="#fff" d="M24 44h6v-6h6v6h6v6h-6v6h-6v-6h-6z"/><circle cx="68" cy="42" r="4.5" fill="#ffd700"/><circle cx="78" cy="50" r="4.5" fill="#ff4d8d"/><circle cx="58" cy="50" r="4.5" fill="#2ee59d"/><circle cx="68" cy="58" r="4.5" fill="#00e5ff"/><ellipse cx="40" cy="30" rx="12" ry="3" fill="#fff" opacity=".35"/></svg>`,
  g_car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a6a"/><stop offset=".55" stop-color="#e00024"/><stop offset="1" stop-color="#7a0010"/></linearGradient></defs><path fill="url(#a)" d="M4 62c0-6 4-9 10-10l16-3 14-11c4-3 9-4 14-4h10c6 0 11 3 15 8l6 8 7 2c3 1 4 4 4 7v6c0 3-2 5-5 5H9c-3 0-5-2-5-5z"/><path fill="#1b1430" d="M46 40h12v12H34zM62 40h6c3 0 6 2 8 5l4 7H62z"/><path d="M8 60h14M84 58h8" stroke="#fff3a0" stroke-width="3" stroke-linecap="round"/><circle cx="26" cy="72" r="11" fill="#14101f"/><circle cx="26" cy="72" r="5" fill="#c9d6ff"/><circle cx="76" cy="72" r="11" fill="#14101f"/><circle cx="76" cy="72" r="5" fill="#c9d6ff"/><path d="M14 54h70" stroke="#fff" stroke-width="1.5" opacity=".45"/></svg>`,
  g_lion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="a"><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#c25400"/></radialGradient><radialGradient id="b" cx=".5" cy=".4"><stop offset="0" stop-color="#ffe9b0"/><stop offset="1" stop-color="#f2b450"/></radialGradient></defs><path fill="url(#a)" d="M50 2l8 10 12-6 3 13 13-2-3 13 12 5-8 10 8 10-12 5 3 13-13-2-3 13-12-6-8 10-8-10-12 6-3-13-13 2 3-13-12-5 8-10-8-10 12-5-3-13 13 2 3-13 12 6z"/><circle cx="50" cy="52" r="27" fill="url(#b)"/><circle cx="31" cy="30" r="7" fill="#f2b450"/><circle cx="69" cy="30" r="7" fill="#f2b450"/><ellipse cx="40" cy="48" rx="4" ry="5" fill="#2a1600"/><ellipse cx="60" cy="48" rx="4" ry="5" fill="#2a1600"/><path fill="#4a2600" d="M44 60h12l-6 7z"/><path d="M50 67v5M43 74q7 5 14 0" stroke="#4a2600" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  g_crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#ffd700"/><stop offset="1" stop-color="#b8760b"/></linearGradient></defs><path fill="url(#a)" d="M8 78 4 28l24 20 22-36 22 36 24-20-4 50z"/><rect x="8" y="78" width="84" height="12" rx="3" fill="#d4a017"/><circle cx="50" cy="56" r="8" fill="#ff2e63"/><circle cx="26" cy="62" r="6" fill="#00c8ff"/><circle cx="74" cy="62" r="6" fill="#2ee59d"/><circle cx="4" cy="28" r="5" fill="#ffd700"/><circle cx="50" cy="12" r="5" fill="#ffd700"/><circle cx="96" cy="28" r="5" fill="#ffd700"/><path d="M14 72h72" stroke="#fff" stroke-width="2" opacity=".5"/></svg>`,
  g_rocket: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d6ff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#9aa8c8"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff36b"/><stop offset=".5" stop-color="#ff8a00"/><stop offset="1" stop-color="#ff1e3c" stop-opacity="0"/></linearGradient></defs><path fill="url(#f)" d="M38 78h24l-12 22z"/><path fill="url(#a)" d="M50 2c14 12 20 30 18 54l-4 22H36l-4-22C30 32 36 14 50 2z"/><path fill="#ff2e63" d="M50 2c7 6 11 12 14 20H36c3-8 7-14 14-20zM32 56 16 72l2 10 16-8zM68 56l16 16-2 10-16-8z"/><circle cx="50" cy="40" r="9" fill="#2b7bff" stroke="#fff" stroke-width="3"/><circle cx="47" cy="37" r="3" fill="#bfe3ff"/></svg>`,
};
const REACT = { hrt: ["heart", "pink"], fir: ["fire", "fire"], str: ["star", "gold"], blt: ["zap", "cyan"], crn: ["crown", "gold"], tro: ["trophy", "gold"], gg: ["game", "violet"] };
const ARTURL = {}; for (const k in ART) ARTURL[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ART[k]);
const ARTIMG = {}; for (const k in ARTURL) { const im = new Image(); im.src = ARTURL[k]; ARTIMG[k] = im; }
const artHtml = (k, cls = "art") => ARTURL[k] ? `<img class="${cls}" src="${ARTURL[k]}" alt="">` : "";
/* colored icon */
const eic = (n, c = "") => `<svg class="ei ${c ? "ei-" + c : ""}"><use href="#i-${n}"/></svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem("wahj." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("wahj." + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------------- app settings (this device) ---------------- */
const P = Object.assign({ haptics: true, fxSound: true, reduceFx: false, showLat: true, chatOnStream: true, autoSound: true }, store.get("prefs", {}));
const setP = (k, v) => { P[k] = v; store.set("prefs", P); };

/* ---------------- state ---------------- */
const S = {
  token: store.get("token", ""),
  user: store.get("user", null),
  lang: store.get("lang", (navigator.language || "ar").startsWith("ar") ? "ar" : "en"),
  following: new Set(),
  native: null, // {platform, device, version, features}
  ice: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
  live: null, // current broadcast job {room, pub, role, ...}
  bstate: "idle",
};

/* ---------------- i18n ---------------- */
const T = {
  ar: {
    tag: "بثّ ألعابك مباشرة — بتأخير أقل من ثانية", login: "تسجيل الدخول", register: "حساب جديد", handle: "اسم المستخدم",
    name: "الاسم الظاهر", password: "كلمة المرور", go: "متابعة", guest: "تصفّح كزائر", liveNow: "مباشر الآن", following: "متابَعون",
    all: "الكل", action: "أكشن", sports: "رياضة", br: "باتل رويال", racing: "سباقات", strategy: "استراتيجية", retro: "ريترو", chill: "دردشة",
    noLive: "لا يوجد بث مباشر حالياً", beFirst: "كن أول من يبث الآن", viewers: "مشاهد", goLive: "ابدأ البث", title: "عنوان البث",
    titlePh: "مثال: تحدي الفوز بدون خسارة", game: "اللعبة", gamePh: "اسم اللعبة", cat: "التصنيف", quality: "الجودة", fps: "الإطارات",
    mic: "الميكروفون", micD: "صوتك يُدمج مع صوت اللعبة", privacy: "درع الخصوصية", dnd: "عدم الإزعاج التلقائي",
    dndD: "يُخفي الإشعارات والاتصالات طوال البث ثم يرجع كما كان", callG: "حماية الاتصالات", callGD: "تُحجب الصورة فوراً عند أي اتصال",
    bannerG: "إخفاء الإشعارات الذكي", bannerGD: "يكشف شريط الإشعارات أعلى الشاشة ويغطّيه", appOnly: "بث اللعبة فقط",
    appOnlyD: "اختر «تطبيق واحد» في نافذة أندرويد — لن يظهر أي شيء غير اللعبة",
    start: "ابدأ البث المباشر", needApp: "البث من الهاتف يحتاج تطبيق وهج", browserLive: "بث من المتصفح",
    chatPh: "اكتب تعليقاً…", loginToChat: "سجّل الدخول للمشاركة", effects: "مؤثرات", react: "تفاعل", challenge: "تحدٍّ",
    challengePh: "تحدَّ البثّاث… مثال: اربح بالمسدس فقط", send: "إرسال", challenges: "التحديات", noCh: "لا توجد تحديات بعد",
    accept: "قبول", done: "نجح ✓", failed: "فشل", reject: "رفض", poll: "تصويت", newPoll: "تصويت جديد", question: "السؤال",
    option: "خيار", duration: "المدة", startPoll: "إطلاق التصويت", endPoll: "إنهاء", votes: "صوت", ended: "انتهى",
    costream: "بث مشترك", reqJoin: "اطلب الانضمام للبث", reqSent: "تم إرسال طلبك للبثّاث", requests: "طلبات الانضمام",
    noReq: "لا توجد طلبات", approve: "قبول", deny: "رفض", invited: "دعاك {n} للبث المشترك!", joinNow: "انضم الآن",
    later: "لاحقاً", invite: "دعوة للبث", kick: "إزالة", pin: "تثبيت", unpin: "إلغاء التثبيت", share: "مشاركة",
    copied: "تم نسخ الرابط", end: "إنهاء البث", endQ: "إنهاء البث المباشر؟", yes: "نعم", no: "لا", liveFor: "مدة البث",
    peak: "الذروة", hypeLvl: "مستوى الحماس", overlay: "الشات فوق اللعبة", camBubble: "كاميرا الوجه", preview: "معاينة",
    chatTitle: "الدردشة", noChat: "الدردشة هادئة… قل مرحباً", starting: "جارٍ التجهيز…", tapStart: "اضغط «بدء البث» في نافذة النظام",
    reopen: "فتح نافذة البث", onAir: "على الهواء", stopped: "توقف البث", shieldOn: "درع الخصوصية يعمل", shieldOff: "الدرع غير مفعّل",
    shieldPaused: "الصورة محجوبة الآن للخصوصية", privTitle: "لحظة خصوصية", privSub: "سيعود البث خلال ثوانٍ",
    offline: "البث غير متاح الآن", endedT: "انتهى البث", back: "رجوع", tapSound: "اضغط لتشغيل الصوت", follow: "متابعة",
    unfollow: "متابَع", followers: "متابِع", past: "بثوث سابقة", edit: "تعديل الملف", save: "حفظ", bio: "نبذة", color: "لون الحساب",
    settings: "الإعدادات", language: "اللغة", logout: "تسجيل الخروج", focusGuide: "دليل إخفاء الإشعارات في آيفون",
    focusSteps: "١. افتح تطبيق «الاختصارات» ← «الأتمتة» ← «أتمتة جديدة»<br>٢. اختر «تطبيق» ← وهج ← «عند الفتح»<br>٣. اختر «تشغيل فوري»<br>٤. أضف إجراء «تعيين التركيز» ← «عدم الإزعاج» ← تشغيل<br><br>الآن كل مرة تفتح وهج يتفعّل عدم الإزعاج تلقائياً ✓",
    openShortcuts: "فتح الاختصارات", errs: { bad_handle: "اسم المستخدم: ٣–٢٠ حرفاً إنجليزياً أو أرقام", weak_password: "كلمة المرور ٦ أحرف على الأقل", taken: "الاسم محجوز", bad_login: "بيانات الدخول غير صحيحة", rate: "محاولات كثيرة، انتظر قليلاً", net: "تعذّر الاتصال", auth: "سجّل الدخول أولاً", not_invited: "لم تتم دعوتك", login: "سجّل الدخول للمشاركة", slow: "انتظر لحظة", guests_full: "اكتمل عدد الضيوف (٣)", bad_email: "البريد الإلكتروني غير صحيح", email_taken: "هذا البريد مسجّل مسبقاً", bad_code: "الرمز غير صحيح أو منتهي", mail_off: "إرسال البريد غير مفعّل في السيرفر بعد", bad_link: "الرابط غير صحيح", no_points: "نقاطك غير كافية", need_text: "اكتب رسالتك أولاً", too_many: "الحد ١٢ مكافأة", no_coins: "رصيدك غير كافٍ", vip_only: "خاص بمشتركي VIP", owned: "تملكه مسبقاً", self: "لا يمكنك إهداء نفسك", pay_off: "الدفع غير مفعّل بعد", pay_fail: "تعذّر إنشاء الدفع", forbidden: "غير مسموح", not_found: "غير موجود", bad_old: "كلمة المرور الحالية غير صحيحة", bad_image: "الصورة غير مدعومة", fx_off: "البثّاث أوقف المؤثرات", ch_off: "البثّاث أوقف التحديات", co_off: "البثّاث لا يقبل طلبات البث المشترك", bad_ytkey: "مفتاح يوتيوب غير صحيح" },
    sentFx: "أرسل", hypeTrain: "قطار الحماس", latency: "تأخير", guestsN: "ضيوف", layoutSplit: "شاشة مقسومة", layoutFocus: "تركيز",
    declined: "تم الرفض", errorT: "خطأ",
    modT: "الإشراف", mods: "المشرفون", vipsR: "المميزون (ترقية)", sanctions: "العقوبات الحالية", roleMod: "مشرف", roleVip: "مميز", roleOwner: "صاحب القناة",
    mTimeout: "تايم أوت (منع الكتابة)", mKick: "طرد 10 دقائق", mBan: "حظر نهائي", mUnban: "رفع كل العقوبات", mUntimeout: "إلغاء التايم أوت", mPromote: "ترقية مميز", mDemote: "إزالة الترقية",
    mAddMod: "تعيين مشرف", mRemoveMod: "إزالة الإشراف", mDel: "حذف الرسالة", mClear: "مسح الشات بالكامل", mProfile: "الملف الشخصي", mAddByHandle: "أضف مشرفاً باسم المستخدم", mAdd: "إضافة",
    mins: "د", hrs: "س", modDone: "تم ✓", owner_only: "هذا لصاحب القناة فقط", already: "مُرقّى مسبقاً", bad_action: "إجراء غير صحيح",
    ml_timeout: "{n} أخذ تايم أوت {m} بواسطة {b}", ml_untimeout: "{b} ألغى التايم أوت عن {n}", ml_kick: "{n} طُرد من البث بواسطة {b}", ml_ban: "{n} حُظر من القناة بواسطة {b}", ml_unban: "{b} رفع العقوبات عن {n}",
    ml_promote: "{n} صار مميزاً بواسطة {b}", ml_demote: "{b} أزال ترقية {n}", ml_addmod: "{n} صار مشرفاً", ml_removemod: "{b} أزال إشراف {n}",
    youMod: "صرت مشرفاً في هذه القناة", youVip: "تمت ترقيتك مميز", youRoleOff: "تمت إزالة رتبتك", timedOutT: "لا يمكنك الكتابة — تايم أوت حتى {t}", kickedT: "تم طردك من هذا البث", bannedT: "أنت محظور من هذه القناة", chatCleared: "تم مسح الشات", noneYet: "لا يوجد",
    fxs: "المؤثرات", fxLocked: "هذا المؤثر يُشترى من المتجر", preview: "معاينة", owned2: "تملكه",
    ranks: "ترتيب الستريمرز", rankMonth: "هذا الشهر", rankAll: "كل الوقت", rankYou: "مركزك", rankNone: "لم تدخل الترتيب بعد — ابدأ البث!", rankEnds: "ينتهي الموسم بعد {n}", days: "يوم",
    sLevel: "مستوى الستريمر", sRankM: "مركزه هذا الشهر", sRankA: "مركزه العام", sNext: "{n} XP للمستوى التالي", sLevelUp: "{n} وصل مستوى ستريمر {l}", sLevelUpMe: "مستواك كستريمر صار {l}!",
    topPerks: "مزايا الثلاثة الأوائل", topYou: "أنت #{n} هذا الشهر", sharePct: "أرباحك من الهدايا والاشتراكات: {n}%",
    perk1: "تاج ذهبي متحرّك بجانب اسمه في كل مكان + إطار ذهبي", perk2: "بثّه يظهر أولاً في الصفحة الرئيسية ببطاقة مميزة", perk3: "أرباح أعلى: الأول 85% • الثاني 80% • الثالث 75% (الباقون 70%)", perk4: "دخول بثّه يظهر بشارة المركز في الشات والبروفايل",
    xpHow: "كيف يرتفع مستوى الستريمر؟", xpHow1: "+2 XP لكل دقيقة بث", xpHow2: "+1 XP لكل مشاهد مسجّل عن كل دقيقة", xpHow3: "+25 XP لكل متابع جديد", xpHow4: "+250 XP لكل اشتراك • +1 XP لكل 2 كوينز هدايا",
    tier1: "مبتدئ", tier2: "صاعد", tier3: "محترف", tier4: "نجم", tier5: "أسطورة", tier6: "أيقونة",
    yt: "يوتيوب", ytAlso: "بث على يوتيوب أيضاً", ytAlsoD: "نفس البث يظهر لمتابعيك على قناتك في يوتيوب", ytAdd: "اربط قناة يوتيوب", ytKey: "مفتاح البث (Stream key)", ytKeyPh: "xxxx-xxxx-xxxx-xxxx-xxxx",
    ytHelp: "افتح YouTube Studio ← إنشاء ← بث مباشر ← البث (Stream) وانسخ «مفتاح البث» والصقه هنا. المفتاح يبقى سرّياً على السيرفر ولا يراه أحد.", ytSave: "حفظ", ytRemove: "إزالة الربط", ytSaved: "تم ربط يوتيوب ✓", ytRemoved: "تمت إزالة الربط",
    ytLinked: "مربوط {k}", ytNot: "غير مربوط", ytOn: "يوتيوب: يبث ✓", ytWait: "يوتيوب: يتم الإرسال… (يظهر بعد ~20 ثانية)", ytErr: "يوتيوب: فشل ({c}) — تأكد من المفتاح وأن البث مفعّل في YouTube Studio", bad_ytkey: "مفتاح يوتيوب غير صحيح",
    subscribe: "اشترك", subscribed: "مشترك {n}", subTitle: "اشترك في قناة {n}", subD: "دخول مميز بأنيميشن يراه الجميع • شارة المشترك في الشات • نقاط ×1.5 • +300 نقطة فوراً", subBuy: "اشترك 30 يوم", subOk: "أنت الآن مشترك في {n}",
    subMonths: "مشترك منذ {n} شهر", enteredGrand: "دخل البث", subsN: "مشترك",
    points: "نقاط القناة", level: "المستوى", xpTo: "{n} XP للمستوى التالي", streakT: "سلسلة {n} يوم", watchT: "{n} دقيقة مشاهدة", rewards: "المكافآت", topFans: "أبرز المتابعين",
    dailyT: "زيارة يومية · سلسلة {s} · +{p} نقطة +{x} XP", chestT: "اضغط لاستلام +50 نقطة", claimedT: "+{n} نقطة", levelUpT: "وصل للمستوى {n}", youLevel: "مستواك الآن {n}",
    redeemedT: "استبدل", msgPh: "رسالتك…", noPoints: "نقاطك غير كافية", howEarn: "كيف أجمع؟", howEarnD: "مشاهدة ٥ دقائق: +10 نقاط +10 XP • صندوق كل ١٥ دقيقة: +50 • زيارة يومية: +50 (تزيد مع السلسلة) • رسالة: +2 XP • هدية: XP بنصف قيمتها",
    myRewards: "مكافآت قناتي", addReward: "إضافة مكافأة", rewardTitle: "اسم المكافأة (مثال: غيّر السلاح)", cost: "السعر بالنقاط", redeemQ: "طلبات المكافآت", done2: "تم", refund: "استرجاع", noRedeems: "لا توجد طلبات",
    wallet: "المحفظة", coins: "كوينز", buyCoins: "شراء كوينز", shop: "المتجر", vip: "اشتراك VIP", vipD: "اسم متحرك بكل الألوان • شارة VIP • مؤثرات حصرية • إعلان دخولك للبث", vipBuy: "اشترك 30 يوم", vipUntil: "VIP حتى {d}",
    names: "ألوان الاسم", badges: "الشارات", frames: "إطارات الصورة", buy: "شراء", equip: "استخدام", equipped: "مستخدم ✓", unequip: "إزالة", noCoins: "رصيدك غير كافٍ", gifts: "هدايا", sendGift: "إرسال",
    giftSent: "أرسل", payOpen: "أكمل الدفع في PayPal ثم ارجع إلى وهج", paid: "تمت إضافة {n} كوينز", payOff: "الدفع غير مفعّل بعد في السيرفر", history: "السجل", earned: "أرباح الهدايا",
    entered: "دخل البث", vipOnly: "خاص بمشتركي VIP", admin: "لوحة المالك", grant: "منح", handleQ: "اسم المستخدم", vipDays: "أيام VIP", sandbox: "وضع التجربة (Sandbox)",
    soonT: "سيبدأ البث خلال لحظات", soonS: "البثّاث يفتح اللعبة الآن", openGameNow: "افتح {g} الآن — يبدأ البث للمشاهدين عند دخولك اللعبة", soonShield: "المشاهدون يرون «سيبدأ البث» حتى تدخل اللعبة",
    autoLaunch: "افتح اللعبة تلقائياً", autoLaunchD: "بعد بدء البث ينتقل وهج إلى اللعبة مباشرة", openingGame: "جارٍ فتح اللعبة…",
    recSave: "حفظ البث على السيرفر", recSaveD: "يُسجَّل بثك ويمكن إعادة مشاهدته من ملفك", recordings: "التسجيلات", noRecs: "لا توجد تسجيلات", replay: "إعادة مشاهدة", delRec: "حذف التسجيل", delRecQ: "حذف هذا التسجيل نهائياً؟",
    delAllRecs: "حذف كل التسجيلات", delAllQ: "حذف كل تسجيلاتك نهائياً؟", storage: "المساحة المستخدمة", recOff: "حفظ البثوث غير مفعّل في السيرفر", recording: "يتم التسجيل", recFull: "مساحة التسجيلات ممتلئة",
    settingsT: "الإعدادات", secAccount: "الحساب", secStream: "إعدادات البث الافتراضية", secRoom: "قواعد غرفتي", secWatch: "المشاهدة", secNotif: "الإشعارات", secApp: "التطبيق", secAbout: "حول",
    editProfile: "تعديل الملف الشخصي", changePass: "تغيير كلمة المرور", oldPass: "كلمة المرور الحالية", deleteAcc: "حذف الحساب", deleteQ: "سيُحذف حسابك نهائياً. اكتب كلمة المرور للتأكيد", deleted: "تم حذف الحساب",
    usernameLocked: "اسم المستخدم لا يمكن تغييره", photo: "الصورة", changePhoto: "تغيير الصورة", removePhoto: "حذف الصورة", link: "رابط (يوتيوب، تيك توك…)", saved: "تم الحفظ ✓",
    followingN: "يتابع", streamsN: "بث", hoursN: "ساعة بث", bestPeak: "أعلى مشاهدة", gamesPlayed: "ألعابه", joined: "انضم",
    allowFx: "السماح بالمؤثرات", allowFxD: "يرسل المشاهدون مؤثرات تظهر في البث", allowCh: "السماح بالتحديات", coStreamWho: "من يطلب البث المشترك", everyone: "الجميع", followersOnly: "المتابِعون", nobody: "لا أحد",
    slowMode: "الوضع البطيء للدردشة", off: "إيقاف", haptics: "الاهتزاز", fxSound: "أصوات المؤثرات", reduceFx: "تقليل المؤثرات", reduceFxD: "بدون اهتزاز الشاشة والوميض", showLat: "إظهار التأخير والإطارات",
    chatOnStream: "إظهار الدردشة فوق البث", autoSound: "تشغيل الصوت تلقائياً", chatOverlayDef: "الشات فوق اللعبة تلقائياً", clearCache: "مسح بيانات التطبيق المؤقتة", version: "الإصدار",
    email: "البريد الإلكتروني", handleOrEmail: "اسم المستخدم أو البريد", forgot: "نسيت كلمة المرور؟", sendCode: "إرسال الرمز", code: "الرمز من البريد",
    newPass: "كلمة مرور جديدة", resetDone: "تم تغيير كلمة المرور ✓", codeSent: "أرسلنا رمزاً إلى بريدك (تفقّد الرسائل غير المرغوبة)", notifyMail: "تنبيهات البريد", notifyMailD: "رسالة عندما يبدأ من تتابعهم البث",
    pickGame: "اختر اللعبة", onPhone: "ألعاب على هاتفك", popular: "الأكثر شعبية", searchGames: "ابحث عن أي لعبة…", noGames: "لا توجد نتائج", otherGame: "لعبة أخرى (بدون صورة)", change: "تغيير",
    nowPlaying: "ألعاب يُبث عليها الآن", speedTest: "اختبار سرعة السيرفر", sStart: "ابدأ الاختبار", sAgain: "أعد الاختبار", ping: "الاستجابة", jitter: "التذبذب", down: "التنزيل", up: "الرفع", server: "السيرفر",
    sPing: "قياس الاستجابة…", sDown: "قياس التنزيل…", sUp: "قياس الرفع…", ms: "مللي ثانية", mbps: "ميغابت/ث",
    vGreat: "ممتاز ✓ يمكنك البث بجودة {q}", vOk: "جيد — يُنصح بالبث بجودة {q}", vBad: "الرفع ضعيف — البث قد يتقطع. جرّب شبكة أخرى أو جودة 540p",
    sound: "الصوت", voiceLink: "صوت الضيوف", you: "أنت", hostTag: "البثّاث", guestTag: "ضيف", chAccepted: "قَبِل التحدي!", chDone: "نجح في التحدي!",
    chFailed: "فشل التحدي", secs: "ث", profile: "حسابي", noPast: "لا توجد بثوث سابقة", pendingLive: "البث لم يبدأ بعد…", camNA: "الكاميرا أثناء اللعب غير مدعومة في آيفون",
  },
  en: {
    tag: "Stream your games live — under a second of delay", login: "Sign in", register: "Create account", handle: "Username",
    name: "Display name", password: "Password", go: "Continue", guest: "Browse as guest", liveNow: "Live now", following: "Following",
    all: "All", action: "Action", sports: "Sports", br: "Battle Royale", racing: "Racing", strategy: "Strategy", retro: "Retro", chill: "Just chatting",
    noLive: "Nobody is live right now", beFirst: "Be the first to go live", viewers: "viewers", goLive: "Go live", title: "Stream title",
    titlePh: "e.g. No-loss challenge", game: "Game", gamePh: "Game name", cat: "Category", quality: "Quality", fps: "Frame rate",
    mic: "Microphone", micD: "Your voice is mixed with game audio", privacy: "Privacy shield", dnd: "Auto Do Not Disturb",
    dndD: "Hides notifications and calls during the stream, then restores", callG: "Call guard", callGD: "Video is blocked instantly on any call",
    bannerG: "Smart notification hiding", bannerGD: "Detects the top notification banner and covers it", appOnly: "Stream the game only",
    appOnlyD: "Pick “A single app” in Android's dialog — nothing but the game is shown",
    start: "Start live stream", needApp: "Phone streaming needs the Wahj app", browserLive: "Stream from browser",
    chatPh: "Say something…", loginToChat: "Sign in to chat", effects: "Effects", react: "React", challenge: "Challenge",
    challengePh: "Challenge the streamer… e.g. win with pistol only", send: "Send", challenges: "Challenges", noCh: "No challenges yet",
    accept: "Accept", done: "Done ✓", failed: "Failed", reject: "Reject", poll: "Poll", newPoll: "New poll", question: "Question",
    option: "Option", duration: "Duration", startPoll: "Launch poll", endPoll: "End", votes: "votes", ended: "Ended",
    costream: "Co-stream", reqJoin: "Ask to join the stream", reqSent: "Request sent to the streamer", requests: "Join requests",
    noReq: "No requests", approve: "Approve", deny: "Deny", invited: "{n} invited you to co-stream!", joinNow: "Join now",
    later: "Later", invite: "Invite to stream", kick: "Remove", pin: "Pin", unpin: "Unpin", share: "Share",
    copied: "Link copied", end: "End stream", endQ: "End the live stream?", yes: "Yes", no: "No", liveFor: "Live for",
    peak: "Peak", hypeLvl: "Hype level", overlay: "Chat over game", camBubble: "Face cam", preview: "Preview",
    chatTitle: "Chat", noChat: "Chat is quiet… say hi", starting: "Getting ready…", tapStart: "Tap “Start Broadcast” in the system sheet",
    reopen: "Open broadcast sheet", onAir: "On air", stopped: "Broadcast stopped", shieldOn: "Privacy shield active", shieldOff: "Shield is off",
    shieldPaused: "Video is hidden for privacy right now", privTitle: "Privacy moment", privSub: "The stream is back in a few seconds",
    offline: "This stream is not available", endedT: "Stream ended", back: "Back", tapSound: "Tap for sound", follow: "Follow",
    unfollow: "Following", followers: "followers", past: "Past streams", edit: "Edit profile", save: "Save", bio: "Bio", color: "Accent color",
    settings: "Settings", language: "Language", logout: "Sign out", focusGuide: "Hide notifications on iPhone",
    focusSteps: "1. Open Shortcuts → Automation → New Automation<br>2. Choose App → Wahj → Is Opened<br>3. Choose Run Immediately<br>4. Add action Set Focus → Do Not Disturb → On<br><br>Now Do Not Disturb turns on automatically every time you open Wahj ✓",
    openShortcuts: "Open Shortcuts", errs: { bad_handle: "Username: 3–20 latin letters/digits", weak_password: "Password needs 6+ characters", taken: "Username taken", bad_login: "Wrong username or password", rate: "Too many attempts, wait a bit", net: "Connection failed", auth: "Sign in first", not_invited: "You were not invited", login: "Sign in to take part", slow: "Slow down a moment", guests_full: "Guest slots are full (3)", bad_email: "Invalid email address", email_taken: "Email already registered", bad_code: "Wrong or expired code", mail_off: "Email sending isn't enabled on the server yet", bad_link: "Invalid link", no_points: "Not enough points", need_text: "Write your message first", too_many: "Max 12 rewards", no_coins: "Not enough coins", vip_only: "VIP only", owned: "Already owned", self: "You can't gift yourself", pay_off: "Payments aren't enabled yet", pay_fail: "Couldn't start the payment", forbidden: "Not allowed", not_found: "Not found", bad_old: "Current password is wrong", bad_image: "Unsupported image", fx_off: "The streamer turned effects off", ch_off: "The streamer turned challenges off", co_off: "The streamer isn't accepting co-stream requests", bad_ytkey: "Invalid YouTube stream key" },
    sentFx: "sent", hypeTrain: "HYPE TRAIN", latency: "Delay", guestsN: "guests", layoutSplit: "Split screen", layoutFocus: "Focus",
    declined: "Declined", errorT: "Error",
    modT: "Moderation", mods: "Moderators", vipsR: "Promoted (VIP)", sanctions: "Active sanctions", roleMod: "Mod", roleVip: "VIP", roleOwner: "Owner",
    mTimeout: "Timeout (mute)", mKick: "Kick 10 minutes", mBan: "Ban permanently", mUnban: "Lift all sanctions", mUntimeout: "Remove timeout", mPromote: "Promote VIP", mDemote: "Remove promotion",
    mAddMod: "Make moderator", mRemoveMod: "Remove moderator", mDel: "Delete message", mClear: "Clear the whole chat", mProfile: "Profile", mAddByHandle: "Add a moderator by username", mAdd: "Add",
    mins: "m", hrs: "h", modDone: "Done ✓", owner_only: "Channel owner only", already: "Already promoted", bad_action: "Invalid action",
    ml_timeout: "{n} was timed out {m} by {b}", ml_untimeout: "{b} removed {n}'s timeout", ml_kick: "{n} was kicked by {b}", ml_ban: "{n} was banned by {b}", ml_unban: "{b} lifted {n}'s sanctions",
    ml_promote: "{n} was promoted by {b}", ml_demote: "{b} removed {n}'s promotion", ml_addmod: "{n} is now a moderator", ml_removemod: "{b} removed {n} as moderator",
    youMod: "You're now a moderator here", youVip: "You've been promoted VIP", youRoleOff: "Your role was removed", timedOutT: "You can't chat — timed out until {t}", kickedT: "You were kicked from this stream", bannedT: "You're banned from this channel", chatCleared: "Chat was cleared", noneYet: "None",
    fxs: "Effects", fxLocked: "Get this effect in the shop", preview: "Preview", owned2: "Owned",
    ranks: "Streamer ranking", rankMonth: "This month", rankAll: "All time", rankYou: "Your rank", rankNone: "Not ranked yet — go live!", rankEnds: "Season ends in {n}", days: "days",
    sLevel: "Streamer level", sRankM: "Rank this month", sRankA: "Overall rank", sNext: "{n} XP to next level", sLevelUp: "{n} reached streamer level {l}", sLevelUpMe: "Your streamer level is now {l}!",
    topPerks: "Top 3 perks", topYou: "You're #{n} this month", sharePct: "Your share of gifts & subs: {n}%",
    perk1: "Animated medal next to their name everywhere + a matching frame", perk2: "Their stream is pinned first on the home page with a featured card", perk3: "Higher earnings: #1 85% • #2 80% • #3 75% (others 70%)", perk4: "Rank badge shown in chat and on the profile",
    xpHow: "How streamer XP works", xpHow1: "+2 XP per minute live", xpHow2: "+1 XP per signed-in viewer per minute", xpHow3: "+25 XP per new follower", xpHow4: "+250 XP per subscription • +1 XP per 2 gift coins",
    tier1: "Rookie", tier2: "Rising", tier3: "Pro", tier4: "Star", tier5: "Legend", tier6: "Icon",
    yt: "YouTube", ytAlso: "Also stream to YouTube", ytAlsoD: "The same stream goes live on your YouTube channel", ytAdd: "Link YouTube channel", ytKey: "Stream key", ytKeyPh: "xxxx-xxxx-xxxx-xxxx-xxxx",
    ytHelp: "Open YouTube Studio → Create → Go live → Stream, copy the “Stream key” and paste it here. It stays secret on the server.", ytSave: "Save", ytRemove: "Unlink", ytSaved: "YouTube linked ✓", ytRemoved: "YouTube unlinked",
    ytLinked: "Linked {k}", ytNot: "Not linked", ytOn: "YouTube: live ✓", ytWait: "YouTube: sending… (shows up in ~20s)", ytErr: "YouTube: failed ({c}) — check the key and that streaming is enabled in YouTube Studio", bad_ytkey: "Invalid YouTube key",
    subscribe: "Subscribe", subscribed: "Subscribed {n}", subTitle: "Subscribe to {n}", subD: "Grand entrance everyone sees • subscriber badge in chat • ×1.5 points • +300 points now", subBuy: "Subscribe 30 days", subOk: "You're subscribed to {n}",
    subMonths: "Subscribed {n} month(s)", enteredGrand: "joined the stream", subsN: "subscribers",
    points: "Channel points", level: "Level", xpTo: "{n} XP to next level", streakT: "{n}-day streak", watchT: "{n} min watched", rewards: "Rewards", topFans: "Top fans",
    dailyT: "Daily visit · streak {s} · +{p} points +{x} XP", chestT: "Tap to claim +50 points", claimedT: "+{n} points", levelUpT: "reached level {n}", youLevel: "You're now level {n}",
    redeemedT: "redeemed", msgPh: "Your message…", noPoints: "Not enough points", howEarn: "How to earn?", howEarnD: "Watch 5 min: +10 points +10 XP • Chest every 15 min: +50 • Daily visit: +50 (grows with streak) • Message: +2 XP • Gift: XP worth half its value",
    myRewards: "My channel rewards", addReward: "Add reward", rewardTitle: "Reward name (e.g. switch weapons)", cost: "Cost in points", redeemQ: "Reward requests", done2: "Done", refund: "Refund", noRedeems: "No requests",
    wallet: "Wallet", coins: "coins", buyCoins: "Buy coins", shop: "Shop", vip: "VIP membership", vipD: "Animated name in every style • VIP badge • exclusive effects • entrance announcement", vipBuy: "Subscribe 30 days", vipUntil: "VIP until {d}",
    names: "Name styles", badges: "Badges", frames: "Avatar frames", buy: "Buy", equip: "Use", equipped: "In use ✓", unequip: "Remove", noCoins: "Not enough coins", gifts: "Gifts", sendGift: "Send",
    giftSent: "sent", payOpen: "Finish paying in PayPal, then come back to Wahj", paid: "{n} coins added", payOff: "Payments aren't enabled on the server yet", history: "History", earned: "Gift earnings",
    entered: "joined the stream", vipOnly: "VIP only", admin: "Owner panel", grant: "Grant", handleQ: "Username", vipDays: "VIP days", sandbox: "Test mode (Sandbox)",
    soonT: "Starting in a moment", soonS: "The streamer is opening the game", openGameNow: "Open {g} now — viewers see the stream once you're in the game", soonShield: "Viewers see “starting soon” until you're in the game",
    autoLaunch: "Open the game automatically", autoLaunchD: "When the stream starts, Wahj switches straight to the game", openingGame: "Opening the game…",
    recSave: "Save streams on the server", recSaveD: "Your stream is recorded and can be replayed from your profile", recordings: "Recordings", noRecs: "No recordings", replay: "Replay", delRec: "Delete recording", delRecQ: "Delete this recording permanently?",
    delAllRecs: "Delete all recordings", delAllQ: "Delete all your recordings permanently?", storage: "Storage used", recOff: "Stream saving isn't enabled on the server", recording: "Recording", recFull: "Recording storage is full",
    settingsT: "Settings", secAccount: "Account", secStream: "Default stream settings", secRoom: "My room rules", secWatch: "Watching", secNotif: "Notifications", secApp: "App", secAbout: "About",
    editProfile: "Edit profile", changePass: "Change password", oldPass: "Current password", deleteAcc: "Delete account", deleteQ: "Your account will be permanently deleted. Enter your password to confirm", deleted: "Account deleted",
    usernameLocked: "Username can't be changed", photo: "Photo", changePhoto: "Change photo", removePhoto: "Remove photo", link: "Link (YouTube, TikTok…)", saved: "Saved ✓",
    followingN: "following", streamsN: "streams", hoursN: "hours live", bestPeak: "best peak", gamesPlayed: "Games", joined: "Joined",
    allowFx: "Allow effects", allowFxD: "Viewers can send effects onto the stream", allowCh: "Allow challenges", coStreamWho: "Who can ask to co-stream", everyone: "Everyone", followersOnly: "Followers", nobody: "Nobody",
    slowMode: "Chat slow mode", off: "Off", haptics: "Haptics", fxSound: "Effect sounds", reduceFx: "Reduce effects", reduceFxD: "No screen shake or flashes", showLat: "Show delay & FPS",
    chatOnStream: "Show chat over the stream", autoSound: "Play sound automatically", chatOverlayDef: "Chat over game by default", clearCache: "Clear cached app data", version: "Version",
    email: "Email", handleOrEmail: "Username or email", forgot: "Forgot password?", sendCode: "Send code", code: "Code from email",
    newPass: "New password", resetDone: "Password changed ✓", codeSent: "We emailed you a code (check spam too)", notifyMail: "Email alerts", notifyMailD: "Get an email when people you follow go live",
    pickGame: "Pick the game", onPhone: "Games on your phone", popular: "Popular", searchGames: "Search any game…", noGames: "No results", otherGame: "Other game (no picture)", change: "Change",
    nowPlaying: "Games live now", speedTest: "Server speed test", sStart: "Start test", sAgain: "Test again", ping: "Ping", jitter: "Jitter", down: "Download", up: "Upload", server: "Server",
    sPing: "Measuring ping…", sDown: "Measuring download…", sUp: "Measuring upload…", ms: "ms", mbps: "Mbps",
    vGreat: "Excellent ✓ you can stream at {q}", vOk: "Good — streaming at {q} is recommended", vBad: "Upload is weak — the stream may stutter. Try another network or 540p",
    sound: "Sound", voiceLink: "Guest voice", you: "You", hostTag: "HOST", guestTag: "GUEST", chAccepted: "accepted the challenge!", chDone: "completed the challenge!",
    chFailed: "failed the challenge", secs: "s", profile: "Profile", noPast: "No past streams", pendingLive: "Stream hasn't started yet…", camNA: "Face cam while gaming isn't supported on iPhone",
  },
};
const t = (k, v) => { let s = (T[S.lang] && T[S.lang][k]) ?? T.en[k] ?? k; if (v) for (const x in v) s = s.replace("{" + x + "}", v[x]); return s; };
const terr = (e) => (T[S.lang].errs[e] || T.en.errs[e] || e || T[S.lang].errs.net);
function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr";
}

/* ---------------- native bridge ---------------- */
const Native = {
  has() { return !!((window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wahj) || window.WahjAndroid); },
  post(cmd, data = {}) {
    const msg = { cmd, data };
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wahj) window.webkit.messageHandlers.wahj.postMessage(msg);
      else if (window.WahjAndroid) window.WahjAndroid.post(JSON.stringify(msg));
    } catch (e) { console.warn(e); }
  },
  subs: new Set(),
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
};
window.__native = (e) => {
  if (typeof e === "string") try { e = JSON.parse(e); } catch (x) { return; }
  if (e.type === "info") S.native = e;
  if (e.type === "broadcast") {
    S.bstate = e.state;
    if (e.state === "stopped" && S.live) { /* keep S.live so studio can show summary */ }
  }
  Native.subs.forEach((f) => { try { f(e); } catch (x) { console.warn(x); } });
};
const plat = () => (S.native && S.native.platform) || (/iphone|ipad/i.test(navigator.userAgent) ? "ios-web" : /android/i.test(navigator.userAgent) ? "android-web" : "web");
const isIOS = () => plat() === "ios";
const isAndroid = () => plat() === "android";
const haptic = (k = "light") => P.haptics && Native.has() && Native.post("haptic", { k });

/* ---------------- api ---------------- */
async function api(path, body, method) {
  try {
    const r = await fetch(path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "content-type": "application/json", ...(S.token ? { authorization: "Bearer " + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await r.json();
  } catch (e) { return { error: "net" }; }
}

/* ---------------- ui helpers ---------------- */
let toastT;
function toast(msg, ms = 2600) {
  const el = $("#toast");
  el.innerHTML = msg;
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("on"), ms);
  el.onclick = () => el.classList.remove("on");
}
const pwField = (id, ph, ac = "current-password") => `<div class="pwrap"><input class="inp pw" id="${id}" type="text" placeholder="${ph}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" data-ac="${ac}"><button class="eye" type="button" data-eye="${id}">${ic("eye")}</button></div>`;
function bindEyes(root = document) {
  $$("[data-eye]", root).forEach((b) => (b.onclick = () => { const i = $("#" + b.dataset.eye, root); const on = i.classList.toggle("show"); b.innerHTML = ic(on ? "eyeoff" : "eye"); }));
}
const gIcon = (src, cls = "gi", size = "") => src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" ${size ? `style="width:${size}px;height:${size}px"` : ""} onerror="this.style.visibility='hidden'">` : "";
let sheetClose = null;
function sheet(html, onMount) {
  const sc = $("#scrim"), sh = $("#sheet");
  sh.innerHTML = `<div class="grab"></div>` + html;
  sc.style.display = "block";
  requestAnimationFrame(() => { sc.classList.add("on"); sh.classList.add("on"); });
  const close = () => {
    sc.classList.remove("on"); sh.classList.remove("on");
    setTimeout(() => { if (!sh.classList.contains("on")) sc.style.display = "none"; }, 300);
    sheetClose = null;
  };
  sheetClose = close;
  sc.onclick = close;
  onMount && onMount(sh, close);
  return close;
}
function confirmBox(q, yes) {
  sheet(`<h3>${esc(q)}</h3><div class="row" style="margin-top:8px"><button class="btn g" data-n>${t("no")}</button><button class="btn d" data-y>${t("yes")}</button></div>`,
    (sh, close) => { $("[data-n]", sh).onclick = close; $("[data-y]", sh).onclick = () => { close(); yes(); }; });
}
/* SVG badges — [path, colorA, colorB, rarity] */
const BADGES = {
  star: ["M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z", "#ffe259", "#ffa751", "c"],
  flame: ["M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 2 1 3 2 3.5C11 9 10.5 5 12 2z", "#ff9a3d", "#ff2e63", "c"],
  diamond: ["M6 3h12l4 6-10 12L2 9zm1.2 2L5 8.5h4.2L10.6 5zm5.9 0l1.4 3.5H19L16.8 5zM5.4 10.5l5.6 6.8-2.3-6.8zm7.6 0l-1 6.8 5.6-6.8z", "#7fe7ff", "#5b6cff", "e"],
  crown: ["M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4zm0 2h18v2H3z", "#ffd700", "#ff8c00", "l"],
  gamer: ["M7 8h10a5 5 0 0 1 4.6 7l-1 2.3a2 2 0 0 1-3.4.4L15 16H9l-2.2 1.7a2 2 0 0 1-3.4-.4l-1-2.3A5 5 0 0 1 7 8zm0 3v1.2H5.8v1.6H7V15h1.6v-1.2h1.2v-1.6H8.6V11zm9.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z", "#2ee59d", "#00a3ff", "c"],
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7z", "#fff200", "#ff9f00", "c"],
  shield: ["M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5zm-1 13.5l6-6-1.4-1.4-4.6 4.6-2.1-2.1L7.5 12z", "#4facfe", "#2b5bff", "r"],
  skull: ["M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h2v-2h2v2h2v-2h2v2h2v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8zm-3 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z", "#e0e0e0", "#6a6a8a", "r"],
  sword: ["M21 2l-1 5-9.5 9.5-3-3L17 4zM6 13l5 5-1.5 1.5-1.5-1.5-3 3-2-2 3-3-1.5-1.5z", "#c9d6ff", "#6c7bff", "r"],
  heart: ["M12 21l-1.5-1.3C5 15 2 12.2 2 8.5 2 5.5 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.5 22 8.5c0 3.7-3 6.5-8.5 11.2z", "#ff6fb5", "#ff1e56", "c"],
  crosshair: ["M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z", "#ff5f6d", "#c31432", "r"],
  headset: ["M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h2a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z", "#b06ab3", "#4568dc", "c"],
  trophy: ["M7 3h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h4zm-2 4v1a3 3 0 0 0 2 2.8V7zm14 0h-2v3.8A3 3 0 0 0 19 8z", "#fceabb", "#f8b500", "e"],
  rocket: ["M12 2c4 2 6 6 6 11l2 3-3 1-1 3h-1l-1-3h-2l-1 3h-1l-1-3-3-1 2-3c0-5 2-9 6-11zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "#f953c6", "#b91d73", "e"],
  ghost: ["M12 2a8 8 0 0 0-8 8v12l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2L20 22V10a8 8 0 0 0-8-8zm-3 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z", "#e0c3fc", "#8ec5fc", "r"],
  wings: ["M12 10c-2-4-6-6-10-6 1 3 2 5 4 6-2 0-3 1-4 2 2 1 4 1 6 0-1 2-1 4 0 6 2-2 4-4 4-8zm0 0c2-4 6-6 10-6-1 3-2 5-4 6 2 0 3 1 4 2-2 1-4 1-6 0 1 2 1 4 0 6-2-2-4-4-4-8z", "#ffffff", "#a1c4fd", "l"],
  moon: ["M15 2a10 10 0 1 0 7 15A8 8 0 0 1 15 2z", "#fdfbfb", "#a18cd1", "r"],
  gem: ["M12 2l9 5v10l-9 5-9-5V7zm0 2.3L5 8.2v7.6l7 3.9 7-3.9V8.2z", "#43e97b", "#38f9d7", "e"],
  eye: ["M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z", "#00f2fe", "#4facfe", "e"],
  note: ["M9 3v11.3A3.5 3.5 0 1 0 11 17V8h6V3z", "#fa709a", "#fee140", "c"],
  leaf: ["M20 3C9 3 4 9 4 16c0 2 .5 3.5 1 5 1-5 5-9 10-11-4 3-7 6-8 11 7 0 13-5 13-18z", "#a8ff78", "#11998e", "c"],
  bomb: ["M10 7a7.5 7.5 0 1 0 4.5 1.4L16 7l-1.5-1.5L13 7a7.5 7.5 0 0 0-3 0zM18 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z", "#636fa4", "#e8cbc0", "r"],
  paw: ["M8 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4.5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm15 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 11c3 0 6 4 6 7a3 3 0 0 1-3 3c-1.2 0-2-.6-3-.6s-1.8.6-3 .6a3 3 0 0 1-3-3c0-3 3-7 6-7z", "#f6d365", "#fda085", "c"],
  verified: ["M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2zm-1.2 13.2l5.6-5.6-1.4-1.4-4.2 4.2-2-2-1.4 1.4z", "#00c6ff", "#0072ff", "l"],
  dragon: ["M21 3c-3 0-5 1-6.5 2.5L13 4l-1 3-3-1 1 3c-3 1-6 4-7 9l3-1 1 4 3-3 2 2 1-4c3 0 6-2 7-5l-3-1 2-2-2-1c2-1 3-2 4-4z", "#f00000", "#ff9a00", "l"],
  phoenix: ["M12 22c-1-3-4-4-4-8 0-2 1-3 2-4-2 0-4-1-6-3 3 0 5 0 7 1-1-2-1-4 0-6 1 2 2 3 2 5 0-2 1-3 2-5 1 2 1 4 0 6 2-1 4-1 7-1-2 2-4 3-6 3 1 1 2 2 2 4 0 4-3 5-4 8z", "#ff512f", "#f09819", "l"],
  planet: ["M12 6a6 6 0 0 1 5.7 4.1c2.9-.6 4.6-.4 4.9.5.4 1.3-3.3 3.6-8.6 5.3-5.3 1.7-9.8 2-10.2.7-.3-.9 1.2-2.2 3.8-3.5A6 6 0 0 1 12 6zm6 6.4c-1.8 1-4.1 2-6.8 2.9-1.4.4-2.6.7-3.7.9A6 6 0 0 0 18 12.4z", "#c471f5", "#fa71cd", "e"],
  controller: ["M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm2 4v1.5H4.5v1.5H6v1.5h1.5V13H9v-1.5H7.5V10zm10 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm2.5 2.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z", "#00dbde", "#fc00ff", "r"],
  sniper: ["M2 11h3l1-2h9l1 2h6v2h-6l-1 2h-2l-1 3H9l1-3H6l-1-2H2zm11-1v2h2v-2z", "#d4fc79", "#96e6a1", "e"],
  ninja: ["M12 2a9 9 0 0 1 9 9v2H3v-2a9 9 0 0 1 9-9zM3 14h18v1a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7zm5-4.5L10 11l-2 .5zm8 0l-2 1.5 2 .5z", "#434343", "#8e2de2", "e"],
};
const RARITY = { c: ["عادي", "Common"], r: ["نادر", "Rare"], e: ["ملحمي", "Epic"], l: ["أسطوري", "Legendary"] };
const badgeSvg = (id) => { const b = BADGES[id]; if (!b) return ""; return `<span class="bx r-${b[3]}" style="--a:${b[1]};--b:${b[2]}"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="${b[0]}"/></svg></span>`; };
const MEDAL = { 1: eic("medal", "gold"), 2: eic("medal", "silver"), 3: eic("medal", "bronze") };
const topHtml = (n) => (n >= 1 && n <= 3 ? `<span class="bdg top${n}">${MEDAL[n]} TOP ${n}</span>` : "");
function badgeHtml(L) {
  if (!L) return "";
  return topHtml(L.top) + badgeHtml0(L);
}
function badgeHtml0(L) {
  if (!L || !L.badge) return "";
  if (L.badge === "vip") return `<span class="bdg bdg-vip">VIP</span>`;
  if (L.badge === "founder") return `<span class="bdg bdg-founder">${S.lang === "ar" ? "المؤسس" : "FOUNDER"}</span>`;
  return badgeSvg(L.badge);
}
const uname = (u, tag = "b") => { const L = (u && u.look) || {}; return `${badgeHtml(L)}<${tag} class="un ${L.name ? "un-" + esc(L.name) : ""}" style="color:${esc((u && u.color) || "#fff")}" data-t="${esc((u && u.name) || "")}">${esc((u && u.name) || "")}</${tag}>`; };
const lvlHtml = (l) => { l = l | 0; if (!l) return ""; const tier = l >= 30 ? 5 : l >= 20 ? 4 : l >= 10 ? 3 : l >= 5 ? 2 : 1; return `<span class="lvl t${tier}">${l}</span>`; };
const sTier = (l) => (l >= 50 ? 6 : l >= 35 ? 5 : l >= 20 ? 4 : l >= 10 ? 3 : l >= 5 ? 2 : 1);
const sLvlHtml = (l) => { l = l | 0; if (!l) return ""; const k = sTier(l); return `<span class="slvl st${k}">${eic("mic")} ${l} · ${t("tier" + k)}</span>`; };
const coinHtml = (n) => `<span class="coin"><i></i>${fmtN(n | 0)}</span>`;
const avatar = (u, cls = "", style = "") => { const a = avatar0(u, cls, style); const L = (u && u.look) || {}; const f = L.top ? "top" + L.top : L.frame; return f ? `<div class="frm frm-${esc(f)}">${a}</div>` : a; };
const avatar0 = (u, cls = "", style = "") => (u && u.avatar)
  ? `<div class="av ${cls}" style="background:${esc(u.color || "#7C5CFF")};overflow:hidden;${style}"><img src="${esc(u.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`
  : `<div class="av ${cls}" style="background:${esc((u && u.color) || "#7C5CFF")};${style}">${esc(((u && (u.name || u.handle)) || "?").trim().charAt(0).toUpperCase())}</div>`;
const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : String(n | 0));
const fmtDur = (ms) => { const s = Math.max(0, ms / 1000 | 0); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, x = s % 60; return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(x).padStart(2, "0"); };
const CATS = ["all", "action", "sports", "br", "racing", "strategy", "retro", "chill"];
const CAT_EMO = { action: eic("swords", "fire"), sports: eic("ball", "green"), br: eic("chute", "cyan"), racing: eic("car", "pink"), strategy: eic("rook", "violet"), retro: eic("alien", "green"), chill: eic("chat", "cyan"), all: eic("game", "brand") };
const GAMES = ["PUBG Mobile", "Free Fire", "eFootball", "EA FC Mobile", "Call of Duty Mobile", "Minecraft", "Roblox", "Clash Royale", "Genshin Impact", "Brawl Stars", "Asphalt Legends", "Emulator"];

/* ---------------- router ---------------- */
let cleanup = null;
let current = "";
let prevView = "home", prevArg, curArg;
function go(view, arg) {
  if (sheetClose) sheetClose();
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  if (view === "ranks" && current !== "ranks") { prevView = current; prevArg = curArg; }
  current = view; curArg = arg;
  const app = $("#app");
  app.innerHTML = "";
  const navViews = ["home", "me"];
  $("#nav").classList.toggle("hide", !navViews.includes(view));
  $$("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.go === view));
  $("#aurora").style.display = view === "watch" ? "none" : "";
  const fn = VIEWS[view];
  cleanup = fn(app, arg) || null;
  if (view !== "watch") history.replaceState(null, "", "/");
}
$$("#nav button").forEach((b) => (b.onclick = () => { haptic(); go(b.dataset.go); }));

/* ================= WebRTC: Cloudflare Realtime SFU ================= */
function waitIce(pc, ms = 1800) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((res) => {
    const done = () => { pc.removeEventListener("icegatheringstatechange", chk); res(); };
    const chk = () => pc.iceGatheringState === "complete" && done();
    pc.addEventListener("icegatheringstatechange", chk);
    setTimeout(done, ms);
  });
}
class Sub {
  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle" });
    this.q = Promise.resolve();
    this.sid = null;
    this.byMid = {};
    this.have = new Set();
    this.early = {};
    this.onTrack = () => {};
    this.pc.ontrack = (e) => {
      const mid = e.transceiver && e.transceiver.mid;
      const info = this.byMid[mid];
      if (info) this.onTrack(info, e.track);
      else this.early[mid] = e.track;
    };
  }
  pull(list) {
    this.q = this.q.then(() => this._pull(list)).catch((e) => console.warn("pull", e));
    return this.q;
  }
  async _pull(list) {
    list = list.filter((x) => !this.have.has(x.sessionId + "/" + x.trackName));
    if (!list.length) return;
    if (!this.sid) {
      const r = await api("/api/sfu/new", {});
      if (!r.sessionId) throw r;
      this.sid = r.sessionId;
    }
    const r = await api(`/api/sfu/${this.sid}/tracks`, { tracks: list.map((x) => ({ location: "remote", sessionId: x.sessionId, trackName: x.trackName })) });
    if (!r.tracks) throw r;
    r.tracks.forEach((tr) => {
      if (tr.error || !tr.mid) return;
      const info = list.find((x) => x.trackName === tr.trackName && (!tr.sessionId || x.sessionId === tr.sessionId));
      if (!info) return;
      this.byMid[tr.mid] = info;
      this.have.add(info.sessionId + "/" + info.trackName);
      if (this.early[tr.mid]) { this.onTrack(info, this.early[tr.mid]); delete this.early[tr.mid]; }
    });
    if (r.requiresImmediateRenegotiation && r.sessionDescription) {
      await this.pc.setRemoteDescription(r.sessionDescription);
      const ans = await this.pc.createAnswer();
      await this.pc.setLocalDescription(ans);
      await waitIce(this.pc, 1200);
      const rr = await api(`/api/sfu/${this.sid}/renegotiate`, { sessionDescription: { type: "answer", sdp: this.pc.localDescription.sdp } }, "PUT");
      if (rr && rr.errorCode) throw rr;
    }
    // tracks that arrived during setRemoteDescription
    for (const mid in this.early) if (this.byMid[mid]) { this.onTrack(this.byMid[mid], this.early[mid]); delete this.early[mid]; }
  }
  async stats() {
    try {
      const st = await this.pc.getStats();
      let rtt = 0, jb = 0, jbn = 0, fps = 0, kbps = 0;
      st.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && r.currentRoundTripTime) rtt = r.currentRoundTripTime;
        if (r.type === "inbound-rtp" && r.kind === "video") {
          jb += r.jitterBufferDelay || 0; jbn += r.jitterBufferEmittedCount || 0; fps = Math.max(fps, r.framesPerSecond || 0);
          if (this._lb && r.id in this._lb) kbps += ((r.bytesReceived - this._lb[r.id].b) * 8) / (r.timestamp - this._lb[r.id].t);
          (this._lb = this._lb || {})[r.id] = { b: r.bytesReceived, t: r.timestamp };
        }
      });
      const buf = jbn ? jb / jbn : 0;
      return { delay: rtt / 2 + buf + 0.05, fps, kbps };
    } catch (e) { return null; }
  }
  close() { try { this.pc.close(); } catch (e) {} if (this.sid) api(`/api/sfu/${this.sid}/close`, { tracks: [], force: true }, "PUT"); }
}

// Browser publisher (desktop streaming + automated tests)
class Pub {
  async start(tracks, job) {
    this.job = job;
    this.pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle" });
    const r0 = await api("/api/sfu/new", {});
    if (!r0.sessionId) throw r0;
    this.sid = r0.sessionId;
    const tx = tracks.map((x) => ({ ...x, tr: this.pc.addTransceiver(x.track, { direction: "sendonly" }) }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await waitIce(this.pc);
    const names = tx.map((x) => x.role + "-" + Math.random().toString(36).slice(2, 8));
    const r = await api(`/api/sfu/${this.sid}/tracks`, {
      sessionDescription: { type: "offer", sdp: this.pc.localDescription.sdp },
      tracks: tx.map((x, i) => ({ location: "local", mid: x.tr.mid, trackName: names[i] })),
    });
    if (!r.sessionDescription) throw r;
    await this.pc.setRemoteDescription(r.sessionDescription);
    await fetch(`/api/room/${job.room}/publish`, {
      method: "POST", headers: { "content-type": "application/json", "x-pub": job.pub },
      body: JSON.stringify({ sessionId: this.sid, tracks: tx.map((x, i) => ({ trackName: names[i], kind: x.track.kind, role: x.role })) }),
    });
    this.beat = setInterval(() => this.thumb(), 20000);
    setTimeout(() => this.thumb(), 2500);
    this.tracks = tracks;
  }
  async thumb() {
    const v = this.tracks.find((x) => x.role === "screen");
    if (!v) return;
    try {
      const vid = document.createElement("video");
      vid.muted = true; vid.srcObject = new MediaStream([v.track]); await vid.play();
      const c = document.createElement("canvas"); const w = 360; c.width = w; c.height = Math.round(w * (vid.videoHeight || 9) / (vid.videoWidth || 16));
      c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.7));
      const res = await fetch(`/api/thumb/${this.job.room}`, { method: "POST", headers: { "x-pub": this.job.pub }, body: blob });
      if (res.status === 401) this.onEnded && this.onEnded();
    } catch (e) {}
  }
  stop() { clearInterval(this.beat); try { this.tracks.forEach((x) => x.track.stop()); this.pc.close(); } catch (e) {} }
}

/* ================= Room websocket ================= */
class RoomWS {
  constructor(room, opts = {}) {
    this.room = room; this.opts = opts; this.handlers = new Set(); this.closed = false; this.tries = 0;
    this.open();
  }
  open() {
    const u = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + `/api/room/${this.room}/ws?token=${encodeURIComponent(S.token || "")}` + (this.opts.pub ? "&pub=1" : "");
    const ws = (this.ws = new WebSocket(u));
    ws.onopen = () => { this.tries = 0; this.ping = setInterval(() => this.send({ t: "ping", at: Date.now() }), 20000); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.handlers.forEach((f) => f(m)); };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.closed) return;
      setTimeout(() => !this.closed && this.open(), Math.min(8000, 600 * 2 ** this.tries++));
    };
  }
  on(f) { this.handlers.add(f); }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.closed = true; clearInterval(this.ping); try { this.ws.close(); } catch (e) {} }
}


/* ================= Effects engine ================= */
const FX = window.FX = {
  list: [
    { id: "fire", e: "fire", ar: "نار", en: "Fire" },
    { id: "hearts", e: "heart", ar: "قلب", en: "Heart" },
    { id: "wave", e: "wave", ar: "موجة", en: "Wave" },
    { id: "confetti", e: "party", ar: "احتفال", en: "Confetti" },
    { id: "lightning", e: "zap", ar: "صاعقة", en: "Lightning" },
    { id: "shake", e: "boom", ar: "انفجار", en: "Boom" },
    { id: "airhorn", e: "vol", ar: "بوق", en: "Airhorn" },
    { id: "boo", e: "ghost", ar: "أشباح", en: "Ghosts" },
    { id: "fireworks", e: "burst", ar: "ألعاب نارية", en: "Fireworks", vip: true },
    { id: "meteor", e: "comet", ar: "نيازك", en: "Meteors", vip: true },
    { id: "rain", e: "drop", ar: "مطر وموج ماء", en: "Rain & ripples", shop: true },
    { id: "snow", e: "snow", ar: "عاصفة ثلج", en: "Blizzard", shop: true },
    { id: "aurora", e: "aurora", ar: "شفق قطبي", en: "Aurora", shop: true },
    { id: "warp", e: "rocket", ar: "قفزة فضائية", en: "Hyperspace", shop: true },
    { id: "matrix", e: "code", ar: "ماتريكس", en: "Matrix", shop: true },
    { id: "bubbles", e: "bubbles", ar: "فقاعات", en: "Bubbles", shop: true },
    { id: "petals", e: "flower", ar: "بتلات ساكورا", en: "Sakura", shop: true },
    { id: "lasers", e: "laser", ar: "ليزر حفلة", en: "Laser show", shop: true },
    { id: "rings", e: "rings", ar: "حلقات نيون", en: "Neon rings", shop: true },
    { id: "blackhole", e: "hole", ar: "ثقب أسود", en: "Black hole", shop: true },
    { id: "tornado", e: "tornado", ar: "إعصار", en: "Tornado", shop: true },
    { id: "stars", e: "star", ar: "شهب ونجوم", en: "Starfall", shop: true },
  ],
  ac: null,
  audio() { try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); if (this.ac.state === "suspended") this.ac.resume(); return this.ac; } catch (e) { return null; } },
  tone(freqs, dur, type = "sawtooth", vol = 0.12, delay = 0) {
    if (!P.fxSound) return;
    const ac = this.audio(); if (!ac) return;
    const t0 = ac.currentTime + delay;
    const g = ac.createGain(); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    freqs.forEach((f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur); });
  },
  noise(dur, vol = 0.15, lp = 800) {
    if (!P.fxSound) return;
    const ac = this.audio(); if (!ac) return;
    const n = ac.sampleRate * dur, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = b;
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp;
    const g = ac.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
  },
  floaty(root, e, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) setTimeout(() => {
      const d = document.createElement("div");
      d.className = "floaty"; if (REACT[e]) d.innerHTML = eic(REACT[e][0], REACT[e][1]); else d.textContent = e;
      d.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
      if (opts.spread) { d.style.insetInlineEnd = (Math.random() * 80 + 5) + "%"; d.style.bottom = (Math.random() * 20 + 5) + "%"; }
      if (opts.size) d.style.fontSize = opts.size + "px";
      root.appendChild(d); setTimeout(() => d.remove(), 2500);
    }, i * (opts.gap || 70));
  },

  /* -------- full-screen canvas engine -------- */
  runs: [],
  canvas: null,
  start(canvas, dur, draw) {
    this.canvas = canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    this.runs.push({ t0: performance.now(), dur, draw, W, H, st: {} });
    if (!this.looping) { this.looping = true; requestAnimationFrame((t) => this.loop(t)); }
  },
  loop(now) {
    const c = this.canvas; if (!c || !c.isConnected) { this.runs = []; this.looping = false; return; }
    const ctx = c.getContext("2d"); const dpr = c.width / Math.max(1, c.clientWidth);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.runs = this.runs.filter((r) => {
      const p = (now - r.t0) / r.dur; if (p >= 1) return false;
      ctx.save(); try { r.draw(ctx, p, r.W, r.H, r.st, now - r.t0); } catch (e) {} ctx.restore();
      return true;
    });
    if (this.runs.length) requestAnimationFrame((t) => this.loop(t)); else { this.looping = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
  },
  ease: (x) => 1 - Math.pow(1 - x, 3),
  env: (p, a = 0.12, b = 0.75) => (p < a ? p / a : p > b ? Math.max(0, 1 - (p - b) / (1 - b)) : 1),

  /* fire: a wall of flames rises and covers the screen */
  fire(canvas) {
    this.start(canvas, 3600, (ctx, p, W, H, s) => {
      if (!s.ps) s.ps = [];
      const e = this.env(p, 0.15, 0.7);
      const spawn = p < 0.72 ? Math.round(34 * (W / 390)) : 0;
      for (let i = 0; i < spawn; i++) s.ps.push({ x: Math.random() * W, y: H + 20, vx: (Math.random() - 0.5) * 1.2, vy: -(8 + Math.random() * 10) * (H / 844), r: 34 + Math.random() * 80, life: 0, max: 70 + Math.random() * 50, seed: Math.random() * 6 });
      // heat glow
      const g = ctx.createLinearGradient(0, H, 0, H * 0.15);
      g.addColorStop(0, `rgba(255,90,0,${0.55 * e})`); g.addColorStop(0.5, `rgba(255,40,0,${0.25 * e})`); g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      s.ps = s.ps.filter((q) => {
        q.life++; const k = q.life / q.max; if (k >= 1) return false;
        q.x += q.vx + Math.sin(q.life * 0.15 + q.seed) * 1.4; q.y += q.vy; q.vy *= 0.998;
        const r = q.r * (1 - k * 0.65);
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        const a = (1 - k) * 0.55 * e;
        gr.addColorStop(0, `rgba(255,${230 - k * 120},${120 - k * 120},${a})`);
        gr.addColorStop(0.4, `rgba(255,${120 - k * 80},0,${a * 0.7})`);
        gr.addColorStop(1, "rgba(200,20,0,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fill();
        return true;
      });
      // embers
      ctx.globalCompositeOperation = "source-over";
      if (!s.emb) s.emb = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: H + Math.random() * H * 0.4, v: 2 + Math.random() * 4, s: 1 + Math.random() * 2.5 }));
      ctx.fillStyle = `rgba(255,220,120,${e})`;
      s.emb.forEach((m) => { m.y -= m.v; m.x += Math.sin(m.y * 0.03) * 0.8; ctx.fillRect(m.x, m.y, m.s, m.s); });
    });
    this.noise(2.6, 0.22, 600); this.tone([70, 90], 1.4, "sawtooth", 0.05);
  },

  /* hearts: one giant beating heart + a swarm */
  hearts(canvas) {
    const heart = (ctx, x, y, sz) => {
      ctx.beginPath(); ctx.moveTo(x, y + sz * 0.3);
      ctx.bezierCurveTo(x, y, x - sz * 0.5, y - sz * 0.05, x - sz * 0.5, y + sz * 0.3);
      ctx.bezierCurveTo(x - sz * 0.5, y + sz * 0.6, x, y + sz * 0.8, x, y + sz);
      ctx.bezierCurveTo(x, y + sz * 0.8, x + sz * 0.5, y + sz * 0.6, x + sz * 0.5, y + sz * 0.3);
      ctx.bezierCurveTo(x + sz * 0.5, y - sz * 0.05, x, y, x, y + sz * 0.3); ctx.closePath();
    };
    this.start(canvas, 3400, (ctx, p, W, H, s) => {
      const e = this.env(p, 0.08, 0.72);
      ctx.fillStyle = `rgba(255,40,120,${0.18 * e})`; ctx.fillRect(0, 0, W, H);
      const beat = 1 + 0.12 * Math.max(0, Math.sin(p * Math.PI * 7)) ;
      const base = Math.min(W, H) * 0.75 * this.ease(Math.min(1, p / 0.2)) * beat;
      const cx = W / 2, cy = H * 0.42 - base / 2;
      ctx.save(); ctx.shadowColor = "rgba(255,60,140,.9)"; ctx.shadowBlur = 60 * e;
      const g = ctx.createLinearGradient(cx - base / 2, cy, cx + base / 2, cy + base);
      g.addColorStop(0, `rgba(255,120,190,${e})`); g.addColorStop(1, `rgba(255,30,90,${e})`);
      ctx.fillStyle = g; heart(ctx, cx, cy, base); ctx.fill();
      ctx.globalAlpha = 0.35 * e; ctx.fillStyle = "#fff"; heart(ctx, cx - base * 0.18, cy + base * 0.12, base * 0.22); ctx.fill();
      ctx.restore();
      // rings
      for (let i = 0; i < 3; i++) { const q = (p * 3 - i * 0.35) % 1; if (q < 0) continue; ctx.strokeStyle = `rgba(255,120,180,${(1 - q) * 0.6 * e})`; ctx.lineWidth = 6 * (1 - q); ctx.beginPath(); ctx.arc(W / 2, H * 0.42, q * Math.max(W, H) * 0.6, 0, 7); ctx.stroke(); }
      if (!s.hs) s.hs = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: H + Math.random() * H, v: 2 + Math.random() * 5, sz: 14 + Math.random() * 34, w: Math.random() * 6 }));
      s.hs.forEach((h) => { h.y -= h.v; ctx.fillStyle = `rgba(255,${60 + h.sz * 3},${140 + h.sz},${0.85 * e})`; heart(ctx, h.x + Math.sin(h.y * 0.02 + h.w) * 14, h.y, h.sz); ctx.fill(); });
    });
    [0, 0.42, 0.84, 1.26].forEach((d) => this.tone([523, 659], 0.35, "sine", 0.07, d));
  },

  /* wave: layered ocean waves sweep across the screen */
  wave(canvas) {
    this.start(canvas, 4200, (ctx, p, W, H, s, ms) => {
      const rise = p < 0.35 ? this.ease(p / 0.35) : p > 0.7 ? 1 - this.ease((p - 0.7) / 0.3) : 1;
      const layers = [["rgba(0,120,255,.55)", 0.62, 1.0, 26], ["rgba(0,190,255,.55)", 0.55, 1.4, 34], ["rgba(120,230,255,.6)", 0.48, 1.9, 22]];
      layers.forEach(([col, lvl, sp, amp], i) => {
        const top = H - (H * (1 - lvl) + H * 0.25) * rise;
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 10; x += 8) ctx.lineTo(x, top + Math.sin(x * 0.012 + ms * 0.004 * sp + i) * amp + Math.sin(x * 0.03 - ms * 0.006 * sp) * amp * 0.35);
        ctx.lineTo(W, H); ctx.closePath();
        const g = ctx.createLinearGradient(0, top - amp, 0, H); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,40,120,.85)");
        ctx.fillStyle = g; ctx.fill();
        // foam crest
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * rise})`; ctx.lineWidth = 3; ctx.beginPath();
        for (let x = 0; x <= W + 10; x += 8) { const y = top + Math.sin(x * 0.012 + ms * 0.004 * sp + i) * amp + Math.sin(x * 0.03 - ms * 0.006 * sp) * amp * 0.35; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      });
      if (!s.b) s.b = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: H * (0.6 + Math.random() * 0.5), r: 2 + Math.random() * 6, v: 0.6 + Math.random() * 1.8 }));
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * rise})`; ctx.lineWidth = 1.5;
      s.b.forEach((b) => { b.y -= b.v; if (b.y < H * 0.35) b.y = H; ctx.beginPath(); ctx.arc(b.x + Math.sin(b.y * 0.05) * 6, b.y, b.r, 0, 7); ctx.stroke(); });
    });
    this.noise(3.5, 0.18, 400);
  },

  /* confetti: two cannons */
  confetti(canvas) {
    const cols = ["#7C5CFF", "#FF4D8D", "#00D1FF", "#FFB800", "#2EE59D", "#ffffff"];
    this.start(canvas, 3800, (ctx, p, W, H, s) => {
      if (!s.ps) {
        s.ps = [];
        for (const side of [0, 1]) for (let i = 0; i < 160; i++) {
          const a = (side ? -Math.PI * 0.62 : -Math.PI * 0.38) + (Math.random() - 0.5) * 0.5, sp = 14 + Math.random() * 16;
          s.ps.push({ x: side ? W : 0, y: H * 0.9, vx: Math.cos(a) * sp * (W / 390), vy: Math.sin(a) * sp * (H / 844) * 1.25, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 8, c: cols[i % cols.length], f: Math.random() * 6 });
        }
      }
      s.ps.forEach((q) => {
        q.vy += 0.45; q.vx *= 0.985; q.vy *= 0.985; q.x += q.vx; q.y += q.vy; q.r += q.vr; q.f += 0.2;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(1, Math.abs(Math.cos(q.f)));
        ctx.globalAlpha = 1 - Math.max(0, (p - 0.8) / 0.2); ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.w / 4, q.w, q.w / 2); ctx.restore();
      });
    });
    this.noise(0.25, 0.3, 2000); this.tone([523, 659, 784, 1046], 0.6, "triangle", 0.07, 0.1);
  },

  /* lightning: forked bolts + flashes */
  lightning(canvas, stage) {
    const bolt = (x1, y1, x2, y2, d) => {
      if (d === 0) return [[x1, y1], [x2, y2]];
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * Math.abs(y2 - y1) * 0.35, my = (y1 + y2) / 2;
      return [...bolt(x1, y1, mx, my, d - 1).slice(0, -1), ...bolt(mx, my, x2, y2, d - 1)];
    };
    this.start(canvas, 2600, (ctx, p, W, H, s, ms) => {
      const k = Math.floor(ms / 280);
      if (s.k !== k && k < 7) { s.k = k; s.bs = Array.from({ length: 1 + (k % 2) }, () => bolt(W * (0.15 + Math.random() * 0.7), -10, W * Math.random(), H * (0.55 + Math.random() * 0.45), 7)); s.flash = 1; if (!P.reduceFx && stage) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); } }
      s.flash = (s.flash || 0) * 0.82;
      ctx.fillStyle = `rgba(20,10,60,${0.45 * this.env(p)})`; ctx.fillRect(0, 0, W, H);
      if (!P.reduceFx) { ctx.fillStyle = `rgba(220,230,255,${s.flash * 0.55})`; ctx.fillRect(0, 0, W, H); }
      (s.bs || []).forEach((b) => {
        for (const [w, c] of [[14, "rgba(120,140,255,.25)"], [6, "rgba(170,190,255,.7)"], [2.2, "#fff"]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w * (0.4 + s.flash); ctx.lineJoin = "round"; ctx.beginPath(); b.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        }
      });
    });
    [0, 0.28, 0.84, 1.4].forEach((d) => setTimeout(() => this.noise(0.5, 0.35, 1200), d * 1000));
  },

  /* boom: shockwave rings + debris + screen shake */
  shake(canvas, stage) {
    if (!P.reduceFx && stage) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }
    this.start(canvas, 2400, (ctx, p, W, H, s) => {
      const cx = W / 2, cy = H * 0.45, R = Math.hypot(W, H);
      const e = this.env(p, 0.02, 0.6);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6 * this.ease(Math.min(1, p * 3)));
      g.addColorStop(0, `rgba(255,255,220,${0.95 * e})`); g.addColorStop(0.2, `rgba(255,170,40,${0.75 * e})`); g.addColorStop(0.5, `rgba(255,60,20,${0.35 * e})`); g.addColorStop(1, "rgba(80,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) { const q = Math.min(1, p * 1.6 - i * 0.15); if (q <= 0) continue; ctx.strokeStyle = `rgba(255,230,180,${(1 - q) * 0.9})`; ctx.lineWidth = 18 * (1 - q); ctx.beginPath(); ctx.arc(cx, cy, q * R * 0.7, 0, 7); ctx.stroke(); }
      if (!s.d) s.d = Array.from({ length: 70 }, () => { const a = Math.random() * 7, v = 6 + Math.random() * 16; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 3 + Math.random() * 7 }; });
      s.d.forEach((q) => { q.vy += 0.35; q.x += q.vx; q.y += q.vy; ctx.fillStyle = `rgba(${200 + Math.random() * 55},${90 + Math.random() * 80},20,${1 - p})`; ctx.fillRect(q.x, q.y, q.s, q.s); });
      ctx.globalAlpha = e; this.art(ctx, "boom", cx, cy, Math.min(W, H) * 0.5 * this.ease(Math.min(1, p * 4)));
    });
    this.noise(1.6, 0.5, 300); this.tone([45, 60], 0.9, "square", 0.12);
  },

  /* airhorn: giant horn + sound rings */
  airhorn(canvas) {
    this.start(canvas, 2600, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.06, 0.75);
      const pulse = 1 + 0.08 * Math.sin(ms * 0.045);
      const cx = W / 2, cy = H * 0.45;
      for (let i = 0; i < 6; i++) { const q = ((ms / 600) + i / 6) % 1; ctx.strokeStyle = `rgba(255,${180 + i * 10},60,${(1 - q) * 0.7 * e})`; ctx.lineWidth = 10 * (1 - q); ctx.beginPath(); ctx.arc(cx, cy, 60 + q * Math.max(W, H) * 0.7, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 60 + q * Math.max(W, H) * 0.7, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); }
      ctx.font = `${Math.min(W, H) * 0.5 * pulse * this.ease(Math.min(1, p * 5))}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = e;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(ms * 0.03) * 0.12); this.art(ctx, "horn", 0, 0, Math.min(W, H) * 0.5 * pulse * this.ease(Math.min(1, p * 5))); ctx.restore();
    });
    [0, 0.3, 0.6, 1.2].forEach((d) => this.tone([466, 470, 932], 0.26, "sawtooth", 0.1, d));
  },

  /* ghosts: big ghosts fly across a darkened screen */
  boo(canvas) {
    this.start(canvas, 3800, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.75);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, `rgba(10,0,30,${0.25 * e})`); v.addColorStop(1, `rgba(0,0,0,${0.85 * e})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      if (!s.g) s.g = Array.from({ length: 7 }, (_, i) => ({ y: H * (0.12 + i * 0.12), dir: i % 2 ? -1 : 1, sp: 0.18 + Math.random() * 0.2, sz: 60 + Math.random() * 90, ph: Math.random() * 6, d: Math.random() * 0.3 }));
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      s.g.forEach((g) => {
        const q = (p - g.d) / (1 - g.d); if (q < 0) return;
        const x = g.dir > 0 ? -100 + q * (W + 200) : W + 100 - q * (W + 200);
        ctx.globalAlpha = Math.min(1, q * 4) * e * 0.9; ctx.font = `${g.sz}px system-ui`;
        ctx.save(); ctx.translate(x, g.y + Math.sin(ms * 0.004 + g.ph) * 30); ctx.scale(g.dir, 1); this.art(ctx, "ghost", 0, 0, g.sz); ctx.restore();
      });
    });
    this.tone([220, 165], 1.6, "triangle", 0.1); this.tone([330, 247], 1.4, "sine", 0.06, 0.3);
  },

  /* VIP: fireworks over the whole screen */
  fireworks(canvas) {
    const cols = ["#ff4d8d", "#ffd700", "#00d1ff", "#2ee59d", "#b26bff", "#ffffff", "#ff6b3d"];
    this.start(canvas, 4600, (ctx, p, W, H, s, ms) => {
      if (!s.r) s.r = []; if (!s.sp) s.sp = [];
      if (p < 0.8 && (!s.next || ms > s.next)) { s.next = ms + 260 + Math.random() * 260; s.r.push({ x: W * (0.15 + Math.random() * 0.7), y: H, ty: H * (0.15 + Math.random() * 0.35), c: cols[Math.random() * cols.length | 0] }); }
      ctx.fillStyle = `rgba(5,3,20,${0.35 * this.env(p)})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      s.r = s.r.filter((r) => {
        r.y -= (r.y - r.ty) * 0.08 + 4; ctx.fillStyle = r.c; ctx.fillRect(r.x - 2, r.y, 4, 12);
        if (r.y - r.ty < 6) { for (let i = 0; i < 70; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 6; s.sp.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: r.c, l: 1 }); } this.noise(0.4, 0.25, 900); return false; }
        return true;
      });
      s.sp = s.sp.filter((q) => { q.vy += 0.08; q.vx *= 0.985; q.vy *= 0.985; q.x += q.vx; q.y += q.vy; q.l -= 0.012; ctx.globalAlpha = Math.max(0, q.l); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, 7); ctx.fill(); return q.l > 0; });
    });
  },
  /* VIP: meteor shower */
  meteor(canvas, stage) {
    this.start(canvas, 3600, (ctx, p, W, H, s, ms) => {
      ctx.fillStyle = `rgba(10,4,30,${0.5 * this.env(p)})`; ctx.fillRect(0, 0, W, H);
      if (!s.m) s.m = Array.from({ length: 16 }, (_, i) => ({ x: W * (0.3 + Math.random() * 1.0), y: -Math.random() * H * 0.8 - 40, v: 8 + Math.random() * 9, r: 4 + Math.random() * 8, d: i * 120 }));
      s.m.forEach((m) => {
        if (ms < m.d) return;
        m.x -= m.v * 0.75; m.y += m.v;
        const g = ctx.createLinearGradient(m.x, m.y, m.x + m.v * 9, m.y - m.v * 12);
        g.addColorStop(0, "rgba(255,240,200,1)"); g.addColorStop(0.3, "rgba(255,140,40,.8)"); g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.strokeStyle = g; ctx.lineWidth = m.r; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.v * 9, m.y - m.v * 12); ctx.stroke();
        if (m.y > H * 0.85 && !m.hit) { m.hit = 1; if (!P.reduceFx && stage) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); } }
      });
    });
    this.noise(3, 0.3, 500);
  },
  /* gifts: a big animated scene per gift */
  gift(canvas, stage, id, n = 1) {
    const E = "g_" + (ART["g_" + id] ? id : "heart");
    const big = { rose: 0.35, heart: 0.4, controller: 0.45, car: 0.4, lion: 0.6, crown: 0.55, rocket: 0.5 }[id] || 0.4;
    const dur = { rose: 2600, heart: 2800, controller: 2800, car: 3000, lion: 3600, crown: 3800, rocket: 4200 }[id] || 3000;
    if (id === "heart") this.hearts(canvas);
    if (id === "crown") setTimeout(() => this.confetti(canvas), 900);
    if (id === "rocket") setTimeout(() => this.fireworks(canvas), 1800);
    if (id === "lion" && !P.reduceFx && stage) setTimeout(() => { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }, 700);
    this.start(canvas, dur, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.08, 0.8), sz = Math.min(W, H) * big; const art = (x, y) => this.art(ctx, E, x, y, sz);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // golden rays behind premium gifts
      if (["lion", "crown", "rocket", "car"].includes(id)) {
        ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(ms * 0.0006);
        for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = `rgba(255,215,0,${0.12 * e})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(W, H), -40); ctx.lineTo(Math.max(W, H), 40); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = e; ctx.font = `${sz}px system-ui`;
      if (id === "car") {
        const x = W + sz - p * (W + sz * 2) * 1.05;
        for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,255,255,${0.25 * e})`; ctx.fillRect(x + sz * 0.4 + Math.random() * 120, H * 0.45 - sz * 0.3 + Math.random() * sz * 0.6, 40 + Math.random() * 80, 3); }
        ctx.save(); ctx.translate(x, H * 0.45 + Math.sin(ms * 0.05) * 3); ctx.scale(-1, 1); art(0, 0); ctx.restore();
      } else if (id === "rocket") {
        const y = H + sz - this.ease(Math.min(1, p * 1.3)) * (H + sz * 2);
        for (let i = 0; i < 20; i++) { const r = 8 + Math.random() * 26; const gy = y + sz * 0.45 + Math.random() * 120; const g = ctx.createRadialGradient(W / 2, gy, 0, W / 2, gy, r); g.addColorStop(0, "rgba(255,230,120,.9)"); g.addColorStop(1, "rgba(255,80,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2 + (Math.random() - 0.5) * 30, gy, r, 0, 7); ctx.fill(); }
        ctx.save(); ctx.translate(W / 2, y); art(0, 0); ctx.restore();
      } else if (id === "crown") {
        const y = p < 0.3 ? -sz + this.ease(p / 0.3) * (H * 0.42 + sz) : H * 0.42 + Math.sin(ms * 0.006) * 6;
        ctx.save(); ctx.shadowColor = "rgba(255,215,0,.9)"; ctx.shadowBlur = 40; art(W / 2, y); ctx.restore();
      } else {
        const k = this.ease(Math.min(1, p * 4)), pulse = 1 + 0.08 * Math.sin(ms * 0.012);
        ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.scale(k * pulse, k * pulse); if (id === "controller") ctx.rotate(Math.sin(ms * 0.01) * 0.25);
        ctx.shadowColor = "rgba(255,255,255,.6)"; ctx.shadowBlur = 30; art(0, 0); ctx.restore();
        if (id === "rose") { if (!s.pt) s.pt = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: 1.5 + Math.random() * 3, r: Math.random() * 6 })); s.pt.forEach((q) => { q.y += q.v; q.r += 0.05; ctx.save(); ctx.translate(q.x + Math.sin(q.y * 0.02) * 20, q.y); ctx.rotate(q.r); this.art(ctx, "petal", 0, 0, 20); ctx.restore(); }); }
      }
      if (n > 1) { ctx.globalAlpha = e; ctx.font = `900 ${Math.min(W, H) * 0.14}px system-ui`; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 6; ctx.strokeText("×" + n, W / 2, H * 0.45 + sz * 0.7); ctx.fillText("×" + n, W / 2, H * 0.45 + sz * 0.7); }
    });
    const tones = { rose: [[659, 784], 0.4], heart: [[523, 659], 0.4], controller: [[440, 660, 880], 0.5], car: [[110, 160], 1.2], lion: [[80, 110], 1.4], crown: [[523, 659, 784, 1046], 0.9], rocket: [[200, 400], 1.6] }[id];
    if (tones) this.tone(tones[0], tones[1], id === "lion" || id === "car" ? "sawtooth" : "triangle", 0.09);
  },

  goldrain(canvas) {
    this.start(canvas, 3600, (ctx, p, W, H, s) => {
      if (!s.c) s.c = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: 3 + Math.random() * 6, r: Math.random() * 6, s: 10 + Math.random() * 14 }));
      ctx.fillStyle = `rgba(255,200,0,${0.12 * this.env(p)})`; ctx.fillRect(0, 0, W, H);
      s.c.forEach((q) => { q.y += q.v; q.r += 0.15; const w = Math.abs(Math.cos(q.r)) * q.s;
        const g = ctx.createLinearGradient(q.x - w, q.y, q.x + w, q.y); g.addColorStop(0, "#b8860b"); g.addColorStop(0.5, "#fff3a0"); g.addColorStop(1, "#ffd700");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1, w), q.s, 0, 0, 7); ctx.fill(); });
    });
    [0, 0.15, 0.3, 0.45].forEach((d) => this.tone([1318, 1567], 0.25, "triangle", 0.05, d));
  },
  /* ===== premium effects (shop) ===== */
  rain(canvas) {
    this.start(canvas, 5200, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.78);
      ctx.fillStyle = `rgba(8,24,60,${0.45 * e})`; ctx.fillRect(0, 0, W, H);
      const lvl = H - H * 0.22 * this.ease(Math.min(1, p / 0.5)) * e;
      if (!s.d) { s.d = []; s.sp = []; s.rp = []; }
      if (p < 0.8) for (let i = 0; i < 9; i++) s.d.push({ x: Math.random() * W * 1.2 - W * 0.1, y: -20, v: 14 + Math.random() * 8, l: 14 + Math.random() * 18 });
      ctx.strokeStyle = `rgba(170,215,255,${0.75 * e})`; ctx.lineWidth = 1.4; ctx.beginPath();
      s.d = s.d.filter((d) => { d.y += d.v; d.x -= d.v * 0.18; if (d.y > lvl) { if (Math.random() < 0.5) s.rp.push({ x: d.x, y: lvl + Math.random() * (H - lvl), r: 0 }); for (let k = 0; k < 2; k++) s.sp.push({ x: d.x, y: lvl, vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3 }); return false; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l); return true; });
      ctx.stroke();
      // water body
      const g = ctx.createLinearGradient(0, lvl, 0, H); g.addColorStop(0, `rgba(60,170,255,${0.55 * e})`); g.addColorStop(1, `rgba(0,40,120,${0.85 * e})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, lvl + Math.sin(x * 0.03 + ms * 0.004) * 5 + Math.sin(x * 0.011 - ms * 0.002) * 7);
      ctx.lineTo(W, H); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * e})`; ctx.lineWidth = 1.2;
      s.rp = s.rp.filter((r) => { r.r += 1.4; if (r.r > 46) return false; ctx.globalAlpha = (1 - r.r / 46) * e; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, 7); ctx.stroke(); return true; });
      ctx.globalAlpha = e; ctx.fillStyle = "rgba(200,235,255,.9)";
      s.sp = s.sp.filter((q) => { q.vy += 0.35; q.x += q.vx; q.y += q.vy; if (q.y > lvl + 4) return false; ctx.fillRect(q.x, q.y, 2, 2); return true; });
    });
    this.noise(4.6, 0.16, 2500);
  },
  snow(canvas) {
    this.start(canvas, 5000, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.75);
      ctx.fillStyle = `rgba(200,225,255,${0.18 * e})`; ctx.fillRect(0, 0, W, H);
      if (!s.f) s.f = Array.from({ length: 260 }, () => ({ x: Math.random() * W, y: -Math.random() * H, r: 1 + Math.random() * 4, v: 1.5 + Math.random() * 3.5, w: Math.random() * 6 }));
      ctx.fillStyle = `rgba(255,255,255,${0.95 * e})`;
      s.f.forEach((f) => { f.y += f.v; f.x += Math.sin(ms * 0.002 + f.w) * 1.2 + 2.2; if (f.y > H) { f.y = -10; f.x = Math.random() * W; } if (f.x > W) f.x = 0; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); });
      const g = ctx.createLinearGradient(0, H * 0.9, 0, H); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(255,255,255,${0.75 * e * Math.min(1, p * 2)})`);
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.9, W, H * 0.1);
    });
    this.noise(4, 0.08, 900);
  },
  aurora(canvas) {
    this.start(canvas, 5600, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.15, 0.75);
      ctx.fillStyle = `rgba(4,8,30,${0.55 * e})`; ctx.fillRect(0, 0, W, H);
      if (!s.st) s.st = Array.from({ length: 90 }, () => [Math.random() * W, Math.random() * H * 0.7, Math.random() * 1.6]);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * e})`; s.st.forEach(([x, y, r]) => { ctx.globalAlpha = e * (0.4 + 0.6 * Math.abs(Math.sin(ms * 0.003 + x))); ctx.fillRect(x, y, r, r); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter";
      [["0,255,170", 0.28, 1], ["120,90,255", 0.36, 1.4], ["0,200,255", 0.22, 0.8], ["255,80,200", 0.42, 1.7]].forEach(([c, yb, sp], i) => {
        for (let x = 0; x < W; x += 6) {
          const y = H * yb + Math.sin(x * 0.008 + ms * 0.0012 * sp + i) * 40 + Math.sin(x * 0.02 - ms * 0.002) * 14;
          const h = 120 + Math.sin(x * 0.01 + ms * 0.002 + i) * 60;
          const g = ctx.createLinearGradient(0, y - h, 0, y + 20); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.8, `rgba(${c},${0.22 * e})`); g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g; ctx.fillRect(x, y - h, 7, h + 20);
        }
      });
    });
    this.tone([220, 277, 330], 2.5, "sine", 0.05); this.tone([330, 415, 494], 2.5, "sine", 0.04, 1.4);
  },
  warp(canvas) {
    this.start(canvas, 4200, (ctx, p, W, H, s) => {
      const e = this.env(p, 0.1, 0.8), sp = 1 + this.ease(Math.min(1, p / 0.6)) * 18;
      ctx.fillStyle = `rgba(0,0,12,${0.75 * e})`; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      if (!s.s) s.s = Array.from({ length: 320 }, () => ({ a: Math.random() * 7, d: Math.random() * 40, c: Math.random() < 0.3 ? "150,200,255" : Math.random() < 0.5 ? "255,255,255" : "200,140,255" }));
      ctx.lineCap = "round";
      s.s.forEach((q) => {
        const d0 = q.d; q.d += sp * (0.4 + q.d / 120); if (q.d > Math.max(W, H)) q.d = Math.random() * 20;
        ctx.strokeStyle = `rgba(${q.c},${Math.min(1, q.d / 120) * e})`; ctx.lineWidth = Math.min(3, 0.5 + q.d / 160);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(q.a) * d0, cy + Math.sin(q.a) * d0); ctx.lineTo(cx + Math.cos(q.a) * q.d, cy + Math.sin(q.a) * q.d); ctx.stroke();
      });
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120); g.addColorStop(0, `rgba(180,200,255,${0.6 * e})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    this.tone([110, 220], 3, "sawtooth", 0.04); this.noise(3, 0.12, 300);
  },
  matrix(canvas) {
    const ch = "アカサタナハマヤラワ0123456789ABCDEFｦｧｨｩｪｫｬｭｮｯ";
    this.start(canvas, 5000, (ctx, p, W, H, s) => {
      const e = this.env(p, 0.08, 0.8), fs = 16, cols = Math.ceil(W / fs);
      if (!s.y) s.y = Array.from({ length: cols }, () => -Math.random() * H);
      ctx.fillStyle = `rgba(0,10,0,${0.6 * e})`; ctx.fillRect(0, 0, W, H);
      ctx.font = `bold ${fs}px monospace`;
      s.y.forEach((y, i) => {
        for (let k = 0; k < 14; k++) { const yy = y - k * fs; if (yy < 0 || yy > H) continue; ctx.fillStyle = k === 0 ? `rgba(220,255,220,${e})` : `rgba(0,255,90,${(1 - k / 14) * e})`; ctx.fillText(ch[(Math.random() * ch.length) | 0], i * fs, yy); }
        s.y[i] = y + 6 + (i % 3) * 2; if (s.y[i] - 14 * fs > H) s.y[i] = -Math.random() * 200;
      });
    });
    this.tone([880, 660, 990], 0.25, "square", 0.03);
  },
  bubbles(canvas) {
    this.start(canvas, 4800, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.78);
      if (!s.b) s.b = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: H + Math.random() * H, r: 8 + Math.random() * 34, v: 1 + Math.random() * 3, w: Math.random() * 6, hue: Math.random() * 360 }));
      s.b.forEach((b) => {
        b.y -= b.v; const x = b.x + Math.sin(ms * 0.002 + b.w) * 12;
        if (b.y < -b.r) { b.y = H + b.r; }
        const g = ctx.createRadialGradient(x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, x, b.y, b.r);
        g.addColorStop(0, `rgba(255,255,255,${0.5 * e})`); g.addColorStop(0.7, `hsla(${b.hue + ms * 0.05},90%,70%,${0.12 * e})`); g.addColorStop(1, `hsla(${b.hue + 60},90%,75%,${0.55 * e})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * e})`; ctx.lineWidth = 1; ctx.stroke();
      });
    });
    [0, 0.3, 0.7, 1.1, 1.6].forEach((d) => this.tone([600 + Math.random() * 500], 0.12, "sine", 0.05, d));
  },
  petals(canvas) {
    this.start(canvas, 5200, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.78);
      ctx.fillStyle = `rgba(255,150,200,${0.1 * e})`; ctx.fillRect(0, 0, W, H);
      if (!s.q) s.q = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: -Math.random() * H, r: Math.random() * 7, vr: (Math.random() - 0.5) * 0.08, v: 1 + Math.random() * 2.2, sz: 6 + Math.random() * 9, f: Math.random() * 6 }));
      s.q.forEach((q) => {
        q.y += q.v; q.x += Math.sin(ms * 0.0015 + q.f) * 1.5 + 0.8; q.r += q.vr; q.f += 0.05; if (q.y > H + 20) { q.y = -20; q.x = Math.random() * W; }
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(1, Math.abs(Math.cos(q.f)) * 0.7 + 0.3);
        const g = ctx.createLinearGradient(-q.sz, 0, q.sz, 0); g.addColorStop(0, `rgba(255,200,225,${e})`); g.addColorStop(1, `rgba(255,110,170,${e})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -q.sz); ctx.quadraticCurveTo(q.sz, -q.sz * 0.2, 0, q.sz); ctx.quadraticCurveTo(-q.sz, -q.sz * 0.2, 0, -q.sz); ctx.fill(); ctx.restore();
      });
    });
    this.tone([659, 784, 988], 1.2, "sine", 0.04); this.tone([523, 659, 784], 1.2, "sine", 0.035, 1.2);
  },
  lasers(canvas) {
    const cols = ["255,0,90", "0,255,200", "120,80,255", "255,220,0", "0,160,255"];
    this.start(canvas, 4800, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.08, 0.82);
      ctx.fillStyle = `rgba(5,0,20,${0.55 * e})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      const src = [[0, H], [W, H], [W / 2, H * 1.05], [0, H * 0.55], [W, H * 0.55]];
      src.forEach(([x, y], i) => {
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + Math.sin(ms * 0.0016 * (1 + i * 0.2) + k * 1.3 + i) * 0.9 + (x === 0 ? 0.5 : x === W ? -0.5 : 0);
          const L = Math.max(W, H) * 1.4, c = cols[(i + k) % cols.length];
          for (const [w, al] of [[10, 0.12], [4, 0.35], [1.5, 0.95]]) { ctx.strokeStyle = `rgba(${c},${al * e})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke(); }
        }
      });
      if (!s.hz) s.hz = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * H, 20 + Math.random() * 60]);
      s.hz.forEach(([x, y, r]) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(160,120,255,${0.05 * e})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); });
    });
    [0, 0.5, 1, 1.5, 2, 2.5, 3].forEach((d) => this.tone([d % 1 ? 110 : 82], 0.18, "square", 0.06, d));
  },
  rings(canvas) {
    const cols = ["#ff2e9a", "#00e5ff", "#7c5cff", "#2ee59d", "#ffd700"];
    this.start(canvas, 4200, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.06, 0.8), cx = W / 2, cy = H * 0.45, M = Math.hypot(W, H) * 0.6;
      ctx.fillStyle = `rgba(0,0,0,${0.35 * e})`; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        const q = (ms / 1600 - i * 0.16); if (q < 0) continue; const k = q % 1;
        ctx.save(); ctx.strokeStyle = cols[i % cols.length]; ctx.shadowColor = cols[i % cols.length]; ctx.shadowBlur = 24; ctx.globalAlpha = (1 - k) * e; ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(cx, cy, k * M, 0, 7); ctx.stroke(); ctx.restore();
      }
    });
    [0, 0.32, 0.64, 0.96].forEach((d, i) => this.tone([330 * (1 + i * 0.25)], 0.3, "sine", 0.06, d));
  },
  blackhole(canvas) {
    this.start(canvas, 5000, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.12, 0.8), cx = W / 2, cy = H * 0.45, R = Math.min(W, H) * 0.12 * this.ease(Math.min(1, p / 0.3));
      ctx.fillStyle = `rgba(0,0,0,${0.6 * e})`; ctx.fillRect(0, 0, W, H);
      if (!s.ps) s.ps = Array.from({ length: 500 }, () => ({ a: Math.random() * 7, d: Math.max(W, H) * (0.2 + Math.random() * 0.6), c: Math.random() }));
      ctx.globalCompositeOperation = "lighter";
      s.ps.forEach((q) => {
        q.a += 2.4 / Math.max(30, q.d) * 6; q.d *= 0.992; if (q.d < R * 1.05) { q.d = Math.max(W, H) * (0.5 + Math.random() * 0.3); }
        const x = cx + Math.cos(q.a) * q.d, y = cy + Math.sin(q.a) * q.d * 0.45;
        ctx.fillStyle = q.c < 0.5 ? `rgba(255,${150 + q.c * 200},60,${0.8 * e})` : `rgba(160,120,255,${0.8 * e})`; ctx.fillRect(x, y, 2, 2);
      });
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.2); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.45, `rgba(255,150,40,${0.6 * e})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    });
    this.tone([55, 58], 4, "sawtooth", 0.06); this.noise(4, 0.1, 200);
  },
  tornado(canvas, stage) {
    this.start(canvas, 4600, (ctx, p, W, H, s, ms) => {
      const e = this.env(p, 0.1, 0.8);
      ctx.fillStyle = `rgba(30,35,50,${0.45 * e})`; ctx.fillRect(0, 0, W, H);
      const cx = W / 2 + Math.sin(ms * 0.0012) * W * 0.18;
      if (!s.ps) s.ps = Array.from({ length: 700 }, () => ({ h: Math.random(), a: Math.random() * 7, s: 0.6 + Math.random() * 0.8 }));
      s.ps.forEach((q) => {
        q.a += 0.12 * q.s; q.h -= 0.003 * q.s; if (q.h < 0) q.h = 1;
        const y = H * (0.05 + q.h * 0.95), r = 14 + (1 - q.h) * W * 0.32;
        const x = cx + Math.cos(q.a) * r + Math.sin(q.h * 8 + ms * 0.002) * 20;
        const z = Math.sin(q.a);
        ctx.fillStyle = `rgba(${200 + z * 40},${205 + z * 40},${220 + z * 30},${(0.35 + z * 0.3) * e})`; ctx.fillRect(x, y, 3, 3);
      });
    });
    if (!P.reduceFx && stage) { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }
    this.noise(4.2, 0.25, 500);
  },
  stars(canvas) {
    this.start(canvas, 4600, (ctx, p, W, H, s) => {
      const e = this.env(p, 0.08, 0.8);
      ctx.fillStyle = `rgba(10,5,40,${0.4 * e})`; ctx.fillRect(0, 0, W, H);
      if (!s.m) s.m = [];
      if (p < 0.8) for (let i = 0; i < 2; i++) s.m.push({ x: Math.random() * W * 1.4, y: -20, v: 7 + Math.random() * 7, l: 60 + Math.random() * 90, hue: 180 + Math.random() * 120 });
      ctx.globalCompositeOperation = "lighter";
      s.m = s.m.filter((m) => {
        m.x -= m.v * 0.6; m.y += m.v; if (m.y > H + 100) return false;
        const g = ctx.createLinearGradient(m.x, m.y, m.x + m.l * 0.6, m.y - m.l); g.addColorStop(0, `hsla(${m.hue},100%,85%,${e})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.l * 0.6, m.y - m.l); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${e})`; ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, 7); ctx.fill();
        return true;
      });
      if (!s.tw) s.tw = Array.from({ length: 60 }, () => [Math.random() * W, Math.random() * H, Math.random() * 6]);
      s.tw.forEach(([x, y, k]) => { const a = Math.max(0, Math.sin(p * 20 + k)) * e; ctx.fillStyle = `rgba(255,255,220,${a})`; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); });
    });
    [0, 0.4, 0.8, 1.2, 1.6].forEach((d, i) => this.tone([1046 + i * 120], 0.25, "triangle", 0.04, d));
  },

  art(ctx, k, x, y, sz) { const im = ARTIMG[k]; if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x - sz / 2, y - sz / 2, sz, sz); },
  play(id, root, stage, canvas) {
    if (!canvas || !this[id] || typeof this[id] !== "function") return;
    this[id](canvas, stage);
  },
};

/* ================= Stage (renders publishers' tracks) ================= */
class Stage {
  constructor(el, { muted = false } = {}) {
    this.el = el; this.sub = new Sub(); this.pubs = []; this.tiles = new Map(); this.cams = new Map(); this.audios = new Map();
    this.mode = "focus"; this.focus = null; this.muted = muted; this.tracks = new Map();
    this.sub.onTrack = (info, track) => { this.tracks.set(info.uid + ":" + info.role, track); this.attach(info, track); };
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(el);
  }
  setPubs(list) {
    this.pubs = list || [];
    const want = [];
    for (const p of this.pubs) for (const tr of p.tracks || []) want.push({ uid: p.uid, role: tr.role, kind: tr.kind, sessionId: tr.sessionId, trackName: tr.trackName });
    const live = new Set(this.pubs.map((p) => p.uid));
    // remove gone publishers
    for (const [k, el] of this.tiles) if (!live.has(k)) { el.remove(); this.tiles.delete(k); }
    for (const [k, el] of this.cams) if (!live.has(k) || !want.find((w) => w.uid === k && w.role === "cam")) { el.remove(); this.cams.delete(k); }
    for (const [k, a] of this.audios) { const [uid, role] = k.split(":"); if (!want.find((w) => w.uid === uid && w.role === role)) { a.remove(); this.audios.delete(k); } }
    for (const p of this.pubs) this.ensureTile(p);
    this.sub.pull(want);
    this.layout();
  }
  ensureTile(p) {
    let el = this.tiles.get(p.uid);
    if (!el) {
      el = document.createElement("div");
      el.className = "vt";
      el.innerHTML = `<video playsinline autoplay muted></video><div class="spin"></div><div class="nm badge"></div>`;
      el.onclick = () => { if (this.pubs.length > 1) { this.focus = p.uid; this.layout(); } };
      this.el.appendChild(el);
      this.tiles.set(p.uid, el);
      const t = this.tracks.get(p.uid + ":screen"); if (t) this.attach({ uid: p.uid, role: "screen" }, t);
    }
    $(".nm", el).innerHTML = `${esc(p.name)}${p.role === "guest" ? " · " + t("guestTag") : ""}`;
    this.setPrivacy(p.uid, !!p.privacy, p.privacy && p.privacy.reason);
  }
  attach(info, track) {
    if (info.role === "screen") {
      const el = this.tiles.get(info.uid); if (!el) return;
      const v = $("video", el); v.srcObject = new MediaStream([track]); v.play().catch(() => {});
      v.onloadeddata = () => { const s = $(".spin", el); s && s.remove(); };
    } else if (info.role === "cam") {
      let c = this.cams.get(info.uid);
      if (!c) {
        c = document.createElement("div"); c.className = "cam"; c.innerHTML = `<video playsinline autoplay muted></video>`;
        this.el.appendChild(c); this.cams.set(info.uid, c); this.drag(c);
      }
      const v = $("video", c); v.srcObject = new MediaStream([track]); v.play().catch(() => {});
      this.layout();
    } else if (track.kind === "audio") {
      const k = info.uid + ":" + info.role;
      let a = this.audios.get(k);
      if (!a) { a = document.createElement("audio"); a.autoplay = true; a.setAttribute("playsinline", ""); this.el.appendChild(a); this.audios.set(k, a); }
      a.srcObject = new MediaStream([track]); a.muted = this.muted;
      a.play().catch(() => this.onBlocked && this.onBlocked());
    }
  }
  unmute() { this.muted = false; for (const a of this.audios.values()) { a.muted = false; a.play().catch(() => {}); } }
  setPrivacy(uid, on, reason) {
    const el = this.tiles.get(uid); if (!el) return;
    let o = $(".priv", el);
    if (!on) { o && o.remove(); return; }
    if (!o) { o = document.createElement("div"); o.className = "priv"; el.appendChild(o); }
    o.innerHTML = reason === "app"
      ? `<div class="lk" style="background:var(--grad)">${ic("game")}</div><b>${t("soonT")}</b><span>${t("soonS")}</span>`
      : `<div class="lk">${ic("lock")}</div><b>${t("privTitle")}</b><span>${t("privSub")}</span>`;
  }
  drag(el) {
    let sx, sy, ox, oy;
    el.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop; el.setPointerCapture(e.pointerId); el.dataset.moved = "1"; });
    el.addEventListener("pointermove", (e) => { if (sx == null) return; el.style.left = ox + e.clientX - sx + "px"; el.style.top = oy + e.clientY - sy + "px"; });
    el.addEventListener("pointerup", () => (sx = null));
  }
  layout() {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const order = this.pubs.map((p) => p.uid);
    const n = order.length;
    if (!n) return;
    const host = (this.pubs.find((p) => p.role === "host") || this.pubs[0]).uid;
    const main = this.focus && order.includes(this.focus) ? this.focus : host;
    const set = (el, x, y, w, h, mini) => { Object.assign(el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" }); el.classList.toggle("mini", !!mini); };
    if (this.mode === "split" && n > 1) {
      const land = W > H;
      const cols = land ? Math.min(n, n > 2 ? 2 : 2) : n > 2 ? 2 : 1;
      const rows = Math.ceil(n / cols);
      const w = W / cols, h = H / rows;
      order.forEach((uid, i) => { const el = this.tiles.get(uid); el && set(el, (i % cols) * w, Math.floor(i / cols) * h, w, h, false); });
    } else {
      const others = order.filter((u) => u !== main);
      const mel = this.tiles.get(main); mel && set(mel, 0, 0, W, H, false);
      const mw = Math.min(150, W * 0.3), mh = mw * 1.4;
      others.forEach((uid, i) => { const el = this.tiles.get(uid); el && set(el, W - mw - 12, (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--st")) || 0) + 70 + i * (mh + 10), mw, mh, true); });
    }
    // camera bubbles: default bottom corner unless dragged
    let i = 0;
    for (const [, c] of this.cams) { if (!c.dataset.moved) { c.style.left = (document.dir === "rtl" ? W - 124 - i * 120 : 12 + i * 120) + "px"; c.style.top = H * 0.52 + "px"; } i++; }
  }
  destroy() { this.ro.disconnect(); this.sub.close(); this.el.innerHTML = ""; }
}

/* ================= Views ================= */
const VIEWS = {};
document.addEventListener("click", (e) => { const el = e.target.closest && e.target.closest("[data-go-ranks]"); if (el) go("ranks"); });

/* ---------- auth ---------- */
VIEWS.auth = (root) => {
  let mode = "login";
  root.innerHTML = `<div class="view auth">
    <div class="hero"><div class="logo">${ic("live")}</div><h1>${S.lang === "ar" ? "وهج" : "Wahj"}<span style="opacity:.5;font-weight:500"> Live</span></h1><p>${t("tag")}</p></div>
    <div class="seg" id="am"><button class="on" data-m="login">${t("login")}</button><button data-m="register">${t("register")}</button></div>
    <div class="field" style="margin-top:16px"><input class="inp" id="ah" placeholder="${t("handleOrEmail")}" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" dir="ltr"></div>
    <div class="field hide" id="aew"><input class="inp" id="ae" type="email" inputmode="email" placeholder="${t("email")}" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr"></div>
    <div class="field hide" id="anw"><input class="inp" id="an" placeholder="${t("name")}"></div>
    <div class="field">${pwField("ap", t("password"))}</div>
    <button class="btn p" id="ago" style="margin-top:10px">${t("go")}</button>
    <button class="link" id="afg">${t("forgot")}</button>
    <button class="btn" id="aguest" style="margin-top:6px;color:var(--mut)">${t("guest")}</button>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="chip" id="alang">${ic("globe")} ${S.lang === "ar" ? "English" : "العربية"}</button></div>
  </div>`;
  $$("#am button").forEach((b) => (b.onclick = () => { mode = b.dataset.m; $$("#am button").forEach((x) => x.classList.toggle("on", x === b)); $("#anw").classList.toggle("hide", mode !== "register"); $("#aew").classList.toggle("hide", mode !== "register"); $("#afg").classList.toggle("hide", mode === "register"); $("#ah").placeholder = mode === "register" ? t("handle") : t("handleOrEmail"); }));
  bindEyes(root);
  $("#afg").onclick = forgotSheet;
  $("#alang").onclick = () => { S.lang = S.lang === "ar" ? "en" : "ar"; store.set("lang", S.lang); applyLang(); go("auth"); };
  $("#aguest").onclick = () => { store.set("guest", true); go("home"); };
  const submit = async () => {
    const b = $("#ago"); b.disabled = true;
    const r = await api("/api/" + mode, { handle: $("#ah").value.trim(), email: $("#ae").value.trim(), name: $("#an").value, password: $("#ap").value });
    b.disabled = false;
    if (r.error) return toast(terr(r.error));
    S.token = r.token; S.user = r.user; store.set("token", r.token); store.set("user", r.user);
    Native.post("auth", { token: r.token, user: r.user });
    haptic("success");
    afterLogin();
  };
  $("#ago").onclick = submit;
  $("#ae").onkeydown = (e) => { if (e.key === "Enter") $("#ap").focus(); };
  $("#ap").onkeydown = (e) => { if (e.key === "Enter") submit(); };
};

function forgotSheet() {
  sheet(`<h3>${ic("mail")} ${t("forgot")}</h3>
    <div class="field"><input class="inp" id="fe" type="email" inputmode="email" placeholder="${t("email")}" autocapitalize="none" autocorrect="off" dir="ltr"></div>
    <button class="btn p" id="fs">${t("sendCode")}</button>
    <div id="fstep2" class="hide"><p class="mut small" style="margin:14px 4px 4px">${t("codeSent")}</p>
      <div class="field"><input class="inp" id="fc" inputmode="numeric" maxlength="6" placeholder="${t("code")}" dir="ltr" style="letter-spacing:6px;font-weight:700"></div>
      <div class="field">${pwField("fp", t("newPass"))}</div>
      <button class="btn p" id="fr">${t("save")}</button></div>`, (sh, close) => {
    bindEyes(sh);
    $("#fs", sh).onclick = async () => {
      const b = $("#fs", sh); b.disabled = true;
      const r = await api("/api/forgot", { email: $("#fe", sh).value.trim() });
      b.disabled = false;
      if (r.error) return toast(terr(r.error));
      $("#fstep2", sh).classList.remove("hide"); b.classList.add("hide"); $("#fc", sh).focus();
    };
    $("#fr", sh).onclick = async () => {
      const r = await api("/api/reset", { email: $("#fe", sh).value.trim(), code: $("#fc", sh).value.trim(), password: $("#fp", sh).value });
      if (r.error) return toast(terr(r.error));
      S.token = r.token; S.user = r.user; store.set("token", r.token); store.set("user", r.user);
      Native.post("auth", { token: r.token, user: r.user });
      close(); toast(t("resetDone")); afterLogin();
    };
  });
}

/* ---------- game catalog ---------- */
const Games = {
  top: null, phone: null,
  async loadTop() { if (this.top) return this.top; const r = await api("/api/games/top"); this.top = (r.items || []).slice(0, 40); return this.top; },
  async search(q) {
    const [loc, store] = await Promise.all([api("/api/games/search?q=" + encodeURIComponent(q)).then((r) => r.items || []), this.appStore(q)]);
    const seen = new Set(); return [...loc, ...store].filter((g) => !seen.has(g.id) && seen.add(g.id));
  },
  // App Store search straight from the phone (JSONP — avoids the shared-IP rate limit on the server)
  appStore(q) {
    return new Promise((res) => {
      const cb = "__it" + Math.random().toString(36).slice(2);
      const sc = document.createElement("script");
      const done = (list) => { delete window[cb]; sc.remove(); clearTimeout(to); res(list); };
      const to = setTimeout(() => done([]), 6000);
      window[cb] = (j) => done((j.results || []).filter((a) => (a.genreIds || []).includes("6014")).map((a) => ({ id: String(a.trackId), name: a.trackName, icon: a.artworkUrl512 || a.artworkUrl100 })));
      sc.onerror = () => done([]);
      sc.src = `https://itunes.apple.com/search?entity=software&limit=25&country=${S.lang === "ar" ? "sa" : "us"}&term=${encodeURIComponent(q)}&callback=${cb}`;
      document.head.appendChild(sc);
    });
  },
  phoneList() {
    if (!isAndroid()) return Promise.resolve([]);
    if (this.phone) return Promise.resolve(this.phone);
    return new Promise((res) => {
      const off = Native.on((e) => { if (e.type === "games") { off(); this.phone = e.list || []; res(this.phone); } });
      Native.post("games", {});
      setTimeout(() => { off(); res(this.phone || []); }, 4000);
    });
  },
};
function gamePicker(onPick) {
  sheet(`<h3>${ic("game")} ${t("pickGame")}</h3>
    <div class="cin" style="background:var(--card);border-color:var(--line)">${ic("search")}<input id="gq" placeholder="${t("searchGames")}" style="padding-inline:10px" autocorrect="off"></div>
    <div id="gres"></div>
    <div id="gphone"></div>
    <div class="h2" style="margin-top:18px">${ic("zap")} ${t("popular")}</div><div id="gtop"><div style="height:120px;position:relative"><div class="spin"></div></div></div>
    <button class="btn g" style="margin-top:16px" id="gother">${t("otherGame")}</button>`, (sh, close) => {
    const grid = (list) => list.length ? `<div class="ggrid">${list.map((g, i) => `<button class="gg" data-i="${i}">${gIcon(g.icon || g.iconData)}<span>${esc(g.name)}</span></button>`).join("")}</div>` : `<p class="mut small" style="padding:14px;text-align:center">${t("noGames")}</p>`;
    const bind = (el, list) => $$("[data-i]", el).forEach((b) => (b.onclick = () => { haptic(); close(); onPick(list[+b.dataset.i]); }));
    Games.phoneList().then((l) => { if (!l.length) return; const el = $("#gphone", sh); el.innerHTML = `<div class="h2" style="margin-top:18px">${ic("phone")} ${t("onPhone")}</div>` + grid(l); bind(el, l); });
    Games.loadTop().then((l) => { const el = $("#gtop", sh); el.innerHTML = grid(l); bind(el, l); });
    let qt;
    $("#gq", sh).oninput = (e) => {
      clearTimeout(qt);
      const q = e.target.value.trim();
      if (!q) return ($("#gres", sh).innerHTML = "");
      qt = setTimeout(async () => {
        const local = (Games.phone || []).filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
        const list = [...local, ...(await Games.search(q))];
        const el = $("#gres", sh); el.innerHTML = grid(list); bind(el, list);
      }, 350);
    };
    $("#gother", sh).onclick = () => { close(); onPick({ name: $("#gq", sh).value.trim(), icon: "" }); };
  });
}

const fmtBytes = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + " MB");
async function deleteRec(id, after) {
  confirmBox(id === "all" ? t("delAllQ") : t("delRecQ"), async () => {
    const r = await api(`/api/rec/${id}/delete`, {});
    if (r.error) return toast(terr(r.error));
    toast(t("saved")); after && after();
  });
}
let hlsLoading;
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return (hlsLoading = hlsLoading || new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "/hls.js"; sc.onload = () => res(window.Hls); sc.onerror = rej; document.head.appendChild(sc); }));
}

/* ---------- moderation ---------- */
const MOD_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5zm-3.5 9.5l1.5-1.5 1.5 1.5 3.5-3.5 1.5 1.5-5 5z"/></svg>';
const VIPR_SVG = '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>';
const roleTag = (r) => r === "mod" ? `<span class="rtag rmod">${MOD_SVG}${t("roleMod")}</span>` : r === "vip" ? `<span class="rtag rvip">${VIPR_SVG}${t("roleVip")}</span>` : "";
const fmtMins = (m) => (m >= 60 ? Math.round(m / 60) + t("hrs") : m + t("mins"));
const modLine = (m) => esc(t("ml_" + m.key, { n: m.name, b: m.by, m: fmtMins(m.mins || 0) }));
async function modAct(host, action, extra = {}) {
  const r = await api("/api/mod", { host, action, ...extra });
  if (r.error) { toast(terr(r.error) === r.error ? t(r.error) : terr(r.error)); return false; }
  haptic("success"); toast(t("modDone")); return true;
}
/* tap a name in chat → profile + actions allowed for my role */
function userSheet(m, ctx) {
  const my = ctx.myRole || "", isOwner = my === "owner", isMod = my === "mod" || isOwner;
  const self = S.user && m.uid === S.user.id, tgtOwner = m.uid === ctx.hostId, tgtMod = m.role === "mod";
  const canAct = isMod && !self && !tgtOwner && (isOwner || !tgtMod);
  const b = (act, label, cls = "g", extra = "") => `<button class="btn ${cls}" data-ma="${act}" ${extra} style="margin-top:8px">${label}</button>`;
  sheet(`<div style="text-align:center">${avatar(m, "lg", "margin:0 auto")}<div style="font-size:20px;font-weight:800;margin-top:10px">${uname(m, "span")}</div>
      <div style="margin-top:6px">${m.uid === ctx.hostId ? `<span class="rtag rowner">${t("roleOwner")}</span>` : roleTag(m.role)}</div></div>
    ${m.handle ? `<button class="btn g" id="usp" style="margin-top:14px">${ic("user")} ${t("mProfile")}</button>` : ""}
    ${canAct ? `<div class="h2" style="margin-top:14px">${eic("shield", "green")} ${t("modT")}</div>
      ${m.id ? b("del", ic("x") + " " + t("mDel")) : ""}
      <label class="small mut" style="display:block;margin:12px 4px 6px">${t("mTimeout")}</label>
      <div class="seg" id="mto">${[1, 5, 10, 60, 1440].map((n) => `<button data-mins="${n}">${fmtMins(n)}</button>`).join("")}</div>
      ${b("untimeout", t("mUntimeout"))}${b("kick", t("mKick"), "g", 'style="color:#ffb86b"')}
      ${m.role === "vip" ? (isOwner ? b("demote", t("mDemote")) : "") : m.role !== "mod" ? b("promote", t("mPromote"), "p") : ""}
      ${isOwner ? (m.role === "mod" ? b("removemod", t("mRemoveMod")) : b("addmod", eic("shield") + " " + t("mAddMod"), "p")) + b("ban", t("mBan"), "g", 'style="color:#ff7b88"') + b("unban", t("mUnban")) : ""}` : ""}`,
    (sh, close) => {
      const p = $("#usp", sh); if (p) p.onclick = () => { close(); go("user", m.handle); };
      $$("#mto [data-mins]", sh).forEach((x) => (x.onclick = async () => { if (await modAct(ctx.hostId, "timeout", { target: m.uid, mins: +x.dataset.mins })) close(); }));
      $$("[data-ma]", sh).forEach((x) => (x.onclick = () => {
        const act = x.dataset.ma;
        const run = async () => { if (await modAct(ctx.hostId, act, act === "del" ? { msgId: m.id } : { target: m.uid })) close(); };
        act === "ban" ? confirmBox(t("mBan") + ": " + m.name + "؟", run) : run();
      }));
    });
}
/* owner/mod manager: mods, promoted, sanctions */
function modsManager(hostId) {
  api("/api/mods", { host: hostId }).then((r) => {
    if (r.error) return toast(terr(r.error));
    const own = r.myRole === "owner";
    const row = (u, btns) => `<div class="sm" style="align-items:center">${avatar(u, "md")}<div class="tx"><b>${uname(u, "span")}</b><br><span class="small mut" dir="ltr">@${esc(u.handle)}</span>${u.kind ? `<br><span class="small" style="color:#ff9b9b">${u.kind === "ban" ? t("mBan") : u.kind === "kick" ? t("mKick") : t("mTimeout")} · ${u.kind === "ban" ? "∞" : new Date(u.until).toLocaleString(S.lang)}</span>` : ""}</div>${btns}</div>`;
    const x = (act, uid) => `<button class="mini" data-ma="${act}" data-u="${uid}" style="color:#ff7b88">${ic("x")}</button>`;
    sheet(`<h3>${eic("shield", "green")} ${t("modT")}</h3>
      ${own ? `<div class="row" style="margin:6px 0 4px"><input class="inp" id="mah" placeholder="${t("mAddByHandle")}" dir="ltr" autocapitalize="none"><button class="btn p" id="maa" style="width:auto;padding:14px 16px">${t("mAdd")}</button></div>` : ""}
      <div class="h2">${t("mods")} · ${r.mods.length}</div><div class="sl">${r.mods.map((u) => row(u, own ? x("removemod", u.id) : "")).join("") || `<p class="mut small">${t("noneYet")}</p>`}</div>
      <div class="h2">${t("vipsR")} · ${r.vips.length}</div><div class="sl">${r.vips.map((u) => row(u, own ? x("demote", u.id) : "")).join("") || `<p class="mut small">${t("noneYet")}</p>`}</div>
      <div class="h2">${t("sanctions")} · ${r.sanctions.length}</div><div class="sl">${r.sanctions.map((u) => row(u, own ? x("unban", u.id) : u.kind === "timeout" ? x("untimeout", u.id) : "")).join("") || `<p class="mut small">${t("noneYet")}</p>`}</div>
      ${own ? `<button class="btn g" id="mclr" style="margin-top:14px;color:#ff7b88">${t("mClear")}</button>` : ""}`, (sh, close) => {
      $$("[data-ma]", sh).forEach((b) => (b.onclick = async () => { if (await modAct(hostId, b.dataset.ma, { target: b.dataset.u })) { close(); modsManager(hostId); } }));
      const a = $("#maa", sh); if (a) a.onclick = async () => { const h = $("#mah", sh).value.trim().replace(/^@/, ""); if (!h) return; if (await modAct(hostId, "addmod", { target: h })) { close(); modsManager(hostId); } };
      const c = $("#mclr", sh); if (c) c.onclick = () => confirmBox(t("mClear") + "؟", async () => { if (await modAct(hostId, "clear")) close(); });
    });
  });
}

/* ---------- YouTube link ---------- */
function ytSheet(done) {
  const u = S.user || {};
  sheet(`<div style="text-align:center"><div class="ytlogo">▶</div><h3 style="margin-top:10px">${t("ytAdd")}</h3></div>
    <p class="mut small" style="line-height:1.8;margin:10px 0 14px">${t("ytHelp")}</p>
    <div class="field"><label>${t("ytKey")}${u.yt ? ` · <span dir="ltr">${esc(u.yt)}</span>` : ""}</label>${pwField("ytk", t("ytKeyPh"), "off")}</div>
    <button class="btn p" id="yts">${t("ytSave")}</button>${u.yt ? `<button class="btn g" id="ytr" style="margin-top:10px;color:#ff7b88">${t("ytRemove")}</button>` : ""}`, (sh, close) => {
    bindEyes(sh);
    const save = async (k) => {
      const r = await api("/api/profile", { ytkey: k });
      if (r.error) return toast(terr(r.error));
      S.user = r.user; store.set("user", r.user); close(); haptic("success"); toast(k ? t("ytSaved") : t("ytRemoved")); done && done();
    };
    $("#yts", sh).onclick = () => { const k = $("#ytk", sh).value.trim(); if (!k) return toast(t("ytKey")); save(k); };
    const rm = $("#ytr", sh); if (rm) rm.onclick = () => save("");
  });
}

/* ---------- grand entrance (VIP / channel subscribers) ---------- */
function grandEntrance(m, canvas) {
  const d = document.createElement("div"); d.className = "grand";
  const tags = [m.look && m.look.vip ? `<span class="bdg bdg-vip">VIP</span>` : "", m.sub ? `<span class="bdg bdg-sub">${eic("star")}${m.sub}</span>` : "", lvlHtml(m.level)].join("");
  d.innerHTML = `<div class="gav">${avatar(m, "lg")}</div><div class="gn">${uname(m, "span")}</div>
    <div class="gs">${tags}${m.sub ? t("subMonths", { n: m.sub }) : ""}</div><div class="gt">${eic("crown")} ${t("enteredGrand")}</div>`;
  ($("#app") || document.body).appendChild(d); setTimeout(() => d.remove(), 5300);
  if (canvas) FX.play(m.look && m.look.vip ? "goldrain" : "confetti", null, null, canvas);
  FX.tone([784, 988, 1318], 0.5, "triangle", 0.07); FX.tone([1046, 1318, 1568], 0.6, "triangle", 0.05, 0.25);
}
function subSheet(host, done) {
  shopData().then((d) => {
    sheet(`<div style="text-align:center">${avatar(host, "lg", "margin:0 auto")}<h3 style="margin-top:12px">${esc(t("subTitle", { n: host.name }))}</h3>
      <p class="mut" style="line-height:1.8;margin-bottom:14px">${t("subD")}</p></div>
      <button class="btn" id="sbb" style="background:linear-gradient(120deg,#00d1ff,#7c5cff);color:#fff">${t("subBuy")} · ${coinHtml(d.sub)}</button>
      <p class="small mut" style="text-align:center;margin-top:10px">${t("wallet")}: ${coinHtml(S.user && S.user.coins)}</p>`, (sh, close) => {
      $("#sbb", sh).onclick = async () => {
        const r = await api("/api/sub", { host: host.id });
        if (r.error) { if (r.error === "no_coins") { close(); toast(t("noCoins")); return go("wallet"); } return toast(terr(r.error)); }
        S.user = { ...S.user, ...r.user }; store.set("user", S.user); close(); haptic("success"); toast(t("subOk", { n: esc(host.name) })); done && done(r.sub);
      };
    });
  });
}

/* ---------- channel points ---------- */
const RW_ICON = { highlight: eic("chat", "cyan"), goldrain: eic("coin", "gold"), pin: eic("pin", "pink") };
function pointsSheet(loy, host, redeem) {
  loy = loy || { level: 1, xp: 0, points: 0, cur: 0, next: 50, rewards: [] };
  const pct = Math.round(((loy.xp - loy.cur) / Math.max(1, loy.next - loy.cur)) * 100);
  sheet(`<div class="lvring"><div class="lvnum" style="--pct:${pct}%"><span>${loy.level}</span></div>
      <div style="flex:1"><b style="font-size:17px">${t("level")} ${loy.level}</b> <span class="mut small">· ${esc(host ? host.name : "")}</span>
      <div class="bar"><i style="width:${pct}%"></i></div><div class="small mut" style="margin-top:6px">${t("xpTo", { n: Math.max(0, loy.next - loy.xp) })}</div></div></div>
    <div class="row" style="justify-content:space-between;margin:14px 2px 4px"><span class="pt" style="font-size:22px">${eic("star", "gold")} ${fmtN(loy.points)}</span>
      <span class="small mut">${loy.streak ? t("streakT", { n: loy.streak }) + " · " : ""}${t("watchT", { n: loy.watchMin || 0 })}</span></div>
    <div class="h2">${t("rewards")}</div>
    <div id="rwl">${(loy.rewards || []).map((r) => `<button class="rw" data-r="${esc(r.id)}" data-t="${r.text || r.id === "highlight" || r.id === "pin" ? 1 : ""}"><span class="ic">${RW_ICON[r.id] || eic("target", "violet")}</span>
      <span style="flex:1;font-weight:600">${esc(r.custom ? r.title : S.lang === "ar" ? r.ar : r.en)}</span><span class="pt">${eic("star", "gold")} ${fmtN(r.cost)}</span></button>`).join("")}</div>
    <div class="h2">${t("topFans")}</div><div id="tfl" class="sl"><div style="height:60px;position:relative"><div class="spin"></div></div></div>
    <details style="margin-top:14px"><summary class="mut small">${t("howEarn")}</summary><p class="small mut" style="line-height:1.9;margin-top:8px">${t("howEarnD")}</p></details>`, (sh, close) => {
    $$("[data-r]", sh).forEach((b) => (b.onclick = () => {
      const r = loy.rewards.find((x) => x.id === b.dataset.r);
      if (loy.points < r.cost) return toast(t("noPoints"));
      if (b.dataset.t) {
        b.outerHTML = `<div class="row" style="margin-top:8px"><input class="inp" id="rwt" maxlength="150" placeholder="${t("msgPh")}"><button class="btn p" style="width:auto;padding:15px 18px" id="rws">${ic("send")}</button></div>`;
        $("#rwt", sh).focus();
        $("#rws", sh).onclick = () => { const v = $("#rwt", sh).value.trim(); if (!v) return; redeem(r.id, v); haptic("success"); close(); };
      } else { redeem(r.id, ""); haptic("success"); close(); }
    }));
    if (host) api("/api/fans?u=" + encodeURIComponent(host.handle)).then((d) => {
      const el = $("#tfl", sh); if (!el) return;
      el.innerHTML = (d.top || []).slice(0, 10).map((f, i) => `<div class="sm" style="align-items:center"><b style="width:22px;text-align:center;color:${i < 3 ? "#ffd700" : "var(--mut)"}">${i + 1}</b>${avatar(f)}<div class="tx">${lvlHtml(f.level)}${uname(f, "span")}</div><span class="small mut">${fmtN(f.xp)} XP</span></div>`).join("") || `<p class="mut small" style="text-align:center">—</p>`;
    });
  });
}
function rewardsSheet(st, ws) {
  const draw = (sh) => {
    const list = st.redeems || [];
    $("#rq", sh).innerHTML = list.filter((x) => x.state === "new").length ? list.filter((x) => x.state === "new").map((q) => `<div class="chl"><div class="row">${uname(q, "span")}<span class="sp"></span><span class="pt">${eic("star", "gold")} ${q.cost}</span></div>
      <div style="margin:6px 0 8px;font-weight:700">${esc(q.title)}</div>${q.text ? `<div class="small mut">${esc(q.text)}</div>` : ""}
      <div class="row" style="margin-top:8px"><button class="mini p" data-ok="${q.id}">${t("done2")}</button><button class="mini" data-rf="${q.id}">${t("refund")}</button></div></div>`).join("") : `<p class="mut small" style="text-align:center;padding:12px">${t("noRedeems")}</p>`;
    $$("[data-ok]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "redeem-set", id: b.dataset.ok, state: "done" }); const x = list.find((y) => y.id === b.dataset.ok); if (x) x.state = "done"; draw(sh); }));
    $$("[data-rf]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "redeem-set", id: b.dataset.rf, state: "refund" }); const x = list.find((y) => y.id === b.dataset.rf); if (x) x.state = "refund"; draw(sh); }));
  };
  sheet(`<h3>${eic("star", "gold")} ${t("redeemQ")}</h3><div id="rq"></div><div class="h2">${t("myRewards")}</div><div id="myr"></div>
    <div class="row" style="margin-top:8px"><input class="inp" id="nrt" maxlength="50" placeholder="${t("rewardTitle")}"><input class="inp" id="nrc" inputmode="numeric" placeholder="${t("cost")}" style="width:110px"></div>
    <button class="btn p" id="nra" style="margin-top:8px">${t("addReward")}</button>`, (sh) => {
    draw(sh);
    const mine = (rows) => { $("#myr", sh).innerHTML = rows.map((r) => `<div class="sm" style="align-items:center"><div class="tx"><b>${esc(r.title)}</b></div><span class="pt">${eic("star", "gold")} ${r.cost}</span><button class="mini" data-del="${r.id}" style="color:#ff7b88">${ic("x")}</button></div>`).join("") || `<p class="mut small">—</p>`;
      $$("[data-del]", sh).forEach((b) => (b.onclick = async () => mine((await api("/api/rewards", { del: b.dataset.del })).rewards || []))); };
    api("/api/rewards", {}).then((r) => mine(r.rewards || []));
    $("#nra", sh).onclick = async () => { const title = $("#nrt", sh).value.trim(), cost = +$("#nrc", sh).value || 0; if (!title || cost < 10) return toast(t("cost") + " ≥ 10"); const r = await api("/api/rewards", { title, cost }); if (r.error) return toast(terr(r.error)); $("#nrt", sh).value = ""; $("#nrc", sh).value = ""; mine(r.rewards || []); haptic("success"); };
  });
}

/* ---------- economy ---------- */
const GIFT_E = new Proxy({}, { get: (o, k) => artHtml("g_" + String(k), "art gi2") || eic("gift", "pink") });
const GIFT_N = { rose: ["وردة", "Rose"], heart: ["قلب", "Heart"], controller: ["يد تحكم", "Controller"], car: ["سيارة", "Supercar"], lion: ["أسد", "Lion"], crown: ["تاج", "Crown"], rocket: ["صاروخ", "Rocket"] };
let SHOPDATA = null;
async function shopData() { if (!SHOPDATA) SHOPDATA = await api("/api/shop"); return SHOPDATA; }
async function refreshMe() { const r = await api("/api/wallet", {}); if (r.user) { S.user = { ...S.user, ...r.user }; store.set("user", S.user); } return r; }
function giftSheet(send) {
  shopData().then((d) => {
    const gifts = Object.entries(d.gifts || {});
    let n = 1;
    sheet(`<div class="row"><h3 style="margin:0">${eic("gift", "pink")} ${t("gifts")}</h3><span class="sp"></span><button class="chip" id="gw">${coinHtml(S.user && S.user.coins)} +</button></div>
      <div class="giftg" style="margin-top:12px">${gifts.map(([id, g]) => `<button class="gift" data-g="${id}"><span class="e">${artHtml("g_" + id, "art")}</span><small>${GIFT_N[id] ? GIFT_N[id][S.lang === "ar" ? 0 : 1] : id}</small>${coinHtml(g.price)}</button>`).join("")}</div>
      <div class="seg" id="gn" style="margin-top:12px">${[1, 5, 10, 99].map((k) => `<button class="${k === 1 ? "on" : ""}" data-n="${k}">×${k}</button>`).join("")}</div>`, (sh, close) => {
      $("#gw", sh).onclick = () => { close(); go("wallet"); };
      $$("#gn button", sh).forEach((b) => (b.onclick = () => { n = +b.dataset.n; $$("#gn button", sh).forEach((x) => x.classList.toggle("on", x === b)); }));
      $$("[data-g]", sh).forEach((b) => (b.onclick = () => {
        const g = d.gifts[b.dataset.g];
        if (!S.user || (S.user.coins | 0) < g.price * n) { close(); toast(t("noCoins")); return go("wallet"); }
        send(b.dataset.g, n); haptic("success"); close();
      }));
    });
  });
}
VIEWS.wallet = (root, arg = {}) => {
  if (!S.token) return go("auth");
  let tab = arg.tab || "names";
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="wb">${ic("back")}</button><div class="h1">${t("wallet")}</div></div><canvas id="fx" class="fxfix"></canvas>
  <div class="scroll" id="wsc" style="padding-bottom:calc(30px + var(--sb))"><div style="height:200px;position:relative"><div class="spin"></div></div></div></div>`;
  $("#wb").onclick = () => go("me");
  let polling = null;
  const render = async () => {
    const [d, r] = await Promise.all([shopData(), refreshMe()]);
    const u = S.user; if (!u) return;
    const vip = u.vipUntil > Date.now();
    const RO = { c: 0, r: 1, e: 2, l: 3 };
    const items = Object.entries(d.shop).filter(([id, it]) => it.kind === tab.slice(0, -1) && !(it.admin && !u.admin))
      .sort((a, b) => (RO[b[1].rarity] ?? 4) - (RO[a[1].rarity] ?? 4) || b[1].price - a[1].price);
    const owns = (id, it) => it.admin ? u.admin : it.vip ? vip : (vip && it.kind === "name") || (u.owned || []).includes(id);
    const prev = (id) => {
      const [k, v] = id.split(":");
      if (k === "name") return `<b class="un un-${v}" style="font-size:20px">${esc(u.name)}</b>`;
      if (k === "badge") return `<div class="bxbig">${badgeHtml({ badge: v })}</div><b>${esc(u.name)}</b>`;
      if (k === "fx") { const f = FX.list.find((x) => x.id === v) || {}; return `<div class="fxpv fxpv-${v}"></div><b style="font-size:13px">${esc(S.lang === "ar" ? f.ar || v : f.en || v)}</b>`; }
      return `<div class="frm frm-${v}">${avatar0(u, "md")}</div>`;
    };
    $("#wsc").innerHTML = `
      <div class="wallet"><div class="small" style="opacity:.8;position:relative;z-index:1">${t("wallet")}</div>
        <div class="big" style="position:relative;z-index:1">${coinHtml(u.coins)}</div>
        <div class="small" style="opacity:.8;position:relative;z-index:1">${t("earned")}: ${coinHtml(u.earned)}${vip ? ` · <b style="color:#ffd700">${t("vipUntil", { d: new Date(u.vipUntil).toLocaleDateString(S.lang) })}</b>` : ""}</div></div>
      <div class="h2">${t("buyCoins")} ${d.mode !== "live" && d.pay ? `<span class="small mut">· ${t("sandbox")}</span>` : ""}</div>
      <div class="packs">${Object.entries(d.packs).map(([id, p], i) => `<button class="pack ${i === 2 ? "best" : ""}" data-pack="${id}">${coinHtml(p.coins)}<span class="pr">$${p.usd}</span></button>`).join("")}</div>
      <div class="vipcard"><h3>${eic("crown", "gold")} ${t("vip")}</h3><p style="margin:8px 0 12px;line-height:1.7;color:#ffe9a8;font-size:14px">${t("vipD")}</p>
        <button class="btn" id="vbuy" style="background:linear-gradient(120deg,#ffd700,#ff9a3d);color:#2b1600">${t("vipBuy")} · ${coinHtml(d.vip)}</button></div>
      <div class="seg" id="wt" style="margin-top:18px">${["names", "badges", "frames", "fxs"].map((k) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${t(k)}</button>`).join("")}</div>
      <div class="shopg" style="margin-top:12px">${items.map(([id, it]) => {
        const own = owns(id, it), on = (u.equip || {})[it.kind] === id;
        const rr = it.rarity ? `<span class="rar rar-${it.rarity}">${RARITY[it.rarity][S.lang === "ar" ? 0 : 1]}</span>` : "";
        const pvb = it.kind === "fx" ? `<button class="mini" data-pv="${id.slice(3)}">${t("preview")}</button>` : "";
        if (it.kind === "fx") return `<div class="item r-${it.rarity || ""}">${rr}<div class="pv">${prev(id)}</div><div class="row" style="gap:6px;justify-content:center">${pvb}${own ? `<span class="small" style="color:var(--ok)">✓ ${t("owned2")}</span>` : `<button class="mini p" data-buy="${id}">${coinHtml(it.price)}</button>`}</div></div>`;
        return `<div class="item r-${it.rarity || ""} ${on ? "on" : ""}">${rr}<div class="pv">${prev(id)}</div>
          ${own ? `<button class="mini ${on ? "" : "p"}" data-eq="${id}" data-k="${it.kind}">${on ? t("unequip") : t("equip")}</button>`
                : it.vip ? `<span class="small" style="color:#ffd700">${t("vipOnly")}</span>` : `<button class="mini p" data-buy="${id}">${t("buy")} ${coinHtml(it.price)}</button>`}</div>`;
      }).join("")}</div>
      ${u.admin ? `<div class="h2">${eic("wrench", "cyan")} ${t("admin")}</div><div class="tile"><div class="field"><input class="inp" id="ah2" placeholder="${t("handleQ")}" dir="ltr" autocapitalize="none"></div>
        <div class="row"><input class="inp" id="ac2" inputmode="numeric" placeholder="${t("coins")}"><input class="inp" id="av2" inputmode="numeric" placeholder="${t("vipDays")}"></div>
        <button class="btn p" id="ag2" style="margin-top:10px">${t("grant")}</button></div>` : ""}
      <div class="h2">${t("history")}</div><div class="sl">${(r.tx || []).map((x) => `<div class="sm"><div class="tx">${esc(x.kind)} <span class="mut small">${esc(x.ref)}</span><br><span class="mut small">${new Date(x.t).toLocaleString(S.lang)}</span></div><b style="color:${x.delta > 0 ? "var(--ok)" : "#ff7b88"}">${x.delta > 0 ? "+" : ""}${x.delta}</b></div>`).join("")}</div>`;
    $$("#wt button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; render(); }));
    $$("[data-pv]").forEach((b) => (b.onclick = () => { FX.audio(); FX.play(b.dataset.pv, null, $("#wsc"), $("#fx")); haptic("medium"); }));
    $$("[data-buy]").forEach((b) => (b.onclick = async () => { const x = await api("/api/buy", { item: b.dataset.buy }); if (x.error) return toast(terr(x.error)); S.user = { ...S.user, ...x.user }; store.set("user", S.user); haptic("success"); toast(t("saved")); render(); }));
    $$("[data-eq]").forEach((b) => (b.onclick = async () => { const on = (S.user.equip || {})[b.dataset.k] === b.dataset.eq; const x = await api("/api/equip", { kind: b.dataset.k, item: on ? "" : b.dataset.eq }); if (x.error) return toast(terr(x.error)); S.user = { ...S.user, ...x.user }; store.set("user", S.user); haptic(); render(); }));
    $("#vbuy").onclick = () => confirmBox(`${t("vipBuy")} — ${d.vip} ${t("coins")}?`, async () => { const x = await api("/api/vip", {}); if (x.error) return toast(terr(x.error)); S.user = { ...S.user, ...x.user }; store.set("user", S.user); haptic("success"); FX.play("fireworks", null, null, null); toast("VIP"); render(); });
    $$("[data-pack]").forEach((b) => (b.onclick = async () => {
      if (!d.pay) return toast(t("payOff"));
      b.disabled = true; const x = await api("/api/pay/create", { pack: b.dataset.pack }); b.disabled = false;
      if (x.error) return toast(terr(x.error));
      if (Native.has()) Native.post("open", { url: x.url }); else window.open(x.url, "_blank");
      toast(t("payOpen"), 6000);
      clearInterval(polling); let k = 0;
      polling = setInterval(async () => { if (++k > 200 || current !== "wallet") return clearInterval(polling); const st = await api("/api/pay/status?id=" + x.id); if (st.status === "paid") { clearInterval(polling); haptic("success"); toast(t("paid", { n: st.coins })); FX.play("confetti", null, null, null); render(); } }, 3000);
    }));
    if ($("#ag2")) $("#ag2").onclick = async () => { const x = await api("/api/admin/grant", { handle: $("#ah2").value.trim(), coins: +$("#ac2").value || 0, vipDays: +$("#av2").value || 0 }); if (x.error) return toast(terr(x.error)); toast("✓ @" + x.user.handle + " · " + x.user.coins + " coins"); if (x.user.id === S.user.id) render(); };
  };
  render();
  return () => clearInterval(polling);
};

/* ---------- replay (recorded stream) ---------- */
VIEWS.replay = (root, arg) => {
  const id = typeof arg === "string" ? arg : arg.id;
  const info = typeof arg === "object" ? arg : {};
  root.innerHTML = `<div class="view" style="background:#000">
    <div class="wtop"><button class="ibtn" id="rx" style="background:rgba(0,0,0,.4)">${ic("x")}</button>
      <div class="pill"><div><div class="n" id="rt">${esc(info.title || t("replay"))}</div><div class="s" id="rg">${info.game ? gIcon(info.gameIcon) + esc(info.game) : ""}</div></div></div><div class="sp"></div>
      ${info.own ? `<button class="ibtn" id="rdel" style="background:rgba(0,0,0,.4);color:#ff7b88">${ic("x")}</button>` : ""}</div>
    <video id="rv" playsinline controls autoplay style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video>
    <div class="spin" id="rspin"></div></div>`;
  $("#rx").onclick = () => history.length > 1 && info.back ? go(info.back.view, info.back.arg) : go("home");
  if ($("#rdel")) $("#rdel").onclick = () => deleteRec(id, () => go("me"));
  const v = $("#rv"), src = `/api/rec/${id}/index.m3u8`;
  let hls;
  v.addEventListener("playing", () => $("#rspin") && $("#rspin").remove());
  const fail = () => { $("#rspin") && $("#rspin").remove(); toast(t("offline")); };
  if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; v.onerror = fail; }
  else loadHls().then((Hls) => {
    if (!Hls.isSupported()) return fail();
    hls = new Hls({ maxBufferLength: 30 });
    hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) fail(); });
    hls.loadSource(src); hls.attachMedia(v);
  }).catch(fail);
  v.play().catch(() => {});
  return () => { try { hls && hls.destroy(); } catch (e) {} v.pause(); v.removeAttribute("src"); v.load(); };
};

function countryName(cc) {
  if (!cc || cc.length !== 2) return "–";
  const flag = String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
  let name = cc;
  try { name = new Intl.DisplayNames([S.lang === "ar" ? "ar" : "en"], { type: "region" }).of(cc.toUpperCase()) || cc; } catch (e) {}
  return flag + " " + name;
}

/* ---------- speed test ---------- */
VIEWS.speed = (root) => {
  const R = 100, C = 2 * Math.PI * R, ARC = C * 0.75;
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="sb">${ic("back")}</button><div class="h1">${t("speedTest")}</div></div>
  <div class="scroll" style="padding-bottom:calc(30px + var(--sb))">
    <div class="gauge"><svg viewBox="0 0 240 240"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#7C5CFF"/><stop offset=".6" stop-color="#FF4D8D"/><stop offset="1" stop-color="#FF9A3D"/></linearGradient></defs>
      <circle cx="120" cy="120" r="${R}" stroke="rgba(255,255,255,.08)" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${ARC} ${C}"/>
      <circle id="garc" cx="120" cy="120" r="${R}" stroke="url(#gg)" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="0 ${C}" style="transition:stroke-dasharray .25s"/></svg>
      <div class="v"><b id="gv">–</b><span id="gu">${t("mbps")}</span><span id="gs" style="margin-top:6px"></span></div></div>
    <div class="sres">
      <div class="kpi"><span class="small">${t("ping")}</span><br><b id="rp">–</b> <span class="small">${t("ms")}</span></div>
      <div class="kpi"><span class="small">${t("jitter")}</span><br><b id="rj">–</b> <span class="small">${t("ms")}</span></div>
      <div class="kpi"><span class="small">${t("down")}</span><br><b id="rd">–</b> <span class="small">${t("mbps")}</span></div>
      <div class="kpi"><span class="small">${t("up")}</span><br><b id="ru">–</b> <span class="small">${t("mbps")}</span></div>
    </div>
    <div class="tile row" style="margin-top:12px">${ic("globe")}<span class="mut">${t("server")}</span><span class="sp"></span><b id="rs">–</b></div>
    <div id="sv"></div>
    <button class="btn p" id="sgo" style="margin-top:16px">${ic("gauge")} ${t("sStart")}</button>
  </div></div>`;
  $("#sb").onclick = () => go(S.token ? "me" : "home");
  let alive = true;
  const setG = (v, max, unit) => { $("#gv").textContent = v < 10 ? v.toFixed(1) : Math.round(v); $("#gu").textContent = unit; $("#garc").setAttribute("stroke-dasharray", `${ARC * Math.min(1, Math.log10(1 + v) / Math.log10(1 + max))} ${C}`); };
  const run = async () => {
    const b = $("#sgo"); b.disabled = true; $("#sv").innerHTML = "";
    ["rp", "rj", "rd", "ru"].forEach((i) => ($("#" + i).textContent = "–"));
    // ping
    $("#gs").textContent = t("sPing");
    const pings = []; let colo = "";
    for (let i = 0; i < 12 && alive; i++) {
      const t0 = performance.now();
      const r = await fetch("/api/speed/ping?r=" + Math.random(), { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const dt = performance.now() - t0;
      if (r) { colo = r.country || ""; if (i > 1) pings.push(dt); setG(dt, 300, t("ms")); }
    }
    const ping = Math.min(...pings), jit = pings.length > 1 ? pings.slice(1).reduce((a, x, i) => a + Math.abs(x - pings[i]), 0) / (pings.length - 1) : 0;
    $("#rp").textContent = Math.round(ping); $("#rj").textContent = Math.round(jit); $("#rs").textContent = countryName(colo);
    // download (parallel streams, ~8s)
    $("#gs").textContent = t("sDown");
    let got = 0; const tD = performance.now(); let stop = false;
    const dl = async () => { while (!stop && alive) { const r = await fetch("/api/speed/down?bytes=8000000&r=" + Math.random(), { cache: "no-store" }); const rd = r.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done || stop) { if (stop) rd.cancel().catch(() => {}); break; } got += value.length; } } };
    const tick = setInterval(() => setG((got * 8) / ((performance.now() - tD) / 1000) / 1e6, 1000, t("mbps")), 200);
    const ws = [dl(), dl(), dl(), dl()];
    await sleep(8000); stop = true; clearInterval(tick); await Promise.allSettled(ws);
    const down = (got * 8) / ((performance.now() - tD) / 1000) / 1e6;
    $("#rd").textContent = down.toFixed(1);
    // upload (parallel, ~8s)
    $("#gs").textContent = t("sUp");
    const blob = new Blob([crypto.getRandomValues(new Uint8Array(65536))]);
    const parts = Array(32).fill(blob); const body = new Blob(parts); // 2 MB
    let sent = 0; const tU = performance.now(); stop = false;
    const ul = async () => { while (!stop && alive) { await fetch("/api/speed/up", { method: "POST", body, cache: "no-store" }).catch(() => {}); if (!stop) sent += body.size; } };
    const tick2 = setInterval(() => setG((sent * 8) / ((performance.now() - tU) / 1000) / 1e6, 1000, t("mbps")), 200);
    const us = [ul(), ul(), ul()];
    await sleep(8000); stop = true; clearInterval(tick2); await Promise.allSettled(us);
    const up = (sent * 8) / ((performance.now() - tU) / 1000) / 1e6;
    $("#ru").textContent = up.toFixed(1);
    setG(up, 1000, t("mbps") + " ↑");
    $("#gs").textContent = "";
    const q = up >= 8 ? "1080p 60" : up >= 5 ? "720p 60" : up >= 3 ? "720p 30" : up >= 1.8 ? "540p" : "";
    $("#sv").innerHTML = `<div class="verdict ${up >= 5 && ping < 120 ? "" : up >= 1.8 ? "w" : "b"}">${q ? t(up >= 5 && ping < 120 ? "vGreat" : "vOk", { q }) : t("vBad")}</div>`;
    b.disabled = false; b.innerHTML = ic("refresh") + " " + t("sAgain");
    haptic("success");
  };
  $("#sgo").onclick = run;
  run();
  return () => { alive = false; };
};

/* ---------- home ---------- */
VIEWS.home = (root) => {
  let cat = "all", tab = "live", data = [], gameF = "";
  root.innerHTML = `<div class="view">
    <div class="top"><div class="brand"><div class="logo">${ic("live")}</div><b>${S.lang === "ar" ? "وهج" : "Wahj"}</b></div><div class="sp"></div>
      <button class="ibtn" id="hrk" title="${t("ranks")}">${eic("trophy", "gold")}</button><button class="ibtn" id="hr">${ic("refresh")}</button></div>
    <div class="scroll" id="hs">
      <div class="seg" style="margin-top:4px" id="ht"><button class="on" data-t="live">${t("liveNow")}</button><button data-t="fol">${t("following")}</button></div>
      <div id="hg"></div>
      <div class="chips" style="margin-top:12px" id="hc">${CATS.map((c) => `<button class="chip ${c === "all" ? "on" : ""}" data-c="${c}">${CAT_EMO[c]} ${t(c)}</button>`).join("")}</div>
      <div id="hl"><div style="height:200px;position:relative"><div class="spin"></div></div></div>
    </div></div>`;
  const card = (s, big) => {
    const thumb = `/api/thumb/${s.id}?b=${Math.floor(Date.now() / 20000)}`;
    const badges = `<div class="live"><span class="badge red">LIVE</span><span class="badge">${ic("eye")} ${fmtN(s.viewers)}</span>${s.guests ? `<span class="badge co">${ic("users")} ${s.guests + 1}</span>` : ""}</div>`;
    const ph = s.gameIcon ? `<div class="thbg" style="background-image:url('${esc(s.gameIcon)}')"></div>${gIcon(s.gameIcon, "gi thic")}` : `<div class="ph">${CAT_EMO[s.cat] || CAT_EMO.all}</div>`;
    const gb = s.game ? `<div class="gbadge">${gIcon(s.gameIcon)}<span>${esc(s.game)}</span></div>` : "";
    if (big) return `<div class="feat ${s.top ? "ftop ftop" + s.top : ""}" data-id="${s.id}">${s.top ? `<div class="fmedal">${MEDAL[s.top]} TOP ${s.top}</div>` : ""}${ph}<img src="${thumb}" onerror="this.remove()" alt="" style="position:absolute;inset:0">${badges}<div class="ov"><div class="t">${esc(s.title)}</div>
      <div class="who">${avatar(s.host)}<span style="font-weight:600">${uname(s.host, "span")}</span></div>${s.game ? `<div class="row" style="gap:8px;margin-top:8px">${gIcon(s.gameIcon, "gi", 22)}<span class="small" style="color:#e6e1ff;font-weight:600">${esc(s.game)}</span></div>` : ""}</div></div>`;
    return `<div class="card ${s.top ? "ctop ctop" + s.top : ""}" data-id="${s.id}"><div class="th">${s.top ? `<div class="fmedal sm">${MEDAL[s.top]}</div>` : ""}${ph}<img src="${thumb}" onerror="this.remove()" alt="" style="position:absolute;inset:0">${badges}${gb}</div>
      <div class="meta"><div class="tt">${esc(s.title)}</div><div class="who">${avatar(s.host)}<span class="small" style="font-weight:600">${uname(s.host, "span")}</span></div></div></div>`;
  };
  const render = () => {
    // games being streamed right now
    const gm = new Map();
    data.forEach((s) => { if (!s.game) return; const k = s.game.toLowerCase(); const g = gm.get(k) || { name: s.game, icon: s.gameIcon, n: 0 }; g.n++; if (!g.icon) g.icon = s.gameIcon; gm.set(k, g); });
    const games = [...gm.values()].sort((a, b) => b.n - a.n);
    $("#hg").innerHTML = games.length ? `<div class="h2" style="margin-top:14px">${ic("game")} ${t("nowPlaying")}</div><div class="chips">${games.map((g) => `<button class="chip gchip ${gameF === g.name.toLowerCase() ? "on" : ""}" data-g="${esc(g.name.toLowerCase())}">${g.icon ? gIcon(g.icon) : eic("game", "brand")}<span>${esc(g.name)}</span><b>${g.n}</b></button>`).join("")}</div>` : "";
    $$("#hg [data-g]").forEach((b) => (b.onclick = () => { gameF = gameF === b.dataset.g ? "" : b.dataset.g; haptic(); render(); }));
    let list = data.filter((s) => (cat === "all" || s.cat === cat) && (!gameF || (s.game || "").toLowerCase() === gameF));
    if (tab === "fol") list = list.filter((s) => s.followed);
    const el = $("#hl");
    if (!list.length) {
      el.innerHTML = `<div class="empty"><div class="radar"><i></i><i></i><i></i>${eic("live", "brand")}</div><div style="font-weight:700;font-size:17px;color:var(--txt)">${t("noLive")}</div><div style="margin-top:6px">${t("beFirst")}</div>
        <button class="btn p" style="margin-top:20px;width:auto;padding:14px 26px;display:inline-flex" id="hgo">${ic("live")} ${t("goLive")}</button></div>`;
      $("#hgo").onclick = () => go("golive");
      return;
    }
    const [f, ...rest] = list;
    el.innerHTML = card(f, true) + (rest.length ? `<div class="h2">${ic("zap")} ${t("liveNow")}</div><div class="grid">${rest.map((s) => card(s)).join("")}</div>` : "");
    $$("[data-id]", el).forEach((c) => (c.onclick = () => { haptic(); go("watch", c.dataset.id); }));
  };
  const load = async () => { const r = await api("/api/live"); if (r.streams) { data = r.streams; render(); } else if (!data.length) render(); };
  $$("#ht button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; $$("#ht button").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
  $$("#hc .chip").forEach((b) => (b.onclick = () => { cat = b.dataset.c; $$("#hc .chip").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
  $("#hr").onclick = () => { haptic(); load(); };
  $("#hrk").onclick = () => go("ranks");
  load();
  const iv = setInterval(load, 15000);
  return () => clearInterval(iv);
};

/* ---------- streamer ranking ---------- */
VIEWS.ranks = (root) => {
  let mode = "month";
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="rb">${ic("back")}</button><div class="h1">${eic("trophy", "gold")} ${t("ranks")}</div></div>
    <div class="scroll" style="padding-bottom:calc(40px + var(--sb))">
      <div class="seg" id="rm"><button class="on" data-m="month">${t("rankMonth")}</button><button data-m="all">${t("rankAll")}</button></div>
      <div id="rl"><div style="height:200px;position:relative"><div class="spin"></div></div></div>
      <div class="h2">${eic("crown", "gold")} ${t("topPerks")}</div>
      <div class="tile perks">${[1, 2, 3, 4].map((i) => `<div>${t("perk" + i)}</div>`).join("")}</div>
      <div class="h2">${eic("chart", "green")} ${t("xpHow")}</div>
      <div class="tile perks">${[1, 2, 3, 4].map((i) => `<div>${t("xpHow" + i)}</div>`).join("")}
        <div class="mut small">${[[1, 1], [5, 2], [10, 3], [20, 4], [35, 5], [50, 6]].map(([l, k]) => `<span class="slvl st${k}" style="margin:3px">${l}+ ${t("tier" + k)}</span>`).join("")}</div></div>
    </div></div>`;
  $("#rb").onclick = () => go(prevView && prevView !== "ranks" ? prevView : "home", prevArg);
  const load = async () => {
    const r = await api("/api/streamers?mode=" + mode);
    const el = $("#rl"); if (!el || !r.list) return;
    const L = r.list, pod = [L[1], L[0], L[2]];
    const days = Math.max(0, Math.ceil((r.ends - Date.now()) / 86400000));
    const me = r.me;
    el.innerHTML = `${mode === "month" ? `<p class="small mut" style="text-align:center;margin:10px 0 0">${eic("hourglass", "violet")} ${t("rankEnds", { n: days + " " + t("days") })}</p>` : ""}
      <div class="podium">${pod.map((u) => u ? `<div class="pd p${u.rank}" data-h="${esc(u.handle)}"><div class="pm">${MEDAL[u.rank]}</div>${avatar(u, "lg")}${u.live ? '<span class="badge red pl">LIVE</span>' : ""}
        <div class="pn">${uname({ ...u, look: { ...u.look, top: 0 } }, "span")}</div><div class="small">${sLvlHtml(u.level)}</div><div class="px">${fmtN(u.xp)} XP</div><div class="pbase">${u.rank}</div></div>` : `<div class="pd empty"></div>`).join("")}</div>
      ${me ? `<div class="sm" style="margin-top:12px;align-items:center;border-color:rgba(124,92,255,.5)"><b style="width:44px;text-align:center">${(mode === "month" ? me.mrank : me.rank) ? "#" + (mode === "month" ? me.mrank : me.rank) : "–"}</b><div class="tx"><b>${t("rankYou")}</b><br><span class="small mut">${(mode === "month" ? me.mrank : me.rank) ? fmtN(mode === "month" ? me.mxp : me.xp) + " XP" : t("rankNone")}</span></div>${sLvlHtml(me.level)}</div>` : ""}
      <div class="sl" style="margin-top:10px">${L.slice(3).map((u) => `<div class="sm" data-h="${esc(u.handle)}" style="align-items:center"><b style="width:34px;text-align:center" class="mut">#${u.rank}</b>${avatar(u, "md")}
        <div class="tx"><b>${uname(u, "span")}</b> ${u.live ? '<span class="badge red">LIVE</span>' : ""}<br><span class="small mut">${fmtN(u.xp)} XP</span></div>${sLvlHtml(u.level)}</div>`).join("")}</div>
      ${!L.length ? `<p class="mut" style="text-align:center;padding:30px">${t("rankNone")}</p>` : ""}`;
    $$("[data-h]", el).forEach((x) => (x.onclick = () => go("user", x.dataset.h)));
  };
  $$("#rm button").forEach((b) => (b.onclick = () => { mode = b.dataset.m; $$("#rm button").forEach((x) => x.classList.toggle("on", x === b)); load(); }));
  load();
};

/* ---------- watch ---------- */
VIEWS.watch = (root, id) => {
  history.replaceState(null, "", "/w/" + id);
  root.innerHTML = `<div class="view" id="watch">
    <div class="stage" id="ws"></div>
    <canvas id="fx"></canvas>
    <div id="wfx" style="position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden"></div>
    <div class="wtop"><button class="ibtn" id="wx" style="background:rgba(0,0,0,.4)">${ic("x")}</button>
      <div class="pill" id="wh"><div class="av md" id="wav"></div><div><div class="n" id="wn">…</div><div class="s" id="wg"></div></div></div>
      <button class="fbtn hide" id="wf">${t("follow")}</button><button class="subbtn hide" id="wsub"></button><div class="sp"></div>
      <span class="stat"><span class="badge red" style="padding:2px 7px">LIVE</span></span>
      <span class="stat" id="wv">${ic("eye")} 0</span></div>
    <div class="pinned hide" id="wpin"></div>
    <div class="chatov" id="wc"></div>
    <div class="hype" id="whype"><i style="height:0%"></i></div><div class="hypel" id="whl">x1</div>
    <div id="wpoll"></div>
    <div class="wbar">
      <div class="cin"><input id="wi" placeholder="${S.token ? t("chatPh") : t("loginToChat")}" maxlength="200" enterkeyhint="send"><button class="rbtn" id="wsend" style="width:36px;height:36px;background:none">${ic("send")}</button></div>
      <button class="rbtn ptsbtn" id="wpts">${eic("star", "gold")}</button><button class="rbtn" id="wr">${eic("heart", "pink")}</button><button class="rbtn" id="wgf">${eic("gift", "pink")}</button><button class="rbtn hot" id="we">${ic("spark")}</button><button class="rbtn" id="wm">${ic("layers")}</button>
    </div>
    <div class="stat lat hide" id="wlat" style="position:absolute;z-index:6;top:calc(var(--st) + 64px);inset-inline-start:14px">${ic("zap")}<span></span></div>
  </div>`;
  const stageEl = $("#ws");
  const stage = new Stage(stageEl, { muted: !P.autoSound });
  if (!P.chatOnStream) setTimeout(() => $("#wc") && $("#wc").classList.add("hide"));
  let meta = null, me = {}, myVote = null, poll = null, isFollowing = false, hostInfo = null, sawPubs = false;
  stage.onBlocked = () => {
    if ($(".tapsound", root)) return;
    const b = document.createElement("button"); b.className = "tapsound"; b.innerHTML = ic("vol") + " " + t("tapSound");
    b.onclick = () => { stage.unmute(); FX.audio(); b.remove(); };
    $("#watch").appendChild(b);
  };
  const chatEl = $("#wc");
  const chatMsgs = new Map();
  let myRole = "", timedUntil = 0;
  const addChat = (html, cls = "", fade = true, m = null) => {
    const d = document.createElement("div"); d.className = "cm " + cls; d.innerHTML = html; chatEl.appendChild(d);
    if (m && m.id) { d.dataset.id = m.id; d.dataset.uid = m.uid || ""; chatMsgs.set(m.id, m); if (chatMsgs.size > 200) chatMsgs.delete(chatMsgs.keys().next().value); }
    while (chatEl.children.length > 40) chatEl.firstChild.remove();
    if (fade) setTimeout(() => { d.classList.add("fade"); setTimeout(() => d.remove(), 1300); }, 20000);
  };
  chatEl.addEventListener("click", (e) => {
    const c = e.target.closest(".cm[data-id]"); if (!c) return;
    const m = chatMsgs.get(c.dataset.id); if (!m || !m.uid) return;
    userSheet(m, { myRole, hostId: meta && meta.host });
  });
  const chatHtml = (m) => `${roleTag(m.role)}${lvlHtml(m.lvl)}${m.sub ? `<span class="bdg bdg-sub">${eic("star")}${m.sub}</span>` : ""}${m.host ? `<span class="tag">${t("hostTag")}</span>` : m.guest ? `<span class="tag" style="background:var(--grad2)">${t("guestTag")}</span>` : ""}${uname(m)} ${m.giftId ? GIFT_E[m.giftId] + " " : ""}${esc(m.text)}`;
  const offline = (txt) => {
    $$(".wtop .badge.red").forEach((b) => (b.parentElement.style.display = "none"));
    if ($(".offline", stageEl)) return;
    const o = document.createElement("div"); o.className = "offline";
    o.innerHTML = `<div class="offic">${eic("sigoff", "violet")}</div><b style="color:#fff;font-size:18px">${txt}</b><button class="btn g" style="width:auto;padding:12px 24px;margin-top:10px">${t("back")}</button>`;
    $("button", o).onclick = () => go("home");
    stageEl.appendChild(o);
  };
  const renderPoll = () => {
    const el = $("#wpoll");
    if (!poll) return (el.innerHTML = "");
    const total = poll.votes.reduce((a, b) => a + b, 0) || 0;
    const left = Math.max(0, Math.round((poll.ends - Date.now()) / 1000));
    el.innerHTML = `<div class="poll"><div class="q">${ic("poll")} ${esc(poll.q || t("poll"))}</div>${poll.opts.map((o, i) => {
      const pct = total ? Math.round(poll.votes[i] * 100 / total) : 0;
      return `<button class="po ${myVote === i ? "me" : ""}" data-o="${i}"><i style="width:${poll.done || myVote != null ? pct : 0}%"></i><span><span>${esc(o)}</span><b>${poll.done || myVote != null ? pct + "%" : ""}</b></span></button>`;
    }).join("")}<div class="tm">${total} ${t("votes")} · ${poll.done ? t("ended") : left + t("secs")}</div></div>`;
    $$(".po", el).forEach((b) => (b.onclick = () => { if (poll.done) return; if (!S.token) return toast(terr("login")); myVote = +b.dataset.o; ws.send({ t: "vote", opt: myVote }); haptic(); renderPoll(); }));
    if (poll.done) setTimeout(() => { if (poll && poll.done) { poll = null; renderPoll(); } }, 8000);
  };
  const pollTick = setInterval(() => poll && !poll.done && renderPoll(), 1000);
  const setHype = (v, lvl) => { $("#whype i").style.height = Math.min(100, v) + "%"; $("#whl").textContent = "x" + (lvl || 1); };
  const banner = (txt) => { const b = document.createElement("div"); b.className = "banner"; b.innerHTML = txt; $("#watch").appendChild(b); setTimeout(() => b.remove(), 4200); };

  const ws = new RoomWS(id);
  ws.on((m) => {
    switch (m.t) {
      case "hello":
        me = m.me; meta = m.meta; root._rules = m.rules || {};
        if (!meta) return offline(t("offline"));
        if (meta.ended) return offline(t("endedT"));
        chatEl.innerHTML = "";
        (m.history || []).slice(-12).forEach((x) => addChat(chatHtml(x), x.hl ? "hl" : "", true, x));
        if (S.user && meta.host === S.user.id) myRole = "owner";
        stage.setPubs(m.publishers); sawPubs = sawPubs || m.publishers.length > 0;
        if (!m.publishers.length) addChat(t("pendingLive"), "sys");
        $("#wv").innerHTML = ic("eye") + " " + fmtN(m.viewers);
        poll = m.poll; renderPoll(); setHype(m.hype.v, m.hype.lvl);
        if (m.pinned) showPin(m.pinned);
        break;
      case "publishers": stage.setPubs(m.list); sawPubs = true; break;
      case "privacy": stage.setPrivacy(m.uid, m.on, m.reason); break;
      case "viewers": $("#wv").innerHTML = ic("eye") + " " + fmtN(m.n); break;
      case "chat": addChat(chatHtml(m), m.hl ? "hl" : "", true, m); break;
      case "modlog": addChat(`${eic("shield", "green")} ${modLine(m)}`, "sys"); break;
      case "delmsg": { const c = $(`.cm[data-id="${m.id}"]`, chatEl); if (c) c.remove(); break; }
      case "purge": $$(`.cm[data-uid="${m.uid}"]`, chatEl).forEach((c) => c.remove()); break;
      case "clearchat": chatEl.innerHTML = ""; addChat(`${eic("broom", "cyan")} ${t("chatCleared")}`, "sys"); break;
      case "myrole": myRole = m.role; if (m.role === "mod") toast(t("youMod")); else if (m.role === "vip") toast(t("youVip")); else if (!S.user || meta.host !== S.user.id) toast(t("youRoleOff")); haptic("success"); break;
      case "timedout": timedUntil = m.until || 0; if (timedUntil > Date.now()) toast(t("timedOutT", { t: new Date(timedUntil).toLocaleTimeString(S.lang, { hour: "2-digit", minute: "2-digit" }) })); break;
      case "kicked": ws.close && ws.close(); stage.setPubs([]); offline(m.ban ? t("bannedT") : t("kickedT")); toast(m.ban ? t("bannedT") : t("kickedT")); haptic("error"); break;
      case "loy": {
        root._loy = m; const pb = $("#wpts"); if (pb) pb.innerHTML = `${eic("star", "gold")} ${fmtN(m.points)}`;
        if (m.daily && m.gotPts) toast(t("dailyT", { s: m.streak, p: m.gotPts, x: m.gotXp }), 4500);
        break;
      }
      case "chest": {
        if ($(".chest", root)) break;
        const c = document.createElement("button"); c.className = "chest"; c.innerHTML = eic("gift", "gold"); c.title = t("chestT");
        c.onclick = () => { ws.send({ t: "claim" }); c.remove(); haptic("success"); };
        $("#watch").appendChild(c); break;
      }
      case "claimed": toast(t("claimedT", { n: m.pts })); FX.floaty($("#wfx"), "str", 10, { spread: true }); break;
      case "slevelup": sLevelUpFx(m, $("#fx")); addChat(`${eic("mic", "brand")} ${esc(t("sLevelUp", { n: m.name || "", l: m.level }))}`, "sys"); break;
      case "levelup": {
        const mine = S.user && m.uid === S.user.id;
        if (mine) { const d = document.createElement("div"); d.className = "lvup"; d.innerHTML = `<b>LV ${m.level}</b>${t("youLevel", { n: m.level })}`; $("#watch").appendChild(d); setTimeout(() => d.remove(), 3100); FX.play("confetti", null, null, $("#fx")); }
        addChat(`${eic("party", "gold")} ${uname(m)} ${t("levelUpT", { n: m.level })} ${lvlHtml(m.level)}`, "sys");
        break;
      }
      case "redeemed": banner(`${eic("star", "gold")} ${uname(m, "span")} ${t("redeemedT")}: ${esc(m.title)}${m.text ? `<br><span style="font-weight:500">${esc(m.text)}</span>` : ""}`); break;
      case "react": if (m.uid !== me.uid) FX.floaty($("#wfx"), m.e); break;
      case "effect":
        FX.play(m.id, $("#wfx"), stageEl, $("#fx"));
        addChat(`<b style="color:${esc(m.color)}">${esc(m.name)}</b>${t("sentFx")} ${m.id === "goldrain" ? eic("coin", "gold") : eic((FX.list.find((x) => x.id === m.id) || {}).e || "spark", "brand")}`, "fx");
        break;
      case "hype": setHype(m.v, m.lvl); if (m.train) { const d = document.createElement("div"); d.className = "train"; d.textContent = t("hypeTrain") + " x" + m.lvl; $("#watch").appendChild(d); setTimeout(() => d.remove(), 2700); FX.play("confetti", null, null, $("#fx")); } break;
      case "poll": if (!poll || poll.id !== m.poll.id) myVote = null; poll = m.poll; renderPoll(); break;
      case "challenges":
        if (m.changed && hostInfo) {
          const c = m.changed, hn = esc(hostInfo.name);
          if (c.state === "accepted") banner(`${eic("trophy", "gold")} ${hn} ${t("chAccepted")}<br><span style="font-weight:500">${esc(c.text)}</span>`);
          if (c.state === "done") { banner(`${eic("party", "gold")} ${hn} ${t("chDone")}`); FX.play("confetti", null, null, $("#fx")); }
          if (c.state === "failed") banner(`${eic("x", "pink")} ${hn} ${t("chFailed")}`);
        }
        root._ch = m.list;
        break;
      case "pinned": showPin(m.msg); break;
      case "gift": {
        FX.gift($("#fx"), stageEl, m.gift, m.n);
        const gb = document.createElement("div"); gb.className = "gbanner";
        gb.innerHTML = `<span class="ge">${GIFT_E[m.gift]}</span><span>${uname(m, "span")} ${t("giftSent")} ×${m.n}</span>`;
        $("#watch").appendChild(gb); setTimeout(() => gb.remove(), 3500);
        addChat(`${uname(m)} ${t("giftSent")} ${GIFT_E[m.gift]} ×${m.n}`, "fx");
        break;
      }
      case "coins": if (S.user) { S.user.coins = m.coins; store.set("user", S.user); } break;
      case "enter": grandEntrance(m, $("#fx")); break;
      case "layout": stage.mode = m.mode; stage.focus = m.focus; stage.layout(); break;
      case "guest-pending": toast(t("reqSent")); break;
      case "guest-ok":
        haptic("success");
        sheet(`<div style="text-align:center"><div class="bigic">${eic("game", "brand")}</div><h3 style="margin-top:6px">${esc(t("invited", { n: m.host }))}</h3><p class="mut" style="margin-bottom:16px">${esc(m.title)}</p></div>
          <button class="btn p" id="gj">${ic("live")} ${t("joinNow")}</button><button class="btn g" style="margin-top:8px" id="gl">${t("later")}</button>`,
          (sh, close) => { $("#gj", sh).onclick = () => { close(); go("golive", { joinRoom: id, hostName: m.host }); }; $("#gl", sh).onclick = close; });
        break;
      case "guest-no": toast(t("declined")); break;
      case "ended": offline(t("endedT")); stage.setPubs([]); break;
      case "err": toast(terr(m.e)); break;
    }
  });
  const showPin = (msg) => { const el = $("#wpin"); if (!msg) return el.classList.add("hide"); el.classList.remove("hide"); el.innerHTML = ic("pin") + `<span><b style="color:${esc(msg.color)}">${esc(msg.name)}</b> ${esc(msg.text)}</span>`; };

  // header info
  api("/api/stream/" + id).then((r) => {
    const s = r.stream;
    if (!s) return offline(t("offline"));
    hostInfo = s.host;
    $("#wav").outerHTML = avatar(s.host, "md");
    $("#wn").innerHTML = uname(s.host, "span");
    $("#wg").innerHTML = (s.game ? gIcon(s.gameIcon) + esc(s.game) + " · " : "") + esc(s.title);
    if (S.user && S.user.id !== s.uid) {
      isFollowing = S.following.has(s.uid);
      const fb = $("#wf"); fb.classList.remove("hide");
      const upd = () => { fb.textContent = isFollowing ? t("unfollow") : t("follow"); fb.classList.toggle("on", isFollowing); };
      upd();
      fb.onclick = async () => { isFollowing = !isFollowing; upd(); haptic(); await api("/api/follow", { target: s.uid, on: isFollowing }); isFollowing ? S.following.add(s.uid) : S.following.delete(s.uid); };
    }
    $("#wh").onclick = () => go("user", s.host.handle);
    if (S.user && S.user.id !== s.uid) {
      const sb = $("#wsub"); sb.classList.remove("hide");
      const paint = (sub) => { sb.textContent = sub ? t("subscribed", { n: sub.months }) : t("subscribe"); sb.classList.toggle("on", !!sub); };
      api("/api/user/" + encodeURIComponent(s.host.handle)).then((r) => paint(r.mySub));
      sb.onclick = () => subSheet(s.host, paint);
    }
  });

  // stats
  const latEl = $("#wlat");
  const statT = setInterval(async () => {
    const s = await stage.sub.stats();
    if (s && s.fps && P.showLat) { latEl.classList.remove("hide"); $("span", latEl).textContent = `${s.delay.toFixed(1)}s · ${Math.round(s.fps)}fps`; }
  }, 2000);

  // input
  const send = () => {
    const i = $("#wi"); const v = i.value.trim(); if (!v) return;
    if (!S.token) return toast(terr("login"));
    ws.send({ t: "chat", text: v }); i.value = ""; haptic();
  };
  $("#wsend").onclick = send;
  $("#wi").onkeydown = (e) => { if (e.key === "Enter") send(); };
  $("#wx").onclick = () => go("home");
  let lastR = 0;
  $("#wr").onclick = () => { const e = ["hrt", "fir", "str", "blt", "crn", "gg"][Math.random() * 6 | 0]; FX.floaty($("#wfx"), e); if (Date.now() - lastR > 250) { ws.send({ t: "react", e }); lastR = Date.now(); } haptic(); FX.audio(); };
  $("#wpts").onclick = () => { if (!S.token) return toast(terr("login")); pointsSheet(root._loy, hostInfo, (id, text) => ws.send({ t: "redeem", id, text })); };
  $("#wgf").onclick = () => { FX.audio(); if (!S.token) return toast(terr("login")); giftSheet((g, n) => ws.send({ t: "gift", gift: g, n })); };
  $("#we").onclick = () => {
    FX.audio();
    sheet(`<h3>${t("react")}</h3><div class="emoji">${Object.keys(REACT).map((e) => `<button data-e="${e}">${eic(REACT[e][0], REACT[e][1])}</button>`).join("")}</div>
      <h3>${t("effects")}</h3><div class="fxgrid">${FX.list.map((f) => { const lock = f.shop && !((S.user && S.user.look && S.user.look.fx) || []).includes(f.id); return `<button class="fxb ${f.shop ? "fxs" : ""} ${lock ? "lock" : ""}" data-fx="${f.id}" ${f.vip ? 'style="border-color:rgba(255,215,0,.5)"' : ""}>${eic(f.e, f.vip ? "gold" : f.shop ? "violet" : "brand")}<small>${f.vip ? "VIP · " : ""}${S.lang === "ar" ? f.ar : f.en}</small>${lock ? `<i class="lk">${ic("lock")}</i>` : ""}</button>`; }).join("")}</div>
      <button class="btn g" style="margin-top:16px" id="sch">${ic("trophy")} ${t("challenge")}</button>`,
      (sh, close) => {
        $$("[data-e]", sh).forEach((b) => (b.onclick = () => { FX.floaty($("#wfx"), b.dataset.e, 3); ws.send({ t: "react", e: b.dataset.e }); haptic(); }));
        $$("[data-fx]", sh).forEach((b) => (b.onclick = () => {
          if (!S.token) return toast(terr("login"));
          const f = FX.list.find((x) => x.id === b.dataset.fx);
          if (f && f.vip && !(S.user && S.user.look && S.user.look.vip)) { close(); return toast(t("vipOnly")); }
          if (b.classList.contains("lock")) { close(); toast(t("fxLocked")); return go("wallet", { tab: "fxs" }); }
          ws.send({ t: "effect", id: b.dataset.fx }); haptic("medium"); close();
        }));
        $("#sch", sh).onclick = () => { close(); challengeSheet(); };
      });
  };
  const challengeSheet = () => {
    const list = root._ch || [];
    sheet(`<h3>${ic("trophy")} ${t("challenges")}</h3>
      <div class="row"><input class="inp" id="chi" placeholder="${t("challengePh")}" maxlength="90"><button class="btn p" style="width:auto;padding:15px 18px" id="chs">${ic("send")}</button></div>
      <div id="chl">${list.length ? list.map((c) => `<div class="chl"><div class="row"><b style="color:${esc(c.color)};font-size:13px">${esc(c.name)}</b><span class="sp"></span><span class="st ${c.state}">${c.state === "new" ? eic("fire", "fire") + " " + c.up : t(c.state === "accepted" ? "accept" : c.state)}</span></div>
        <div style="margin-top:6px;font-size:15px">${esc(c.text)}</div>${c.state === "new" ? `<button class="mini" style="margin-top:8px" data-up="${c.id}">+1 ${eic("fire", "fire")}</button>` : ""}</div>`).join("") : `<p class="mut" style="padding:20px;text-align:center">${t("noCh")}</p>`}</div>`,
      (sh, close) => {
        $("#chs", sh).onclick = () => { const v = $("#chi", sh).value.trim(); if (!v) return; if (!S.token) return toast(terr("login")); ws.send({ t: "challenge", text: v }); haptic("success"); close(); };
        $$("[data-up]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "ch-up", id: b.dataset.up }); b.remove(); }));
      });
  };
  $("#wm").onclick = () => {
    sheet(`<div class="tile" style="padding:6px 14px">
      <div class="tg" id="mco"><div class="ic">${ic("users")}</div><div class="tx"><b>${t("reqJoin")}</b><span>${t("costream")}</span></div></div>
      <div class="tg" id="mch"><div class="ic">${ic("trophy")}</div><div class="tx"><b>${t("challenges")}</b></div></div>
      <div class="tg" id="mly"><div class="ic">${ic("grid")}</div><div class="tx"><b>${stage.mode === "split" ? t("layoutFocus") : t("layoutSplit")}</b></div></div>
      <div class="tg" id="msnd"><div class="ic">${ic("vol")}</div><div class="tx"><b>${t("sound")}</b></div></div>
      <div class="tg" id="msh"><div class="ic">${ic("share")}</div><div class="tx"><b>${t("share")}</b></div></div></div>`,
      (sh, close) => {
        $("#mco", sh).onclick = () => { close(); if (!S.token) return toast(terr("login")); ws.send({ t: "guest-req" }); };
        $("#mch", sh).onclick = () => { close(); challengeSheet(); };
        $("#mly", sh).onclick = () => { close(); stage.mode = stage.mode === "split" ? "focus" : "split"; stage.layout(); };
        $("#msnd", sh).onclick = () => { close(); stage.unmute(); FX.audio(); };
        $("#msh", sh).onclick = () => { close(); shareLink(location.origin + "/w/" + id, hostInfo ? hostInfo.name : ""); };
      });
  };
  return () => { clearInterval(statT); clearInterval(pollTick); ws.close(); stage.destroy(); };
};
function shareLink(url, text) {
  if (Native.has()) return Native.post("share", { url, text });
  if (navigator.share) return navigator.share({ url, text }).catch(() => {});
  navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast(t("copied")));
}

/* ---------- go live ---------- */
VIEWS.golive = (root, arg = {}) => {
  if (!S.token) { toast(terr("auth")); return go("auth"); }
  const joining = !!arg.joinRoom;
  const cfg = Object.assign({ title: "", game: "", gameIcon: "", gameId: "", gamePkg: "", autoLaunch: true, cat: "action", quality: "720", fps: 30, mic: true, privacy: { dnd: true, callGuard: true, bannerGuard: true } }, store.get("golive", {}));
  cfg.privacy = Object.assign({ dnd: true, callGuard: true, bannerGuard: true }, cfg.privacy || {});
  const nat = Native.has();
  const webCap = !nat && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && !/iphone|ipad|android/i.test(navigator.userAgent);
  const sw = (k, on) => `<div class="sw ${on ? "on" : ""}" data-sw="${k}"></div>`;
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="gb">${ic("back")}</button><div class="h1">${joining ? t("costream") : t("goLive")}</div></div>
  <div class="scroll" style="padding-bottom:calc(30px + var(--sb))">
    ${joining ? `<div class="tile" style="text-align:center"><div class="bigic">${eic("users", "brand")}</div><b>${esc(t("invited", { n: arg.hostName || "" }))}</b></div>` : `
    <div class="field"><label>${t("title")}</label><input class="inp" id="gt" maxlength="80" placeholder="${t("titlePh")}" value="${esc(cfg.title)}"></div>
    <div class="field"><label>${t("game")}</label><button class="gpick" id="gg"></button></div>
    <div class="field"><label>${t("cat")}</label><div class="chips" id="gc">${CATS.slice(1).map((c) => `<button class="chip ${cfg.cat === c ? "on" : ""}" data-c="${c}">${CAT_EMO[c]} ${t(c)}</button>`).join("")}</div></div>`}
    <div class="row" style="gap:12px;margin-top:6px">
      <div style="flex:1"><label class="small mut" style="display:block;margin:0 4px 7px">${t("quality")}</label><div class="seg" id="gq">${["540", "720", "1080"].map((q) => `<button class="${cfg.quality === q ? "on" : ""}" data-q="${q}">${q}p</button>`).join("")}</div></div>
      <div style="width:120px"><label class="small mut" style="display:block;margin:0 4px 7px">${t("fps")}</label><div class="seg" id="gf">${[30, 60].map((f) => `<button class="${cfg.fps === f ? "on" : ""}" data-f="${f}">${f}</button>`).join("")}</div></div>
    </div>
    <div class="tile" style="padding:4px 14px;margin-top:14px">
      <div class="tg"><div class="ic">${ic("mic")}</div><div class="tx"><b>${t("mic")}</b><span>${t("micD")}</span></div>${sw("mic", cfg.mic)}</div>
      ${nat && !joining ? `<div class="tg"><div class="ic">${ic("game")}</div><div class="tx"><b>${t("autoLaunch")}</b><span>${t("autoLaunchD")}</span></div>${sw("autoLaunch", cfg.autoLaunch)}</div>` : ""}
      ${!joining ? (S.user && S.user.yt ? `<div class="tg"><div class="ic ytic">▶</div><div class="tx"><b>${t("ytAlso")}</b><span>${t("ytAlsoD")}</span></div>${sw("youtube", cfg.youtube)}</div>`
        : `<div class="tg" id="gyt"><div class="ic ytic">▶</div><div class="tx"><b>${t("ytAdd")}</b><span>${t("ytAlsoD")}</span></div><span class="mut">›</span></div>`) : ""}
    </div>
    <div class="h2">${ic("shield")} ${t("privacy")}</div>
    <div class="tile" style="padding:4px 14px">
      ${isAndroid() || !nat ? `<div class="tg"><div class="ic">${ic("bell")}</div><div class="tx"><b>${t("dnd")}</b><span>${t("dndD")}</span></div>${sw("dnd", cfg.privacy.dnd)}</div>` : ""}
      <div class="tg"><div class="ic">${ic("phone")}</div><div class="tx"><b>${t("callG")}</b><span>${t("callGD")}</span></div>${sw("callGuard", cfg.privacy.callGuard)}</div>
      ${isIOS() || !nat ? `<div class="tg"><div class="ic">${ic("eye")}</div><div class="tx"><b>${t("bannerG")}</b><span>${t("bannerGD")}</span></div>${sw("bannerGuard", cfg.privacy.bannerGuard)}</div>` : ""}
      ${isAndroid() ? `<div class="tg"><div class="ic">${ic("lock")}</div><div class="tx"><b>${t("appOnly")}</b><span>${t("appOnlyD")}</span></div></div>` : ""}
      ${isIOS() ? `<div class="tg" id="gfg"><div class="ic">${ic("bell")}</div><div class="tx"><b>${t("focusGuide")}</b></div><span class="mut">›</span></div>` : ""}
    </div>
    <button class="btn g" id="gspd" style="margin-top:14px">${ic("gauge")} ${t("speedTest")}</button>
    <button class="btn p" id="gs" style="margin-top:10px">${ic("live")} ${nat ? t("start") : webCap ? t("browserLive") : t("start")}</button>
    ${!nat && !webCap ? `<p class="mut small" style="text-align:center;margin-top:10px">${t("needApp")}</p>` : ""}
  </div></div>`;
  $("#gb").onclick = () => go("home");
  $("#gspd").onclick = () => go("speed");
  if (!joining) {
    const showGame = () => {
      $("#gg").innerHTML = (cfg.gameIcon || cfg.gameIconData ? gIcon(cfg.gameIcon || cfg.gameIconData) : `<div class="ph2">${eic("game", "brand")}</div>`) +
        `<div style="flex:1;min-width:0"><b style="display:block;font-size:16px">${esc(cfg.game || t("pickGame"))}</b><span class="mut small">${cfg.game ? t("change") : t("searchGames")}</span></div><span class="mut">›</span>`;
    };
    showGame();
    $("#gg").onclick = () => gamePicker((g) => {
      cfg.game = g.name || ""; cfg.gameIcon = g.icon || ""; cfg.gameIconData = g.iconData || ""; cfg.gameId = g.id || ""; cfg.gamePkg = g.pkg || "";
      if (!cfg.gamePkg && Games.phone) { const n = (x) => x.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, ""); const m = Games.phone.find((p) => n(p.name) && (n(p.name).includes(n(g.name).slice(0, 8)) || n(g.name).includes(n(p.name)))); if (m) cfg.gamePkg = m.pkg; }
      showGame();
    });
    $$("#gc .chip").forEach((b) => (b.onclick = () => { cfg.cat = b.dataset.c; $$("#gc .chip").forEach((x) => x.classList.toggle("on", x === b)); }));
  }
  $$("#gq button").forEach((b) => (b.onclick = () => { cfg.quality = b.dataset.q; $$("#gq button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("#gf button").forEach((b) => (b.onclick = () => { cfg.fps = +b.dataset.f; $$("#gf button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("[data-sw]").forEach((s) => (s.onclick = () => {
    const k = s.dataset.sw; s.classList.toggle("on"); const on = s.classList.contains("on"); haptic();
    if (k === "mic") cfg.mic = on; else if (k === "autoLaunch") cfg.autoLaunch = on; else if (k === "youtube") cfg.youtube = on; else cfg.privacy[k] = on;
    if (k === "dnd" && on && isAndroid()) Native.post("perm", { kind: "dnd" });
  }));
  const fg = $("#gfg"); if (fg) fg.onclick = focusGuide;
  const gy = $("#gyt"); if (gy) gy.onclick = () => ytSheet(() => { cfg.youtube = true; store.set("golive", { ...cfg, gameIconData: "" }); go("golive", arg); });
  $("#gs").onclick = async () => {
    if (!joining) cfg.title = $("#gt").value.trim();
    store.set("golive", { ...cfg, gameIconData: "" });
    if (!nat && !webCap) return toast(t("needApp"));
    const b = $("#gs"); b.disabled = true;
    const r = await api("/api/go-live", { ...cfg, youtube: !joining && !!cfg.youtube && !!(S.user && S.user.yt), gameIconData: cfg.gameIconData || undefined, joinRoom: arg.joinRoom, device: S.native && S.native.device });
    b.disabled = false;
    if (r.error) return toast(terr(r.error));
    S.live = { ...r.job, title: cfg.title, game: cfg.game, startedAt: Date.now(), launch: !joining && cfg.autoLaunch && cfg.game ? { name: cfg.game, pkg: cfg.gamePkg, appId: cfg.gameId } : null };
    haptic("success");
    if (nat) {
      S.bstate = "starting";
      Native.post("startBroadcast", { ...r.job, server: location.origin, token: S.token, title: cfg.title });
      go("studio");
    } else {
      // desktop browser streaming
      try {
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: cfg.fps, height: +cfg.quality }, audio: true });
        const tracks = [{ track: scr.getVideoTracks()[0], role: "screen" }];
        if (scr.getAudioTracks()[0]) tracks.push({ track: scr.getAudioTracks()[0], role: "audio" });
        if (cfg.mic) { try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); tracks.push({ track: m.getAudioTracks()[0], role: "mic" }); } catch (e) {} }
        const pub = new Pub(); await pub.start(tracks, r.job);
        S.webPub = pub; S.bstate = "live";
        scr.getVideoTracks()[0].onended = () => endLive();
        go("studio");
      } catch (e) {
        console.warn(e); toast(String(e.message || e.error || e)); api("/api/end", { room: r.job.room, pub: r.job.pub });
      }
    }
  };
};
function focusGuide() {
  sheet(`<h3>${ic("bell")} ${t("focusGuide")}</h3><div class="tile" style="line-height:1.9;font-size:14.5px">${t("focusSteps")}</div>
    <button class="btn p" id="fgo">${t("openShortcuts")}</button>`, (sh, close) => { $("#fgo", sh).onclick = () => { close(); Native.post("open", { url: "shortcuts://create-automation" }); }; });
}
async function endLive() {
  const job = S.live;
  if (!job) return;
  Native.post("stopBroadcast", {});
  if (S.webPub) { S.webPub.stop(); S.webPub = null; }
  await api("/api/end", { room: job.room, pub: job.pub });
  S.live = null; S.bstate = "idle";
  if (current === "studio") go("home");
}

/* ---------- studio (streamer dashboard) ---------- */
VIEWS.studio = (root) => {
  const job = S.live;
  if (!job) return go("home");
  const nat = Native.has();
  const st = { viewers: 0, peak: 0, hype: 0, lvl: 1, chat: [], reqs: [], ch: [], guests: [], pubs: [], privacy: false, overlay: store.get("overlay", true), cam: false, poll: null };
  root.innerHTML = `<div class="view"><div class="top"><div class="brand" style="font-size:20px"><span class="badge red" id="sb">LIVE</span><span id="slv" style="margin-inline-start:8px">${S.user && S.user.streamer ? sLvlHtml(S.user.streamer.level) + (S.user.streamer.top ? " " + topHtml(S.user.streamer.top) : "") : ""}</span></div><div class="sp"></div>
    <button class="ibtn" id="ssh">${ic("share")}</button><button class="ibtn" id="sx" style="color:#ff7b88">${ic("stop")}</button></div>
  <div class="scroll" style="padding-bottom:calc(30px + var(--sb))">
    <div class="lvcard"><div class="row"><div><div class="small" style="color:#d6d1ee">${t("liveFor")}</div><div class="big" id="sd">0:00</div></div><div class="sp"></div>
      <div style="text-align:end"><div class="small" style="color:#d6d1ee" id="sst">${t("starting")}</div>${job.rec && job.save !== false ? `<div class="small" style="color:#ff7b88;margin-top:3px">● ${t("recording")}</div>` : ""}<div style="font-weight:700;margin-top:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(job.title || "")}</div></div></div>
      <div class="kpis"><div class="kpi"><b id="kv">0</b><span>${t("viewers")}</span></div><div class="kpi"><b id="kp">0</b><span>${t("peak")}</span></div><div class="kpi"><b id="kh">x1</b><span>${t("hypeLvl")}</span></div></div>
    </div>
    <div id="shint"></div>
    ${job.yt ? `<div class="ytst" id="syt"><span class="ytic">▶</span><span id="sytT">${t("ytWait")}</span></div>` : ""}
    <div class="shield" id="sshield"><div class="ic">${ic("shield")}</div><div style="flex:1"><b id="sshT">${t("shieldOn")}</b><div class="small mut" id="sshD"></div></div></div>
    <div class="acts">
      <button class="act ${st.overlay ? "on" : ""}" id="aov">${ic("chat")}<span>${t("overlay")}</span></button>
      <button class="act" id="acam">${ic("cam")}<span>${t("camBubble")}</span></button>
      <button class="act" id="apoll">${ic("poll")}<span>${t("poll")}</span></button>
      <button class="act" id="ach">${ic("trophy")}<span>${t("challenges")}</span></button>
      <button class="act" id="areq">${ic("users")}<span>${t("costream")}</span></button>
      <button class="act" id="apv">${ic("eye")}<span>${t("preview")}</span></button>
      <button class="act" id="arw">${eic("star", "gold")}<span>${t("rewards")}</span></button>
      ${job.role === "host" ? `<button class="act" id="amod">${MOD_SVG.replace("<svg", '<svg width="22" height="22" fill="currentColor"')}<span>${t("modT")}</span></button>` : ""}
      <button class="act" id="aend" style="color:#ff7b88">${ic("stop")}<span>${t("end")}</span></button>
    </div>
    <div class="prev hide" id="spv"><div class="stage" id="spvs" style="position:absolute;inset:0"></div></div>
    <div class="h2">${ic("chat")} ${t("chatTitle")}</div>
    <div class="row" style="margin-bottom:8px"><div class="cin" style="background:var(--card)"><input id="si" placeholder="${t("chatPh")}" maxlength="200"><button class="rbtn" id="ssend" style="width:36px;height:36px;background:none">${ic("send")}</button></div></div>
    <div class="sl" id="sl"><p class="mut" style="text-align:center;padding:20px">${t("noChat")}</p></div>
  </div></div>`;
  if (job.role === "guest") { $("#apoll").classList.add("hide"); $("#ach").classList.add("hide"); $("#areq").classList.add("hide"); }
  if (!isAndroid()) $("#acam").onclick = () => toast(t("camNA"));
  const dot = (el, n) => { let d = $(".dot", el); if (!n) return d && d.remove(); if (!d) { d = document.createElement("span"); d.className = "dot"; el.appendChild(d); } d.textContent = n; };
  const ws = new RoomWS(job.room, { pub: true });
  let previewStage = null;
  const renderChat = () => {
    const el = $("#sl");
    if (!st.chat.length) return;
    el.innerHTML = st.chat.slice(-60).reverse().map((m) => m.sys ? `<div class="sm small mut" style="justify-content:center">${m.sys}</div>` : `<div class="sm">${avatar(m)}<div class="tx">${roleTag(m.role)}${uname(m)}<br>${m.giftId ? GIFT_E[m.giftId] + " " : ""}${esc(m.text)}</div>
      ${job.role === "host" && m.uid !== S.user.id ? `<button class="mini" data-mod="${m.id}">${MOD_SVG.replace("<svg", '<svg width="16" height="16" fill="currentColor"')}</button><button class="mini" data-pin="${m.id}">${ic("pin")}</button><button class="mini" data-inv="${m.uid}" data-n="${esc(m.name)}">${ic("users")}</button>` : ""}</div>`).join("");
    $$("[data-pin]", el).forEach((b) => (b.onclick = () => { ws.send({ t: "pin", id: b.dataset.pin }); toast(t("pin") + " ✓"); }));
    $$("[data-mod]", el).forEach((b) => (b.onclick = () => { const m = st.chat.find((x) => x.id === b.dataset.mod); if (m) userSheet(m, { myRole: "owner", hostId: S.user.id }); }));
    $$("[data-inv]", el).forEach((b) => (b.onclick = () => confirmBox(t("invite") + ": " + b.dataset.n + "؟", () => ws.send({ t: "guest-invite", uid: b.dataset.inv }))));
  };
  const setShield = () => {
    const sh = $("#sshield");
    sh.classList.toggle("warn", st.privacy);
    $("#sshT").textContent = st.privacy ? t("shieldPaused") : t("shieldOn");
    const p = job.privacy || {};
    $("#sshD").textContent = [isAndroid() && p.dnd ? t("dnd") : "", p.callGuard ? t("callG") : "", isIOS() && p.bannerGuard ? t("bannerG") : ""].filter(Boolean).join(" · ") || t("shieldOff");
  };
  setShield();
  const ytPaint = (y) => { const e = $("#syt"); if (!e) return; e.classList.toggle("ok", !!y.ok); e.classList.toggle("bad", !y.ok); $("#sytT").textContent = y.ok ? t("ytOn") : t("ytErr", { c: y.code || "net" }); };
  ws.on((m) => {
    switch (m.t) {
      case "yt": ytPaint(m); break;
      case "slevel": { const e = $("#slv"); if (e) e.innerHTML = sLvlHtml(m.level) + (m.top ? " " + topHtml(m.top) : ""); break; }
      case "slevelup": sLevelUpFx(m, null); break;
      case "hello":
        if (m.yt) ytPaint(m.yt);
        st.chat = m.history || []; renderChat(); st.viewers = m.viewers; st.pubs = m.publishers || [];
        if (m.requests) { st.reqs = m.requests; dot($("#areq"), st.reqs.length); }
        if (m.redeems) { st.redeems = m.redeems; dot($("#arw"), m.redeems.filter((x) => x.state === "new").length); }
        st.ch = m.challenges || []; dot($("#ach"), st.ch.filter((c) => c.state === "new").length);
        st.hype = m.hype.v; st.lvl = m.hype.lvl; st.guests = m.guests || []; st.poll = m.poll;
        upd(); if (st.pubs.find((p) => p.uid === S.user.id)) setState("live");
        if (m.meta && m.meta.ended) { toast(t("endedT")); endLive(); }
        break;
      case "chat": st.chat.push(m); renderChat(); break;
      case "modlog": st.chat.push({ sys: eic("shield", "green") + " " + modLine(m), id: "s" + m.at }); renderChat(); break;
      case "delmsg": st.chat = st.chat.filter((x) => x.id !== m.id); renderChat(); break;
      case "purge": st.chat = st.chat.filter((x) => x.uid !== m.uid); renderChat(); break;
      case "clearchat": st.chat = []; $("#sl").innerHTML = ""; break;
      case "viewers": st.viewers = m.n; st.peak = Math.max(st.peak, m.n); upd(); break;
      case "hype": st.hype = m.v; st.lvl = m.lvl; upd(); if (m.train) haptic("success"); break;
      case "requests": st.reqs = m.list; dot($("#areq"), st.reqs.length); if (m.list.length) haptic(); break;
      case "challenges": st.ch = m.list; dot($("#ach"), st.ch.filter((c) => c.state === "new").length); break;
      case "guests": st.guests = m.list; break;
      case "poll": st.poll = m.poll; break;
      case "publishers": st.pubs = m.list; if (m.list.find((p) => p.uid === S.user.id)) setState("live"); previewStage && previewStage.setPubs(m.list);
        if (nat) Native.post("voice", { room: job.room, pub: job.pub, server: location.origin, publishers: m.list, me: S.user.id });
        break;
      case "privacy": if (m.uid === S.user.id) { st.privacy = m.on && m.reason !== "app"; setShield(); } previewStage && previewStage.setPrivacy(m.uid, m.on, m.reason); break;
      case "effect": haptic("medium"); break;
      case "enter": grandEntrance(m, null); haptic("success"); break;
      case "redeems": st.redeems = m.list; dot($("#arw"), m.list.filter((x) => x.state === "new").length); if (m.list.some((x) => x.state === "new")) haptic(); break;
      case "gift": haptic("success"); toast(`${GIFT_E[m.gift]} ${uname(m, "span")} ${t("giftSent")} ×${m.n} · +${Math.floor(m.value * 0.7)} ${eic("coin", "gold")}`, 4000); st.chat.push({ uid: m.uid, name: m.name, color: m.color, look: m.look, text: `×${m.n}`, giftId: m.gift }); renderChat(); break;
      case "bstatus": if (m.uid === S.user.id && m.msg) { toast(esc(m.msg), 6000); if (m.state === "error") setState("error"); } break;
      case "kicked": case "ended": endLive(); break;
      case "err": toast(terr(m.e)); break;
    }
  });
  const upd = () => { $("#kv").textContent = fmtN(st.viewers); st.peak = Math.max(st.peak, st.viewers); $("#kp").textContent = fmtN(st.peak); $("#kh").textContent = "x" + st.lvl; };
  const setState = (s) => {
    S.bstate = s;
    $("#sst").textContent = s === "live" ? "● " + t("onAir") : s === "stopped" ? t("stopped") : s === "error" ? t("errorT") : t("starting");
    $("#sst").style.color = s === "live" ? "var(--ok)" : "";
    const hint = $("#shint");
    if (s === "starting" && isIOS()) {
      hint.innerHTML = `<div class="shield warn"><div class="ic">${ic("live")}</div><div style="flex:1"><b>${t("tapStart")}</b></div><button class="mini p" id="sre">${t("reopen")}</button></div>`;
      $("#sre").onclick = () => Native.post("startBroadcast", { ...job, server: location.origin, token: S.token, reopen: true });
    } else hint.innerHTML = "";
  };
  setState(S.bstate === "live" ? "live" : "starting");
  const off = Native.on((e) => {
    if (e.type === "broadcast") {
      setState(e.state);
      if ((e.state === "live" || e.state === "connecting") && job.launch && !job.launched) {
        job.launched = true; S.live.launched = true;
        toast(t("openingGame"));
        setTimeout(() => Native.post("launchGame", job.launch), 900);
      }
      if (e.error) toast(esc(e.error), 4000);
      if (e.state === "stopped") { api("/api/end", { room: job.room, pub: job.pub }); S.live = null; setTimeout(() => current === "studio" && go("home"), 1500); }
    }
    if (e.type === "privacy") { st.privacy = e.on; setShield(); }
    if (e.type === "launch" && !e.ok) toast(t("openGameNow", { g: esc(e.name || t("game")) }), 7000);
    if (e.type === "overlay") { st.overlay = e.on; $("#aov").classList.toggle("on", e.on); }
    if (e.type === "cam") { st.cam = e.on; $("#acam").classList.toggle("on", e.on); }
  });
  if (nat && st.overlay) setTimeout(() => Native.post("overlay", { on: true, room: job.room, token: S.token, server: location.origin }), 1200);
  const timer = setInterval(() => ($("#sd").textContent = fmtDur(Date.now() - job.startedAt)), 1000);
  const send = () => { const i = $("#si"); const v = i.value.trim(); if (!v) return; ws.send({ t: "chat", text: v }); i.value = ""; };
  $("#ssend").onclick = send; $("#si").onkeydown = (e) => { if (e.key === "Enter") send(); };
  const askEnd = () => confirmBox(t("endQ"), endLive);
  $("#sx").onclick = askEnd; $("#aend").onclick = askEnd;
  $("#ssh").onclick = () => shareLink(location.origin + "/w/" + job.room, job.title);
  $("#aov").onclick = () => { st.overlay = !st.overlay; store.set("overlay", st.overlay); $("#aov").classList.toggle("on", st.overlay); haptic(); Native.post("overlay", { on: st.overlay, room: job.room, token: S.token, server: location.origin }); };
  if (isAndroid()) $("#acam").onclick = () => { st.cam = !st.cam; $("#acam").classList.toggle("on", st.cam); haptic(); Native.post("camBubble", { on: st.cam }); };
  $("#arw").onclick = () => rewardsSheet(st, ws);
  { const am = $("#amod"); if (am) am.onclick = () => modsManager(S.user.id); }
  $("#apv").onclick = () => {
    const el = $("#spv"); const on = el.classList.toggle("hide") === false; $("#apv").classList.toggle("on", on);
    if (on) { previewStage = new Stage($("#spvs"), { muted: true }); previewStage.setPubs(st.pubs); } else if (previewStage) { previewStage.destroy(); previewStage = null; }
  };
  $("#apoll").onclick = () => {
    if (st.poll && !st.poll.done) {
      const total = st.poll.votes.reduce((a, b) => a + b, 0);
      return sheet(`<h3>${ic("poll")} ${esc(st.poll.q)}</h3>${st.poll.opts.map((o, i) => `<div class="po"><i style="width:${total ? st.poll.votes[i] * 100 / total : 0}%"></i><span><span>${esc(o)}</span><b>${st.poll.votes[i]}</b></span></div>`).join("")}
        <button class="btn d" style="margin-top:14px" id="pe">${t("endPoll")}</button>`, (sh, close) => { $("#pe", sh).onclick = () => { ws.send({ t: "endpoll" }); close(); }; });
    }
    sheet(`<h3>${ic("poll")} ${t("newPoll")}</h3><div class="field"><input class="inp" id="pq" placeholder="${t("question")}" maxlength="100"></div>
      ${[1, 2, 3, 4].map((i) => `<div class="field"><input class="inp" data-po placeholder="${t("option")} ${i}" maxlength="40"></div>`).join("")}
      <div class="seg" id="pd">${[30, 60, 120].map((s) => `<button class="${s === 60 ? "on" : ""}" data-s="${s}">${s}${t("secs")}</button>`).join("")}</div>
      <button class="btn p" style="margin-top:14px" id="ps">${t("startPoll")}</button>`,
      (sh, close) => {
        let secs = 60;
        $$("#pd button", sh).forEach((b) => (b.onclick = () => { secs = +b.dataset.s; $$("#pd button", sh).forEach((x) => x.classList.toggle("on", x === b)); }));
        $("#ps", sh).onclick = () => { const opts = $$("[data-po]", sh).map((i) => i.value.trim()).filter(Boolean); if (opts.length < 2) return toast(t("option") + " ×2"); ws.send({ t: "poll", q: $("#pq", sh).value.trim(), opts, secs }); haptic("success"); close(); };
      });
  };
  $("#ach").onclick = () => {
    const render = (sh, close) => {
      $("#chlist", sh).innerHTML = st.ch.length ? st.ch.map((c) => `<div class="chl"><div class="row"><b style="color:${esc(c.color)};font-size:13px">${esc(c.name)}</b><span class="sp"></span><span class="st ${c.state}">${c.state === "new" ? eic("fire", "fire") + " " + c.up : t(c.state === "accepted" ? "accept" : c.state)}</span></div>
        <div style="margin:6px 0 8px;font-size:15px">${esc(c.text)}</div><div class="row">${c.state === "new" ? `<button class="mini p" data-s="accepted" data-id="${c.id}">${t("accept")}</button><button class="mini" data-s="rejected" data-id="${c.id}">${t("reject")}</button>` : c.state === "accepted" ? `<button class="mini p" data-s="done" data-id="${c.id}">${t("done")}</button><button class="mini" data-s="failed" data-id="${c.id}">${t("failed")}</button>` : ""}</div></div>`).join("") : `<p class="mut" style="padding:20px;text-align:center">${t("noCh")}</p>`;
      $$("[data-s]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "ch-set", id: b.dataset.id, state: b.dataset.s }); const c = st.ch.find((x) => x.id === b.dataset.id); if (c) c.state = b.dataset.s; haptic("success"); render(sh, close); }));
    };
    sheet(`<h3>${ic("trophy")} ${t("challenges")}</h3><div id="chlist"></div>`, render);
  };
  $("#areq").onclick = () => {
    sheet(`<h3>${ic("users")} ${t("requests")}</h3><div id="rq"></div>`, (sh) => {
      const r = () => {
        $("#rq", sh).innerHTML = st.reqs.length ? st.reqs.map((q) => `<div class="sm" style="align-items:center">${avatar(q, "md")}<div class="tx"><b>${esc(q.name)}</b><br><span class="mut small">@${esc(q.handle)}</span></div>
          <button class="mini p" data-ok="${q.uid}">${t("approve")}</button><button class="mini" data-no="${q.uid}">${t("deny")}</button></div>`).join("") : `<p class="mut" style="padding:20px;text-align:center">${t("noReq")}</p>`;
        $$("[data-ok]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "guest-invite", uid: b.dataset.ok }); st.reqs = st.reqs.filter((x) => x.uid !== b.dataset.ok); r(); }));
        $$("[data-no]", sh).forEach((b) => (b.onclick = () => { ws.send({ t: "guest-deny", uid: b.dataset.no }); st.reqs = st.reqs.filter((x) => x.uid !== b.dataset.no); r(); }));
      };
      r();
    });
  };
  return () => { off(); clearInterval(timer); ws.close(); previewStage && previewStage.destroy(); };
};

/* ---------- profiles ---------- */
function streamerCard(st, self) {
  if (!st) return "";
  const pct = st.next > st.cur ? Math.min(100, ((st.xp - st.cur) / (st.next - st.cur)) * 100) : 100;
  return `<div class="scard ${st.top ? "top" + st.top : ""}" data-go-ranks="1">
    ${st.top ? `<div class="stop">${MEDAL[st.top]} ${self ? t("topYou", { n: st.top }) : "TOP " + st.top + " · " + t("rankMonth")}</div>` : ""}
    <div class="row" style="gap:10px"><div style="flex:1;text-align:start"><div class="small mut">${t("sLevel")}</div><div style="margin-top:4px">${sLvlHtml(st.level)}</div></div>
      <div class="srk"><b>${st.mrank ? "#" + st.mrank : "–"}</b><span>${t("sRankM")}</span></div><div class="srk"><b>${st.rank ? "#" + st.rank : "–"}</b><span>${t("sRankA")}</span></div></div>
    <div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>
    <div class="row small mut" style="margin-top:6px"><span>${fmtN(st.xp)} XP</span><div class="sp"></div><span>${t("sNext", { n: fmtN(Math.max(0, st.next - st.xp)) })}</span></div>
    ${self ? `<div class="small" style="margin-top:8px;color:#ffd36b">${eic("coin", "gold")} ${t("sharePct", { n: st.share })}</div>` : ""}
  </div>`;
}
function sLevelUpFx(m, canvas) {
  const d = document.createElement("div"); d.className = "lvup slv"; d.innerHTML = `<b>${eic("mic")} LV ${m.level}</b>${S.user && m.uid === S.user.id ? t("sLevelUpMe", { l: m.level }) : esc(t("sLevelUp", { n: m.name || "", l: m.level }))}`;
  ($("#app") || document.body).appendChild(d); setTimeout(() => d.remove(), 3600);
  FX.play("fireworks", null, null, canvas || $("#fx")); haptic("success");
}
function profileHtml(r, self) {
  const u = r.user;
  const since = new Date(u.created || Date.now()).toLocaleDateString(S.lang === "ar" ? "ar" : "en", { year: "numeric", month: "long" });
  const kp = (n, l) => `<div class="kpi" style="background:var(--card);border:1px solid var(--line)"><b>${n}</b><span class="mut">${l}</span></div>`;
  return `<div style="text-align:center;margin-top:8px">
    <div style="position:relative;width:96px;margin:0 auto">${avatar(u, "lg", "width:96px;height:96px;margin:0 auto")}
      ${self ? `<button id="pcam" style="position:absolute;bottom:-2px;inset-inline-end:-4px;width:34px;height:34px;border-radius:50%;background:var(--grad);display:grid;place-items:center;border:3px solid var(--bg)">${ic("cam")}</button>` : ""}</div>
    <div style="font-size:24px;font-weight:800;margin-top:14px">${uname(u, "span")}</div>
    <div class="mut" dir="ltr">@${esc(u.handle)}</div>
    ${u.bio ? `<div style="margin-top:10px;color:#e6e1ff;line-height:1.6">${esc(u.bio)}</div>` : ""}
    ${u.link ? `<a href="${esc(u.link)}" target="_blank" rel="noopener" class="chip" style="display:inline-flex;gap:6px;margin-top:10px;text-decoration:none;color:#b9a8ff">${ic("globe")} ${esc(u.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))}</a>` : ""}
    <div class="small mut" style="margin-top:8px">${t("joined")} ${esc(since)}</div>
  </div>
  ${streamerCard(r.streamer, self)}
  <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
    ${kp(fmtN(r.followers), t("followers"))}${kp(fmtN(r.following), t("followingN"))}${kp(fmtN(r.streamsCount), t("streamsN"))}
    ${kp(r.hours, t("hoursN"))}${kp(fmtN(r.bestPeak), t("bestPeak"))}${kp(fmtN(r.subsCount || 0), t("subsN"))}
  </div>
  <div id="pact"></div>
  ${r.games.length ? `<div class="h2">${ic("game")} ${t("gamesPlayed")}</div><div class="chips">${r.games.map((g) => `<span class="chip gchip">${g.icon ? gIcon(g.icon) : eic("game", "brand")}<span>${esc(g.name)}</span><b>${g.n}</b></span>`).join("")}</div>` : ""}
  ${(() => { const recs = r.streams.filter((s) => s.rec && !s.live); return recs.length ? `<div class="h2">${ic("live")} ${t("recordings")}</div><div class="grid">${recs.map((s) => `<div class="card" data-id="${s.id}" data-rec="1">
      <div class="th land">${s.gameIcon ? `<div class="thbg" style="background-image:url('${esc(s.gameIcon)}')"></div>` : `<div class="ph">${eic("game", "brand")}</div>`}<img src="/api/thumb/${s.id}" onerror="this.remove()" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
        <div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center;font-size:18px;backdrop-filter:blur(8px)">▶</div></div>
        <span class="badge" style="position:absolute;bottom:8px;inset-inline-end:8px">${fmtDur(s.rec.dur * 1000)}</span>
        ${self ? `<button class="mini" data-del="${s.id}" style="position:absolute;top:8px;inset-inline-end:8px;background:rgba(0,0,0,.55);color:#ff7b88">${ic("x")}</button>` : ""}</div>
      <div class="meta"><div class="tt">${esc(s.title)}</div><div class="small mut" style="margin-top:4px">${s.game ? esc(s.game) + " · " : ""}${new Date(s.started).toLocaleDateString(S.lang)}</div></div></div>`).join("")}</div>` : ""; })()}
  <div class="h2">${t("past")}</div>
  <div class="sl">${r.streams.length ? r.streams.map((s) => `<div class="sm" data-id="${s.id}" data-rec="${s.rec && !s.live ? 1 : ""}" style="align-items:center">${s.gameIcon ? gIcon(s.gameIcon, "gi", 40) : `<div class="ph2" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--card2)">${eic("game", "brand")}</div>`}
    <div class="tx"><b>${esc(s.title)}</b><br><span class="mut small">${esc(s.game || "")} · ${new Date(s.started).toLocaleDateString(S.lang)} · ${t("peak")} ${s.peak}</span></div>${s.live ? '<span class="badge red">LIVE</span>' : s.rec ? `<span class="badge" style="background:var(--grad)">▶ ${fmtDur(s.rec.dur * 1000)}</span>${self ? `<button class="mini" data-del="${s.id}" style="color:#ff7b88">${ic("x")}</button>` : ""}` : ""}</div>`).join("") : `<p class="mut small" style="text-align:center;padding:16px">${t("noPast")}</p>`}</div>`;
}
function pickPhoto(cb) {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
  i.onchange = () => {
    const f = i.files && i.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const S2 = 320, c = document.createElement("canvas"); c.width = c.height = S2;
      const m = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S2, S2);
      cb(c.toDataURL("image/jpeg", 0.82)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => toast(terr("bad_image"));
    img.src = URL.createObjectURL(f);
  };
  i.click();
}
async function uploadPhoto(data) {
  const r = await api("/api/avatar", { data });
  if (r.error) return toast(terr(r.error));
  S.user = r.user; store.set("user", r.user); toast(t("saved")); if (current === "me") go("me");
}
VIEWS.me = (root) => {
  if (!S.token) return go("auth");
  root.innerHTML = `<div class="view"><div class="top"><div class="h1">${t("profile")}</div><div class="sp"></div><button class="chip" id="mwal" style="padding:9px 14px">${coinHtml(S.user.coins)}</button><button class="ibtn" id="mset">${ic("gear")}</button></div>
  <div class="scroll" id="ms"><div style="height:200px;position:relative"><div class="spin"></div></div></div></div>`;
  $("#mset").onclick = () => go("settings");
  $("#mwal").onclick = () => go("wallet");
  api("/api/user/" + S.user.handle).then((r) => {
    if (!r.user) return;
    r.user = { ...r.user, ...S.user };
    $("#ms").innerHTML = profileHtml(r, true);
    $("#pact").innerHTML = `<button class="btn g" style="margin-top:14px" id="med">${ic("user")} ${t("editProfile")}</button>`;
    $("#med").onclick = editProfile;
    $("#pcam").onclick = () => pickPhoto(uploadPhoto);
    bindStreams($("#ms"), r, true);
  });
};
function editProfile() {
  const u = S.user;
  const cols = ["#7C5CFF", "#9D7BFF", "#B26BFF", "#D16BFF", "#FF4DD8", "#FF4D8D", "#FF2E63", "#FF5F6D", "#FF6B3D", "#FF9A3D", "#FFB800", "#FFD700",
    "#F6E05E", "#C6F432", "#7CFF6B", "#2EE59D", "#00F5A0", "#00E5C3", "#00D1FF", "#3DDCFF", "#4FACFE", "#2B7BFF", "#5B6CFF", "#A1C4FD",
    "#FFFFFF", "#E0E0E0", "#FFC3E1", "#FFD8B0", "#B5FFFC", "#E0C3FC", "#FDA085", "#C9A227"];
  let col = u.color;
  sheet(`<h3>${t("editProfile")}</h3>
    <div class="row" style="gap:14px;margin-bottom:8px">${avatar(u, "lg", "width:72px;height:72px;font-size:28px")}
      <div style="flex:1"><button class="mini p" id="eph">${t("changePhoto")}</button> ${u.avatar ? `<button class="mini" id="erm">${t("removePhoto")}</button>` : ""}</div></div>
    <div class="field"><label>${t("handle")}</label><div class="inp row" style="opacity:.65;gap:8px" dir="ltr">${ic("lock")}<span>@${esc(u.handle)}</span></div>
      <div class="small mut" style="margin:6px 4px 0">${t("usernameLocked")}</div></div>
    <div class="field"><label>${t("name")}</label><input class="inp" id="en" value="${esc(u.name)}" maxlength="32"></div>
    <div class="field"><label>${t("bio")}</label><textarea class="inp" id="eb" maxlength="140" rows="3" style="resize:none">${esc(u.bio || "")}</textarea></div>
    <div class="field"><label>${t("link")}</label><input class="inp" id="el" value="${esc(u.link || "")}" maxlength="200" autocapitalize="none" autocorrect="off" dir="ltr" placeholder="youtube.com/@…"></div>
    <div class="field"><label>${t("email")}</label><input class="inp" id="em" type="email" inputmode="email" value="${esc(u.email || "")}" autocapitalize="none" autocorrect="off" dir="ltr"></div>
    <div class="field"><label>${t("color")}</label><div class="colgrid">${cols.map((c) => `<button data-c="${c}" style="width:34px;height:34px;border-radius:50%;background:${c};box-shadow:${c === col ? "0 0 0 3px #fff" : "none"}"></button>`).join("")}</div></div>
    <button class="btn p" id="es" style="margin-top:8px">${t("save")}</button>`, (sh, close) => {
    $("#eph", sh).onclick = () => { close(); pickPhoto(uploadPhoto); };
    if ($("#erm", sh)) $("#erm", sh).onclick = () => { close(); uploadPhoto(""); };
    $$("[data-c]", sh).forEach((b) => (b.onclick = () => { col = b.dataset.c; $$("[data-c]", sh).forEach((x) => (x.style.boxShadow = x === b ? "0 0 0 3px #fff" : "none")); }));
    $("#es", sh).onclick = async () => {
      const r = await api("/api/profile", { name: $("#en", sh).value, bio: $("#eb", sh).value, link: $("#el", sh).value, color: col, email: $("#em", sh).value.trim() });
      if (r.error) return toast(terr(r.error));
      S.user = r.user; store.set("user", r.user); close(); toast(t("saved")); if (current === "me") go("me");
    };
  });
}

function bindStreams(el, r, own) {
  $$("[data-del]", el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); deleteRec(b.dataset.del, () => go(current === "me" ? "me" : "home")); }));
  $$("[data-id]", el).forEach((x) => (x.onclick = () => {
    const s = r.streams.find((q) => q.id === x.dataset.id) || {};
    if (x.dataset.rec) go("replay", { id: s.id, title: s.title, game: s.game, gameIcon: s.gameIcon, own, back: own ? { view: "me" } : { view: "user", arg: r.user.handle } });
    else go("watch", x.dataset.id);
  }));
}

/* ---------- settings ---------- */
VIEWS.settings = (root) => {
  const u = S.user;
  const g = Object.assign({ quality: "720", fps: 30, mic: true, privacy: { dnd: true, callGuard: true, bannerGuard: true } }, store.get("golive", {}));
  g.privacy = Object.assign({ dnd: true, callGuard: true, bannerGuard: true }, g.privacy || {});
  const rp = Object.assign({ allowFx: true, allowCh: true, coStream: "all", slow: 0, rec: true }, (u && u.prefs) || {});
  const sw = (id, on) => `<div class="sw ${on ? "on" : ""}" data-s="${id}"></div>`;
  const row = (icn, title, sub, right, id = "") => `<div class="tg" ${id ? `id="${id}"` : ""}><div class="ic">${ic(icn)}</div><div class="tx"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>${right || ""}</div>`;
  const seg = (id, opts, val) => `<div class="seg" data-seg="${id}" style="margin:2px 0 12px">${opts.map(([v, l]) => `<button class="${String(v) === String(val) ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const sec = (title, body) => `<div class="h2">${title}</div><div class="tile" style="padding:4px 14px">${body}</div>`;
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="xb">${ic("back")}</button><div class="h1">${t("settingsT")}</div></div>
  <div class="scroll" style="padding-bottom:calc(40px + var(--sb))">
    ${u ? `<div class="sm" style="align-items:center;padding:14px;margin-top:4px" id="xme">${avatar(u, "md")}<div class="tx"><b>${esc(u.name)}</b><br><span class="mut small" dir="ltr">@${esc(u.handle)}</span></div><span class="mut">›</span></div>` : ""}
    ${u ? sec(t("secAccount"),
      row("user", t("editProfile"), "", `<span class="mut">›</span>`, "xedit") +
      row("lock", t("changePass"), "", `<span class="mut">›</span>`, "xpw") +
      row("out", t("logout"), "", "", "xout") +
      `<div class="tg" id="xdel" style="color:#ff7b88"><div class="ic">${ic("x")}</div><div class="tx"><b>${t("deleteAcc")}</b></div></div>`) : ""}
    ${sec(t("secStream"),
      `<div style="padding-top:12px"><label class="small mut">${t("quality")}</label></div>${seg("quality", [["540", "540p"], ["720", "720p"], ["1080", "1080p"]], g.quality)}
       <label class="small mut">${t("fps")}</label>${seg("fps", [[30, "30"], [60, "60"]], g.fps)}` +
      row("mic", t("mic"), t("micD"), sw("mic", g.mic)) +
      row("chat", t("chatOverlayDef"), "", sw("overlay", store.get("overlay", true))) +
      row("phone", t("callG"), t("callGD"), sw("callGuard", g.privacy.callGuard)) +
      (isAndroid() || !Native.has() ? row("bell", t("dnd"), t("dndD"), sw("dnd", g.privacy.dnd)) : "") +
      (isIOS() || !Native.has() ? row("eye", t("bannerG"), t("bannerGD"), sw("bannerGuard", g.privacy.bannerGuard)) : "") +
      (isIOS() ? row("bell", t("focusGuide"), "", `<span class="mut">›</span>`, "xfocus") : "") +
      row("gauge", t("speedTest"), "", `<span class="mut">›</span>`, "xspeed"))}
    ${u ? sec(t("modT"), row("shield", t("mods") + " · " + t("vipsR") + " · " + t("sanctions"), "", `<span class="mut">›</span>`, "xmods")) : ""}
    ${u ? sec(t("yt"), row("live", t("ytAdd"), u.yt ? t("ytLinked", { k: `<span dir="ltr">${esc(u.yt)}</span>` }) : t("ytNot"), `<span class="mut">›</span>`, "xyt")) : ""}
    ${u ? sec(t("recordings"),
      row("live", t("recSave"), t("recSaveD"), sw("rec", rp.rec)) +
      row("layers", t("storage"), `<span id="xstor">…</span>`, "") +
      `<div class="tg" id="xdelall" style="color:#ff7b88"><div class="ic">${ic("x")}</div><div class="tx"><b>${t("delAllRecs")}</b></div></div>`) : ""}
    ${u ? sec(t("secRoom"),
      row("spark", t("allowFx"), t("allowFxD"), sw("allowFx", rp.allowFx)) +
      row("trophy", t("allowCh"), "", sw("allowCh", rp.allowCh)) +
      `<div style="padding-top:12px"><label class="small mut">${t("coStreamWho")}</label></div>${seg("coStream", [["all", t("everyone")], ["followers", t("followersOnly")], ["none", t("nobody")]], rp.coStream)}
       <label class="small mut">${t("slowMode")}</label>${seg("slow", [[0, t("off")], [5, "5" + t("secs")], [15, "15" + t("secs")], [30, "30" + t("secs")]], rp.slow)}`) : ""}
    ${sec(t("secWatch"),
      row("chat", t("chatOnStream"), "", sw("p:chatOnStream", P.chatOnStream)) +
      row("vol", t("autoSound"), "", sw("p:autoSound", P.autoSound)) +
      row("spark", t("fxSound"), "", sw("p:fxSound", P.fxSound)) +
      row("zap", t("reduceFx"), t("reduceFxD"), sw("p:reduceFx", P.reduceFx)) +
      row("gauge", t("showLat"), "", sw("p:showLat", P.showLat)))}
    ${u ? sec(t("secNotif"), row("mail", t("notifyMail"), t("notifyMailD"), sw("notify", u.notify !== false))) : ""}
    ${sec(t("secApp"),
      row("globe", t("language"), S.lang === "ar" ? "العربية" : "English", `<span class="mut">⇄</span>`, "xlang") +
      (Native.has() ? row("zap", t("haptics"), "", sw("p:haptics", P.haptics)) : "") +
      row("refresh", t("clearCache"), "", "", "xcache"))}
    ${sec(t("secAbout"), row("live", "Wahj Live", t("version") + " " + esc((S.native && S.native.version) || "web"), ""))}
  </div></div>`;
  $("#xb").onclick = () => go(S.token ? "me" : "home");
  const saveG = () => store.set("golive", g);
  let rpT;
  const saveRoom = () => { clearTimeout(rpT); rpT = setTimeout(async () => { const r = await api("/api/profile", { prefs: rp }); if (r.user) { S.user = r.user; store.set("user", r.user); } }, 400); };
  $$("[data-s]", root).forEach((el) => (el.onclick = async () => {
    const on = el.classList.toggle("on"); haptic();
    const k = el.dataset.s;
    if (k.startsWith("p:")) return setP(k.slice(2), on);
    if (k === "mic") g.mic = on, saveG();
    else if (k === "overlay") store.set("overlay", on);
    else if (["callGuard", "dnd", "bannerGuard"].includes(k)) { g.privacy[k] = on; saveG(); if (k === "dnd" && on && isAndroid()) Native.post("perm", { kind: "dnd" }); }
    else if (k === "allowFx" || k === "allowCh" || k === "rec") { rp[k] = on; saveRoom(); }
    else if (k === "notify") { const r = await api("/api/profile", { notify: on }); if (r.user) { S.user = r.user; store.set("user", r.user); } }
  }));
  $$("[data-seg]", root).forEach((sg) => $$("button", sg).forEach((b) => (b.onclick = () => {
    $$("button", sg).forEach((x) => x.classList.toggle("on", x === b)); haptic();
    const k = sg.dataset.seg, v = b.dataset.v;
    if (k === "quality") g.quality = v, saveG();
    else if (k === "fps") g.fps = +v, saveG();
    else { rp[k] = k === "slow" ? +v : v; saveRoom(); }
  })));
  const on = (id, f) => { const e = $("#" + id); if (e) e.onclick = f; };
  on("xme", () => go("me"));
  on("xyt", () => ytSheet(() => go("settings")));
  on("xmods", () => modsManager(S.user.id));
  on("xdelall", () => deleteRec("all", () => go("settings")));
  if (u) api("/api/recs").then((r) => { const el = $("#xstor"); if (el) el.textContent = r.myBytes !== undefined ? `${fmtBytes(r.myBytes)} · ${r.recs.length} ${t("recordings")}` : "–"; });
  if (u && !(S.cfg && S.cfg.rec)) api("/api/config").then((c) => { if (!c.rec && $("#xstor")) $("#xstor").textContent = t("recOff"); });
  on("xedit", editProfile);
  on("xspeed", () => go("speed"));
  on("xfocus", focusGuide);
  on("xlang", () => { S.lang = S.lang === "ar" ? "en" : "ar"; store.set("lang", S.lang); applyLang(); Native.post("lang", { lang: S.lang }); go("settings"); });
  on("xcache", () => { const keep = ["token", "user", "lang", "prefs", "golive", "overlay"]; Object.keys(localStorage).filter((k) => k.startsWith("wahj.") && !keep.includes(k.slice(5))).forEach((k) => localStorage.removeItem(k)); Games.top = null; Games.phone = null; toast(t("saved")); });
  on("xout", () => confirmBox(t("logout") + "?", () => { S.token = ""; S.user = null; store.set("token", ""); store.set("user", null); store.set("guest", false); Native.post("auth", { token: "" }); go("auth"); }));
  on("xpw", () => sheet(`<h3>${ic("lock")} ${t("changePass")}</h3><div class="field">${pwField("po", t("oldPass"))}</div><div class="field">${pwField("pn", t("newPass"))}</div><button class="btn p" id="ps">${t("save")}</button>`, (sh, close) => {
    bindEyes(sh);
    $("#ps", sh).onclick = async () => { const r = await api("/api/password", { old: $("#po", sh).value, password: $("#pn", sh).value }); if (r.error) return toast(terr(r.error)); close(); toast(t("saved")); };
  }));
  on("xdel", () => sheet(`<h3 style="color:#ff7b88">${t("deleteAcc")}</h3><p class="mut" style="margin-bottom:10px;line-height:1.7">${t("deleteQ")}</p><div class="field">${pwField("dp", t("password"))}</div><button class="btn d" id="dd">${t("deleteAcc")}</button>`, (sh, close) => {
    bindEyes(sh);
    $("#dd", sh).onclick = async () => { const r = await api("/api/delete-account", { password: $("#dp", sh).value }); if (r.error) return toast(terr(r.error)); close(); S.token = ""; S.user = null; store.set("token", ""); store.set("user", null); store.set("guest", false); toast(t("deleted")); go("auth"); };
  }));
};
function settingsSheet() { go("settings"); }

/* ---------- other user's profile ---------- */
VIEWS.user = (root, handle) => {
  if (S.user && handle === S.user.handle) return go("me");
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="ub">${ic("back")}</button></div><div class="scroll" id="us"><div class="spin"></div></div></div>`;
  $("#ub").onclick = () => go("home");
  api("/api/user/" + encodeURIComponent(handle)).then((r) => {
    if (!r.user) return ($("#us").innerHTML = `<div class="empty">${t("offline")}</div>`);
    const u = r.user; let fol = S.following.has(u.id);
    $("#us").innerHTML = profileHtml(r, false);
    if (S.user) {
      $("#pact").innerHTML = `<div class="row" style="margin-top:14px"><button class="btn ${fol ? "g" : "p"}" id="uf">${fol ? t("unfollow") : t("follow")}</button>
        <button class="btn" id="usb" style="background:linear-gradient(120deg,#00d1ff,#7c5cff);color:#fff">${r.mySub ? t("subscribed", { n: r.mySub.months }) : t("subscribe")}</button></div>`;
      $("#usb").onclick = () => subSheet(u, (sub) => { $("#usb").textContent = t("subscribed", { n: sub.months }); });
      $("#uf").onclick = async () => { fol = !fol; const fb = $("#uf"); fb.className = "btn " + (fol ? "g" : "p"); fb.textContent = fol ? t("unfollow") : t("follow"); haptic(); await api("/api/follow", { target: u.id, on: fol }); fol ? S.following.add(u.id) : S.following.delete(u.id); };
    }
    bindStreams($("#us"), r, false);
  });
};

/* ================= diagnostics ================= */
function diag(msg, room) {
  try { fetch("/api/diag", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ src: "web-" + plat(), room: room || (S.live && S.live.room) || "", msg: String(msg).slice(0, 800) }) }).catch(() => {}); } catch (e) {}
}
window.addEventListener("error", (e) => diag("JS " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
Native.on((e) => { if (e.type === "broadcast" || e.type === "diag") diag("native " + JSON.stringify(e)); });

/* ================= boot ================= */
async function afterLogin() {
  const m = location.pathname.match(/^\/w\/([a-z0-9]+)/);
  if (S.live && S.bstate !== "idle") return go("studio");
  if (m) return go("watch", m[1]);
  go("home");
}
async function boot() {
  applyLang();
  Native.post("info", {});
  // wait briefly for native info
  for (let i = 0; i < 10 && Native.has() && !S.native; i++) await sleep(60);
  if (S.native && S.native.lang && !store.get("langSet", false)) { /* keep user choice */ }
  api("/api/config").then((c) => { S.cfg = c; if (c.ice) S.ice = c.ice; });
  // restore an ongoing broadcast after app reload
  const resume = store.get("live", null);
  if (resume && S.native && S.native.broadcasting && Date.now() - resume.startedAt < 12 * 3600e3) { S.live = resume; S.bstate = "live"; }
  if (S.token) {
    const r = await api("/api/me");
    if (r.user) { S.user = r.user; store.set("user", r.user); S.following = new Set(r.following || []); Native.post("auth", { token: S.token, user: r.user }); }
    else if (r.error === "auth") { S.token = ""; store.set("token", ""); }
  }
  const m = location.pathname.match(/^\/w\/([a-z0-9]+)/);
  if (!S.token && !store.get("guest", false) && !m) return go("auth");
  afterLogin();
}
// persist the live job so the studio survives a WebView reload
setInterval(() => store.set("live", S.live), 3000);
window.addEventListener("beforeunload", () => store.set("live", S.live));
window.Wahj = { go, S, Native, endLive, current: () => current }; // for native/debug
boot();
