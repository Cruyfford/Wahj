// Wahj Live — Cloudflare Worker backend
// Accounts, stream directory, Cloudflare Realtime SFU proxy, realtime rooms.
import APP_HTML from "./app.html";
import GAMES from "./games.json";
import HLS_JS from "./lib/hls.txt";

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
    if (p === "/hls.js") return new Response(HLS_JS, { headers: { "content-type": "application/javascript", "cache-control": "public, max-age=604800" } });
    if (p === "/health") return J({ ok: true, v: VERSION, rev: env.NATIVE_REV || "" });
    if (!p.startsWith("/api/")) return new Response("Not found", { status: 404 });

    let m0;
    try {
      // ---- config ----
      if (p === "/api/config") {
        return J({ v: VERSION, rev: env.NATIVE_REV || "", ice: await iceServers(env), sfu: !!env.SFU_APP_ID, mail: !!env.RESEND_API_KEY, rec: !!env.REC });
      }
      if (p === "/api/ice") return J({ iceServers: await iceServers(env) });

      // ---- recordings (R2, HLS fMP4) ----
      let mr = p.match(/^\/api\/rec\/([a-z0-9]+)\/(init|seg)$/);
      if (mr && req.method === "POST") {
        if (!env.REC) return J({ error: "rec_off" }, 503);
        const pub = req.headers.get("x-pub") || "";
        const buf = await req.arrayBuffer();
        if (buf.byteLength < 8 || buf.byteLength > 25e6) return J({ error: "size" }, 400);
        const n = mr[2] === "init" ? -1 : Math.max(0, +url.searchParams.get("n") | 0);
        const dur = Math.min(30, Math.max(0, +url.searchParams.get("dur") || 0));
        const r = await hub(env, "/rec-seg", { pub, room: mr[1], n, dur, bytes: buf.byteLength,
          w: +url.searchParams.get("w") || 0, h: +url.searchParams.get("h") || 0 });
        if (!r.ok) return J(r, r.error === "auth" ? 401 : 409);
        await env.REC.put(`rec/${mr[1]}/${n < 0 ? "init.mp4" : n + ".m4s"}`, buf, { httpMetadata: { contentType: n < 0 ? "video/mp4" : "video/iso.segment" } });
        return J({ ok: true });
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
      m = p.match(/^\/api\/room\/([a-z0-9]+)\/(ws|publish|privacy|state)$/);
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
  recTotal() { return (this.one("SELECT SUM(bytes) b FROM recs WHERE deleted=0") || {}).b || 0; }
  prefsOf(u) { try { return JSON.parse(u.prefs || "{}") || {}; } catch (e) { return {}; } }
  pubUser(u, self) {
    return u && { id: u.id, handle: u.handle, name: u.name, color: u.color, bio: u.bio || "", link: u.link || "",
      avatar: u.av ? "/api/avatar/" + u.id + "?v=" + u.av : "", created: u.created,
      ...(self ? { email: u.email || "", notify: u.notify !== 0, prefs: this.prefsOf(u) } : {}) };
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
      const u = this.user(b.token);
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
      let prefs = this.prefsOf(u);
      if (b.prefs && typeof b.prefs === "object") {
        const P = b.prefs;
        if ("allowFx" in P) prefs.allowFx = !!P.allowFx;
        if ("allowCh" in P) prefs.allowCh = !!P.allowCh;
        if ("coStream" in P) prefs.coStream = ["all", "followers", "none"].includes(P.coStream) ? P.coStream : "all";
        if ("slow" in P) prefs.slow = Math.min(60, Math.max(0, P.slow | 0));
        if ("guestChat" in P) prefs.guestChat = !!P.guestChat;
        if ("rec" in P) prefs.rec = !!P.rec;
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
        return o;
      });
      const games = this.all("SELECT game, MAX(gameIcon) icon, COUNT(*) n FROM streams WHERE uid=? AND game<>'' GROUP BY lower(game) ORDER BY n DESC LIMIT 8", u.id);
      return J2({ user: this.pubUser(u), followers, following, streamsCount: st.n || 0, bestPeak: st.p || 0, hours: Math.round((st.d || 0) / 360000) / 10, games: games.map((g) => ({ name: g.game, icon: g.icon === "local" ? "" : g.icon, n: g.n })), streams: past });
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
      if (b.on) this.sql.exec("INSERT OR IGNORE INTO follows VALUES(?,?)", u.id, String(b.target));
      else this.sql.exec("DELETE FROM follows WHERE uid=? AND target=?", u.id, String(b.target));
      return J2({ ok: true });
    }
    if (p === "/live") {
      const u = this.user(b.token);
      const rows = this.all("SELECT * FROM streams WHERE ended=0 AND beat>? ORDER BY viewers DESC, started DESC LIMIT 100", t - 90000);
      const fol = u ? new Set(this.all("SELECT target FROM follows WHERE uid=?", u.id).map((r) => r.target)) : new Set();
      return J2({ streams: rows.map((s) => ({ ...this.streamOut(s), followed: fol.has(s.uid) })) });
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
        await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + room)).fetch("https://room/init", {
          method: "POST",
          body: JSON.stringify({ room, host: u.id, hostName: u.name, title, prefs: this.prefsOf(u),
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
        rec: role === "host" && !!this.env.REC && this.prefsOf(u).rec !== false && this.recTotal() < REC_LIMIT,
      };
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
      const r = this.one("SELECT * FROM pubs WHERE pub=? AND room=?", String(b.pub), String(b.room));
      if (!r || r.role !== "host") return J2({ ok: false, error: "auth" });
      const u = this.one("SELECT * FROM users WHERE id=?", r.uid);
      if (this.prefsOf(u).rec === false) return J2({ ok: false, error: "rec_disabled" });
      let rec = this.one("SELECT * FROM recs WHERE id=?", r.room);
      if (rec && rec.deleted) return J2({ ok: false, error: "deleted" });
      if (this.recTotal() + (b.bytes | 0) > REC_LIMIT) return J2({ ok: false, error: "rec_full" });
      if (!rec) {
        const s = this.one("SELECT * FROM streams WHERE id=?", r.room) || {};
        this.sql.exec("INSERT INTO recs(id,uid,title,game,gameIcon,started) VALUES(?,?,?,?,?,?)", r.room, r.uid, s.title || "", s.game || "", s.gameIcon === "local" ? "/api/gameicon/" + r.room : s.gameIcon || "", s.started || t);
      }
      if (b.n < 0) {
        this.sql.exec("UPDATE recs SET init=1, w=?, h=?, bytes=bytes+? WHERE id=?", b.w | 0, b.h | 0, b.bytes | 0, r.room);
      } else {
        const ex = this.one("SELECT * FROM recsegs WHERE rec=? AND n=?", r.room, b.n);
        this.sql.exec("INSERT OR REPLACE INTO recsegs VALUES(?,?,?,?)", r.room, b.n, +b.dur || 0, b.bytes | 0);
        this.sql.exec("UPDATE recs SET segs=segs+?, dur=dur+?, bytes=bytes+? WHERE id=?", ex ? 0 : 1, (+b.dur || 0) - (ex ? ex.dur : 0), (b.bytes | 0) - (ex ? ex.bytes : 0), r.room);
      }
      this.sql.exec("UPDATE pubs SET beat=? WHERE pub=?", t, r.pub);
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
        prefs: body.prefs || {}, followers: (body.followers || []).slice(0, 5000) };
      this.history = []; this.pubs = {}; this.guests = []; this.requests = []; this.poll = null; this.challenges = [];
      this.hype = { v: 0, t: now(), lvl: 1 }; this.pinned = null;
      await this.state.storage.put({ meta: this.meta, history: [], pubs: {}, guests: [], requests: [], poll: null, challenges: [], hype: this.hype, pinned: null });
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
      };
      this.state.acceptWebSocket(server);
      server.serializeAttachment(att);
      const h = this.hypeNow();
      this.send(server, {
        t: "hello", me: att, meta: this.meta && { room: this.meta.room, host: this.meta.host, hostName: this.meta.hostName, title: this.meta.title, started: this.meta.started, ended: this.meta.ended }, history: this.history, publishers: this.publishers(),
        viewers: this.counts(), poll: this.pollOut(), hype: { v: Math.round(h.v), lvl: h.lvl },
        challenges: this.challenges, pinned: this.pinned, guests: this.guests,
        requests: this.isHost(uid) ? this.requests : undefined,
        host: this.isHost(uid),
        rules: this.meta ? { allowFx: this.pref("allowFx") !== false, allowCh: this.pref("allowCh") !== false, coStream: this.pref("coStream") || "all", slow: this.pref("slow") | 0 } : null,
      });
      this.state.waitUntil(this.syncHub());
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
      case "chat": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        const text = String(m.text || "").trim().slice(0, 200);
        const slow = host ? 0 : ((this.meta && this.meta.prefs && this.meta.prefs.slow) | 0) * 1000;
        if (!text) return;
        if (!this.allowed("c:" + me.uid, Math.max(700, slow))) return slow ? this.send(ws, { t: "err", e: "slow" }) : undefined;
        const msg = { t: "chat", id: rid(8), uid: me.uid, name: me.name, color: me.color, text, at: t, host, guest: this.guests.includes(me.uid) };
        this.pushHistory(msg);
        this.bcast(msg);
        this.addHype(1);
        return;
      }
      case "react": {
        const e = String(m.e || "❤️").slice(0, 4);
        if (!this.allowed("r:" + (me.uid || me.id), 250)) return;
        this.bcast({ t: "react", e, uid: me.uid });
        this.addHype(0.6);
        return;
      }
      case "effect": {
        if (me.anon) return this.send(ws, { t: "err", e: "login" });
        if (this.pref("allowFx") === false && !host) return this.send(ws, { t: "err", e: "fx_off" });
        if (!EFFECTS.has(m.id) || !this.allowed("e:" + me.uid, 4000)) return this.send(ws, { t: "err", e: "slow" });
        this.bcast({ t: "effect", id: m.id, name: me.name, color: me.color, at: t });
        this.addHype(6);
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
  async alarm() {
    await this.loaded;
    const t = now();
    if (this.poll && !this.poll.done && t >= this.poll.ends) {
      this.poll.done = true;
      await this.state.storage.put("poll", this.poll);
      this.bcast({ t: "poll", poll: this.pollOut() });
    }
    await this.syncHub();
    const next = [];
    if (this.poll && !this.poll.done) next.push(this.poll.ends);
    if (this.sockets().length) next.push(t + 30000);
    if (next.length) await this.state.storage.setAlarm(Math.min(...next));
  }
}
