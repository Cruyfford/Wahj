// Wahj Live — Cloudflare Worker backend
// Accounts, stream directory, Cloudflare Realtime SFU proxy, realtime rooms.
import APP_HTML from "./app.html";
import GAMES from "./games.json";
import HLS_JS from "./lib/hls.txt";
import { parseInit, remux } from "./ts.js";
import EN_TXT from "./lib/en.txt";

const SFU = "https://rtc.live.cloudflare.com/v1";
const VERSION = "1.0.0";

const J = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...h },
  });
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, x-pub",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
};
const rid = (n = 10) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => a[x % a.length]).join("");
};
const now = () => Date.now();

function hubStub(env) {
  return env.HUB.get(env.HUB.idFromName("hub"));
}
function roomStub(env, id) {
  return env.ROOM.get(env.ROOM.idFromName("r:" + id));
}
async function hub(env, path, body) {
  const r = await hubStub(env).fetch("https://hub" + path, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
  return r.json();
}
function bearer(req) {
  const a = req.headers.get("authorization") || "";
  return a.startsWith("Bearer ") ? a.slice(7).trim() : new URL(req.url).searchParams.get("token") || "";
}

// ---------- email (Resend API, optional) ----------
// ---- i18n ----
let _i18nV = "";
function I18N_V() { if (!_i18nV) { let h = 5381; const src = "v2|" + EN_TXT; for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0; _i18nV = (h >>> 0).toString(36); } return _i18nV; }
const I18N_LANGS = new Set("af am az be bg bn bs ca ceb cs cy da de el es et fa fi fr ga gl gu ha he hi hr ht hu hy id ig is it ja jv ka kk km kn ko lb lo lt lv mg mk ml mn mr ms my ne nl no pa pl ps pt ro ru sd si sk sl so sq sr su sv sw ta th tl tr uk ur uz vi xh yo zh zu".split(" "));
const _i18nMem = {};
const LANG_EN = { af: "Afrikaans", am: "Amharic", az: "Azerbaijani", be: "Belarusian", bg: "Bulgarian", bn: "Bengali", bs: "Bosnian", ca: "Catalan", ceb: "Cebuano", cs: "Czech", cy: "Welsh", da: "Danish", de: "German", el: "Greek", es: "Spanish", et: "Estonian", fa: "Persian (Farsi)", fi: "Finnish", fr: "French", ga: "Irish", gl: "Galician", gu: "Gujarati", ha: "Hausa", he: "Hebrew", hi: "Hindi", hr: "Croatian", ht: "Haitian Creole", hu: "Hungarian", hy: "Armenian", id: "Indonesian", ig: "Igbo", is: "Icelandic", it: "Italian", ja: "Japanese", jv: "Javanese", ka: "Georgian", kk: "Kazakh", km: "Khmer", kn: "Kannada", ko: "Korean", lb: "Luxembourgish", lo: "Lao", lt: "Lithuanian", lv: "Latvian", mg: "Malagasy", mk: "Macedonian", ml: "Malayalam", mn: "Mongolian", mr: "Marathi", ms: "Malay", my: "Burmese", ne: "Nepali", nl: "Dutch", no: "Norwegian (Bokmål)", pa: "Punjabi", pl: "Polish", ps: "Pashto", pt: "Portuguese", ro: "Romanian", ru: "Russian", sd: "Sindhi", si: "Sinhala", sk: "Slovak", sl: "Slovenian", so: "Somali", sq: "Albanian", sr: "Serbian (Cyrillic)", su: "Sundanese", sv: "Swedish", sw: "Swahili", ta: "Tamil", te: "Telugu", th: "Thai", tl: "Filipino (Tagalog)", tr: "Turkish", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek (Latin)", vi: "Vietnamese", xh: "Xhosa", yo: "Yoruba", zh: "Simplified Chinese", zu: "Zulu" };
// reject outputs that leak letters from an unrelated script (e.g. Hangul inside Urdu)
const SCRIPTS = [[/[\uAC00-\uD7AF\u1100-\u11FF]/, ["ko"]], [/[\u3040-\u30FF]/, ["ja"]], [/[\u4E00-\u9FFF]/, ["zh", "ja"]], [/[\u0600-\u06FF]/, ["fa", "ur", "ps", "sd"]],
  [/[\u0400-\u04FF]/, ["ru", "uk", "bg", "sr", "mk", "be", "kk", "mn"]], [/[\u0590-\u05FF]/, ["he"]], [/[\u0900-\u097F]/, ["hi", "mr", "ne"]], [/[\u0E00-\u0E7F]/, ["th"]]];
const NON_LATIN = new Set("am be bg bn el fa gu he hi hy ja ka kk km kn ko lo mk ml mn mr my ne pa ps ru sd si sr ta te th uk ur zh".split(" "));
const scriptOk = (lang, v) => SCRIPTS.every(([re, ok]) => ok.includes(lang) || !re.test(v));
const I18N_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/google/gemma-3-12b-it"];
async function i18nBatch(env, lang, part) {
  const sys = `You are a professional app localizer. Translate the JSON values of a mobile GAME LIVE-STREAMING app (like Twitch/Kick) from English into ${LANG_EN[lang]}.
Rules: use the natural terms gamers in that language actually use ("Go live" = start a live broadcast, "stream" = live broadcast, "streamer", "chat", "followers", "coins", "VIP", "co-stream", "clip").
Keep it short like real app UI. Keep every {placeholder} exactly as written. Keep "Wahj", "Wahj Live", "VIP", "PayPal", "YouTube", "Wi-Fi", "XP", "LIVE" unchanged. Keep emoji-free. Do not translate keys.
Return ONLY a JSON object with exactly the same keys.`;
  for (const model of I18N_MODELS) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(part) }], max_tokens: 4096, temperature: 0.2 });
      let txt = r && (typeof r.response === "string" ? r.response : JSON.stringify(r.response || ""));
      const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
      if (a < 0 || b < a) continue;
      const o = JSON.parse(txt.slice(a, b + 1)), out = {};
      for (const k in part) {
        const v = typeof o[k] === "string" ? o[k].trim() : "";
        const ph = part[k].match(/\{\w+\}/g) || [];
        // in non-Latin languages an untranslated English sentence is a miss (brand words alone are fine)
        const untranslated = NON_LATIN.has(lang) && v === part[k] && /[a-z]{3,}/i.test(part[k].replace(/Wahj|Live|VIP|LIVE|XP|PayPal|YouTube|Wi-?Fi|\{\w+\}/g, ""));
        if (v && ph.every((p) => v.includes(p)) && scriptOk(lang, v) && !untranslated) out[k] = v;
      }
      if (Object.keys(out).length >= Object.keys(part).length * 0.7) return out;
    } catch (e) {}
  }
  return {};
}
async function i18n(env, lang) {
  if (!I18N_LANGS.has(lang) || !LANG_EN[lang]) return { error: "lang" };
  const v = I18N_V(), key = `i18n/${lang}-${v}.json`;
  if (_i18nMem[key]) return { v, lang, d: _i18nMem[key] };
  if (env.REC) { const o = await env.REC.get(key); if (o) { const d = await o.json(); _i18nMem[key] = d; return { v, lang, d }; } }
  if (!env.AI) return { error: "ai_off" };
  const en = JSON.parse(EN_TXT), keys = Object.keys(en), parts = [];
  for (let i = 0; i < keys.length; i += 40) { const p = {}; keys.slice(i, i + 40).forEach((k) => (p[k] = en[k])); parts.push(p); }
  const res = await Promise.all(parts.map((p) => i18nBatch(env, lang, p)));
  const out = Object.assign({}, ...res);
  // second pass for anything missing or rejected
  const miss = keys.filter((k) => !out[k]);
  for (let i = 0; i < miss.length; i += 30) { const p = {}; miss.slice(i, i + 30).forEach((k) => (p[k] = en[k])); Object.assign(out, await i18nBatch(env, lang, p)); }
  if (!Object.keys(out).length) return { error: "ai_fail" };
  const partial = Object.keys(out).length < keys.length * 0.97;
  if (!partial) { _i18nMem[key] = out; if (env.REC) await env.REC.put(key, JSON.stringify(out), { httpMetadata: { contentType: "application/json" } }); }
  return { v, lang, d: out, partial, n: Object.keys(out).length, of: keys.length };
}

// ---- YouTube simulcast over HLS ingest (same fMP4 segments the phone already uploads) ----
async function ytForward(env, room, n, buf, yt) {
  // YouTube HLS ingest only accepts MPEG-TS segments → remux the phone's fMP4 segments on the fly
  const base = "https://a.upload.youtube.com/http_upload_hls?cid=" + encodeURIComponent(yt.key) + "&copy=0&file=";
  const put = (file, body, type) => fetch(base + file, { method: "PUT", body, headers: { "content-type": type, "user-agent": "Wahj / Live / 1.0" } });
  let ok = true, code = 0, msg = "";
  if (n < 0) { ok = !!yt.meta; msg = yt.meta ? "init parsed" + (yt.meta.a ? " +audio" : " no-audio") : "init parse failed"; }
  else try {
    if (!yt.meta) throw new Error("no init");
    const ts = remux(buf, yt.meta);
    if (!ts) throw new Error("remux: no video samples");
    const r = await put("s" + yt.init + "_" + n + ".ts", ts, "video/mp2t");
    code = r.status; ok = r.ok;
    if (!ok) msg = (await r.text().catch(() => "")).slice(0, 200);
    if (ok && yt.segs.length) {
      const td = Math.ceil(Math.max(...yt.segs.map((x) => x.dur), 2));
      let m = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${td}\n#EXT-X-MEDIA-SEQUENCE:${yt.segs[0].n}\n#EXT-X-DISCONTINUITY-SEQUENCE:${yt.init}\n`;
      for (const sg of yt.segs) m += `#EXTINF:${(+sg.dur).toFixed(3)},\ns${yt.init}_${sg.n}.ts\n`;
      const p = await put("live.m3u8", m, "application/vnd.apple.mpegurl");
      if (!p.ok) { ok = false; code = p.status; msg = "playlist " + (await p.text().catch(() => "")).slice(0, 200); }
    }
    if (ok) msg = (ts.length / 1024 | 0) + "KB ts";
  } catch (e) { ok = false; msg = String(e && e.message || e).slice(0, 200); }
  // tell the studio (first segments, every 10th, and on every failure)
  if (!ok || n <= 3 || n % 10 === 0) await hub(env, "/yt-stat", { room, ok, code, msg, n }).catch(() => {});
}

async function sendMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM || "Wahj Live <onboarding@resend.dev>", to: [to], subject, html }),
    });
    return r.ok;
  } catch (e) { return false; }
}
function mailBox(title, body, cta, url) {
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0912;padding:28px;color:#f4f2ff">
  <div style="max-width:460px;margin:auto;background:#15121f;border-radius:20px;padding:26px;border:1px solid #2a2438">
  <div style="font-size:22px;font-weight:800;margin-bottom:6px"><span style="color:#ff4d8d">وهج</span> Live</div>
  <div style="font-size:18px;font-weight:700;margin:14px 0 8px">${title}</div>
  <div style="font-size:15px;line-height:1.8;color:#cfcae6">${body}</div>
  ${cta ? `<a href="${url}" style="display:inline-block;margin-top:18px;background:linear-gradient(120deg,#7C5CFF,#FF4D8D);color:#fff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:700">${cta}</a>` : ""}
  </div></div>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- ICE servers (STUN + optional Cloudflare TURN) ----------
async function iceServers(env) {
  const list = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
  if (env.TURN_KEY_ID && env.TURN_KEY_TOKEN) {
    try {
      const r = await fetch(`${SFU}/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.TURN_KEY_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (r.ok) {
        const j = await r.json();
        const s = j.iceServers;
        if (Array.isArray(s)) return s;
        if (s) list.push(s);
      }
    } catch (e) {}
  }
  return list;
}

// ---------- SFU proxy ----------
async function sfu(env, method, path, body) {
  if (!env.SFU_APP_ID || !env.SFU_APP_SECRET) return J({ error: "sfu_not_configured" }, 503);
  const r = await fetch(`${SFU}/apps/${env.SFU_APP_ID}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.SFU_APP_SECRET}`, "content-type": "application/json" },
    body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const t = await r.text();
  return new Response(t, { status: r.status, headers: { "content-type": "application/json", ...CORS } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (p === "/" || p.startsWith("/w/") || p === "/index.html") {
      return new Response(APP_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
      });
    }
    { const mm = p.match(/^\/clips\/([a-z0-9]+)\.(mp4|webm|jpg)$/);
      if (mm && env.REC) return r2Range(req, env, `clips/${mm[1]}.${mm[2]}`); }
    { const cm = p.match(/^\/c\/([a-z0-9]+)$/);
      if (cm) { const r = await hub(env, "/clip-get", { id: cm[1], view: true }); return clipPage(url, r.clip); } }
    if (p === "/hls.js") return new Response(HLS_JS, { headers: { "content-type": "application/javascript", "cache-control": "public, max-age=604800" } });
    if (p === "/health") return J({ ok: true, v: VERSION, rev: env.NATIVE_REV || "" });
    if (!p.startsWith("/api/")) return new Response("Not found", { status: 404 });

    let m0;
    try {
      // ---- config ----
      if (p === "/api/config") {
        return J({ v: VERSION, i18n: I18N_V(), ai: !!env.AI, rev: env.NATIVE_REV || "", ice: await iceServers(env), sfu: !!env.SFU_APP_ID, mail: !!env.RESEND_API_KEY, rec: !!env.REC });
      }
      if (p === "/api/ice") return J({ iceServers: await iceServers(env) });
      // ---- automatic UI translation (Workers AI m2m100), cached in R2 per language + string-set version ----
      { const im = p.match(/^\/api\/i18n\/([a-z]{2,3})$/); if (im) return J(await i18n(env, im[1])); }
      // ---- clips: upload (raw body), thumbnail, meta, lists, delete ----
      if (p === "/api/clip" && req.method === "POST" && env.REC) {
        const buf = await req.arrayBuffer();
        if (buf.byteLength < 1000 || buf.byteLength > 60e6) return J({ error: "size" }, 400);
        const ext = url.searchParams.get("ext") === "webm" ? "webm" : "mp4";
        const r = await hub(env, "/clip-new", { token: bearer(req), room: url.searchParams.get("room") || "", title: url.searchParams.get("title") || "", dur: +url.searchParams.get("dur") || 0, size: buf.byteLength, ext });
        if (r.error) return J(r, 400);
        await env.REC.put(`clips/${r.id}.${ext}`, buf, { httpMetadata: { contentType: ext === "webm" ? "video/webm" : "video/mp4" } });
        ctx.waitUntil(roomPost(env, url.searchParams.get("room") || "", "/clip", { id: r.id, name: r.name, title: r.title }));
        return J({ ok: true, id: r.id, url: url.origin + "/c/" + r.id });
      }
      { const cm = p.match(/^\/api\/clip\/([a-z0-9]+)(\/thumb|\/del)?$/);
        if (cm) {
          if (cm[2] === "/thumb" && req.method === "POST" && env.REC) {
            const buf = await req.arrayBuffer(); if (buf.byteLength > 2e6) return J({ error: "size" }, 400);
            const r = await hub(env, "/clip-thumb", { token: bearer(req), id: cm[1] }); if (r.error) return J(r, 403);
            await env.REC.put(`clips/${cm[1]}.jpg`, buf, { httpMetadata: { contentType: "image/jpeg" } }); return J({ ok: true });
          }
          if (cm[2] === "/del" && req.method === "POST") {
            const r = await hub(env, "/clip-del", { token: bearer(req), id: cm[1] }); if (r.error) return J(r, 403);
            if (env.REC) { await env.REC.delete(`clips/${cm[1]}.${r.ext}`); await env.REC.delete(`clips/${cm[1]}.jpg`); }
            return J({ ok: true });
          }
          return J(await hub(env, "/clip-get", { id: cm[1], view: url.searchParams.get("view") === "1" }));
        } }
      if (p === "/api/clips") return J(await hub(env, "/clips", { host: url.searchParams.get("host") || "" }));

      // ---- diagnostics ----
      if (p === "/api/diag" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        await hub(env, "/diag-add", { ip: req.headers.get("cf-connecting-ip") || "", ua: (req.headers.get("user-agent") || "").slice(0, 80),
          src: String(b.src || "").slice(0, 20), room: String(b.room || "").slice(0, 20), msg: String(b.msg || "").slice(0, 800) });
        return J({ ok: true });
      }
      if (p === "/api/diag" && env.DIAG_KEY && url.searchParams.get("key") === env.DIAG_KEY) {
        return J(await hub(env, "/diag-get", { n: +url.searchParams.get("n") || 200 }));
      }

      // ---- recordings (R2, HLS fMP4) ----
      let mr = p.match(/^\/api\/rec\/([a-z0-9]+)\/(init|seg)$/);
      if (mr && req.method === "POST") {
        if (!env.REC) return J({ error: "rec_off" }, 503);
        const pub = req.headers.get("x-pub") || "", rkey = req.headers.get("x-rec") || "";
        const buf = await req.arrayBuffer();
        if (buf.byteLength < 8 || buf.byteLength > 25e6) return J({ error: "size" }, 400);
        const n = mr[2] === "init" ? -1 : Math.max(0, +url.searchParams.get("n") | 0);
        const dur = Math.min(30, Math.max(0, +url.searchParams.get("dur") || 0));
        let ytmeta = null; if (n < 0) { try { ytmeta = parseInit(buf); } catch (e) {} }
        const r = await hub(env, "/rec-seg", { pub, key: rkey, room: mr[1], n, dur, bytes: buf.byteLength, ytmeta,
          w: +url.searchParams.get("w") || 0, h: +url.searchParams.get("h") || 0 });
        if (!r.ok) return J(r, r.error === "auth" ? 401 : 409);
        if (r.yt) ctx.waitUntil(ytForward(env, mr[1], n, buf, r.yt));
        if (r.store === false) return J({ ok: true });
        await env.REC.put(`rec/${mr[1]}/${n < 0 ? "init.mp4" : n + ".m4s"}`, buf, { httpMetadata: { contentType: n < 0 ? "video/mp4" : "video/iso.segment" } });
        return J({ ok: true });
      }
      // whole recording as one fragmented MP4 (init + segments streamed back-to-back) — for saving to Photos/Files
      mr = p.match(/^\/api\/rec\/([a-z0-9]+)\/download\.mp4$/);
      if (mr && env.REC) {
        const r = await hub(env, "/rec-get", { id: mr[1] });
        if (!r.rec || !r.rec.init) return new Response("not found", { status: 404, headers: CORS });
        const keys = ["init.mp4", ...r.segs.map((x) => x.n + ".m4s")];
        const { readable, writable } = new TransformStream();
        ctx.waitUntil((async () => {
          const w = writable.getWriter();
          try { for (const k of keys) { const o = await env.REC.get(`rec/${mr[1]}/${k}`); if (!o) continue; const rd = o.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; await w.write(value); } } } catch (e) {}
          await w.close();
        })());
        const name = (r.rec.title || "wahj").replace(/[^\w\u0600-\u06FF -]/g, "").slice(0, 40) || "wahj";
        return new Response(readable, { headers: { "content-type": "video/mp4", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.mp4`, ...CORS } });
      }
      mr = p.match(/^\/api\/rec\/([a-z0-9]+)\/(index\.m3u8|init\.mp4|\d+\.m4s)$/);
      if (mr) {
        if (!env.REC) return new Response(null, { status: 404, headers: CORS });
        if (mr[2] === "index.m3u8") {
          const r = await hub(env, "/rec-get", { id: mr[1] });
          if (!r.rec || !r.rec.init) return new Response("not found", { status: 404, headers: CORS });
          const td = Math.ceil(Math.max(6, ...r.segs.map((x) => x.dur)));
          let m = `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:${td}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:${r.rec.ended ? "VOD" : "EVENT"}\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-MAP:URI="init.mp4"\n`;
          for (const sg of r.segs) m += `#EXTINF:${sg.dur.toFixed(3)},\n${sg.n}.m4s\n`;
          if (r.rec.ended) m += "#EXT-X-ENDLIST\n";
          return new Response(m, { headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": r.rec.ended ? "max-age=60" : "no-cache", ...CORS } });
        }
        const obj = await env.REC.get(`rec/${mr[1]}/${mr[2]}`);
        if (!obj) return new Response(null, { status: 404, headers: CORS });
        return new Response(obj.body, { headers: { "content-type": mr[2].endsWith(".mp4") ? "video/mp4" : "video/iso.segment", "cache-control": "public, max-age=31536000, immutable", "content-length": String(obj.size), ...CORS } });
      }
      if (p === "/api/recs") {
        return J(await hub(env, "/recs", { handle: url.searchParams.get("u") || "", token: bearer(req) }));
      }
      mr = p.match(/^\/api\/rec\/([a-z0-9]+|all)\/delete$/);
      if (mr && req.method === "POST") {
        const r = await hub(env, "/rec-del", { id: mr[1], token: bearer(req) });
        if (!r.ok) return J(r, 400);
        if (env.REC) ctx.waitUntil((async () => {
          for (const id of r.ids) {
            let cursor;
            do {
              const l = await env.REC.list({ prefix: `rec/${id}/`, cursor });
              if (l.objects.length) await env.REC.delete(l.objects.map((o) => o.key));
              cursor = l.truncated ? l.cursor : undefined;
            } while (cursor);
          }
        })());
        return J({ ok: true, ids: r.ids });
      }

      // ---- speed test ----
      if (p === "/api/speed/ping") {
        return J({ t: Date.now(), colo: (req.cf && req.cf.colo) || "", country: (req.cf && req.cf.country) || "" }, 200, { "cache-control": "no-store" });
      }
      if (p === "/api/speed/down") {
        const n = Math.min(30e6, Math.max(1e5, +url.searchParams.get("bytes") || 5e6));
        const chunk = new Uint8Array(65536);
        crypto.getRandomValues(chunk);
        let sent = 0;
        const stream = new ReadableStream({
          pull(c) {
            if (sent >= n) return c.close();
            const k = Math.min(chunk.length, n - sent);
            c.enqueue(k === chunk.length ? chunk : chunk.slice(0, k));
            sent += k;
          },
        });
        return new Response(stream, { headers: { "content-type": "application/octet-stream", "content-length": String(n), "cache-control": "no-store", ...CORS } });
      }
      if (p === "/api/speed/up" && req.method === "POST") {
        const r = req.body.getReader();
        let n = 0;
        for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > 40e6) break; }
        return J({ bytes: n }, 200, { "cache-control": "no-store" });
      }

      // ---- game catalog (App Store icons) ----
      if (p === "/api/games/top") {
        return J({ items: GAMES.slice(0, 48) }, 200, { "cache-control": "public, max-age=3600" });
      }
      if (p === "/api/games/search") {
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const items = q ? GAMES.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 24) : [];
        return J({ items });
      }
      m0 = p.match(/^\/api\/gameicon\/([a-z0-9]+)$/);
      if (m0) {
        const r = await roomStub(env, m0[1]).fetch("https://room/gameicon");
        if (!r.ok) return new Response(null, { status: 404, headers: CORS });
        return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") || "image/png", "cache-control": "max-age=86400", ...CORS } });
      }

      // ---- account ----
      if (p === "/api/register" || p === "/api/login") {
        const b = await req.json();
        b.ip = req.headers.get("cf-connecting-ip") || "";
        b.origin = url.origin;
        const r = await hub(env, p.slice(4), b);
        return J(r, r.error ? 400 : 200);
      }
      if ((p === "/api/forgot" || p === "/api/reset") && req.method === "POST") {
        const b = await req.json();
        b.ip = req.headers.get("cf-connecting-ip") || "";
        const r = await hub(env, p.slice(4), b);
        return J(r, r.error ? 400 : 200);
      }
      if ((p === "/api/password" || p === "/api/delete-account" || p === "/api/avatar") && req.method === "POST") {
        const b = await req.json();
        const r = await hub(env, p.slice(4), { ...b, token: bearer(req) });
        return J(r, r.error ? 400 : 200);
      }
      let ma = p.match(/^\/api\/avatar\/([a-z0-9]+)$/);
      if (ma) {
        const r = await hubStub(env).fetch("https://hub/avatar-get", { method: "POST", body: JSON.stringify({ uid: ma[1] }) });
        if (!r.ok) return new Response(null, { status: 404, headers: CORS });
        return new Response(r.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400", ...CORS } });
      }
      // ---- economy ----
      if (p === "/api/sub" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const r = await hub(env, "/sub", { ...b, token: bearer(req) });
        return J(r, r.error ? 400 : 200);
      }
      if (p === "/api/shop") return J({ packs: PACKS, vip: VIP_PRICE, sub: SUB_PRICE, shop: SHOP, gifts: GIFTS, pay: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET), mode: env.PAYPAL_MODE || "sandbox" });
      if (["/api/buy", "/api/equip", "/api/vip", "/api/wallet", "/api/admin/grant"].includes(p) && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const r = await hub(env, p.replace("/api", "").replace("/admin/grant", "/grant"), { ...b, token: bearer(req) });
        return J(r, r.error ? 400 : 200);
      }
      if (p === "/api/rewards" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        return J(await hub(env, "/rewards-set", { ...b, token: bearer(req) }));
      }
      if ((p === "/api/mod" || p === "/api/mods") && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const r = await hub(env, p.slice(4), { ...b, token: bearer(req) });
        return J(r, r.error ? 400 : 200);
      }
      if (p === "/api/streamers") {
        return J(await hub(env, "/streamers", { mode: url.searchParams.get("mode") || "month", token: bearer(req) }));
      }
      if (p === "/api/fans") {
        const u = await hub(env, "/user", { handle: url.searchParams.get("u") || "" });
        if (!u.user) return J({ top: [] });
        return J(await hub(env, "/loy-top", { host: u.user.id }));
      }
      if (p === "/api/pay/create" && req.method === "POST") {
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return J({ error: "pay_off" }, 400);
        const b = await req.json().catch(() => ({}));
        const me = await hub(env, "/me", { token: bearer(req) });
        if (!me.user) return J({ error: "auth" }, 401);
        const pack = PACKS[b.pack];
        if (!pack) return J({ error: "bad_pack" }, 400);
        const r = await paypal(env, "POST", "/v2/checkout/orders", {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: b.pack, custom_id: me.user.id + ":" + b.pack, description: `Wahj Live — ${pack.coins} coins`,
            amount: { currency_code: "USD", value: pack.usd } }],
          payment_source: { paypal: { experience_context: { brand_name: "Wahj Live", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
            return_url: url.origin + "/pay/return", cancel_url: url.origin + "/pay/cancel" } } },
        });
        const link = (r.data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
        if (!r.data.id || !link) return J({ error: "pay_fail", detail: JSON.stringify(r.data).slice(0, 300) }, 502);
        await hub(env, "/order-new", { id: r.data.id, uid: me.user.id, pack: b.pack, coins: pack.coins, usd: pack.usd });
        return J({ id: r.data.id, url: link.href });
      }
      if (p === "/api/donate" && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        const r = await hub(env, "/donate", { ...b, token: bearer(req) });
        if (r.error || !r.pending) return J(r, r.error ? 400 : 200);
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return J({ error: "pay_off" }, 400);
        const pp = await paypal(env, "POST", "/v2/checkout/orders", {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: r.id, custom_id: "don:" + r.id, description: `Wahj Live — support ${String(r.hostName).slice(0, 40)}`,
            amount: { currency_code: "USD", value: r.usd } }],
          payment_source: { paypal: { experience_context: { brand_name: "Wahj Live", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
            return_url: url.origin + "/pay/return", cancel_url: url.origin + "/pay/cancel" } } },
        });
        const link = (pp.data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
        if (!pp.data.id || !link) return J({ error: "pay_fail" }, 502);
        const me = await hub(env, "/me", { token: bearer(req) });
        await hub(env, "/order-new", { id: pp.data.id, uid: me.user.id, pack: "don:" + r.id, coins: 0, usd: r.usd });
        return J({ id: pp.data.id, url: link.href });
      }
      if ((p === "/api/goal") && req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        return J(await hub(env, "/goal", { ...b, token: bearer(req) }));
      }
      mr = p.match(/^\/api\/support\/([\w.-]+)$/);
      if (mr) return J(await hub(env, "/support-info", { host: mr[1] }));
      if (p === "/api/pay/status") {
        return J(await hub(env, "/order-get", { id: url.searchParams.get("id") || "", token: bearer(req) }));
      }
      if (p === "/pay/return" || p === "/pay/cancel") {
        const id = url.searchParams.get("token") || "";
        if (p === "/pay/cancel" || !id) return payPage(false, "تم إلغاء الدفع");
        const o = await hub(env, "/order-get", { id, raw: true });
        if (!o.order) return payPage(false, "طلب غير معروف");
        if (o.order.status !== "paid") {
          const r = await paypal(env, "POST", `/v2/checkout/orders/${id}/capture`, {});
          const cap = r.data.purchase_units && r.data.purchase_units[0].payments && r.data.purchase_units[0].payments.captures && r.data.purchase_units[0].payments.captures[0];
          const done = (r.data.status === "COMPLETED" || (r.data.details && r.data.details[0] && r.data.details[0].issue === "ORDER_ALREADY_CAPTURED")) &&
            (!cap || (cap.amount && cap.amount.value === o.order.usd && cap.amount.currency_code === "USD"));
          if (!done) return payPage(false, "لم يكتمل الدفع");
          await hub(env, "/order-paid", { id });
        }
        return payPage(true, String(o.order.pack).startsWith("don:") ? "شكراً لدعمك! وصل دعمك للستريمر" : `تمت إضافة ${o.order.coins} كوينز`);
      }
      if (p === "/api/me") return J(await hub(env, "/me", { token: bearer(req) }));
      if (p === "/api/profile" && req.method === "POST") {
        const b = await req.json();
        return J(await hub(env, "/profile", { ...b, token: bearer(req) }));
      }
      if (p.startsWith("/api/user/")) {
        return J(await hub(env, "/user", { handle: decodeURIComponent(p.slice(10)), token: bearer(req) }));
      }
      if (p === "/api/follow" && req.method === "POST") {
        const b = await req.json();
        return J(await hub(env, "/follow", { ...b, token: bearer(req) }));
      }

      // ---- streams ----
      if (p === "/api/live") return J(await hub(env, "/live", { token: bearer(req) }));
      if (p.startsWith("/api/stream/")) return J(await hub(env, "/stream", { id: p.slice(12) }));
      if (p === "/api/go-live" && req.method === "POST") {
        const b = await req.json();
        let iconData = null;
        if (typeof b.gameIconData === "string" && b.gameIconData.startsWith("data:image/") && b.gameIconData.length < 120000) iconData = b.gameIconData;
        delete b.gameIconData;
        if (iconData) b.gameIcon = "local";
        else if (!/^https:\/\/is\d+-ssl\.mzstatic\.com\//.test(b.gameIcon || "")) b.gameIcon = "";
        const r = await hub(env, "/go-live", { ...b, origin: url.origin, token: bearer(req) });
        if (iconData && r.job && r.job.role === "host") {
          const [head, data] = iconData.split(",");
          const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          await roomStub(env, r.job.room).fetch("https://room/gameicon", { method: "PUT", headers: { "content-type": head.slice(5).split(";")[0] }, body: bin });
        }
        return J(r, r.error ? 400 : 200);
      }
      if (p === "/api/pending") {
        // Used by the iOS broadcast extension (no shared container needed).
        return J(await hub(env, "/pending", { device: url.searchParams.get("device") || "" }));
      }
      if (p === "/api/end" && req.method === "POST") {
        const b = await req.json();
        const r = await hub(env, "/end", { ...b, token: bearer(req), pub: req.headers.get("x-pub") || b.pub });
        if (r.room) await roomStub(env, r.room).fetch("https://room/ended", { method: "POST", body: JSON.stringify(r) });
        return J(r);
      }

      // ---- thumbnails / heartbeat ----
      let m = p.match(/^\/api\/thumb\/([a-z0-9]+)$/);
      if (m) {
        if (req.method === "POST") {
          const pub = req.headers.get("x-pub") || "";
          const ok = await hub(env, "/beat", { pub, room: m[1] });
          if (!ok.ok) return J({ error: "auth", ended: !!ok.ended }, 401);
          const buf = await req.arrayBuffer();
          if (buf.byteLength > 500 && buf.byteLength < 120000) {
            await roomStub(env, m[1]).fetch("https://room/thumb?u=" + ok.uid, { method: "PUT", body: buf });
          }
          return J({ ok: true });
        }
        const r = await roomStub(env, m[1]).fetch("https://room/thumb?u=" + (url.searchParams.get("u") || ""));
        if (!r.ok) return new Response(null, { status: 404, headers: CORS });
        return new Response(r.body, { headers: { "content-type": "image/jpeg", "cache-control": "max-age=15", ...CORS } });
      }

      // ---- SFU proxy ----
      if (p === "/api/sfu/new" && req.method === "POST") return sfu(env, "POST", "/sessions/new", null);
      m = p.match(/^\/api\/sfu\/([A-Za-z0-9_-]+)\/(tracks|renegotiate|close)$/);
      if (m) {
        const body = await req.text();
        if (m[2] === "tracks") return sfu(env, "POST", `/sessions/${m[1]}/tracks/new`, body);
        if (m[2] === "renegotiate") return sfu(env, "PUT", `/sessions/${m[1]}/renegotiate`, body);
        return sfu(env, "PUT", `/sessions/${m[1]}/tracks/close`, body);
      }

      // ---- rooms ----
      m = p.match(/^\/api\/room\/([a-z0-9]+)\/(ws|publish|privacy|state|status)$/);
      if (m) {
        const room = m[1];
        if (m[2] === "ws") {
          if (req.headers.get("upgrade") !== "websocket") return J({ error: "ws" }, 426);
          const me = await hub(env, "/me", { token: url.searchParams.get("token") || "" });
          const u = new URL("https://room/ws");
          if (me.user) {
            u.searchParams.set("uid", me.user.id);
            u.searchParams.set("name", me.user.name);
            u.searchParams.set("color", me.user.color || "");
            u.searchParams.set("handle", me.user.handle);
            u.searchParams.set("look", JSON.stringify(me.user.look || {}));
            u.searchParams.set("av", me.user.avatar || "");
          }
          u.searchParams.set("room", room);
          u.searchParams.set("pub", url.searchParams.get("pub") === "1" ? "1" : "");
          return roomStub(env, room).fetch(u.toString(), req);
        }
        if (m[2] === "state") return roomStub(env, room).fetch("https://room/state");
        const pub = req.headers.get("x-pub") || "";
        const who = await hub(env, "/pubinfo", { pub, room });
        if (!who.ok) return J({ error: "auth" }, 401);
        const b = await req.json();
        b.uid = who.uid; b.name = who.name; b.role = who.role; b.color = who.color;
        const r = await roomStub(env, room).fetch("https://room/" + m[2], { method: "POST", body: JSON.stringify(b) });
        if (m[2] === "publish") ctx.waitUntil(hub(env, "/beat", { pub, room }));
        return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", ...CORS } });
      }
      return J({ error: "not_found" }, 404);
    } catch (e) {
      return J({ error: "server", msg: String(e && e.message || e) }, 500);
    }
  },
};

// ======================================================================
// Hub — accounts, streams, publish tokens (single SQLite Durable Object)
// ======================================================================
// ---------------- economy ----------------
const PACKS = {
  p100: { coins: 100, usd: "0.99" }, p550: { coins: 550, usd: "4.99" },
  p1200: { coins: 1200, usd: "9.99" }, p2600: { coins: 2600, usd: "19.99" }, p7000: { coins: 7000, usd: "49.99" },
};
const VIP_PRICE = 900; // coins / 30 days
const SUB_PRICE = 500; // channel subscription, coins / 30 days
// ---- cosmetics catalog (rarity → price). Old ids kept so past purchases stay valid. ----
const RARITY_PRICE = {
  name: { c: 200, r: 400, e: 700, l: 1200 }, badge: { c: 150, r: 350, e: 700, l: 1500 },
  frame: { c: 250, r: 450, e: 800, l: 1500 }, fx: { r: 400, e: 650, l: 1000 },
};
const CATALOG = {
  name: { rainbow: "r", fire: "e", neon: "r", gold: "e", galaxy: "e", ice: "r", water: "l", lava: "e", electric: "l", glitch: "l", holo: "l", chrome: "e",
    aurora: "e", toxic: "r", candy: "c", sunset: "c", ocean: "c", matrix: "e", sakura: "r", blood: "r", emerald: "c", sapphire: "c", ruby: "c", amethyst: "c",
    glitter: "l", shadow: "r", outline: "r", plasma: "l", frost: "e", royal: "e", cyber: "e", mint: "c", peach: "c", smoke: "e", thunder: "l", pixel: "r" },
  badge: { star: "c", flame: "c", diamond: "e", crown: "l", gamer: "c", bolt: "c", shield: "r", skull: "r", sword: "r", heart: "c", crosshair: "r", headset: "c",
    trophy: "e", rocket: "e", ghost: "r", wings: "l", moon: "r", gem: "e", eye: "e", note: "c", leaf: "c", bomb: "r", paw: "c", verified: "l",
    dragon: "l", phoenix: "l", planet: "e", controller: "r", sniper: "e", ninja: "e" },
  frame: { neon: "r", gold: "e", fire: "e", rainbow: "r", water: "l", electric: "l", orbit: "e", twin: "e", ice: "r", toxic: "r", galaxy: "l", aurora: "e",
    lava: "e", sakura: "r", cyber: "e", glitch: "l", pulse: "r", dash: "c", gear: "r", hex: "e", plasma: "l", mint: "c", sunset: "c", ocean: "c", ruby: "c",
    royal: "e", shadow: "r", holo: "l", bubbles: "l", thunder: "l" },
  fx: { rain: "e", snow: "r", aurora: "e", warp: "l", matrix: "e", bubbles: "r", petals: "r", lasers: "l", rings: "r", blackhole: "l", tornado: "l", stars: "r" },
};
const SHOP = { "badge:vip": { kind: "badge", price: 0, vip: true }, "badge:founder": { kind: "badge", price: 0, admin: true } };
for (const [kind, items] of Object.entries(CATALOG)) for (const [id, r] of Object.entries(items)) SHOP[kind + ":" + id] = { kind, price: RARITY_PRICE[kind][r], rarity: r };
const GIFTS = {
  rose: { price: 10, e: "🌹" }, heart: { price: 30, e: "💖" }, controller: { price: 99, e: "🎮" }, car: { price: 299, e: "🏎️" },
  lion: { price: 499, e: "🦁" }, crown: { price: 999, e: "👑" }, rocket: { price: 1999, e: "🚀" },
};
const VIP_FX = new Set(["fireworks", "meteor"]);
const STREAMER_SHARE = 0.7;
// ---- streamer levels & monthly ranking ----
// streamer XP: +2/min live, +1 per viewer-minute watched, +25 per new follower (once per follower),
// +250 per subscription received, +1 per 2 coins of gifts received.
const sLevelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 200)) + 1;   // L2=200, L5=3200, L10=16200, L20=72200, L50=480200
const sXpFor = (l) => 200 * (l - 1) * (l - 1);
const MAX_LEVEL = 100;
const TOP_SHARE = { 1: 0.85, 2: 0.8, 3: 0.75 };  // top-3 of the month keep more of every gift/sub
const monthKey = (t) => new Date(t + 3 * 3600000).toISOString().slice(0, 7);
// ---------------- channel loyalty (per streamer): XP, levels, points ----------------
const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;   // L2=50, L5=800, L10=4050, L20=18050
const xpFor = (lvl) => 50 * (lvl - 1) * (lvl - 1);
const DEFAULT_REWARDS = [
  { id: "highlight", cost: 100, ar: "تمييز رسالتي", en: "Highlight my message", text: true },
  { id: "goldrain", cost: 250, ar: "مطر ذهبي على البث", en: "Golden rain on stream" },
  { id: "pin", cost: 400, ar: "تثبيت رسالتي دقيقة", en: "Pin my message for 1 min", text: true },
];

async function paypal(env, method, path, body) {
  const base = env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = await fetch(base + "/v1/oauth2/token", {
    method: "POST", body: "grant_type=client_credentials",
    headers: { authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET), "content-type": "application/x-www-form-urlencoded" },
  }).then((r) => r.json());
  if (!auth.access_token) throw new Error("paypal auth: " + JSON.stringify(auth).slice(0, 200));
  const r = await fetch(base + path, { method, headers: { authorization: "Bearer " + auth.access_token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
// channel URL / @handle / UC id → channel id
async function resolveYtChannel(env, v) {
  if (!v) return "";
  let m = v.match(/(UC[\w-]{22})/); if (m) return m[1];
  m = v.match(/@([\w.\-]{3,30})/) || v.match(/^([\w.\-]{3,30})$/); if (!m) return "";
  const h = m[1];
  if (env.YT_API_KEY) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@${encodeURIComponent(h)}&key=${env.YT_API_KEY}`).then((x) => x.json()).catch(() => ({}));
    if (r.items && r.items[0]) return r.items[0].id;
  }
  const html = await fetch(`https://www.youtube.com/@${encodeURIComponent(h)}`, { headers: YT_H }).then((x) => x.text()).catch(() => "");
  m = html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/); return m ? m[1] : "";
}
const YT_H = { "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+cb; SOCS=CAI", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" };
// current live video of a channel: the /live page (free); falls back to search.list (100 quota) now and then
async function ytLiveVideo(chan, key, tries) {
  const html = await fetch(`https://www.youtube.com/channel/${chan}/live`, { headers: YT_H }).then((x) => x.text()).catch(() => "");
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
  if (m && /"isLiveNow":true|"isLive":true|isLiveBroadcast/.test(html)) return m[1];
  if (key && tries % 8 === 3) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&channelId=${chan}&eventType=live&type=video&maxResults=1&key=${key}`).then((x) => x.json()).catch(() => ({}));
    if (r.items && r.items[0] && r.items[0].id) return r.items[0].id.videoId;
  }
  return null;
}
async function roomPost(env, room, path, body) {
  if (!room) return; try { await env.ROOM.get(env.ROOM.idFromName("r:" + room)).fetch("https://room" + path, { method: "POST", body: JSON.stringify(body) }); } catch (e) {}
}
// R2 object with HTTP Range support (iOS video playback requires byte ranges)
async function r2Range(req, env, key) {
  const head = await env.REC.head(key); if (!head) return new Response("not found", { status: 404, headers: CORS });
  const size = head.size, type = (head.httpMetadata && head.httpMetadata.contentType) || "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  const base = { "content-type": type, "accept-ranges": "bytes", "cache-control": "public, max-age=86400", ...CORS };
  if (!m) { const o = await env.REC.get(key); return new Response(o.body, { headers: { ...base, "content-length": String(size) } }); }
  let start = m[1] === "" ? Math.max(0, size - (+m[2] || 0)) : +m[1], end = m[1] !== "" && m[2] !== "" ? Math.min(+m[2], size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
  const o = await env.REC.get(key, { range: { offset: start, length: end - start + 1 } });
  return new Response(o.body, { status: 206, headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
}
function clipPage(url, c) {
  const e = (x) => String(x || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  if (!c) return new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0;background:#06050A;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh"><h2>Clip not found · الكليب غير موجود</h2></body>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  const vid = `${url.origin}/clips/${c.id}.${c.ext}`, img = `${url.origin}/clips/${c.id}.jpg`, who = c.host ? c.host.name : "";
  return new Response(`<!doctype html><html dir="auto"><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${e(c.title || "Clip")} · ${e(who)} · Wahj Live</title>
<meta property="og:type" content="video.other"><meta property="og:title" content="${e(c.title || "Clip")} · ${e(who)}"><meta property="og:site_name" content="Wahj Live">
<meta property="og:description" content="${e(who)} — Wahj Live"><meta property="og:image" content="${img}"><meta property="og:video" content="${vid}"><meta property="og:video:type" content="video/${c.ext}">
<meta name="twitter:card" content="player"><meta name="twitter:image" content="${img}">
<style>body{margin:0;background:radial-gradient(120% 80% at 50% 0,#1d1440,#06050A);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.w{width:min(560px,100%);padding:18px;box-sizing:border-box}.v{width:100%;border-radius:20px;background:#000;box-shadow:0 20px 60px rgba(124,92,255,.35);max-height:72vh}
h1{font-size:20px;margin:14px 0 4px}.m{color:#b9b3d6;font-size:14px}.b{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
a.btn{flex:1;text-align:center;padding:14px;border-radius:16px;text-decoration:none;font-weight:800;color:#fff;background:linear-gradient(120deg,#7C5CFF,#FF4D8D,#FF9A3D)}a.g{background:rgba(255,255,255,.08)}
.logo{margin-top:22px;font-weight:900;font-size:18px;background:linear-gradient(120deg,#7C5CFF,#FF4D8D,#FF9A3D);-webkit-background-clip:text;color:transparent}</style></head>
<body><div class="w"><div class="logo">Wahj Live · وهج</div><video class="v" src="${vid}" poster="${img}" controls playsinline autoplay muted loop></video>
<h1>${e(c.title || "Clip")}</h1><div class="m">${e(who)}${c.game ? " · " + e(c.game) : ""} · ${c.views} views</div>
<div class="b"><a class="btn" href="wahj://c/${c.id}">Open in Wahj · افتح في وهج</a><a class="btn g" href="${vid}" download>Download · تنزيل</a></div></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } });
}
function payPage(ok, msg) {
  return new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Wahj</title>
<body style="margin:0;background:#06050A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
<div><div style="font-size:64px">${ok ? "🎉" : "⚠️"}</div><h2>${msg}</h2><a href="wahj://wallet" style="display:inline-block;margin-top:14px;background:linear-gradient(120deg,#7C5CFF,#FF4D8D);color:#fff;padding:14px 28px;border-radius:16px;text-decoration:none;font-weight:700">العودة إلى وهج</a></div>
<script>setTimeout(()=>location.href="wahj://wallet",1200)</script></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}

const REC_LIMIT = 9.5e9; // keep under the R2 free tier (10 GB)
const COLORS = ["#7C5CFF", "#FF4D8D", "#00D1FF", "#FFB800", "#2EE59D", "#FF6B3D", "#B26BFF", "#3DDCFF"];

async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 },
    key,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, handle TEXT UNIQUE, name TEXT, pw TEXT, salt TEXT,
        color TEXT, bio TEXT DEFAULT '', created INTEGER);
      CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, uid TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS streams(id TEXT PRIMARY KEY, uid TEXT, title TEXT, game TEXT, cat TEXT,
        started INTEGER, ended INTEGER DEFAULT 0, beat INTEGER DEFAULT 0, peak INTEGER DEFAULT 0, viewers INTEGER DEFAULT 0, guests INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS pubs(pub TEXT PRIMARY KEY, uid TEXT, room TEXT, role TEXT, created INTEGER, beat INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS pending(device TEXT PRIMARY KEY, data TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS follows(uid TEXT, target TEXT, PRIMARY KEY(uid, target));
      CREATE TABLE IF NOT EXISTS hits(k TEXT PRIMARY KEY, n INTEGER, t INTEGER);
      CREATE TABLE IF NOT EXISTS resets(email TEXT PRIMARY KEY, code TEXT, until INTEGER, tries INTEGER DEFAULT 0);
    `);
    for (const c of ["email TEXT", "notify INTEGER DEFAULT 1", "lastAlert INTEGER DEFAULT 0"]) {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c); } catch (e) {}
    }
    try { this.sql.exec("ALTER TABLE streams ADD COLUMN gameIcon TEXT DEFAULT ''"); } catch (e) {}
    for (const c of ["link TEXT DEFAULT ''", "prefs TEXT DEFAULT '{}'", "av INTEGER DEFAULT 0", "deleted INTEGER DEFAULT 0"]) {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c); } catch (e) {}
    }
    this.sql.exec("CREATE TABLE IF NOT EXISTS avatars(uid TEXT PRIMARY KEY, data BLOB)");
    this.sql.exec(`CREATE TABLE IF NOT EXISTS recs(id TEXT PRIMARY KEY, uid TEXT, title TEXT, game TEXT, gameIcon TEXT, started INTEGER,
      ended INTEGER DEFAULT 0, dur REAL DEFAULT 0, bytes INTEGER DEFAULT 0, segs INTEGER DEFAULT 0, init INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0, w INTEGER DEFAULT 0, h INTEGER DEFAULT 0)`);
    for (const c of ["coins INTEGER DEFAULT 0", "vipUntil INTEGER DEFAULT 0", "owned TEXT DEFAULT '[]'", "equip TEXT DEFAULT '{}'", "earned INTEGER DEFAULT 0"]) {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c); } catch (e) {}
    }
    try { this.sql.exec("ALTER TABLE users ADD COLUMN ytkey TEXT DEFAULT ''"); } catch (e) {}
    try { this.sql.exec("ALTER TABLE users ADD COLUMN ytchan TEXT DEFAULT ''"); } catch (e) {}
    for (const c of ["sxp INTEGER DEFAULT 0", "mxp INTEGER DEFAULT 0", "mkey TEXT DEFAULT ''", "lmrank INTEGER DEFAULT 0"]) {
      try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c); } catch (e) {}
    }
    this.sql.exec("CREATE TABLE IF NOT EXISTS fxp(uid TEXT, target TEXT, PRIMARY KEY(uid, target))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS modroles(host TEXT, uid TEXT, role TEXT, by TEXT, t INTEGER, PRIMARY KEY(host, uid))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS sanctions(host TEXT, uid TEXT, kind TEXT, until INTEGER, by TEXT, t INTEGER, PRIMARY KEY(host, uid, kind))");
    try { this.sql.exec("ALTER TABLE streams ADD COLUMN yt INTEGER DEFAULT 0"); } catch (e) {}
    try { this.sql.exec("ALTER TABLE streams ADD COLUMN ytinit INTEGER DEFAULT 0"); } catch (e) {}
    try { this.sql.exec("ALTER TABLE streams ADD COLUMN ytmeta TEXT DEFAULT ''"); } catch (e) {}
    try { this.sql.exec("ALTER TABLE streams ADD COLUMN rec INTEGER DEFAULT 0"); } catch (e) {}
    this.sql.exec("CREATE TABLE IF NOT EXISTS clips(id TEXT PRIMARY KEY, room TEXT, host TEXT, uid TEXT, title TEXT, game TEXT, dur REAL, size INTEGER, ext TEXT, views INTEGER DEFAULT 0, t INTEGER, deleted INTEGER DEFAULT 0, thumb INTEGER DEFAULT 0)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS donations(id TEXT PRIMARY KEY, host TEXT, uid TEXT, name TEXT, coins INTEGER, usd TEXT, kind TEXT, msg TEXT, status TEXT, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS goals(host TEXT PRIMARY KEY, title TEXT, target INTEGER, cur INTEGER, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS supporters(host TEXT, uid TEXT, total INTEGER, PRIMARY KEY(host, uid))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS reckeys(room TEXT PRIMARY KEY, uid TEXT, k TEXT, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS ytsegs(room TEXT, n INTEGER, dur REAL, PRIMARY KEY(room, n))");
    this.sql.exec(`CREATE TABLE IF NOT EXISTS chan(uid TEXT, host TEXT, xp INTEGER DEFAULT 0, points INTEGER DEFAULT 0, day TEXT DEFAULT '',
      streak INTEGER DEFAULT 0, watch INTEGER DEFAULT 0, PRIMARY KEY(uid, host))`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS subs(uid TEXT, host TEXT, until INTEGER, since INTEGER, months INTEGER DEFAULT 0, PRIMARY KEY(uid, host))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS rewards(id TEXT PRIMARY KEY, host TEXT, title TEXT, cost INTEGER, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS tx(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, delta INTEGER, kind TEXT, ref TEXT, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, uid TEXT, pack TEXT, coins INTEGER, usd TEXT, status TEXT, t INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS diag(id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, ip TEXT, ua TEXT, src TEXT, room TEXT, msg TEXT)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS recsegs(rec TEXT, n INTEGER, dur REAL, bytes INTEGER, PRIMARY KEY(rec, n))");
    try { this.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)"); } catch (e) {}
  }
  one(q, ...a) {
    const r = this.sql.exec(q, ...a).toArray();
    return r[0] || null;
  }
  all(q, ...a) {
    return this.sql.exec(q, ...a).toArray();
  }
  user(token) {
    if (!token) return null;
    return this.one("SELECT u.* FROM tokens t JOIN users u ON u.id=t.uid WHERE t.token=? AND u.deleted=0", token);
  }
  subOf(uid, host) {
    const r = this.one("SELECT * FROM subs WHERE uid=? AND host=?", uid, host);
    return r && r.until > now() ? { until: r.until, months: r.months, since: r.since } : null;
  }
  chanRow(uid, host) {
    uid = String(uid); host = String(host);
    let c = this.one("SELECT * FROM chan WHERE uid=? AND host=?", uid, host);
    if (!c) {
      this.sql.exec("INSERT OR IGNORE INTO chan(uid, host) VALUES(?,?)", uid, host);
      const a = this.one("SELECT * FROM users WHERE id=?", uid);
      if (this.isAdmin(a)) this.sql.exec("UPDATE chan SET xp=?, points=999999 WHERE uid=? AND host=?", xpFor(MAX_LEVEL), uid, host);
      c = this.one("SELECT * FROM chan WHERE uid=? AND host=?", uid, host);
    }
    return c;
  }
  loyOut(c) {
    const level = levelOf(c.xp);
    return { xp: c.xp, level, points: c.points, cur: xpFor(level), next: xpFor(level + 1), streak: c.streak, watchMin: Math.round(c.watch / 60) };
  }
  addSxp(uid, xp) {
    xp = Math.floor(xp); if (!uid || xp <= 0) return null;
    const u = this.one("SELECT sxp, mkey FROM users WHERE id=?", String(uid)); if (!u) return null;
    const mk = monthKey(now()), before = sLevelOf(u.sxp | 0);
    if (u.mkey !== mk) this.sql.exec("UPDATE users SET mxp=0, mkey=? WHERE id=?", mk, String(uid));
    this.sql.exec("UPDATE users SET sxp=sxp+?, mxp=mxp+? WHERE id=?", xp, xp, String(uid));
    this.topC = null;
    const level = sLevelOf((u.sxp | 0) + xp);
    return { level, levelUp: level > before };
  }
  // ---- streamer support: every coin of gifts, subs and donations counts toward supporters + the goal ----
  goalOf(host) { const g = this.one("SELECT title, target, cur FROM goals WHERE host=?", String(host)); return g || null; }
  topSupporters(host, n = 10) {
    return this.all("SELECT uid, total FROM supporters WHERE host=? ORDER BY total DESC LIMIT ?", String(host), n)
      .map((r, i) => { const u = this.one("SELECT * FROM users WHERE id=? AND deleted=0", r.uid); return u ? { rank: i + 1, total: r.total, ...this.pubUser(u) } : null; }).filter(Boolean);
  }
  async roomOf(host, path, body) {
    const live = this.one("SELECT id FROM streams WHERE uid=? AND ended=0 AND beat>? ORDER BY started DESC", String(host), now() - 120000);
    if (live) await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + live.id)).fetch("https://room" + path, { method: "POST", body: JSON.stringify(body) }).catch(() => {});
  }
  async support(host, uid, coins) {
    coins = Math.floor(coins); if (!host || coins <= 0) return;
    if (uid) this.sql.exec("INSERT INTO supporters VALUES(?,?,?) ON CONFLICT(host, uid) DO UPDATE SET total=total+excluded.total", String(host), String(uid), coins);
    const g = this.goalOf(host);
    if (g) { this.sql.exec("UPDATE goals SET cur=cur+? WHERE host=?", coins, String(host)); await this.roomOf(host, "/goal", { goal: this.goalOf(host) }); }
  }
  async finishDonation(d) {
    this.sql.exec("UPDATE donations SET status='paid', t=? WHERE id=?", now(), d.id);
    const host = this.one("SELECT * FROM users WHERE id=?", d.host); if (!host) return;
    const share = this.shareFor(host.id);
    this.addCoins(host.id, Math.floor(d.coins * share), "donation_in", d.name);
    this.addSxp(host.id, d.coins / 2);
    await this.support(host.id, d.uid, d.coins);
    const u = d.uid ? this.one("SELECT * FROM users WHERE id=?", d.uid) : null;
    await this.roomOf(host.id, "/donation", { id: d.id, uid: d.uid, name: d.name, color: u ? u.color : "#ffd36b", look: u ? this.lookOf(u) : {}, avatar: u ? this.pubUser(u).avatar : "",
      coins: d.coins, usd: d.kind === "paypal" ? d.usd : "", msg: d.msg });
  }
  roleOf(host, uid) {
    if (!uid) return "";
    if (uid === host) return "owner";
    const r = this.one("SELECT role FROM modroles WHERE host=? AND uid=?", String(host), String(uid));
    return r ? r.role : "";
  }
  sanctionOf(host, uid) {
    const t = now(), out = {};
    for (const r of this.all("SELECT kind, until FROM sanctions WHERE host=? AND uid=? AND until>?", String(host), String(uid), t)) out[r.kind] = r.until;
    return out;
  }
  get noAdm() { const l = String(this.env.ADMIN_HANDLES || "cruyfford").split(",").map((x) => "'" + x.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") + "'").join(","); return ` AND handle NOT IN (${l})`; }
  top3() {
    const t = now();
    if (this.topC && t - this.topC.t < 60000) return this.topC.m;
    const m = {};
    this.all("SELECT id FROM users WHERE mkey=? AND mxp>0 AND deleted=0" + this.noAdm + " ORDER BY mxp DESC, sxp DESC LIMIT 3", monthKey(t)).forEach((r, i) => (m[r.id] = i + 1));
    this.topC = { t, m };
    return m;
  }
  shareFor(uid) { return TOP_SHARE[this.top3()[uid]] || STREAMER_SHARE; }
  streamerOf(u) {
    const xp = u.sxp | 0, level = sLevelOf(xp), mk = monthKey(now());
    const mxp = u.mkey === mk ? u.mxp | 0 : 0;
    const adm = this.isAdmin(u);
    const mrank = mxp > 0 && !adm ? this.one("SELECT COUNT(*) n FROM users WHERE mkey=? AND deleted=0 AND (mxp>? OR (mxp=? AND sxp>?))" + this.noAdm, mk, mxp, mxp, xp).n + 1 : 0;
    const rank = xp > 0 && !adm ? this.one("SELECT COUNT(*) n FROM users WHERE deleted=0 AND sxp>?" + this.noAdm, xp).n + 1 : 0;
    return { xp, level, cur: sXpFor(level), next: sXpFor(level + 1), mxp, mrank, rank, top: this.top3()[u.id] || 0, share: Math.round(this.shareFor(u.id) * 100) };
  }
  recTotal() { return ((this.one("SELECT SUM(bytes) b FROM recs WHERE deleted=0") || {}).b || 0) + ((this.one("SELECT SUM(size) b FROM clips WHERE deleted=0") || {}).b || 0); }
  clipOut(c) {
    const u = this.one("SELECT * FROM users WHERE id=?", c.uid), h = this.one("SELECT * FROM users WHERE id=?", c.host);
    return { id: c.id, title: c.title, dur: c.dur, views: c.views, t: c.t, game: c.game || "", by: u ? this.pubUser(u) : null, host: h ? this.pubUser(h) : null, ext: c.ext };
  }
  prefsOf(u) { try { return JSON.parse(u.prefs || "{}") || {}; } catch (e) { return {}; } }
  isAdmin(u) { return !!u && String(this.env.ADMIN_HANDLES || "cruyfford").split(",").map((x) => x.trim().toLowerCase()).includes(u.handle); }
  isVip(u) { return !!u && ((u.vipUntil || 0) > now() || this.isAdmin(u)); }
  /** Founder account: every item, permanent VIP, max coins, max streamer + viewer level. */
  maxAdmin(u) {
    if (!u || !this.isAdmin(u)) return u;
    const MAXC = 999999999, SX = sXpFor(MAX_LEVEL), VX = xpFor(MAX_LEVEL), mk = monthKey(now());
    if ((u.coins | 0) < MAXC) this.sql.exec("UPDATE users SET coins=? WHERE id=?", MAXC, u.id);
    const own = Object.keys(SHOP).filter((k) => !SHOP[k].vip && !SHOP[k].admin);
    this.sql.exec("UPDATE users SET owned=?, vipUntil=?, sxp=MAX(sxp,?) WHERE id=?", JSON.stringify(own), now() + 100 * 365 * 86400000, SX, u.id);
    this.sql.exec("UPDATE chan SET xp=MAX(xp,?), points=MAX(points,999999) WHERE uid=?", VX, u.id);
    return this.one("SELECT * FROM users WHERE id=?", u.id);
  }
  jarr(s) { try { return JSON.parse(s || "[]") || []; } catch (e) { return []; } }
  jobj(s) { try { return JSON.parse(s || "{}") || {}; } catch (e) { return {}; } }
  ownsItem(u, id) {
    const it = SHOP[id]; if (!it) return false;
    if (it.admin) return this.isAdmin(u);
    if (it.vip) return this.isVip(u);
    if (this.isVip(u) && it.kind === "name") return true; // VIP: every name style
    return this.jarr(u.owned).includes(id);
  }
  lookOf(u) {
    if (!u) return {};
    const e = this.jobj(u.equip), out = { vip: this.isVip(u) };
    for (const k of ["name", "badge", "frame"]) if (e[k] && this.ownsItem(u, e[k])) out[k] = e[k].split(":")[1];
    const fx = this.jarr(u.owned).filter((x) => x.startsWith("fx:")).map((x) => x.slice(3));
    if (fx.length) out.fx = fx;
    if (!out.badge && this.isAdmin(u)) out.badge = "founder";
    const tp = this.top3()[u.id || u.uid]; if (tp) out.top = tp;
    return out;
  }
  addCoins(uid, delta, kind, ref) {
    this.sql.exec("UPDATE users SET coins=coins+? WHERE id=?", delta, uid);
    this.sql.exec("INSERT INTO tx(uid, delta, kind, ref, t) VALUES(?,?,?,?,?)", uid, delta, kind, String(ref || ""), now());
  }
  pubUser(u, self) {
    return u && { id: u.id, handle: u.handle, name: u.name, color: u.color, bio: u.bio || "", link: u.link || "", look: this.lookOf(u),
      avatar: u.av ? "/api/avatar/" + u.id + "?v=" + u.av : "", created: u.created,
      ...(self ? { email: u.email || "", notify: u.notify !== 0, prefs: this.prefsOf(u), coins: u.coins | 0, vipUntil: u.vipUntil || 0,
        owned: this.jarr(u.owned), equip: this.jobj(u.equip), earned: u.earned | 0, admin: this.isAdmin(u),
        yt: u.ytkey ? "••••" + u.ytkey.slice(-4) : "", ytchan: u.ytchan || "", ytChatOk: !!this.env.YT_API_KEY, streamer: this.streamerOf(u) } : {}) };
  }
  limited(k, max, win) {
    const r = this.one("SELECT * FROM hits WHERE k=?", k);
    const t = now();
    if (!r || t - r.t > win) {
      this.sql.exec("INSERT OR REPLACE INTO hits(k,n,t) VALUES(?,?,?)", k, 1, t);
      return false;
    }
    if (r.n >= max) return true;
    this.sql.exec("UPDATE hits SET n=n+1 WHERE k=?", k);
    return false;
  }
  streamOut(s) {
    if (!s) return null;
    const u = this.one("SELECT * FROM users WHERE id=?", s.uid);
    const live = !s.ended && now() - s.beat < 90000;
    return {
      id: s.id, title: s.title, game: s.game, cat: s.cat, started: s.started, live,
      gameIcon: s.gameIcon === "local" ? "/api/gameicon/" + s.id : s.gameIcon || "",
      viewers: s.viewers, peak: s.peak, guests: s.guests, uid: s.uid, host: this.pubUser(u),
    };
  }

  async fetch(req) {
    const p = new URL(req.url).pathname;
    const b = await req.json().catch(() => ({}));
    const t = now();
    const J2 = (o) => new Response(JSON.stringify(o));

    if (p === "/register") {
      const handle = String(b.handle || "").trim().toLowerCase().replace(/^@/, "");
      const name = String(b.name || handle).trim().slice(0, 32);
      const pw = String(b.password || "");
      const email = String(b.email || "").trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(handle)) return J2({ error: "bad_handle" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return J2({ error: "bad_email" });
      if (this.one("SELECT id FROM users WHERE email=?", email)) return J2({ error: "email_taken" });
      if (pw.length < 6) return J2({ error: "weak_password" });
      if (this.limited("reg:" + b.ip, 8, 3600000)) return J2({ error: "rate" });
      if (this.one("SELECT id FROM users WHERE handle=?", handle)) return J2({ error: "taken" });
      const id = rid(12), salt = rid(16);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.sql.exec("INSERT INTO users(id,handle,name,pw,salt,color,created,email,notify) VALUES(?,?,?,?,?,?,?,?,1)",
        id, handle, name, await hashPw(pw, salt), salt, color, t, email);
      const token = rid(32);
      this.sql.exec("INSERT INTO tokens VALUES(?,?,?)", token, id, t);
      this.state.waitUntil(sendMail(this.env, email, "أهلاً بك في وهج Live 🎮",
        mailBox("أهلاً " + esc(name) + " 👋", "تم إنشاء حسابك <b dir=ltr>@" + esc(handle) + "</b> بنجاح.<br>ابدأ بثّك الأول الآن وشارك ألعابك مع أصدقائك.", "افتح وهج", b.origin || "")));
      return J2({ token, user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", id), true) });
    }
    if (p === "/login") {
      const handle = String(b.handle || "").trim().toLowerCase().replace(/^@/, "");
      if (this.limited("login:" + b.ip, 20, 600000)) return J2({ error: "rate" });
      const u = handle.includes("@") ? this.one("SELECT * FROM users WHERE email=?", handle) : this.one("SELECT * FROM users WHERE handle=?", handle);
      if (!u || u.deleted || (await hashPw(String(b.password || ""), u.salt)) !== u.pw) return J2({ error: "bad_login" });
      const token = rid(32);
      this.sql.exec("INSERT INTO tokens VALUES(?,?,?)", token, u.id, t);
      return J2({ token, user: this.pubUser(u, true) });
    }
    if (p === "/forgot") {
      const email = String(b.email || "").trim().toLowerCase();
      if (this.limited("fg:" + b.ip, 10, 3600000) || this.limited("fge:" + email, 4, 3600000)) return J2({ error: "rate" });
      if (!this.env.RESEND_API_KEY) return J2({ error: "mail_off" });
      const u = this.one("SELECT * FROM users WHERE email=?", email);
      if (u) {
        const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        this.sql.exec("INSERT OR REPLACE INTO resets VALUES(?,?,?,0)", email, code, t + 15 * 60000);
        await sendMail(this.env, email, "رمز استعادة كلمة المرور: " + code,
          mailBox("استعادة كلمة المرور", "رمزك هو:<div dir=ltr style='font-size:34px;font-weight:800;letter-spacing:8px;color:#fff;margin:12px 0'>" + code + "</div>صالح لمدة ١٥ دقيقة. إذا لم تطلبه فتجاهل هذه الرسالة."));
      }
      return J2({ ok: true });
    }
    if (p === "/reset") {
      const email = String(b.email || "").trim().toLowerCase();
      const r = this.one("SELECT * FROM resets WHERE email=?", email);
      if (!r || t > r.until || r.tries >= 5) return J2({ error: "bad_code" });
      if (String(b.code || "").trim() !== r.code) { this.sql.exec("UPDATE resets SET tries=tries+1 WHERE email=?", email); return J2({ error: "bad_code" }); }
      const pw = String(b.password || "");
      if (pw.length < 6) return J2({ error: "weak_password" });
      const u = this.one("SELECT * FROM users WHERE email=?", email);
      if (!u) return J2({ error: "bad_code" });
      const salt = rid(16);
      this.sql.exec("UPDATE users SET pw=?, salt=? WHERE id=?", await hashPw(pw, salt), salt, u.id);
      this.sql.exec("DELETE FROM tokens WHERE uid=?", u.id);
      this.sql.exec("DELETE FROM resets WHERE email=?", email);
      const token = rid(32);
      this.sql.exec("INSERT INTO tokens VALUES(?,?,?)", token, u.id, t);
      return J2({ token, user: this.pubUser(u, true) });
    }
    if (p === "/me") {
      const u = this.maxAdmin(this.user(b.token));
      if (!u) return J2({ error: "auth" });
      const following = this.all("SELECT target FROM follows WHERE uid=?", u.id).map((r) => r.target);
      return J2({ user: this.pubUser(u, true), following });
    }
    if (p === "/profile") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      const name = String(b.name ?? u.name).trim().slice(0, 32) || u.name;
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color || "") ? b.color : u.color;
      const bio = String(b.bio ?? u.bio ?? "").slice(0, 140);
      let email = u.email || "";
      if (b.email !== undefined) {
        const e = String(b.email).trim().toLowerCase();
        if (e !== email) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 120) return J2({ error: "bad_email" });
          if (this.one("SELECT id FROM users WHERE email=? AND id<>?", e, u.id)) return J2({ error: "email_taken" });
          email = e;
        }
      }
      const notify = b.notify === undefined ? (u.notify !== 0 ? 1 : 0) : (b.notify ? 1 : 0);
      let link = u.link || "";
      if (b.link !== undefined) {
        link = String(b.link).trim().slice(0, 200);
        if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
        if (link && !/^https?:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(link)) return J2({ error: "bad_link" });
      }
      if (b.ytkey !== undefined) {
        let k = String(b.ytkey).trim();
        const cm = k.match(/[?&]cid=([A-Za-z0-9_-]+)/); if (cm) k = cm[1];   // pasted the full HLS ingest URL
        if (k && !/^[A-Za-z0-9_-]{8,64}$/.test(k)) return J2({ error: "bad_ytkey" });
        this.sql.exec("UPDATE users SET ytkey=? WHERE id=?", k, u.id);
        u.ytkey = k;
      }
      if (b.ytchan !== undefined) {
        const c = await resolveYtChannel(this.env, String(b.ytchan || "").trim());
        if (b.ytchan && !c) return J2({ error: "bad_ytchan" });
        this.sql.exec("UPDATE users SET ytchan=? WHERE id=?", c || "", u.id); u.ytchan = c || "";
      }
      let prefs = this.prefsOf(u);
      if (b.prefs && typeof b.prefs === "object") {
        const P = b.prefs;
        if ("allowFx" in P) prefs.allowFx = !!P.allowFx;
        if ("allowCh" in P) prefs.allowCh = !!P.allowCh;
        if ("coStream" in P) prefs.coStream = ["all", "followers", "none"].includes(P.coStream) ? P.coStream : "all";
        if ("slow" in P) prefs.slow = Math.min(60, Math.max(0, P.slow | 0));
        if ("guestChat" in P) prefs.guestChat = !!P.guestChat;
        if ("rec" in P) prefs.rec = !!P.rec;
        if ("ytChat" in P) prefs.ytChat = !!P.ytChat;
      }
      this.sql.exec("UPDATE users SET name=?, color=?, bio=?, email=?, notify=?, link=?, prefs=? WHERE id=?", name, color, bio, email, notify, link, JSON.stringify(prefs), u.id);
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/user") {
      const u = this.one("SELECT * FROM users WHERE handle=? AND deleted=0", String(b.handle || "").toLowerCase());
      if (!u) return J2({ error: "not_found" });
      const followers = this.one("SELECT COUNT(*) n FROM follows WHERE target=?", u.id).n;
      const following = this.one("SELECT COUNT(*) n FROM follows WHERE uid=?", u.id).n;
      const st = this.one("SELECT COUNT(*) n, MAX(peak) p, SUM(CASE WHEN ended>0 THEN ended-started ELSE 0 END) d FROM streams WHERE uid=?", u.id);
      const past = this.all("SELECT * FROM streams WHERE uid=? ORDER BY started DESC LIMIT 30", u.id).map((s) => {
        const o = this.streamOut(s);
        const r = this.one("SELECT dur, segs, init FROM recs WHERE id=? AND deleted=0", s.id);
        if (r && r.init && r.segs > 0) o.rec = { dur: Math.round(r.dur) };
        // waiting for the phone to upload (gives up showing it after 3 days)
        else if (s.rec && !(r && r.deleted) && (!s.ended || now() - s.ended < 3 * 86400000)) o.recPending = true;
        return o;
      });
      const games = this.all("SELECT game, MAX(gameIcon) icon, COUNT(*) n FROM streams WHERE uid=? AND game<>'' GROUP BY lower(game) ORDER BY n DESC LIMIT 8", u.id);
      const viewer = b.token ? this.user(b.token) : null;
      const subsCount = this.one("SELECT COUNT(*) n FROM subs WHERE host=? AND until>?", u.id, t).n;
      return J2({ goal: this.goalOf(u.id), topSupporters: this.topSupporters(u.id, 5), streamer: this.streamerOf(u), mySub: viewer ? this.subOf(viewer.id, u.id) : null, subsCount, user: this.pubUser(u), followers, following, streamsCount: st.n || 0, bestPeak: st.p || 0, hours: Math.round((st.d || 0) / 360000) / 10, games: games.map((g) => ({ name: g.game, icon: g.icon === "local" ? "" : g.icon, n: g.n })), streams: past });
    }
    if (p === "/password") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      if ((await hashPw(String(b.old || ""), u.salt)) !== u.pw) return J2({ error: "bad_old" });
      const pw = String(b.password || "");
      if (pw.length < 6) return J2({ error: "weak_password" });
      const salt = rid(16);
      this.sql.exec("UPDATE users SET pw=?, salt=? WHERE id=?", await hashPw(pw, salt), salt, u.id);
      this.sql.exec("DELETE FROM tokens WHERE uid=? AND token<>?", u.id, b.token);
      return J2({ ok: true });
    }
    if (p === "/avatar") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      if (!b.data) {
        this.sql.exec("DELETE FROM avatars WHERE uid=?", u.id);
        this.sql.exec("UPDATE users SET av=0 WHERE id=?", u.id);
      } else {
        const d = String(b.data);
        if (!d.startsWith("data:image/jpeg;base64,") || d.length > 200000) return J2({ error: "bad_image" });
        const bin = Uint8Array.from(atob(d.slice(23)), (c) => c.charCodeAt(0));
        this.sql.exec("INSERT OR REPLACE INTO avatars VALUES(?,?)", u.id, bin);
        this.sql.exec("UPDATE users SET av=? WHERE id=?", t, u.id);
      }
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/avatar-get") {
      const r = this.one("SELECT data FROM avatars WHERE uid=?", String(b.uid));
      return r ? new Response(r.data) : new Response(null, { status: 404 });
    }
    if (p === "/delete-account") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      if ((await hashPw(String(b.password || ""), u.salt)) !== u.pw) return J2({ error: "bad_old" });
      this.sql.exec("UPDATE streams SET ended=? WHERE uid=? AND ended=0", t, u.id);
      this.sql.exec("DELETE FROM tokens WHERE uid=?", u.id);
      this.sql.exec("DELETE FROM follows WHERE uid=? OR target=?", u.id, u.id);
      this.sql.exec("DELETE FROM avatars WHERE uid=?", u.id);
      this.sql.exec("UPDATE users SET deleted=1, name=?, bio='', email=NULL, link='', av=0, pw='' WHERE id=?", "deleted", u.id);
      return J2({ ok: true });
    }
    if (p === "/follow") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      if (b.on) {
        this.sql.exec("INSERT OR IGNORE INTO follows VALUES(?,?)", u.id, String(b.target));
        if (String(b.target) !== u.id && !this.one("SELECT 1 x FROM fxp WHERE uid=? AND target=?", u.id, String(b.target))) {
          this.sql.exec("INSERT INTO fxp VALUES(?,?)", u.id, String(b.target)); this.addSxp(b.target, 25);
        }
      }
      else this.sql.exec("DELETE FROM follows WHERE uid=? AND target=?", u.id, String(b.target));
      return J2({ ok: true });
    }
    if (p === "/live") {
      const u = this.user(b.token);
      const rows = this.all("SELECT * FROM streams WHERE ended=0 AND beat>? ORDER BY viewers DESC, started DESC LIMIT 100", t - 90000);
      const fol = u ? new Set(this.all("SELECT target FROM follows WHERE uid=?", u.id).map((r) => r.target)) : new Set();
      const tp = this.top3();
      rows.sort((a, c) => (tp[a.uid] || 9) - (tp[c.uid] || 9));
      return J2({ streams: rows.map((s) => ({ ...this.streamOut(s), followed: fol.has(s.uid), top: tp[s.uid] || 0 })) });
    }
    if (p === "/stream") {
      return J2({ stream: this.streamOut(this.one("SELECT * FROM streams WHERE id=?", String(b.id))) });
    }
    if (p === "/go-live") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      let room, role = "host";
      if (b.joinRoom) {
        // Co-streaming: the host must have approved this user as a guest.
        const s = this.one("SELECT * FROM streams WHERE id=? AND ended=0", String(b.joinRoom));
        if (!s) return J2({ error: "no_stream" });
        const r = await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + s.id))
          .fetch("https://room/is-guest", { method: "POST", body: JSON.stringify({ uid: u.id }) }).then((r) => r.json());
        if (!r.ok) return J2({ error: "not_invited" });
        room = s.id; role = "guest";
        this.sql.exec("UPDATE streams SET guests=? WHERE id=?", r.count || 1, s.id);
      } else {
        // End any previous stream of this user.
        this.sql.exec("UPDATE streams SET ended=? WHERE uid=? AND ended=0", t, u.id);
        room = rid(8);
        const title = String(b.title || "").trim().slice(0, 80) || (u.name + " Live");
        this.sql.exec("INSERT INTO streams(id,uid,title,game,cat,started,beat,gameIcon) VALUES(?,?,?,?,?,?,?,?)",
          room, u.id, title, String(b.game || "").slice(0, 60), String(b.cat || "").slice(0, 20), t, t, String(b.gameIcon || "").slice(0, 300));
        if (b.youtube && u.ytkey) this.sql.exec("UPDATE streams SET yt=1 WHERE id=?", room);
        if (b.youtube || u.ytkey) this.sql.exec("INSERT INTO diag(t,ip,ua,src,room,msg) VALUES(?,?,?,?,?,?)", t, "", "", "yt", room, `youtube requested=${!!b.youtube} key=${u.ytkey ? "saved" : "missing"} → ${b.youtube && u.ytkey ? "ON" : "off"}`);
        await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + room)).fetch("https://room/init", {
          method: "POST",
          body: JSON.stringify({ room, host: u.id, hostName: u.name, title, prefs: this.prefsOf(u),
            ytChan: b.youtube && u.ytkey && u.ytchan && this.prefsOf(u).ytChat !== false ? u.ytchan : "",
            followers: this.all("SELECT uid FROM follows WHERE target=?", u.id).map((r) => r.uid) }),
        });
        if (this.env.RESEND_API_KEY && t - (u.lastAlert || 0) > 30 * 60000) {
          this.sql.exec("UPDATE users SET lastAlert=? WHERE id=?", t, u.id);
          const fans = this.all("SELECT u.email, u.name FROM follows f JOIN users u ON u.id=f.uid WHERE f.target=? AND u.notify<>0 AND u.email<>'' LIMIT 200", u.id);
          const link = (b.origin || "") + "/w/" + room;
          this.state.waitUntil(Promise.all(fans.map((f) => sendMail(this.env, f.email, "🔴 " + u.name + " يبث الآن على وهج",
            mailBox("🔴 " + esc(u.name) + " بدأ بثاً مباشراً", "<b>" + esc(title) + "</b>" + (b.game ? "<br>🎮 " + esc(b.game) : ""), "شاهد الآن", link)))));
        }
      }
      const pub = rid(32);
      this.sql.exec("INSERT INTO pubs(pub,uid,room,role,created,beat) VALUES(?,?,?,?,?,?)", pub, u.id, room, role, t, t);
      const job = {
        room, pub, role, uid: u.id, name: u.name,
        quality: b.quality || "720", fps: +b.fps || 30, mic: b.mic !== false,
        privacy: b.privacy || {}, at: t,
        rec: role === "host" && !!this.env.REC && (b.record !== undefined ? !!b.record : this.prefsOf(u).rec !== false) && this.recTotal() < REC_LIMIT,
      };
      // YouTube simulcast rides on the same HLS segments (no second encoder on the phone)
      job.save = job.rec;
      if (job.save) {
        // record on the phone, upload after the stream (keeps upstream bandwidth for the live video)
        job.deferred = b.deferred !== false;
        job.recKey = rid(24); job.wifiOnly = !!b.wifiOnly;
        this.sql.exec("INSERT OR REPLACE INTO reckeys VALUES(?,?,?,?)", room, u.id, job.recKey, t);
        if (role === "host") this.sql.exec("UPDATE streams SET rec=1 WHERE id=?", room);
      }
      if (role === "host" && b.youtube && u.ytkey && this.env.REC) { job.yt = true; job.rec = true; }
      if (b.device) this.sql.exec("INSERT OR REPLACE INTO pending VALUES(?,?,?)", String(b.device), JSON.stringify(job), t);
      this.sql.exec("DELETE FROM pending WHERE created<?", t - 3600000);
      return J2({ ok: true, job, stream: this.streamOut(this.one("SELECT * FROM streams WHERE id=?", room)) });
    }
    if (p === "/pending") {
      const r = this.one("SELECT * FROM pending WHERE device=?", String(b.device));
      if (!r || t - r.created > 1800000) return J2({ error: "none" });
      return J2({ job: JSON.parse(r.data) });
    }
    if (p === "/pubinfo" || p === "/beat") {
      const r = this.one("SELECT * FROM pubs WHERE pub=? AND room=?", String(b.pub), String(b.room));
      if (!r) return J2({ ok: false });
      const s = this.one("SELECT * FROM streams WHERE id=?", r.room);
      if (!s || s.ended) return J2({ ok: false, ended: true });
      if (p === "/beat") {
        this.sql.exec("UPDATE pubs SET beat=? WHERE pub=?", t, r.pub);
        if (r.role === "host") this.sql.exec("UPDATE streams SET beat=? WHERE id=?", t, r.room);
      }
      const u = this.one("SELECT * FROM users WHERE id=?", r.uid);
      return J2({ ok: true, uid: r.uid, role: r.role, name: u.name, color: u.color });
    }
    if (p === "/rec-seg") {
      let r = this.one("SELECT * FROM pubs WHERE pub=? AND room=?", String(b.pub), String(b.room));
      if (!r && b.key) { const k = this.one("SELECT * FROM reckeys WHERE room=? AND k=?", String(b.room), String(b.key)); if (k && t - k.t < 7 * 86400000) r = { uid: k.uid, room: k.room, role: "host", pub: "" }; }
      if (!r || r.role !== "host") return J2({ ok: false, error: "auth" });
      const u = this.one("SELECT * FROM users WHERE id=?", r.uid);
      const st = this.one("SELECT * FROM streams WHERE id=?", r.room) || {};
      let yt = null;
      if (st.yt && u.ytkey && !st.ended) {
        if (b.n < 0) {
          // new init segment (encoder restarted / orientation change) → fresh playlist after a discontinuity
          this.sql.exec("UPDATE streams SET ytinit=ytinit+1, ytmeta=? WHERE id=?", b.ytmeta ? JSON.stringify(b.ytmeta) : "", r.room);
          st.ytmeta = b.ytmeta ? JSON.stringify(b.ytmeta) : "";
          this.sql.exec("DELETE FROM ytsegs WHERE room=?", r.room);
          st.ytinit = (st.ytinit | 0) + 1;
        } else {
          this.sql.exec("INSERT OR REPLACE INTO ytsegs VALUES(?,?,?)", r.room, b.n, +b.dur || 0);
          this.sql.exec("DELETE FROM ytsegs WHERE room=? AND n<?", r.room, b.n - 6);
        }
        let meta = null; try { meta = st.ytmeta ? JSON.parse(st.ytmeta) : null; } catch (e) {}
        yt = { key: u.ytkey, init: st.ytinit | 0, meta, segs: this.all("SELECT n, dur FROM ytsegs WHERE room=? ORDER BY n DESC LIMIT 5", r.room).reverse() };
      }
      let rec = this.one("SELECT * FROM recs WHERE id=?", r.room);
      // the per-stream choice ("record this stream") wins over the default in settings
      const wanted = st.rec ? true : this.prefsOf(u).rec !== false;
      let store = wanted && !(rec && rec.deleted) && this.recTotal() + (b.bytes | 0) <= REC_LIMIT;
      if (!store) {
        this.sql.exec("UPDATE pubs SET beat=? WHERE pub=?", t, r.pub);
        if (yt) return J2({ ok: true, store: false, yt });
        if (this.prefsOf(u).rec === false) return J2({ ok: false, error: "rec_disabled" });
        return J2({ ok: false, error: rec && rec.deleted ? "deleted" : "rec_full" });
      }
      if (!rec) {
        const s = this.one("SELECT * FROM streams WHERE id=?", r.room) || {};
        this.sql.exec("INSERT INTO recs(id,uid,title,game,gameIcon,started,ended) VALUES(?,?,?,?,?,?,?)", r.room, r.uid, s.title || "", s.game || "", s.gameIcon === "local" ? "/api/gameicon/" + r.room : s.gameIcon || "", s.started || t, s.ended || 0);
      }
      if (b.n < 0) {
        this.sql.exec("UPDATE recs SET init=1, w=?, h=?, bytes=bytes+? WHERE id=?", b.w | 0, b.h | 0, b.bytes | 0, r.room);
      } else {
        const ex = this.one("SELECT * FROM recsegs WHERE rec=? AND n=?", r.room, b.n);
        this.sql.exec("INSERT OR REPLACE INTO recsegs VALUES(?,?,?,?)", r.room, b.n, +b.dur || 0, b.bytes | 0);
        this.sql.exec("UPDATE recs SET segs=segs+?, dur=dur+?, bytes=bytes+? WHERE id=?", ex ? 0 : 1, (+b.dur || 0) - (ex ? ex.dur : 0), (b.bytes | 0) - (ex ? ex.bytes : 0), r.room);
      }
      this.sql.exec("UPDATE pubs SET beat=? WHERE pub=?", t, r.pub);
      return J2({ ok: true, store: true, yt });
    }
    if (p === "/yt-stat") {
      const s = this.one("SELECT uid FROM streams WHERE id=?", String(b.room));
      if (s) await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + b.room)).fetch("https://room/yt", { method: "POST", body: JSON.stringify({ ok: !!b.ok, code: b.code | 0 }) }).catch(() => {});
      this.sql.exec("INSERT INTO diag(t,ip,ua,src,room,msg) VALUES(?,?,?,?,?,?)", t, "", "", "yt", String(b.room), ((b.ok ? "youtube OK seg=" : "youtube FAIL seg=") + b.n + " code " + b.code + " " + (b.msg || "")).slice(0, 400));
      return J2({ ok: true });
    }
    if (p === "/rec-get") {
      const rec = this.one("SELECT * FROM recs WHERE id=? AND deleted=0", String(b.id));
      if (!rec) return J2({ rec: null, segs: [] });
      // a stream that stopped without a clean end: treat as finished after 2 minutes of silence
      if (!rec.ended) { const s = this.one("SELECT * FROM streams WHERE id=?", rec.id); if (!s || s.ended || t - s.beat > 120000) { rec.ended = 1; } }
      return J2({ rec, segs: this.all("SELECT n, dur FROM recsegs WHERE rec=? ORDER BY n", rec.id) });
    }
    if (p === "/recs") {
      const me = this.user(b.token);
      const u = b.handle ? this.one("SELECT * FROM users WHERE handle=?", String(b.handle).toLowerCase()) : me;
      if (!u) return J2({ recs: [] });
      const own = me && me.id === u.id;
      const recs = this.all("SELECT * FROM recs WHERE uid=? AND deleted=0 AND init=1 AND segs>0 ORDER BY started DESC LIMIT 100", u.id)
        .map((r) => ({ id: r.id, title: r.title, game: r.game, gameIcon: r.gameIcon, started: r.started, dur: Math.round(r.dur), bytes: own ? r.bytes : undefined, ended: !!r.ended }));
      const out = { recs };
      if (own) { out.myBytes = recs.reduce((a, r) => a + r.bytes, 0); out.totalBytes = this.recTotal(); out.limit = REC_LIMIT; }
      return J2(out);
    }
    if (p === "/rec-del") {
      const u = this.user(b.token);
      if (!u) return J2({ ok: false, error: "auth" });
      const rows = b.id === "all" ? this.all("SELECT id FROM recs WHERE uid=? AND deleted=0", u.id) : this.all("SELECT id FROM recs WHERE id=? AND uid=? AND deleted=0", String(b.id), u.id);
      if (!rows.length) return J2({ ok: false, error: "not_found" });
      for (const r of rows) {
        this.sql.exec("UPDATE recs SET deleted=1, bytes=0 WHERE id=?", r.id);
        this.sql.exec("DELETE FROM recsegs WHERE rec=?", r.id);
      }
      return J2({ ok: true, ids: rows.map((r) => r.id) });
    }
    if (p === "/wallet") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      return J2({ user: this.pubUser(u, true), tx: this.all("SELECT delta, kind, ref, t FROM tx WHERE uid=? ORDER BY id DESC LIMIT 30", u.id) });
    }
    if (p === "/buy") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      const it = SHOP[b.item]; if (!it || it.vip || it.admin) return J2({ error: "bad_item" });
      if (this.ownsItem(u, b.item)) return J2({ error: "owned" });
      if ((u.coins | 0) < it.price) return J2({ error: "no_coins" });
      this.addCoins(u.id, -it.price, "shop", b.item);
      const owned = [...this.jarr(u.owned), b.item];
      const eq = { ...this.jobj(u.equip), [it.kind]: b.item };
      this.sql.exec("UPDATE users SET owned=?, equip=? WHERE id=?", JSON.stringify(owned), JSON.stringify(eq), u.id);
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/equip") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      const kind = String(b.kind || ""); if (!["name", "badge", "frame"].includes(kind)) return J2({ error: "bad_item" });
      const eq = this.jobj(u.equip);
      if (!b.item) delete eq[kind];
      else { if (!SHOP[b.item] || SHOP[b.item].kind !== kind || !this.ownsItem(u, b.item)) return J2({ error: "not_owned" }); eq[kind] = b.item; }
      this.sql.exec("UPDATE users SET equip=? WHERE id=?", JSON.stringify(eq), u.id);
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/vip") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      if ((u.coins | 0) < VIP_PRICE) return J2({ error: "no_coins" });
      this.addCoins(u.id, -VIP_PRICE, "vip", "30d");
      const until = Math.max(u.vipUntil || 0, t) + 30 * 86400000;
      const eq = this.jobj(u.equip); if (!eq.badge) eq.badge = "badge:vip";
      this.sql.exec("UPDATE users SET vipUntil=?, equip=? WHERE id=?", until, JSON.stringify(eq), u.id);
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/grant") {
      const a = this.user(b.token); if (!this.isAdmin(a)) return J2({ error: "forbidden" });
      const u = this.one("SELECT * FROM users WHERE handle=? AND deleted=0", String(b.handle || "").toLowerCase().replace(/^@/, ""));
      if (!u) return J2({ error: "not_found" });
      const coins = Math.max(-1e6, Math.min(1e6, b.coins | 0));
      if (coins) this.addCoins(u.id, coins, "admin", a.handle);
      const days = Math.max(0, Math.min(3650, b.vipDays | 0));
      if (days) this.sql.exec("UPDATE users SET vipUntil=? WHERE id=?", Math.max(u.vipUntil || 0, t) + days * 86400000, u.id);
      return J2({ ok: true, user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/gift") {
      // called by a Room: viewer pays, streamer receives 70%
      const g = GIFTS[b.gift]; if (!g) return J2({ error: "bad_gift" });
      const from = this.one("SELECT * FROM users WHERE id=? AND deleted=0", String(b.from));
      if (!from) return J2({ error: "auth" });
      if (b.from === b.to) return J2({ error: "self" });
      const n = Math.max(1, Math.min(99, b.n | 0 || 1));
      const cost = g.price * n;
      if ((from.coins | 0) < cost) return J2({ error: "no_coins" });
      this.addCoins(from.id, -cost, "gift", b.gift + "x" + n + ">" + b.to);
      const share = Math.floor(cost * this.shareFor(String(b.to)));
      const lv = this.addSxp(b.to, cost / 2);
      await this.support(String(b.to), from.id, cost);
      this.addCoins(String(b.to), share, "gift_in", b.gift + "x" + n + "<" + from.id);
      this.sql.exec("UPDATE users SET earned=earned+? WHERE id=?", share, String(b.to));
      return J2({ ok: true, coins: (from.coins | 0) - cost, cost, share, n, host: lv });
    }
    // ---- loyalty ----
    if (p === "/sub") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      const h = this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host || ""), String(b.host || "").toLowerCase());
      if (!h) return J2({ error: "not_found" });
      if (h.id === u.id) return J2({ error: "self" });
      if ((u.coins | 0) < SUB_PRICE) return J2({ error: "no_coins" });
      this.addCoins(u.id, -SUB_PRICE, "sub", h.handle);
      const share = Math.floor(SUB_PRICE * this.shareFor(h.id));
      this.addSxp(h.id, 250);
      await this.support(h.id, u.id, SUB_PRICE);
      this.addCoins(h.id, share, "sub_in", u.handle);
      this.sql.exec("UPDATE users SET earned=earned+? WHERE id=?", share, h.id);
      const cur = this.one("SELECT * FROM subs WHERE uid=? AND host=?", u.id, h.id);
      const until = Math.max(cur ? cur.until : 0, t) + 30 * 86400000;
      if (cur) this.sql.exec("UPDATE subs SET until=?, months=months+1 WHERE uid=? AND host=?", until, u.id, h.id);
      else this.sql.exec("INSERT INTO subs VALUES(?,?,?,?,1)", u.id, h.id, until, t);
      this.chanRow(u.id, h.id); this.sql.exec("UPDATE chan SET xp=xp+100, points=points+300 WHERE uid=? AND host=?", u.id, h.id);
      return J2({ ok: true, sub: this.subOf(u.id, h.id), user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id), true) });
    }
    if (p === "/sub-get") {
      return J2({ sub: this.subOf(String(b.uid), String(b.host)) });
    }
    if (p === "/loy-get") {
      const c = this.chanRow(b.uid, b.host);
      const rewards = [...DEFAULT_REWARDS, ...this.all("SELECT id, title, cost FROM rewards WHERE host=? ORDER BY cost", String(b.host)).map((r) => ({ ...r, custom: true }))];
      return J2({ ...this.loyOut(c), rewards, sub: this.subOf(String(b.uid), String(b.host)), role: this.roleOf(b.host, b.uid), sanction: this.sanctionOf(b.host, b.uid) });
    }
    if (p === "/loy-daily") {
      const c = this.chanRow(b.uid, b.host);
      const today = new Date(t + 3 * 3600000).toISOString().slice(0, 10); // Gulf day
      if (c.day === today) return J2({ ...this.loyOut(c), daily: false });
      const yesterday = new Date(t + 3 * 3600000 - 86400000).toISOString().slice(0, 10);
      const streak = c.day === yesterday ? Math.min(30, c.streak + 1) : 1;
      const pts = 50 + Math.min(7, streak - 1) * 10, xp = 25 + Math.min(7, streak - 1) * 5;
      this.sql.exec("UPDATE chan SET day=?, streak=?, points=points+?, xp=xp+? WHERE uid=? AND host=?", today, streak, pts, xp, c.uid, c.host);
      return J2({ ...this.loyOut(this.chanRow(b.uid, b.host)), daily: true, gotPts: pts, gotXp: xp, streak });
    }
    if (p === "/loy-add") {
      // batch: [{uid, xp, pts, watch}]
      const out = {};
      for (const e of (b.list || []).slice(0, 500)) {
        if (!e.uid || e.uid === b.host) continue;
        const c = this.chanRow(e.uid, b.host);
        const before = levelOf(c.xp);
        this.sql.exec("UPDATE chan SET xp=xp+?, points=points+?, watch=watch+? WHERE uid=? AND host=?", Math.max(0, e.xp | 0), Math.max(0, e.pts | 0), Math.max(0, e.watch | 0), e.uid, b.host);
        const o = this.loyOut(this.chanRow(e.uid, b.host));
        if (o.level > before) o.levelUp = true;
        out[e.uid] = o;
      }
      const host = b.hostXp > 0 ? this.addSxp(b.host, b.hostXp) : null;
      return J2({ users: out, host: host && { ...host, top: this.top3()[b.host] || 0 } });
    }
    if (p === "/loy-spend") {
      const c = this.chanRow(b.uid, b.host);
      const cost = Math.max(0, b.cost | 0);
      if (c.points < cost) return J2({ error: "no_points" });
      this.sql.exec("UPDATE chan SET points=points-? WHERE uid=? AND host=?", cost, b.uid, b.host);
      return J2({ ok: true, ...this.loyOut(this.chanRow(b.uid, b.host)) });
    }
    if (p === "/loy-reward") {
      const r = DEFAULT_REWARDS.find((x) => x.id === b.id) || this.one("SELECT id, title, cost FROM rewards WHERE id=? AND host=?", String(b.id), String(b.host));
      return J2({ reward: r || null, custom: !!(r && !DEFAULT_REWARDS.includes(r)) });
    }
    // ---- clips ----
    if (p === "/clip-new") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      if (this.limited("clip:" + u.id, 10, 3600000)) return J2({ error: "slow" });
      const st = this.one("SELECT * FROM streams WHERE id=?", String(b.room));
      if (!st) return J2({ error: "no_stream" });
      if (this.recTotal() + (b.size | 0) > REC_LIMIT) return J2({ error: "rec_full" });
      const id = rid(10), title = String(b.title || st.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
      this.sql.exec("INSERT INTO clips(id,room,host,uid,title,game,dur,size,ext,t) VALUES(?,?,?,?,?,?,?,?,?,?)", id, st.id, st.uid, u.id, title, st.game || "", Math.min(90, +b.dur || 0), b.size | 0, b.ext === "webm" ? "webm" : "mp4", t);
      return J2({ ok: true, id, host: st.uid, name: u.name, title });
    }
    if (p === "/clip-thumb") {
      const u = this.user(b.token); const c = this.one("SELECT * FROM clips WHERE id=?", String(b.id));
      if (!u || !c || c.uid !== u.id) return J2({ error: "auth" });
      this.sql.exec("UPDATE clips SET thumb=1 WHERE id=?", c.id); return J2({ ok: true });
    }
    if (p === "/clip-get") {
      const c = this.one("SELECT * FROM clips WHERE id=? AND deleted=0", String(b.id));
      if (!c) return J2({ error: "not_found" });
      if (b.view) this.sql.exec("UPDATE clips SET views=views+1 WHERE id=?", c.id);
      return J2({ clip: { ...this.clipOut(c), thumb: !!c.thumb } });
    }
    if (p === "/clips") {
      let rows;
      if (b.host) {
        const h = this.one("SELECT id FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host), String(b.host).toLowerCase());
        rows = h ? this.all("SELECT * FROM clips WHERE host=? AND deleted=0 ORDER BY t DESC LIMIT 60", h.id) : [];
      } else rows = this.all("SELECT * FROM clips WHERE deleted=0 AND t>? ORDER BY views DESC, t DESC LIMIT 20", t - 7 * 86400000);
      return J2({ clips: rows.map((c) => ({ ...this.clipOut(c), thumb: !!c.thumb })) });
    }
    if (p === "/clip-del") {
      const u = this.user(b.token); const c = this.one("SELECT * FROM clips WHERE id=?", String(b.id));
      if (!u || !c || (c.uid !== u.id && c.host !== u.id && !this.isAdmin(u))) return J2({ error: "forbidden" });
      this.sql.exec("UPDATE clips SET deleted=1 WHERE id=?", c.id);
      return J2({ ok: true, ext: c.ext });
    }
    // ---- support: donations (coins / PayPal), goal, top supporters ----
    if (p === "/donate") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      const h = this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host), String(b.host).toLowerCase());
      if (!h || h.id === u.id) return J2({ error: "not_found" });
      const msg = String(b.msg || "").replace(/\s+/g, " ").trim().slice(0, 150);
      if (this.limited("don:" + u.id, 6, 60000)) return J2({ error: "slow" });
      const d = { id: "d" + rid(10), host: h.id, uid: u.id, name: u.name, msg };
      if (b.kind === "paypal") {
        const usd = Math.round(Math.max(1, Math.min(500, +b.usd || 0)) * 100) / 100;
        Object.assign(d, { coins: Math.round(usd * 100), usd: usd.toFixed(2), kind: "paypal" });
        this.sql.exec("INSERT INTO donations VALUES(?,?,?,?,?,?,?,?,?,?)", d.id, d.host, d.uid, d.name, d.coins, d.usd, d.kind, d.msg, "pending", t);
        return J2({ ok: true, pending: true, id: d.id, usd: d.usd, hostName: h.name });
      }
      const c = Math.floor(+b.coins || 0);
      if (c < 10 || c > 1000000) return J2({ error: "bad_amount" });
      if ((u.coins | 0) < c) return J2({ error: "no_coins" });
      this.addCoins(u.id, -c, "donate", h.handle);
      Object.assign(d, { coins: c, usd: "", kind: "coins" });
      this.sql.exec("INSERT INTO donations VALUES(?,?,?,?,?,?,?,?,?,?)", d.id, d.host, d.uid, d.name, d.coins, d.usd, d.kind, d.msg, "pending", t);
      await this.finishDonation(d);
      return J2({ ok: true, coins: (u.coins | 0) - c });
    }
    if (p === "/goal") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      if (b.clear) this.sql.exec("DELETE FROM goals WHERE host=?", u.id);
      else {
        const title = String(b.title || "").trim().slice(0, 60), target = Math.floor(+b.target || 0);
        if (!title || target < 100 || target > 100000000) return J2({ error: "bad_goal" });
        const g = this.goalOf(u.id);
        this.sql.exec("INSERT OR REPLACE INTO goals VALUES(?,?,?,?,?)", u.id, title, target, b.reset || !g ? 0 : g.cur, t);
      }
      const goal = this.goalOf(u.id);
      await this.roomOf(u.id, "/goal", { goal });
      return J2({ ok: true, goal });
    }
    if (p === "/support-info") {
      const h = this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host), String(b.host).toLowerCase());
      if (!h) return J2({ error: "not_found" });
      return J2({ goal: this.goalOf(h.id), top: this.topSupporters(h.id, 10),
        recent: this.all("SELECT name, coins, usd, kind, msg, t FROM donations WHERE host=? AND status='paid' ORDER BY t DESC LIMIT 10", h.id) });
    }
    // ---- moderation: owner > mod > vip(promoted) > viewer ----
    if (p === "/mod") {
      const me = this.user(b.token); if (!me) return J2({ error: "auth" });
      const h = b.host ? this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host), String(b.host).toLowerCase()) : me;
      if (!h) return J2({ error: "not_found" });
      const myRole = this.roleOf(h.id, me.id);
      if (myRole !== "owner" && myRole !== "mod") return J2({ error: "forbidden" });
      const act = String(b.action || "");
      const OWNER_ONLY = ["addmod", "removemod", "demote", "ban", "unban", "unkick", "clear"];
      if (OWNER_ONLY.includes(act) && myRole !== "owner") return J2({ error: "owner_only" });
      const apply = { action: act, by: me.name, byUid: me.id };
      if (act === "del" || act === "clear") {
        apply.msgId = String(b.msgId || "");
      } else {
        const tg = this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.target || ""), String(b.target || "").toLowerCase());
        if (!tg) return J2({ error: "not_found" });
        const tr = this.roleOf(h.id, tg.id);
        if (tr === "owner") return J2({ error: "forbidden" });
        if (tr === "mod" && myRole !== "owner") return J2({ error: "forbidden" });
        Object.assign(apply, { uid: tg.id, name: tg.name });
        const sanc = (kind, mins) => { const until = t + mins * 60000; this.sql.exec("INSERT OR REPLACE INTO sanctions VALUES(?,?,?,?,?,?)", h.id, tg.id, kind, until, me.id, t); apply.until = until; apply.mins = mins; };
        const setRole = (role) => { if (role) this.sql.exec("INSERT OR REPLACE INTO modroles VALUES(?,?,?,?,?)", h.id, tg.id, role, me.id, t); else this.sql.exec("DELETE FROM modroles WHERE host=? AND uid=?", h.id, tg.id); apply.role = role; };
        if (act === "timeout") sanc("timeout", Math.max(1, Math.min(10080, b.mins | 0 || 5)));
        else if (act === "untimeout") this.sql.exec("DELETE FROM sanctions WHERE host=? AND uid=? AND kind='timeout'", h.id, tg.id);
        else if (act === "kick") sanc("kick", Math.max(1, Math.min(1440, b.mins | 0 || 10)));
        else if (act === "ban") sanc("ban", 100 * 365 * 24 * 60);
        else if (act === "unban" || act === "unkick") this.sql.exec("DELETE FROM sanctions WHERE host=? AND uid=? AND kind IN ('ban','kick','timeout')", h.id, tg.id);
        else if (act === "promote") { if (tr === "vip") return J2({ error: "already" }); setRole("vip"); }
        else if (act === "demote") { if (tr !== "vip") return J2({ error: "not_found" }); setRole(""); }
        else if (act === "addmod") setRole("mod");
        else if (act === "removemod") { if (tr !== "mod") return J2({ error: "not_found" }); setRole(""); }
        else return J2({ error: "bad_action" });
      }
      const live = this.one("SELECT id FROM streams WHERE uid=? AND ended=0 AND beat>? ORDER BY started DESC", h.id, t - 120000);
      if (live) await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + live.id)).fetch("https://room/mod-apply", { method: "POST", body: JSON.stringify(apply) }).catch(() => {});
      return J2({ ok: true, ...apply });
    }
    if (p === "/mods") {
      const me = this.user(b.token); if (!me) return J2({ error: "auth" });
      const h = b.host ? this.one("SELECT * FROM users WHERE (id=? OR handle=?) AND deleted=0", String(b.host), String(b.host).toLowerCase()) : me;
      if (!h) return J2({ error: "not_found" });
      const myRole = this.roleOf(h.id, me.id);
      if (myRole !== "owner" && myRole !== "mod") return J2({ error: "forbidden" });
      const U = (r) => { const u = this.one("SELECT * FROM users WHERE id=?", r.uid); return u ? { ...this.pubUser(u), role: r.role, kind: r.kind, until: r.until } : null; };
      return J2({ myRole,
        mods: this.all("SELECT uid, role FROM modroles WHERE host=? AND role='mod' ORDER BY t", h.id).map(U).filter(Boolean),
        vips: this.all("SELECT uid, role FROM modroles WHERE host=? AND role='vip' ORDER BY t", h.id).map(U).filter(Boolean),
        sanctions: this.all("SELECT uid, kind, until FROM sanctions WHERE host=? AND until>? ORDER BY until DESC LIMIT 200", h.id, t).map(U).filter(Boolean) });
    }
    if (p === "/streamers") {
      const t2 = now(), mk = monthKey(t2), month = b.mode !== "all";
      const rows = month
        ? this.all("SELECT * FROM users WHERE mkey=? AND mxp>0 AND deleted=0" + this.noAdm + " ORDER BY mxp DESC, sxp DESC LIMIT 50", mk)
        : this.all("SELECT * FROM users WHERE sxp>0 AND deleted=0" + this.noAdm + " ORDER BY sxp DESC LIMIT 50");
      const liveSet = new Set(this.all("SELECT uid FROM streams WHERE ended=0 AND beat>?", t2 - 90000).map((r) => r.uid));
      const me = this.user(b.token);
      const ends = new Date(Date.UTC(+mk.slice(0, 4), +mk.slice(5, 7), 1) - 3 * 3600000).getTime();
      return J2({ month: mk, ends, list: rows.map((u, i) => ({ rank: i + 1, ...this.pubUser(u), level: sLevelOf(u.sxp), xp: month ? u.mxp : u.sxp, live: liveSet.has(u.id) })),
        me: me && !this.isAdmin(me) ? this.streamerOf(me) : null, shares: TOP_SHARE, base: STREAMER_SHARE });
    }
    if (p === "/loy-top") {
      const rows = this.all("SELECT c.uid, c.xp, u.name, u.color, u.handle, u.av, u.vipUntil, u.equip, u.owned FROM chan c JOIN users u ON u.id=c.uid WHERE c.host=? AND u.deleted=0 ORDER BY c.xp DESC LIMIT 20", String(b.host));
      return J2({ top: rows.map((r) => ({ uid: r.uid, xp: r.xp, level: levelOf(r.xp), name: r.name, color: r.color, handle: r.handle, avatar: r.av ? "/api/avatar/" + r.uid + "?v=" + r.av : "", look: this.lookOf(r) })) });
    }
    if (p === "/rewards-set") {
      const u = this.user(b.token); if (!u) return J2({ error: "auth" });
      if (b.del) this.sql.exec("DELETE FROM rewards WHERE id=? AND host=?", String(b.del), u.id);
      if (b.title) {
        const n = this.one("SELECT COUNT(*) n FROM rewards WHERE host=?", u.id).n;
        if (n >= 12) return J2({ error: "too_many" });
        this.sql.exec("INSERT INTO rewards VALUES(?,?,?,?,?)", "c" + rid(8), u.id, String(b.title).trim().slice(0, 50), Math.max(10, Math.min(100000, b.cost | 0)), t);
      }
      return J2({ rewards: this.all("SELECT id, title, cost FROM rewards WHERE host=? ORDER BY cost", u.id) });
    }
    if (p === "/order-new") {
      this.sql.exec("INSERT OR REPLACE INTO orders VALUES(?,?,?,?,?,?,?)", b.id, b.uid, b.pack, b.coins, b.usd, "created", t);
      return J2({ ok: true });
    }
    if (p === "/order-get") {
      const o = this.one("SELECT * FROM orders WHERE id=?", String(b.id));
      if (b.raw) return J2({ order: o });
      const u = this.user(b.token);
      if (!o || !u || o.uid !== u.id) return J2({ error: "not_found" });
      return J2({ status: o.status, coins: o.coins, balance: u.coins | 0 });
    }
    if (p === "/order-paid") {
      const o = this.one("SELECT * FROM orders WHERE id=?", String(b.id));
      if (!o || o.status === "paid") return J2({ ok: true });
      this.sql.exec("UPDATE orders SET status='paid' WHERE id=?", o.id);
      if (String(o.pack).startsWith("don:")) {
        const d = this.one("SELECT * FROM donations WHERE id=? AND status='pending'", String(o.pack).slice(4));
        if (d) await this.finishDonation(d);
        return J2({ ok: true, donation: true });
      }
      this.addCoins(o.uid, o.coins, "purchase", o.id);
      return J2({ ok: true });
    }
    if (p === "/diag-add") {
      if (this.limited("dg:" + b.ip, 300, 600000)) return J2({ ok: false });
      this.sql.exec("INSERT INTO diag(t, ip, ua, src, room, msg) VALUES(?,?,?,?,?,?)", t, b.ip, b.ua, b.src, b.room, b.msg);
      this.sql.exec("DELETE FROM diag WHERE id <= (SELECT MAX(id) - 1000 FROM diag)");
      return J2({ ok: true });
    }
    if (p === "/diag-get") {
      return J2({ logs: this.all("SELECT * FROM diag ORDER BY id DESC LIMIT ?", Math.min(1000, b.n | 0 || 200)).reverse()
        .map((r) => ({ ...r, ip: (r.ip || "").replace(/[.:][^.:]*$/, ".x") })) });
    }
    if (p === "/viewers") {
      this.sql.exec("UPDATE streams SET viewers=?, peak=MAX(peak,?), guests=? WHERE id=?", b.n | 0, b.n | 0, b.guests | 0, String(b.room));
      return J2({ ok: true });
    }
    if (p === "/end") {
      let r = null;
      if (b.pub) r = this.one("SELECT * FROM pubs WHERE pub=?", String(b.pub));
      const u = r ? this.one("SELECT * FROM users WHERE id=?", r.uid) : this.user(b.token);
      if (!u) return J2({ error: "auth" });
      const room = r ? r.room : String(b.room || "");
      const role = r ? r.role : "host";
      const s = this.one("SELECT * FROM streams WHERE id=?", room);
      if (!s) return J2({ error: "no_stream" });
      if (role === "host" && s.uid === u.id) {
        this.sql.exec("UPDATE streams SET ended=? WHERE id=?", t, room);
        this.sql.exec("DELETE FROM pubs WHERE room=?", room);
        this.sql.exec("UPDATE recs SET ended=? WHERE id=? AND ended=0", t, room);
        return J2({ ok: true, room, uid: u.id, all: true });
      }
      this.sql.exec("DELETE FROM pubs WHERE room=? AND uid=?", room, u.id);
      return J2({ ok: true, room, uid: u.id, all: false });
    }
    return J2({ error: "unknown" });
  }
}

// ======================================================================
// Room — one per stream: chat, reactions, effects, polls, challenges,
// hype meter, co-stream guests, published tracks, privacy state.
// Uses the WebSocket Hibernation API so idle rooms cost nothing.
// ======================================================================
const EFFECTS = new Set(["confetti", "shake", "hearts", "airhorn", "boo", "fire", "wave", "lightning"]);

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.loaded = this.state.blockConcurrencyWhile(async () => {
      this.meta = (await state.storage.get("meta")) || null;
      this.history = (await state.storage.get("history")) || [];
      this.pubs = (await state.storage.get("pubs")) || {}; // uid -> publisher
      this.guests = (await state.storage.get("guests")) || []; // approved uids
      this.requests = (await state.storage.get("requests")) || []; // [{uid,name,color}]
      this.poll = (await state.storage.get("poll")) || null;
      this.challenges = (await state.storage.get("challenges")) || [];
      this.hype = (await state.storage.get("hype")) || { v: 0, t: now(), lvl: 1 };
      this.pinned = (await state.storage.get("pinned")) || null;
      this.redeems = (await state.storage.get("redeems")) || [];
      this.wt = (await state.storage.get("wt")) || {};
      this.lastTick = (await state.storage.get("lastTick")) || 0;
    });
    this.throttle = new Map();
  }
  sockets() {
    return this.state.getWebSockets();
  }
  info(ws) {
    try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; }
  }
  send(ws, o) {
    try { ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch (e) {}
  }
  bcast(o, filter) {
    const s = JSON.stringify(o);
    for (const ws of this.sockets()) if (!filter || filter(this.info(ws))) this.send(ws, s);
  }
  isHost(uid) {
    return this.meta && uid && uid === this.meta.host;
  }
  hypeNow() {
    const h = this.hype;
    const dt = (now() - h.t) / 1000;
    h.v = Math.max(0, h.v - dt * 0.6);
    h.t = now();
    return h;
  }
  addHype(n) {
    const h = this.hypeNow();
    h.v += n;
    let train = false;
    if (h.v >= 100) { h.v = 35; h.lvl += 1; train = true; }
    this.state.storage.put("hype", h);
    this.bcast({ t: "hype", v: Math.round(h.v), lvl: h.lvl, train });
  }
  counts() {
    let n = 0;
    for (const ws of this.sockets()) if (!this.info(ws).pub) n++;
    return n;
  }
  publishers() {
    return Object.values(this.pubs);
  }
  async syncHub() {
    if (!this.meta) return;
    const n = this.counts();
    if (this._lastN === n) return;
    this._lastN = n;
    try {
      await this.env.HUB.get(this.env.HUB.idFromName("hub")).fetch("https://hub/viewers", {
        method: "POST",
        body: JSON.stringify({ room: this.meta.room, n, guests: this.guests.length }),
      });
    } catch (e) {}
    this.bcast({ t: "viewers", n });
  }
  allowed(key, ms) {
    const t = now(), last = this.throttle.get(key) || 0;
    if (t - last < ms) return false;
    this.throttle.set(key, t);
    return true;
  }
  pushHistory(m) {
    this.history.push(m);
    if (this.history.length > 80) this.history.splice(0, this.history.length - 80);
    this.state.storage.put("history", this.history);
  }

  async fetch(req) {
    await this.loaded;
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === "/gameicon") {
      if (req.method === "PUT") {
        await this.state.storage.put("gameicon", { type: req.headers.get("content-type") || "image/png", data: await req.arrayBuffer() });
        return new Response("ok");
      }
      const g = await this.state.storage.get("gameicon");
      return g ? new Response(g.data, { headers: { "content-type": g.type } }) : new Response(null, { status: 404 });
    }
    if (p === "/thumb") {
      if (req.method === "PUT") {
        await this.state.storage.put("thumb:" + url.searchParams.get("u"), await req.arrayBuffer());
        return new Response("ok");
      }
      const u = url.searchParams.get("u") || (this.meta && this.meta.host);
      const img = await this.state.storage.get("thumb:" + u);
      return img ? new Response(img, { headers: { "content-type": "image/jpeg" } }) : new Response(null, { status: 404 });
    }
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const R = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

    if (p === "/init") {
      this.meta = { room: body.room, host: body.host, hostName: body.hostName, title: body.title, started: now(), ended: false,
        prefs: body.prefs || {}, followers: (body.followers || []).slice(0, 5000), ytChan: body.ytChan || "", ytOn: !!body.ytChan };
      this.ytc = null;
      this.history = []; this.pubs = {}; this.guests = []; this.requests = []; this.poll = null; this.challenges = [];
      this.hype = { v: 0, t: now(), lvl: 1 }; this.pinned = null; this.redeems = []; this.wt = {}; this.lastTick = 0;
      await this.state.storage.put({ meta: this.meta, history: [], pubs: {}, guests: [], requests: [], poll: null, challenges: [], hype: this.hype, pinned: null });
      return R({ ok: true });
    }
    if (p === "/donation") {
      const d = body, t = now();
      this.bcast({ t: "donation", ...d });
      this.pushHistory({ id: "dn" + rid(6), uid: d.uid, name: d.name, color: d.color, look: d.look, text: d.msg || "", don: d.usd ? "$" + d.usd : d.coins, at: t });
      this.addHype(Math.min(80, 10 + d.coins / 15));
      return R({ ok: true });
    }
    if (p === "/goal") { this.bcast({ t: "goal", goal: body.goal }); return R({ ok: true }); }
    if (p === "/clip") { this.bcast({ t: "clip", id: body.id, name: body.name, title: body.title }); return R({ ok: true }); }
    if (p === "/mod-apply") {
      const a = body, t = now();
      const sys = (key) => { const ev = { t: "modlog", key, name: a.name || "", by: a.by || "", mins: a.mins || 0, at: t }; this.bcast(ev); };
      const purge = (uid) => { const n = this.history.length; this.history = this.history.filter((m) => m.uid !== uid); if (this.history.length !== n) this.state.storage.put("history", this.history); this.bcast({ t: "purge", uid }); };
      const patch = (uid, f) => { for (const w of this.socketsOf(uid)) { const x = this.info(w); f(x); try { w.serializeAttachment(x); } catch (e) {} } };
      switch (a.action) {
        case "timeout": patch(a.uid, (x) => (x.to = a.until)); purge(a.uid); sys("timeout"); for (const w of this.socketsOf(a.uid)) this.send(w, { t: "timedout", until: a.until }); break;
        case "untimeout": patch(a.uid, (x) => (x.to = 0)); sys("untimeout"); for (const w of this.socketsOf(a.uid)) this.send(w, { t: "timedout", until: 0 }); break;
        case "kick": case "ban":
          purge(a.uid); sys(a.action);
          for (const w of this.socketsOf(a.uid)) { this.send(w, { t: "kicked", until: a.until, ban: a.action === "ban" }); try { w.close(4003, a.action); } catch (e) {} }
          this.guests = this.guests.filter((g) => g !== a.uid); break;
        case "unban": case "unkick": sys("unban"); break;
        case "promote": case "demote": case "addmod": case "removemod":
          patch(a.uid, (x) => (x.role = a.role || "")); this.bcast({ t: "role", uid: a.uid, role: a.role || "" }); sys(a.action);
          for (const w of this.socketsOf(a.uid)) this.send(w, { t: "myrole", role: a.role || "" });
          break;
        case "del": { this.history = this.history.filter((m) => m.id !== a.msgId); this.state.storage.put("history", this.history); this.bcast({ t: "delmsg", id: a.msgId }); break; }
        case "clear": this.history = []; this.state.storage.put("history", []); this.bcast({ t: "clearchat", by: a.by }); break;
      }
      return R({ ok: true });
    }
    if (p === "/yt") {
      const was = this.yt;
      this.yt = { ok: !!body.ok, code: body.code | 0 };
      if (!was || was.ok !== this.yt.ok) this.bcast({ t: "yt", ...this.yt });
      return R({ ok: true });
    }
    if (p === "/state") {
      return R({ meta: this.meta && { room: this.meta.room, title: this.meta.title, ended: this.meta.ended }, publishers: this.publishers(), viewers: this.counts() });
    }
    if (p === "/is-guest") {
      const ok = this.guests.includes(body.uid);
      return R({ ok, count: this.guests.length });
    }
    if (p === "/publish") {
      // body: {uid,name,role,color, sessionId, tracks:[{trackName,kind,role}], device}
      if (!this.meta || this.meta.ended) return R({ error: "ended" }, 410);
      if (body.role === "guest" && !this.guests.includes(body.uid)) return R({ error: "not_guest" }, 403);
      const tracks = (body.tracks || []).slice(0, 6).map((t) => ({
        trackName: String(t.trackName), kind: t.kind === "audio" ? "audio" : "video",
        role: ["screen", "cam", "audio", "mic"].includes(t.role) ? t.role : "screen",
      }));
      const sid = String(body.sessionId || "");
      const prev = this.pubs[body.uid];
      const roles = new Set(tracks.map((x) => x.role));
      const keep = prev ? prev.tracks.filter((x) => x.sessionId !== sid && !roles.has(x.role)) : [];
      this.pubs[body.uid] = {
        uid: body.uid, name: body.name, color: body.color, role: body.role,
        tracks: [...keep, ...tracks.map((x) => ({ ...x, sessionId: sid }))],
        privacy: prev ? prev.privacy : null,
        orientation: body.orientation || (prev && prev.orientation) || "auto",
        since: prev ? prev.since : now(),
      };
      await this.state.storage.put("pubs", this.pubs);
      this.bcast({ t: "publishers", list: this.publishers() });
      this.state.storage.setAlarm(now() + 30000);
      return R({ ok: true });
    }
    if (p === "/status") {
      this.bcast({ t: "bstatus", uid: body.uid, state: String(body.state || "").slice(0, 20), msg: String(body.msg || "").slice(0, 300) });
      return R({ ok: true });
    }
    if (p === "/privacy") {
      const pb = this.pubs[body.uid];
      if (pb) {
        pb.privacy = body.on ? { reason: String(body.reason || "privacy").slice(0, 20), at: now() } : null;
        await this.state.storage.put("pubs", this.pubs);
      }
      this.bcast({ t: "privacy", uid: body.uid, on: !!body.on, reason: body.reason || "" });
      return R({ ok: true });
    }
    if (p === "/ended") {
      if (body.all) {
        if (this.meta) this.meta.ended = true;
        this.pubs = {};
        await this.state.storage.put({ meta: this.meta, pubs: {} });
        this.bcast({ t: "ended" });
      } else {
        delete this.pubs[body.uid];
        this.guests = this.guests.filter((g) => g !== body.uid);
        await this.state.storage.put({ pubs: this.pubs, guests: this.guests });
        this.bcast({ t: "publishers", list: this.publishers() });
      }
      return R({ ok: true });
    }
    if (p === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const uid = url.searchParams.get("uid") || "";
      const att = {
        uid, name: url.searchParams.get("name") || "", color: url.searchParams.get("color") || "#7C5CFF",
        handle: url.searchParams.get("handle") || "", anon: !uid, id: rid(6),
        pub: url.searchParams.get("pub") === "1",
        look: (() => { try { return JSON.parse(url.searchParams.get("look") || "{}"); } catch (e) { return {}; } })(),
        av: (url.searchParams.get("av") || "").slice(0, 200),
      };
      this.state.acceptWebSocket(server);
      server.serializeAttachment(att);
      const h = this.hypeNow();
      this.send(server, {
        t: "hello", yt: this.yt || null, me: att, meta: this.meta && { room: this.meta.room, host: this.meta.host, hostName: this.meta.hostName, title: this.meta.title, started: this.meta.started, ended: this.meta.ended, ytChan: !!this.meta.ytChan, ytOn: !!this.meta.ytOn }, history: this.history, publishers: this.publishers(),
        viewers: this.counts(), poll: this.pollOut(), hype: { v: Math.round(h.v), lvl: h.lvl },
        challenges: this.challenges, pinned: this.pinned, guests: this.guests,
        requests: this.isHost(uid) ? this.requests : undefined,
        redeems: this.isHost(uid) ? this.redeems || [] : undefined,
        host: this.isHost(uid),
        rules: this.meta ? { allowFx: this.pref("allowFx") !== false, allowCh: this.pref("allowCh") !== false, coStream: this.pref("coStream") || "all", slow: this.pref("slow") | 0 } : null,
      });
      this.state.waitUntil(this.syncHub());
      if (uid && !att.pub && this.meta && uid !== this.meta.host) {
        this.state.waitUntil((async () => {
          try {
            const d = await this.hubPost("/loy-daily", { uid, host: this.meta.host });
            const g = await this.hubPost("/loy-get", { uid, host: this.meta.host });
            this.setLvl(uid, g.level);
            const sc = g.sanction || {};
            if (sc.ban || sc.kick) { this.send(server, { t: "kicked", until: sc.ban || sc.kick, ban: !!sc.ban }); try { server.close(4003, "banned"); } catch (e) {} return; }
            const a2 = this.info(server); a2.sub = g.sub ? g.sub.months : 0; a2.role = g.role || ""; a2.to = sc.timeout || 0; try { server.serializeAttachment(a2); } catch (e) {}
            if (g.role) this.send(server, { t: "myrole", role: g.role });
            if (sc.timeout) this.send(server, { t: "timedout", until: sc.timeout });
            this.send(server, { t: "loy", ...g, daily: d.daily, gotPts: d.gotPts, gotXp: d.gotXp });
            if ((g.sub || (att.look && att.look.vip)) && this.allowed("enter:" + uid, 60000)) {
              this.bcast({ t: "enter", uid, name: att.name, color: att.color, look: att.look || {}, avatar: att.av, level: g.level, sub: g.sub ? g.sub.months : 0, handle: att.handle });
            }
            const s = this.wt && this.wt[uid]; if (s && s.chestReady) this.send(server, { t: "chest" });
          } catch (e) {}
        })());
      }
      if (!(await this.state.storage.getAlarm())) await this.state.storage.setAlarm(now() + 30000);

      return new Response(null, { status: 101, webSocket: client });
    }
    return R({ error: "unknown" }, 404);
  }

  pollOut() {
    const p = this.poll;
    if (!p) return null;
    return { id: p.id, q: p.q, opts: p.opts, votes: p.votes, ends: p.ends, done: p.done };
  }

  async webSocketMessage(ws, raw) {
    await this.loaded;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const me = this.info(ws);
    const host = this.isHost(me.uid);
    const t = now();
    switch (m.t) {
      case "ping":
        return this.send(ws, { t: "pong", at: m.at });
      case "ytchat": {
        if (!this.meta || me.uid !== this.meta.host) return;
        this.meta.ytOn = !!m.on && !!this.meta.ytChan; await this.state.storage.put("meta", this.meta);
        this.bcast({ t: "ytchat", on: this.meta.ytOn });
        if (this.meta.ytOn) await this.state.storage.setAlarm(now() + 2000);
        return;
      }
      case "chat": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        const text = String(m.text || "").trim().slice(0, 200);
        if (me.to && me.to > t) return this.send(ws, { t: "timedout", until: me.to });
        const slow = host || me.role ? 0 : ((this.meta && this.meta.prefs && this.meta.prefs.slow) | 0) * 1000;
        if (!text) return;
        if (!this.allowed("c:" + me.uid, Math.max(700, slow))) return slow ? this.send(ws, { t: "err", e: "slow" }) : undefined;
        const msg = { t: "chat", id: rid(8), uid: me.uid, name: me.name, color: me.color, text, at: t, host, guest: this.guests.includes(me.uid), look: me.look || {}, lvl: host ? 0 : me.lvl || 1, sub: me.sub || 0, role: host ? "" : me.role || "" };
        const ws0 = (this.wt = this.wt || {})[me.uid] = (this.wt || {})[me.uid] || { ms: 0, chest: 0, chat: 0, chestReady: false };
        if (ws0.chat < 30) { ws0.chat += 2; this.addXp(me.uid, 2); }
        this.pushHistory(msg);
        this.bcast(msg);
        this.addHype(1);
        return;
      }
      case "react": {
        const e = String(m.e || "hrt").slice(0, 4);
        if (!this.allowed("r:" + (me.uid || me.id), 250)) return;
        this.bcast({ t: "react", e, uid: me.uid });
        this.addHype(0.6);
        return;
      }
      case "effect": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        if (this.pref("allowFx") === false && !host) return this.send(ws, { t: "err", e: "fx_off" });
        if (VIP_FX.has(m.id) && !(me.look && me.look.vip)) return this.send(ws, { t: "err", e: "vip_only" });
        if (CATALOG.fx[m.id] && !((me.look && me.look.fx) || []).includes(m.id)) return this.send(ws, { t: "err", e: "not_owned" });
        if (!(EFFECTS.has(m.id) || VIP_FX.has(m.id) || CATALOG.fx[m.id]) || !this.allowed("e:" + me.uid, 4000)) return this.send(ws, { t: "err", e: "slow" });
        this.bcast({ t: "effect", id: m.id, name: me.name, color: me.color, at: t });
        this.addHype(6);
        return;
      }
      case "gift": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        if (!this.meta || this.meta.ended || !GIFTS[m.gift]) return;
        if (!this.allowed("g:" + me.uid, 800)) return this.send(ws, { t: "err", e: "slow" });
        const to = m.to && (this.guests.includes(m.to) || m.to === this.meta.host) ? m.to : this.meta.host;
        const r = await this.env.HUB.get(this.env.HUB.idFromName("hub")).fetch("https://hub/gift", {
          method: "POST", body: JSON.stringify({ from: me.uid, to, gift: m.gift, n: m.n | 0 || 1 }) }).then((x) => x.json());
        if (r.error) return this.send(ws, { t: "err", e: r.error });
        this.send(ws, { t: "coins", coins: r.coins });
        const ev = { t: "gift", id: rid(6), gift: m.gift, n: r.n, uid: me.uid, name: me.name, color: me.color, look: me.look || {}, to, value: r.cost, at: t };
        this.giftTotal = (this.giftTotal || 0) + r.cost;
        this.addXp(me.uid, Math.round(r.cost / 2));
        this.state.waitUntil(this.flushLoyalty());
        this.pushHistory({ t: "chat", id: ev.id, uid: me.uid, name: me.name, color: me.color, look: me.look || {}, text: `×${r.n}`, at: t, gift: true, giftId: m.gift });
        this.bcast(ev);
        if (r.host && r.host.levelUp && to === this.meta.host) this.bcast({ t: "slevelup", uid: to, name: this.meta.hostName, level: r.host.level });
        this.addHype(Math.min(60, 5 + r.cost / 20));
        return;
      }
      case "claim": {
        const s = this.wt && this.wt[me.uid];
        if (!s || !s.chestReady) return;
        s.chestReady = false; s.chest = 0;
        this.addXp(me.uid, 0, 50);
        await this.flushLoyalty();
        this.send(ws, { t: "claimed", pts: 50 });
        return;
      }
      case "redeem": {
        if (me.anon || host) return;
        if (!this.allowed("rd:" + me.uid, 2000)) return this.send(ws, { t: "err", e: "slow" });
        const rr = await this.hubPost("/loy-reward", { id: m.id, host: this.meta.host });
        const rw = rr.reward; if (!rw) return;
        const text = String(m.text || "").trim().slice(0, 150);
        if ((rw.text || m.id === "highlight" || m.id === "pin") && !text) return this.send(ws, { t: "err", e: "need_text" });
        const sp = await this.hubPost("/loy-spend", { uid: me.uid, host: this.meta.host, cost: rw.cost });
        if (sp.error) return this.send(ws, { t: "err", e: sp.error });
        this.send(ws, { t: "loy", ...sp });
        const base = { id: rid(8), uid: me.uid, name: me.name, color: me.color, look: me.look || {}, lvl: me.lvl || 1, at: t };
        if (m.id === "highlight" || m.id === "pin") {
          const msg = { t: "chat", ...base, text, hl: true };
          this.pushHistory(msg); this.bcast(msg);
          if (m.id === "pin") { this.pinned = { ...msg, until: t + 60000 }; await this.state.storage.put("pinned", this.pinned); this.bcast({ t: "pinned", msg: this.pinned }); await this.state.storage.setAlarm(Math.min((await this.state.storage.getAlarm()) || Infinity, t + 60200)); }
        } else if (m.id === "goldrain") {
          this.bcast({ t: "effect", id: "goldrain", name: me.name, color: me.color, at: t });
        } else {
          this.redeems = (this.redeems || []).concat({ ...base, rid: rw.id, title: rw.title, cost: rw.cost, text, state: "new" }).slice(-30);
          await this.state.storage.put("redeems", this.redeems);
          this.bcast({ t: "redeems", list: this.redeems }, (i) => this.isHost(i.uid));
          this.bcast({ t: "redeemed", ...base, title: rw.title, text });
        }
        this.addHype(4);
        return;
      }
      case "redeem-set": {
        if (!host) return;
        const it = (this.redeems || []).find((x) => x.id === m.id); if (!it || it.state !== "new") return;
        it.state = m.state === "refund" ? "refund" : "done";
        if (it.state === "refund") { this.addXp(it.uid, 0, it.cost); await this.flushLoyalty(); }
        await this.state.storage.put("redeems", this.redeems);
        this.bcast({ t: "redeems", list: this.redeems }, (i) => this.isHost(i.uid));
        return;
      }
      case "vote": {
        const p = this.poll;
        if (!p || p.done || me.anon) return;
        const k = me.uid;
        const opt = m.opt | 0;
        if (opt < 0 || opt >= p.opts.length) return;
        if (p.voters[k] !== undefined) p.votes[p.voters[k]]--;
        p.voters[k] = opt;
        p.votes[opt]++;
        this.state.storage.put("poll", p);
        if (this.allowed("pv", 300)) this.bcast({ t: "poll", poll: this.pollOut() });
        return;
      }
      case "poll": {
        if (!host) return;
        const opts = (m.opts || []).map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 4);
        if (opts.length < 2) return;
        const secs = Math.min(300, Math.max(15, m.secs | 0 || 60));
        this.poll = { id: rid(6), q: String(m.q || "").slice(0, 100), opts, votes: opts.map(() => 0), voters: {}, ends: t + secs * 1000, done: false };
        await this.state.storage.put("poll", this.poll);
        await this.state.storage.setAlarm(this.poll.ends);
        this.bcast({ t: "poll", poll: this.pollOut() });
        return;
      }
      case "endpoll": {
        if (!host || !this.poll) return;
        this.poll.done = true;
        await this.state.storage.put("poll", this.poll);
        this.bcast({ t: "poll", poll: this.pollOut() });
        return;
      }
      case "challenge": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        if (this.pref("allowCh") === false) return this.send(ws, { t: "err", e: "ch_off" });
        const text = String(m.text || "").trim().slice(0, 90);
        if (!text || !this.allowed("ch:" + me.uid, 20000)) return this.send(ws, { t: "err", e: "slow" });
        const c = { id: rid(6), uid: me.uid, name: me.name, color: me.color, text, state: "new", at: t, up: 1, voters: [me.uid] };
        this.challenges.unshift(c);
        this.challenges = this.challenges.slice(0, 30);
        await this.state.storage.put("challenges", this.challenges);
        this.bcast({ t: "challenges", list: this.challenges.map(this.chOut) });
        this.addHype(3);
        return;
      }
      case "ch-up": {
        const c = this.challenges.find((x) => x.id === m.id);
        if (!c || me.anon || c.voters.includes(me.uid)) return;
        c.voters.push(me.uid); c.up++;
        await this.state.storage.put("challenges", this.challenges);
        this.bcast({ t: "challenges", list: this.challenges.map(this.chOut) });
        return;
      }
      case "ch-set": {
        if (!host) return;
        const c = this.challenges.find((x) => x.id === m.id);
        if (!c || !["accepted", "done", "failed", "rejected"].includes(m.state)) return;
        c.state = m.state;
        await this.state.storage.put("challenges", this.challenges);
        this.bcast({ t: "challenges", list: this.challenges.map(this.chOut), changed: this.chOut(c) });
        if (m.state === "done") this.addHype(20);
        return;
      }
      case "pin": {
        if (!host) return;
        this.pinned = m.id ? this.history.find((x) => x.id === m.id) || null : null;
        await this.state.storage.put("pinned", this.pinned);
        this.bcast({ t: "pinned", msg: this.pinned });
        return;
      }
      case "guest-req": {
        if (me.anon || host) return;
        const cs = this.pref("coStream") || "all";
        if (cs === "none" || (cs === "followers" && !(this.meta.followers || []).includes(me.uid))) return this.send(ws, { t: "err", e: "co_off" });
        if (this.requests.find((r) => r.uid === me.uid) || this.guests.includes(me.uid)) return;
        this.requests.push({ uid: me.uid, name: me.name, color: me.color, handle: me.handle, at: t });
        this.requests = this.requests.slice(-20);
        await this.state.storage.put("requests", this.requests);
        this.bcast({ t: "requests", list: this.requests }, (i) => this.isHost(i.uid));
        this.send(ws, { t: "guest-pending" });
        return;
      }
      case "guest-invite": {
        // host invites a viewer directly (from chat) or approves a request
        if (!host) return;
        const uid = String(m.uid || "");
        if (!uid || this.guests.includes(uid)) return;
        if (this.guests.length >= 3) return this.send(ws, { t: "err", e: "guests_full" });
        this.guests.push(uid);
        this.requests = this.requests.filter((r) => r.uid !== uid);
        await this.state.storage.put({ guests: this.guests, requests: this.requests });
        this.bcast({ t: "guest-ok", room: this.meta.room, title: this.meta.title, host: this.meta.hostName }, (i) => i.uid === uid);
        this.bcast({ t: "requests", list: this.requests }, (i) => this.isHost(i.uid));
        this.bcast({ t: "guests", list: this.guests });
        return;
      }
      case "guest-deny": {
        if (!host) return;
        this.requests = this.requests.filter((r) => r.uid !== m.uid);
        await this.state.storage.put("requests", this.requests);
        this.bcast({ t: "requests", list: this.requests }, (i) => this.isHost(i.uid));
        this.bcast({ t: "guest-no" }, (i) => i.uid === m.uid);
        return;
      }
      case "guest-kick": {
        if (!host && me.uid !== m.uid) return;
        this.guests = this.guests.filter((g) => g !== m.uid);
        delete this.pubs[m.uid];
        await this.state.storage.put({ guests: this.guests, pubs: this.pubs });
        this.bcast({ t: "guests", list: this.guests });
        this.bcast({ t: "publishers", list: this.publishers() });
        this.bcast({ t: "kicked" }, (i) => i.uid === m.uid);
        return;
      }
      case "layout": {
        if (!host) return;
        this.bcast({ t: "layout", mode: String(m.mode || "focus"), focus: m.focus || null });
        return;
      }
    }
  }
  pref(k) { return this.meta && this.meta.prefs ? this.meta.prefs[k] : undefined; }
  hubPost(path, body) {
    return this.env.HUB.get(this.env.HUB.idFromName("hub")).fetch("https://hub" + path, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
  }
  socketsOf(uid) { return this.sockets().filter((w) => this.info(w).uid === uid); }
  setLvl(uid, lvl) { for (const w of this.socketsOf(uid)) { const a = this.info(w); if (a.lvl !== lvl) { a.lvl = lvl; try { w.serializeAttachment(a); } catch (e) {} } } }
  addXp(uid, xp, pts = 0) {
    if (!uid || !this.meta || uid === this.meta.host) return;
    this.pend = this.pend || {};
    const p = (this.pend[uid] = this.pend[uid] || { xp: 0, pts: 0, watch: 0 });
    p.xp += xp; p.pts += pts;
  }
  /** Called every ~30 s: watch time, 5-minute rewards, bonus chest, then one batched write to the hub. */
  async loyaltyTick(t) {
    if (!this.meta || this.meta.ended) return;
    const live = this.publishers().length > 0;
    const dt = Math.min(60000, t - (this.lastTick || t));
    this.lastTick = t;
    this.wt = this.wt || {};
    const seen = new Set();
    for (const w of this.sockets()) {
      const a = this.info(w);
      if (!a.uid || a.pub || a.uid === this.meta.host || seen.has(a.uid)) continue;
      seen.add(a.uid);
      if (!live || !dt) continue;
      this.hxp = (this.hxp || 0) + dt / 60000;          // +1 per viewer-minute
      const s = (this.wt[a.uid] = this.wt[a.uid] || { ms: 0, chest: 0, chat: 0, chestReady: false });
      s.ms += dt; s.chest += dt;
      (this.pend = this.pend || {})[a.uid] = this.pend[a.uid] || { xp: 0, pts: 0, watch: 0 };
      this.pend[a.uid].watch += Math.round(dt / 1000);
      while (s.ms >= 300000) { s.ms -= 300000; this.addXp(a.uid, 10, a.sub ? 15 : 10); s.chat = 0; }
      if (s.chest >= 900000 && !s.chestReady) { s.chestReady = true; for (const x of this.socketsOf(a.uid)) this.send(x, { t: "chest" }); }
    }
    if (live && dt) this.hxp = (this.hxp || 0) + 2 * dt / 60000;  // +2 per minute live
    await this.flushLoyalty();
    await this.state.storage.put({ wt: this.wt, lastTick: this.lastTick });
  }
  async flushLoyalty() {
    const pend = this.pend || {};
    const list = Object.entries(pend).filter(([, v]) => v.xp || v.pts || v.watch).map(([uid, v]) => ({ uid, ...v }));
    this.pend = {};
    const hostXp = Math.floor(this.hxp || 0);
    if ((!list.length && !hostXp) || !this.meta) return;
    this.hxp = (this.hxp || 0) - hostXp;
    const r = await this.hubPost("/loy-add", { host: this.meta.host, list, hostXp });
    if (r.host) {
      for (const w of this.socketsOf(this.meta.host)) this.send(w, { t: "slevel", ...r.host });
      if (r.host.levelUp) this.bcast({ t: "slevelup", uid: this.meta.host, name: this.meta.hostName, level: r.host.level });
    }
    for (const [uid, o] of Object.entries(r.users || {})) {
      this.setLvl(uid, o.level);
      for (const w of this.socketsOf(uid)) this.send(w, { t: "loy", ...o });
      if (o.levelUp) {
        const a = this.socketsOf(uid)[0]; const info = a ? this.info(a) : {};
        this.bcast({ t: "levelup", uid, name: info.name || "", color: info.color, look: info.look || {}, level: o.level });
      }
    }
  }
  chOut(c) {
    return { id: c.id, name: c.name, color: c.color, text: c.text, state: c.state, up: c.up, at: c.at };
  }
  async webSocketClose(ws) {
    await this.loaded;
    this.state.waitUntil(this.syncHub());
  }
  async webSocketError(ws) {
    await this.loaded;
    this.state.waitUntil(this.syncHub());
  }
  // ---- YouTube live chat → Wahj chat (official Data API; quota-friendly polling) ----
  async ytStep(t) {
    const c = this.ytc || (this.ytc = { next: 0, tries: 0, seen: [] }), key = this.env.YT_API_KEY;
    if (t < c.next) return;
    const yt = (msg) => this.env.HUB.get(this.env.HUB.idFromName("hub")).fetch("https://hub/diag-add", { method: "POST", body: JSON.stringify({ ip: "yt", ua: "", src: "yt", room: this.meta.room, msg }) }).catch(() => {});
    if (!c.chatId) {
      if (!c.vid) c.vid = await ytLiveVideo(this.meta.ytChan, key, c.tries);
      if (c.vid) {
        const v = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${c.vid}&key=${key}`).then((r) => r.json()).catch(() => ({}));
        c.chatId = (v.items && v.items[0] && v.items[0].liveStreamingDetails && v.items[0].liveStreamingDetails.activeLiveChatId) || null;
        if (v.error) yt("youtube chat: videos error " + JSON.stringify(v.error).slice(0, 200));
      }
      if (!c.chatId) { c.tries++; c.next = t + (c.tries < 40 ? 15000 : 60000); if (c.tries === 4) yt("youtube chat: live video not found yet on channel " + this.meta.ytChan); return; }
      c.first = true; yt("youtube chat: connected video=" + c.vid);
    }
    const r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(c.chatId)}&part=snippet,authorDetails&maxResults=200&key=${key}` + (c.page ? "&pageToken=" + encodeURIComponent(c.page) : "")).then((x) => x.json()).catch(() => ({}));
    if (r.error) {
      yt("youtube chat error " + (r.error.code || "") + " " + String(r.error.message || "").slice(0, 160));
      if (r.error.code === 403) c.next = t + 600000; else { c.chatId = null; c.vid = null; c.page = null; c.next = t + 20000; }
      return;
    }
    c.page = r.nextPageToken || c.page;
    if (!c.first) {
      for (const it of r.items || []) {
        const sn = it.snippet || {}, au = it.authorDetails || {};
        if (sn.type !== "textMessageEvent" && sn.type !== "superChatEvent") continue;
        if (c.seen.includes(it.id)) continue;
        c.seen.push(it.id); if (c.seen.length > 400) c.seen.splice(0, 200);
        const text = String(sn.displayMessage || "").slice(0, 300); if (!text) continue;
        const msg = { t: "chat", id: "yt" + rid(8), uid: "", name: String(au.displayName || "YouTube").slice(0, 40), color: "#ff5b52", text, at: t, src: "yt",
          yav: au.profileImageUrl || "", ymod: !!(au.isChatModerator || au.isChatOwner), ysc: sn.superChatDetails ? sn.superChatDetails.amountDisplayString : "" };
        this.pushHistory(msg); this.bcast(msg);
      }
    }
    c.first = false;
    c.next = t + Math.max(8000, r.pollingIntervalMillis || 8000);
  }
  async alarm() {
    await this.loaded;
    const t = now();
    if (this.poll && !this.poll.done && t >= this.poll.ends) {
      this.poll.done = true;
      await this.state.storage.put("poll", this.poll);
      this.bcast({ t: "poll", poll: this.pollOut() });
    }
    await this.syncHub();
    try { await this.loyaltyTick(t); } catch (e) {}
    if (this.pinned && this.pinned.until && t > this.pinned.until) { this.pinned = null; await this.state.storage.put("pinned", null); this.bcast({ t: "pinned", msg: null }); }
    const next = [];
    if (this.poll && !this.poll.done) next.push(this.poll.ends);
    if (this.pinned && this.pinned.until) next.push(this.pinned.until + 200);
    if (this.meta && this.meta.ytChan && this.meta.ytOn && !this.meta.ended && this.env.YT_API_KEY) {
      try { await this.ytStep(t); } catch (e) {}
      if (this.ytc && this.sockets().length) next.push(Math.max(t + 3000, this.ytc.next));
    }
    if (this.sockets().length) next.push(t + 30000);
    if (next.length) await this.state.storage.setAlarm(Math.min(...next));
  }
}
