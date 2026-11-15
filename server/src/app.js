"use strict";
/* ================= Wahj Live — app ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n, cls = "") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
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
    noLive: "لا يوجد بث مباشر حالياً", beFirst: "كن أول من يبث الآن ✨", viewers: "مشاهد", goLive: "ابدأ البث", title: "عنوان البث",
    titlePh: "مثال: تحدي الفوز بدون خسارة 🔥", game: "اللعبة", gamePh: "اسم اللعبة", cat: "التصنيف", quality: "الجودة", fps: "الإطارات",
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
    chatTitle: "الدردشة", noChat: "الدردشة هادئة… قل مرحباً 👋", starting: "جارٍ التجهيز…", tapStart: "اضغط «بدء البث» في نافذة النظام",
    reopen: "فتح نافذة البث", onAir: "على الهواء", stopped: "توقف البث", shieldOn: "درع الخصوصية يعمل", shieldOff: "الدرع غير مفعّل",
    shieldPaused: "الصورة محجوبة الآن للخصوصية", privTitle: "لحظة خصوصية", privSub: "سيعود البث خلال ثوانٍ",
    offline: "البث غير متاح الآن", endedT: "انتهى البث", back: "رجوع", tapSound: "اضغط لتشغيل الصوت", follow: "متابعة",
    unfollow: "متابَع", followers: "متابِع", past: "بثوث سابقة", edit: "تعديل الملف", save: "حفظ", bio: "نبذة", color: "لون الحساب",
    settings: "الإعدادات", language: "اللغة", logout: "تسجيل الخروج", focusGuide: "دليل إخفاء الإشعارات في آيفون",
    focusSteps: "١. افتح تطبيق «الاختصارات» ← «الأتمتة» ← «أتمتة جديدة»<br>٢. اختر «تطبيق» ← وهج ← «عند الفتح»<br>٣. اختر «تشغيل فوري»<br>٤. أضف إجراء «تعيين التركيز» ← «عدم الإزعاج» ← تشغيل<br><br>الآن كل مرة تفتح وهج يتفعّل عدم الإزعاج تلقائياً ✓",
    openShortcuts: "فتح الاختصارات", errs: { bad_handle: "اسم المستخدم: ٣–٢٠ حرفاً إنجليزياً أو أرقام", weak_password: "كلمة المرور ٦ أحرف على الأقل", taken: "الاسم محجوز", bad_login: "بيانات الدخول غير صحيحة", rate: "محاولات كثيرة، انتظر قليلاً", net: "تعذّر الاتصال", auth: "سجّل الدخول أولاً", not_invited: "لم تتم دعوتك", login: "سجّل الدخول للمشاركة", slow: "انتظر لحظة", guests_full: "اكتمل عدد الضيوف (٣)", bad_email: "البريد الإلكتروني غير صحيح", email_taken: "هذا البريد مسجّل مسبقاً", bad_code: "الرمز غير صحيح أو منتهي", mail_off: "إرسال البريد غير مفعّل في السيرفر بعد", bad_link: "الرابط غير صحيح", bad_old: "كلمة المرور الحالية غير صحيحة", bad_image: "الصورة غير مدعومة", fx_off: "البثّاث أوقف المؤثرات", ch_off: "البثّاث أوقف التحديات", co_off: "البثّاث لا يقبل طلبات البث المشترك" },
    sentFx: "أرسل", hypeTrain: "قطار الحماس 🚀", latency: "تأخير", guestsN: "ضيوف", layoutSplit: "شاشة مقسومة", layoutFocus: "تركيز",
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
    sound: "الصوت", voiceLink: "صوت الضيوف", you: "أنت", hostTag: "البثّاث", guestTag: "ضيف", chAccepted: "قَبِل التحدي!", chDone: "نجح في التحدي! 🎉",
    chFailed: "فشل التحدي 😅", secs: "ث", profile: "حسابي", noPast: "لا توجد بثوث سابقة", pendingLive: "البث لم يبدأ بعد…", camNA: "الكاميرا أثناء اللعب غير مدعومة في آيفون",
  },
  en: {
    tag: "Stream your games live — under a second of delay", login: "Sign in", register: "Create account", handle: "Username",
    name: "Display name", password: "Password", go: "Continue", guest: "Browse as guest", liveNow: "Live now", following: "Following",
    all: "All", action: "Action", sports: "Sports", br: "Battle Royale", racing: "Racing", strategy: "Strategy", retro: "Retro", chill: "Just chatting",
    noLive: "Nobody is live right now", beFirst: "Be the first to go live ✨", viewers: "viewers", goLive: "Go live", title: "Stream title",
    titlePh: "e.g. No-loss challenge 🔥", game: "Game", gamePh: "Game name", cat: "Category", quality: "Quality", fps: "Frame rate",
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
    chatTitle: "Chat", noChat: "Chat is quiet… say hi 👋", starting: "Getting ready…", tapStart: "Tap “Start Broadcast” in the system sheet",
    reopen: "Open broadcast sheet", onAir: "On air", stopped: "Broadcast stopped", shieldOn: "Privacy shield active", shieldOff: "Shield is off",
    shieldPaused: "Video is hidden for privacy right now", privTitle: "Privacy moment", privSub: "The stream is back in a few seconds",
    offline: "This stream is not available", endedT: "Stream ended", back: "Back", tapSound: "Tap for sound", follow: "Follow",
    unfollow: "Following", followers: "followers", past: "Past streams", edit: "Edit profile", save: "Save", bio: "Bio", color: "Accent color",
    settings: "Settings", language: "Language", logout: "Sign out", focusGuide: "Hide notifications on iPhone",
    focusSteps: "1. Open Shortcuts → Automation → New Automation<br>2. Choose App → Wahj → Is Opened<br>3. Choose Run Immediately<br>4. Add action Set Focus → Do Not Disturb → On<br><br>Now Do Not Disturb turns on automatically every time you open Wahj ✓",
    openShortcuts: "Open Shortcuts", errs: { bad_handle: "Username: 3–20 latin letters/digits", weak_password: "Password needs 6+ characters", taken: "Username taken", bad_login: "Wrong username or password", rate: "Too many attempts, wait a bit", net: "Connection failed", auth: "Sign in first", not_invited: "You were not invited", login: "Sign in to take part", slow: "Slow down a moment", guests_full: "Guest slots are full (3)", bad_email: "Invalid email address", email_taken: "Email already registered", bad_code: "Wrong or expired code", mail_off: "Email sending isn't enabled on the server yet", bad_link: "Invalid link", bad_old: "Current password is wrong", bad_image: "Unsupported image", fx_off: "The streamer turned effects off", ch_off: "The streamer turned challenges off", co_off: "The streamer isn't accepting co-stream requests" },
    sentFx: "sent", hypeTrain: "HYPE TRAIN 🚀", latency: "Delay", guestsN: "guests", layoutSplit: "Split screen", layoutFocus: "Focus",
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
    sound: "Sound", voiceLink: "Guest voice", you: "You", hostTag: "HOST", guestTag: "GUEST", chAccepted: "accepted the challenge!", chDone: "completed the challenge! 🎉",
    chFailed: "failed the challenge 😅", secs: "s", profile: "Profile", noPast: "No past streams", pendingLive: "Stream hasn't started yet…", camNA: "Face cam while gaming isn't supported on iPhone",
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
const avatar = (u, cls = "", style = "") => (u && u.avatar)
  ? `<div class="av ${cls}" style="background:${esc(u.color || "#7C5CFF")};overflow:hidden;${style}"><img src="${esc(u.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`
  : `<div class="av ${cls}" style="background:${esc((u && u.color) || "#7C5CFF")};${style}">${esc(((u && (u.name || u.handle)) || "?").trim().charAt(0).toUpperCase())}</div>`;
const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : String(n | 0));
const fmtDur = (ms) => { const s = Math.max(0, ms / 1000 | 0); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, x = s % 60; return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(x).padStart(2, "0"); };
const CATS = ["all", "action", "sports", "br", "racing", "strategy", "retro", "chill"];
const CAT_EMO = { action: "⚔️", sports: "⚽", br: "🪂", racing: "🏎️", strategy: "♟️", retro: "👾", chill: "💬", all: "🎮" };
const GAMES = ["PUBG Mobile", "Free Fire", "eFootball", "EA FC Mobile", "Call of Duty Mobile", "Minecraft", "Roblox", "Clash Royale", "Genshin Impact", "Brawl Stars", "Asphalt Legends", "Emulator"];

/* ---------------- router ---------------- */
let cleanup = null;
let current = "";
function go(view, arg) {
  if (sheetClose) sheetClose();
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  current = view;
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
    { id: "fire", e: "🔥", ar: "نار", en: "Fire" },
    { id: "hearts", e: "💖", ar: "قلب", en: "Heart" },
    { id: "wave", e: "🌊", ar: "موجة", en: "Wave" },
    { id: "confetti", e: "🎉", ar: "احتفال", en: "Confetti" },
    { id: "lightning", e: "⚡", ar: "صاعقة", en: "Lightning" },
    { id: "shake", e: "💥", ar: "انفجار", en: "Boom" },
    { id: "airhorn", e: "📯", ar: "بوق", en: "Airhorn" },
    { id: "boo", e: "👻", ar: "أشباح", en: "Ghosts" },
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
      d.className = "floaty"; d.textContent = e;
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
      ctx.font = `${Math.min(W, H) * 0.45 * this.ease(Math.min(1, p * 4))}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = e; ctx.fillText("💥", cx, cy);
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
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(ms * 0.03) * 0.12); ctx.fillText("📯", 0, 0); ctx.restore();
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
        ctx.save(); ctx.translate(x, g.y + Math.sin(ms * 0.004 + g.ph) * 30); ctx.scale(g.dir, 1); ctx.fillText("👻", 0, 0); ctx.restore();
      });
    });
    this.tone([220, 165], 1.6, "triangle", 0.1); this.tone([330, 247], 1.4, "sine", 0.06, 0.3);
  },

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
    this.setPrivacy(p.uid, !!p.privacy);
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
  setPrivacy(uid, on) {
    const el = this.tiles.get(uid); if (!el) return;
    let o = $(".priv", el);
    if (on && !o) {
      o = document.createElement("div"); o.className = "priv";
      o.innerHTML = `<div class="lk">${ic("lock")}</div><b>${t("privTitle")}</b><span>${t("privSub")}</span>`;
      el.appendChild(o);
    } else if (!on && o) o.remove();
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
      <button class="ibtn" id="hr">${ic("refresh")}</button></div>
    <div class="scroll" id="hs">
      <div class="seg" style="margin-top:4px" id="ht"><button class="on" data-t="live">${t("liveNow")}</button><button data-t="fol">${t("following")}</button></div>
      <div id="hg"></div>
      <div class="chips" style="margin-top:12px" id="hc">${CATS.map((c) => `<button class="chip ${c === "all" ? "on" : ""}" data-c="${c}">${CAT_EMO[c]} ${t(c)}</button>`).join("")}</div>
      <div id="hl"><div style="height:200px;position:relative"><div class="spin"></div></div></div>
    </div></div>`;
  const card = (s, big) => {
    const thumb = `/api/thumb/${s.id}?b=${Math.floor(Date.now() / 20000)}`;
    const badges = `<div class="live"><span class="badge red">LIVE</span><span class="badge">${ic("eye")} ${fmtN(s.viewers)}</span>${s.guests ? `<span class="badge co">${ic("users")} ${s.guests + 1}</span>` : ""}</div>`;
    const ph = s.gameIcon ? `<div class="thbg" style="background-image:url('${esc(s.gameIcon)}')"></div>${gIcon(s.gameIcon, "gi thic")}` : `<div class="ph">${CAT_EMO[s.cat] || "🎮"}</div>`;
    const gb = s.game ? `<div class="gbadge">${gIcon(s.gameIcon)}<span>${esc(s.game)}</span></div>` : "";
    if (big) return `<div class="feat" data-id="${s.id}">${ph}<img src="${thumb}" onerror="this.remove()" alt="" style="position:absolute;inset:0">${badges}<div class="ov"><div class="t">${esc(s.title)}</div>
      <div class="who">${avatar(s.host)}<span style="font-weight:600">${esc(s.host && s.host.name)}</span></div>${s.game ? `<div class="row" style="gap:8px;margin-top:8px">${gIcon(s.gameIcon, "gi", 22)}<span class="small" style="color:#e6e1ff;font-weight:600">${esc(s.game)}</span></div>` : ""}</div></div>`;
    return `<div class="card" data-id="${s.id}"><div class="th">${ph}<img src="${thumb}" onerror="this.remove()" alt="" style="position:absolute;inset:0">${badges}${gb}</div>
      <div class="meta"><div class="tt">${esc(s.title)}</div><div class="who">${avatar(s.host)}<span class="small" style="font-weight:600">${esc(s.host && s.host.name)}</span></div></div></div>`;
  };
  const render = () => {
    // games being streamed right now
    const gm = new Map();
    data.forEach((s) => { if (!s.game) return; const k = s.game.toLowerCase(); const g = gm.get(k) || { name: s.game, icon: s.gameIcon, n: 0 }; g.n++; if (!g.icon) g.icon = s.gameIcon; gm.set(k, g); });
    const games = [...gm.values()].sort((a, b) => b.n - a.n);
    $("#hg").innerHTML = games.length ? `<div class="h2" style="margin-top:14px">${ic("game")} ${t("nowPlaying")}</div><div class="chips">${games.map((g) => `<button class="chip gchip ${gameF === g.name.toLowerCase() ? "on" : ""}" data-g="${esc(g.name.toLowerCase())}">${g.icon ? gIcon(g.icon) : "🎮"}<span>${esc(g.name)}</span><b>${g.n}</b></button>`).join("")}</div>` : "";
    $$("#hg [data-g]").forEach((b) => (b.onclick = () => { gameF = gameF === b.dataset.g ? "" : b.dataset.g; haptic(); render(); }));
    let list = data.filter((s) => (cat === "all" || s.cat === cat) && (!gameF || (s.game || "").toLowerCase() === gameF));
    if (tab === "fol") list = list.filter((s) => s.followed);
    const el = $("#hl");
    if (!list.length) {
      el.innerHTML = `<div class="empty"><div class="big">📡</div><div style="font-weight:700;font-size:17px;color:var(--txt)">${t("noLive")}</div><div style="margin-top:6px">${t("beFirst")}</div>
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
  load();
  const iv = setInterval(load, 15000);
  return () => clearInterval(iv);
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
      <button class="fbtn hide" id="wf">${t("follow")}</button><div class="sp"></div>
      <span class="stat"><span class="badge red" style="padding:2px 7px">LIVE</span></span>
      <span class="stat" id="wv">${ic("eye")} 0</span></div>
    <div class="pinned hide" id="wpin"></div>
    <div class="chatov" id="wc"></div>
    <div class="hype" id="whype"><i style="height:0%"></i></div><div class="hypel" id="whl">x1</div>
    <div id="wpoll"></div>
    <div class="wbar">
      <div class="cin"><input id="wi" placeholder="${S.token ? t("chatPh") : t("loginToChat")}" maxlength="200" enterkeyhint="send"><button class="rbtn" id="wsend" style="width:36px;height:36px;background:none">${ic("send")}</button></div>
      <button class="rbtn" id="wr">❤️</button><button class="rbtn hot" id="we">${ic("spark")}</button><button class="rbtn" id="wm">${ic("layers")}</button>
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
  const addChat = (html, cls = "", fade = true) => {
    const d = document.createElement("div"); d.className = "cm " + cls; d.innerHTML = html; chatEl.appendChild(d);
    while (chatEl.children.length > 40) chatEl.firstChild.remove();
    if (fade) setTimeout(() => { d.classList.add("fade"); setTimeout(() => d.remove(), 1300); }, 20000);
  };
  const chatHtml = (m) => `${m.host ? `<span class="tag">${t("hostTag")}</span>` : m.guest ? `<span class="tag" style="background:var(--grad2)">${t("guestTag")}</span>` : ""}<b style="color:${esc(m.color)}">${esc(m.name)}</b>${esc(m.text)}`;
  const offline = (txt) => {
    $$(".wtop .badge.red").forEach((b) => (b.parentElement.style.display = "none"));
    if ($(".offline", stageEl)) return;
    const o = document.createElement("div"); o.className = "offline";
    o.innerHTML = `<div style="font-size:56px">📴</div><b style="color:#fff;font-size:18px">${txt}</b><button class="btn g" style="width:auto;padding:12px 24px;margin-top:10px">${t("back")}</button>`;
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
        (m.history || []).slice(-12).forEach((x) => addChat(chatHtml(x)));
        stage.setPubs(m.publishers); sawPubs = sawPubs || m.publishers.length > 0;
        if (!m.publishers.length) addChat(t("pendingLive"), "sys");
        $("#wv").innerHTML = ic("eye") + " " + fmtN(m.viewers);
        poll = m.poll; renderPoll(); setHype(m.hype.v, m.hype.lvl);
        if (m.pinned) showPin(m.pinned);
        break;
      case "publishers": stage.setPubs(m.list); sawPubs = true; break;
      case "privacy": stage.setPrivacy(m.uid, m.on); break;
      case "viewers": $("#wv").innerHTML = ic("eye") + " " + fmtN(m.n); break;
      case "chat": addChat(chatHtml(m)); break;
      case "react": if (m.uid !== me.uid) FX.floaty($("#wfx"), m.e); break;
      case "effect":
        FX.play(m.id, $("#wfx"), stageEl, $("#fx"));
        addChat(`<b style="color:${esc(m.color)}">${esc(m.name)}</b>${t("sentFx")} ${(FX.list.find((x) => x.id === m.id) || {}).e || "✨"}`, "fx");
        break;
      case "hype": setHype(m.v, m.lvl); if (m.train) { const d = document.createElement("div"); d.className = "train"; d.textContent = t("hypeTrain") + " x" + m.lvl; $("#watch").appendChild(d); setTimeout(() => d.remove(), 2700); FX.play("confetti", null, null, $("#fx")); } break;
      case "poll": if (!poll || poll.id !== m.poll.id) myVote = null; poll = m.poll; renderPoll(); break;
      case "challenges":
        if (m.changed && hostInfo) {
          const c = m.changed, hn = esc(hostInfo.name);
          if (c.state === "accepted") banner(`🏆 ${hn} ${t("chAccepted")}<br><span style="font-weight:500">${esc(c.text)}</span>`);
          if (c.state === "done") { banner(`🎉 ${hn} ${t("chDone")}`); FX.play("confetti", null, null, $("#fx")); }
          if (c.state === "failed") banner(`😅 ${hn} ${t("chFailed")}`);
        }
        root._ch = m.list;
        break;
      case "pinned": showPin(m.msg); break;
      case "layout": stage.mode = m.mode; stage.focus = m.focus; stage.layout(); break;
      case "guest-pending": toast(t("reqSent")); break;
      case "guest-ok":
        haptic("success");
        sheet(`<div style="text-align:center"><div style="font-size:52px">🎮</div><h3 style="margin-top:6px">${esc(t("invited", { n: m.host }))}</h3><p class="mut" style="margin-bottom:16px">${esc(m.title)}</p></div>
          <button class="btn p" id="gj">${ic("live")} ${t("joinNow")}</button><button class="btn g" style="margin-top:8px" id="gl">${t("later")}</button>`,
          (sh, close) => { $("#gj", sh).onclick = () => { close(); go("golive", { joinRoom: id, hostName: m.host }); }; $("#gl", sh).onclick = close; });
        break;
      case "guest-no": toast("🙏"); break;
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
    $("#wn").textContent = s.host.name;
    $("#wg").innerHTML = (s.game ? gIcon(s.gameIcon) + esc(s.game) + " · " : "") + esc(s.title);
    if (S.user && S.user.id !== s.uid) {
      isFollowing = S.following.has(s.uid);
      const fb = $("#wf"); fb.classList.remove("hide");
      const upd = () => { fb.textContent = isFollowing ? t("unfollow") : t("follow"); fb.classList.toggle("on", isFollowing); };
      upd();
      fb.onclick = async () => { isFollowing = !isFollowing; upd(); haptic(); await api("/api/follow", { target: s.uid, on: isFollowing }); isFollowing ? S.following.add(s.uid) : S.following.delete(s.uid); };
    }
    $("#wh").onclick = () => go("user", s.host.handle);
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
  $("#wr").onclick = () => { const e = ["❤️", "🔥", "😂", "👏", "😮", "💯"][Math.random() * 6 | 0]; FX.floaty($("#wfx"), e); if (Date.now() - lastR > 250) { ws.send({ t: "react", e }); lastR = Date.now(); } haptic(); FX.audio(); };
  $("#we").onclick = () => {
    FX.audio();
    sheet(`<h3>${t("react")}</h3><div class="emoji">${["❤️", "🔥", "😂", "👏", "😮", "💯", "🏆"].map((e) => `<button data-e="${e}">${e}</button>`).join("")}</div>
      <h3>${t("effects")}</h3><div class="fxgrid">${FX.list.map((f) => `<button class="fxb" data-fx="${f.id}">${f.e}<small>${S.lang === "ar" ? f.ar : f.en}</small></button>`).join("")}</div>
      <button class="btn g" style="margin-top:16px" id="sch">${ic("trophy")} ${t("challenge")}</button>`,
      (sh, close) => {
        $$("[data-e]", sh).forEach((b) => (b.onclick = () => { FX.floaty($("#wfx"), b.dataset.e, 3); ws.send({ t: "react", e: b.dataset.e }); haptic(); }));
        $$("[data-fx]", sh).forEach((b) => (b.onclick = () => { if (!S.token) return toast(terr("login")); ws.send({ t: "effect", id: b.dataset.fx }); haptic("medium"); close(); }));
        $("#sch", sh).onclick = () => { close(); challengeSheet(); };
      });
  };
  const challengeSheet = () => {
    const list = root._ch || [];
    sheet(`<h3>${ic("trophy")} ${t("challenges")}</h3>
      <div class="row"><input class="inp" id="chi" placeholder="${t("challengePh")}" maxlength="90"><button class="btn p" style="width:auto;padding:15px 18px" id="chs">${ic("send")}</button></div>
      <div id="chl">${list.length ? list.map((c) => `<div class="chl"><div class="row"><b style="color:${esc(c.color)};font-size:13px">${esc(c.name)}</b><span class="sp"></span><span class="st ${c.state}">${c.state === "new" ? "🔥 " + c.up : t(c.state === "accepted" ? "accept" : c.state)}</span></div>
        <div style="margin-top:6px;font-size:15px">${esc(c.text)}</div>${c.state === "new" ? `<button class="mini" style="margin-top:8px" data-up="${c.id}">+1 🔥</button>` : ""}</div>`).join("") : `<p class="mut" style="padding:20px;text-align:center">${t("noCh")}</p>`}</div>`,
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
  const cfg = Object.assign({ title: "", game: "", gameIcon: "", cat: "action", quality: "720", fps: 30, mic: true, privacy: { dnd: true, callGuard: true, bannerGuard: true } }, store.get("golive", {}));
  cfg.privacy = Object.assign({ dnd: true, callGuard: true, bannerGuard: true }, cfg.privacy || {});
  const nat = Native.has();
  const webCap = !nat && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && !/iphone|ipad|android/i.test(navigator.userAgent);
  const sw = (k, on) => `<div class="sw ${on ? "on" : ""}" data-sw="${k}"></div>`;
  root.innerHTML = `<div class="view"><div class="top"><button class="ibtn" id="gb">${ic("back")}</button><div class="h1">${joining ? t("costream") : t("goLive")}</div></div>
  <div class="scroll" style="padding-bottom:calc(30px + var(--sb))">
    ${joining ? `<div class="tile" style="text-align:center"><div style="font-size:40px">🤝</div><b>${esc(t("invited", { n: arg.hostName || "" }))}</b></div>` : `
    <div class="field"><label>${t("title")}</label><input class="inp" id="gt" maxlength="80" placeholder="${t("titlePh")}" value="${esc(cfg.title)}"></div>
    <div class="field"><label>${t("game")}</label><button class="gpick" id="gg"></button></div>
    <div class="field"><label>${t("cat")}</label><div class="chips" id="gc">${CATS.slice(1).map((c) => `<button class="chip ${cfg.cat === c ? "on" : ""}" data-c="${c}">${CAT_EMO[c]} ${t(c)}</button>`).join("")}</div></div>`}
    <div class="row" style="gap:12px;margin-top:6px">
      <div style="flex:1"><label class="small mut" style="display:block;margin:0 4px 7px">${t("quality")}</label><div class="seg" id="gq">${["540", "720", "1080"].map((q) => `<button class="${cfg.quality === q ? "on" : ""}" data-q="${q}">${q}p</button>`).join("")}</div></div>
      <div style="width:120px"><label class="small mut" style="display:block;margin:0 4px 7px">${t("fps")}</label><div class="seg" id="gf">${[30, 60].map((f) => `<button class="${cfg.fps === f ? "on" : ""}" data-f="${f}">${f}</button>`).join("")}</div></div>
    </div>
    <div class="tile" style="padding:4px 14px;margin-top:14px">
      <div class="tg"><div class="ic">${ic("mic")}</div><div class="tx"><b>${t("mic")}</b><span>${t("micD")}</span></div>${sw("mic", cfg.mic)}</div>
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
      $("#gg").innerHTML = (cfg.gameIcon || cfg.gameIconData ? gIcon(cfg.gameIcon || cfg.gameIconData) : `<div class="ph2">🎮</div>`) +
        `<div style="flex:1;min-width:0"><b style="display:block;font-size:16px">${esc(cfg.game || t("pickGame"))}</b><span class="mut small">${cfg.game ? t("change") : t("searchGames")}</span></div><span class="mut">›</span>`;
    };
    showGame();
    $("#gg").onclick = () => gamePicker((g) => { cfg.game = g.name || ""; cfg.gameIcon = g.icon || ""; cfg.gameIconData = g.iconData || ""; showGame(); });
    $$("#gc .chip").forEach((b) => (b.onclick = () => { cfg.cat = b.dataset.c; $$("#gc .chip").forEach((x) => x.classList.toggle("on", x === b)); }));
  }
  $$("#gq button").forEach((b) => (b.onclick = () => { cfg.quality = b.dataset.q; $$("#gq button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("#gf button").forEach((b) => (b.onclick = () => { cfg.fps = +b.dataset.f; $$("#gf button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("[data-sw]").forEach((s) => (s.onclick = () => {
    const k = s.dataset.sw; s.classList.toggle("on"); const on = s.classList.contains("on"); haptic();
    if (k === "mic") cfg.mic = on; else cfg.privacy[k] = on;
    if (k === "dnd" && on && isAndroid()) Native.post("perm", { kind: "dnd" });
  }));
  const fg = $("#gfg"); if (fg) fg.onclick = focusGuide;
  $("#gs").onclick = async () => {
    if (!joining) cfg.title = $("#gt").value.trim();
    store.set("golive", { ...cfg, gameIconData: "" });
    if (!nat && !webCap) return toast(t("needApp"));
    const b = $("#gs"); b.disabled = true;
    const r = await api("/api/go-live", { ...cfg, gameIconData: cfg.gameIconData || undefined, joinRoom: arg.joinRoom, device: S.native && S.native.device });
    b.disabled = false;
    if (r.error) return toast(terr(r.error));
    S.live = { ...r.job, title: cfg.title, game: cfg.game, startedAt: Date.now() };
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
  root.innerHTML = `<div class="view"><div class="top"><div class="brand" style="font-size:20px"><span class="badge red" id="sb">LIVE</span></div><div class="sp"></div>
    <button class="ibtn" id="ssh">${ic("share")}</button><button class="ibtn" id="sx" style="color:#ff7b88">${ic("stop")}</button></div>
  <div class="scroll" style="padding-bottom:calc(30px + var(--sb))">
    <div class="lvcard"><div class="row"><div><div class="small" style="color:#d6d1ee">${t("liveFor")}</div><div class="big" id="sd">0:00</div></div><div class="sp"></div>
      <div style="text-align:end"><div class="small" style="color:#d6d1ee" id="sst">${t("starting")}</div>${job.rec ? `<div class="small" style="color:#ff7b88;margin-top:3px">● ${t("recording")}</div>` : ""}<div style="font-weight:700;margin-top:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(job.title || "")}</div></div></div>
      <div class="kpis"><div class="kpi"><b id="kv">0</b><span>${t("viewers")}</span></div><div class="kpi"><b id="kp">0</b><span>${t("peak")}</span></div><div class="kpi"><b id="kh">x1</b><span>${t("hypeLvl")}</span></div></div>
    </div>
    <div id="shint"></div>
    <div class="shield" id="sshield"><div class="ic">${ic("shield")}</div><div style="flex:1"><b id="sshT">${t("shieldOn")}</b><div class="small mut" id="sshD"></div></div></div>
    <div class="acts">
      <button class="act ${st.overlay ? "on" : ""}" id="aov">${ic("chat")}<span>${t("overlay")}</span></button>
      <button class="act" id="acam">${ic("cam")}<span>${t("camBubble")}</span></button>
      <button class="act" id="apoll">${ic("poll")}<span>${t("poll")}</span></button>
      <button class="act" id="ach">${ic("trophy")}<span>${t("challenges")}</span></button>
      <button class="act" id="areq">${ic("users")}<span>${t("costream")}</span></button>
      <button class="act" id="apv">${ic("eye")}<span>${t("preview")}</span></button>
      <button class="act" id="afg">${ic("bell")}<span>${t("privacy")}</span></button>
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
    el.innerHTML = st.chat.slice(-60).reverse().map((m) => `<div class="sm">${avatar(m)}<div class="tx"><b style="color:${esc(m.color)}">${esc(m.name)}</b><br>${esc(m.text)}</div>
      ${job.role === "host" && m.uid !== S.user.id ? `<button class="mini" data-pin="${m.id}">${ic("pin")}</button><button class="mini" data-inv="${m.uid}" data-n="${esc(m.name)}">${ic("users")}</button>` : ""}</div>`).join("");
    $$("[data-pin]", el).forEach((b) => (b.onclick = () => { ws.send({ t: "pin", id: b.dataset.pin }); toast(t("pin") + " ✓"); }));
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
  ws.on((m) => {
    switch (m.t) {
      case "hello":
        st.chat = m.history || []; renderChat(); st.viewers = m.viewers; st.pubs = m.publishers || [];
        if (m.requests) { st.reqs = m.requests; dot($("#areq"), st.reqs.length); }
        st.ch = m.challenges || []; dot($("#ach"), st.ch.filter((c) => c.state === "new").length);
        st.hype = m.hype.v; st.lvl = m.hype.lvl; st.guests = m.guests || []; st.poll = m.poll;
        upd(); if (st.pubs.find((p) => p.uid === S.user.id)) setState("live");
        if (m.meta && m.meta.ended) { toast(t("endedT")); endLive(); }
        break;
      case "chat": st.chat.push(m); renderChat(); break;
      case "viewers": st.viewers = m.n; st.peak = Math.max(st.peak, m.n); upd(); break;
      case "hype": st.hype = m.v; st.lvl = m.lvl; upd(); if (m.train) haptic("success"); break;
      case "requests": st.reqs = m.list; dot($("#areq"), st.reqs.length); if (m.list.length) haptic(); break;
      case "challenges": st.ch = m.list; dot($("#ach"), st.ch.filter((c) => c.state === "new").length); break;
      case "guests": st.guests = m.list; break;
      case "poll": st.poll = m.poll; break;
      case "publishers": st.pubs = m.list; if (m.list.find((p) => p.uid === S.user.id)) setState("live"); previewStage && previewStage.setPubs(m.list);
        if (nat) Native.post("voice", { room: job.room, pub: job.pub, server: location.origin, publishers: m.list, me: S.user.id });
        break;
      case "privacy": if (m.uid === S.user.id) { st.privacy = m.on; setShield(); } previewStage && previewStage.setPrivacy(m.uid, m.on); break;
      case "effect": haptic("medium"); break;
      case "kicked": case "ended": endLive(); break;
      case "err": toast(terr(m.e)); break;
    }
  });
  const upd = () => { $("#kv").textContent = fmtN(st.viewers); st.peak = Math.max(st.peak, st.viewers); $("#kp").textContent = fmtN(st.peak); $("#kh").textContent = "x" + st.lvl; };
  const setState = (s) => {
    S.bstate = s;
    $("#sst").textContent = s === "live" ? "● " + t("onAir") : s === "stopped" ? t("stopped") : t("starting");
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
      if (e.error) toast(esc(e.error), 4000);
      if (e.state === "stopped") { api("/api/end", { room: job.room, pub: job.pub }); S.live = null; setTimeout(() => current === "studio" && go("home"), 1500); }
    }
    if (e.type === "privacy") { st.privacy = e.on; setShield(); }
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
  $("#afg").onclick = () => (isIOS() ? focusGuide() : Native.post("perm", { kind: "dnd" }));
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
      $("#chlist", sh).innerHTML = st.ch.length ? st.ch.map((c) => `<div class="chl"><div class="row"><b style="color:${esc(c.color)};font-size:13px">${esc(c.name)}</b><span class="sp"></span><span class="st ${c.state}">${c.state === "new" ? "🔥 " + c.up : t(c.state === "accepted" ? "accept" : c.state)}</span></div>
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
function profileHtml(r, self) {
  const u = r.user;
  const since = new Date(u.created || Date.now()).toLocaleDateString(S.lang === "ar" ? "ar" : "en", { year: "numeric", month: "long" });
  const kp = (n, l) => `<div class="kpi" style="background:var(--card);border:1px solid var(--line)"><b>${n}</b><span class="mut">${l}</span></div>`;
  return `<div style="text-align:center;margin-top:8px">
    <div style="position:relative;width:96px;margin:0 auto">${avatar(u, "lg", "width:96px;height:96px;margin:0 auto")}
      ${self ? `<button id="pcam" style="position:absolute;bottom:-2px;inset-inline-end:-4px;width:34px;height:34px;border-radius:50%;background:var(--grad);display:grid;place-items:center;border:3px solid var(--bg)">${ic("cam")}</button>` : ""}</div>
    <div style="font-size:24px;font-weight:800;margin-top:14px">${esc(u.name)}</div>
    <div class="mut" dir="ltr">@${esc(u.handle)}</div>
    ${u.bio ? `<div style="margin-top:10px;color:#e6e1ff;line-height:1.6">${esc(u.bio)}</div>` : ""}
    ${u.link ? `<a href="${esc(u.link)}" target="_blank" rel="noopener" class="chip" style="display:inline-flex;gap:6px;margin-top:10px;text-decoration:none;color:#b9a8ff">${ic("globe")} ${esc(u.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))}</a>` : ""}
    <div class="small mut" style="margin-top:8px">${t("joined")} ${esc(since)}</div>
  </div>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
    ${kp(fmtN(r.followers), t("followers"))}${kp(fmtN(r.following), t("followingN"))}${kp(fmtN(r.streamsCount), t("streamsN"))}
    ${kp(r.hours, t("hoursN"))}${kp(fmtN(r.bestPeak), t("bestPeak"))}${kp(r.games.length, t("gamesPlayed"))}
  </div>
  <div id="pact"></div>
  ${r.games.length ? `<div class="h2">${ic("game")} ${t("gamesPlayed")}</div><div class="chips">${r.games.map((g) => `<span class="chip gchip">${g.icon ? gIcon(g.icon) : "🎮"}<span>${esc(g.name)}</span><b>${g.n}</b></span>`).join("")}</div>` : ""}
  <div class="h2">${t("past")}</div>
  <div class="sl">${r.streams.length ? r.streams.map((s) => `<div class="sm" data-id="${s.id}" data-rec="${s.rec && !s.live ? 1 : ""}" style="align-items:center">${s.gameIcon ? gIcon(s.gameIcon, "gi", 40) : `<div class="ph2" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--card2)">🎮</div>`}
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
  root.innerHTML = `<div class="view"><div class="top"><div class="h1">${t("profile")}</div><div class="sp"></div><button class="ibtn" id="mset">${ic("gear")}</button></div>
  <div class="scroll" id="ms"><div style="height:200px;position:relative"><div class="spin"></div></div></div></div>`;
  $("#mset").onclick = () => go("settings");
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
  const cols = ["#7C5CFF", "#FF4D8D", "#00D1FF", "#FFB800", "#2EE59D", "#FF6B3D", "#B26BFF", "#3DDCFF"];
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
    <div class="field"><label>${t("color")}</label><div class="row" style="flex-wrap:wrap">${cols.map((c) => `<button data-c="${c}" style="width:40px;height:40px;border-radius:50%;background:${c};box-shadow:${c === col ? "0 0 0 3px #fff" : "none"}"></button>`).join("")}</div></div>
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
      $("#pact").innerHTML = `<button class="btn ${fol ? "g" : "p"}" id="uf" style="margin-top:14px">${fol ? t("unfollow") : t("follow")}</button>`;
      $("#uf").onclick = async () => { fol = !fol; const fb = $("#uf"); fb.className = "btn " + (fol ? "g" : "p"); fb.textContent = fol ? t("unfollow") : t("follow"); haptic(); await api("/api/follow", { target: u.id, on: fol }); fol ? S.following.add(u.id) : S.following.delete(u.id); };
    }
    bindStreams($("#us"), r, false);
  });
};

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
