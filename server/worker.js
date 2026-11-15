// Wahj Live — Cloudflare Worker backend
// Accounts, stream directory, Cloudflare Realtime SFU proxy, realtime rooms.
import APP_HTML from "./app.html";

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
    if (p === "/health") return J({ ok: true, v: VERSION, rev: env.NATIVE_REV || "" });
    if (!p.startsWith("/api/")) return new Response("Not found", { status: 404 });

    try {
      // ---- config ----
      if (p === "/api/config") {
        return J({ v: VERSION, rev: env.NATIVE_REV || "", ice: await iceServers(env), sfu: !!env.SFU_APP_ID });
      }
      if (p === "/api/ice") return J({ iceServers: await iceServers(env) });

      // ---- account ----
      if (p === "/api/register" || p === "/api/login") {
        const b = await req.json();
        b.ip = req.headers.get("cf-connecting-ip") || "";
        const r = await hub(env, p.slice(4), b);
        return J(r, r.error ? 400 : 200);
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
        const r = await hub(env, "/go-live", { ...b, token: bearer(req) });
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
    `);
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
    return this.one("SELECT u.* FROM tokens t JOIN users u ON u.id=t.uid WHERE t.token=?", token);
  }
  pubUser(u) {
    return u && { id: u.id, handle: u.handle, name: u.name, color: u.color, bio: u.bio || "" };
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
      if (!/^[a-z0-9_.]{3,20}$/.test(handle)) return J2({ error: "bad_handle" });
      if (pw.length < 6) return J2({ error: "weak_password" });
      if (this.limited("reg:" + b.ip, 8, 3600000)) return J2({ error: "rate" });
      if (this.one("SELECT id FROM users WHERE handle=?", handle)) return J2({ error: "taken" });
      const id = rid(12), salt = rid(16);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.sql.exec("INSERT INTO users(id,handle,name,pw,salt,color,created) VALUES(?,?,?,?,?,?,?)",
        id, handle, name, await hashPw(pw, salt), salt, color, t);
      const token = rid(32);
      this.sql.exec("INSERT INTO tokens VALUES(?,?,?)", token, id, t);
      return J2({ token, user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", id)) });
    }
    if (p === "/login") {
      const handle = String(b.handle || "").trim().toLowerCase().replace(/^@/, "");
      if (this.limited("login:" + b.ip, 20, 600000)) return J2({ error: "rate" });
      const u = this.one("SELECT * FROM users WHERE handle=?", handle);
      if (!u || (await hashPw(String(b.password || ""), u.salt)) !== u.pw) return J2({ error: "bad_login" });
      const token = rid(32);
      this.sql.exec("INSERT INTO tokens VALUES(?,?,?)", token, u.id, t);
      return J2({ token, user: this.pubUser(u) });
    }
    if (p === "/me") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      const following = this.all("SELECT target FROM follows WHERE uid=?", u.id).map((r) => r.target);
      return J2({ user: this.pubUser(u), following });
    }
    if (p === "/profile") {
      const u = this.user(b.token);
      if (!u) return J2({ error: "auth" });
      const name = String(b.name ?? u.name).trim().slice(0, 32) || u.name;
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color || "") ? b.color : u.color;
      const bio = String(b.bio ?? u.bio ?? "").slice(0, 140);
      this.sql.exec("UPDATE users SET name=?, color=?, bio=? WHERE id=?", name, color, bio, u.id);
      return J2({ user: this.pubUser(this.one("SELECT * FROM users WHERE id=?", u.id)) });
    }
    if (p === "/user") {
      const u = this.one("SELECT * FROM users WHERE handle=?", String(b.handle || "").toLowerCase());
      if (!u) return J2({ error: "not_found" });
      const followers = this.one("SELECT COUNT(*) n FROM follows WHERE target=?", u.id).n;
      const past = this.all("SELECT * FROM streams WHERE uid=? ORDER BY started DESC LIMIT 12", u.id).map((s) => this.streamOut(s));
      return J2({ user: this.pubUser(u), followers, streams: past });
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
        this.sql.exec("INSERT INTO streams(id,uid,title,game,cat,started,beat) VALUES(?,?,?,?,?,?,?)",
          room, u.id, title, String(b.game || "").slice(0, 40), String(b.cat || "").slice(0, 20), t, t);
        await this.env.ROOM.get(this.env.ROOM.idFromName("r:" + room)).fetch("https://room/init", {
          method: "POST",
          body: JSON.stringify({ room, host: u.id, hostName: u.name, title }),
        });
      }
      const pub = rid(32);
      this.sql.exec("INSERT INTO pubs(pub,uid,room,role,created,beat) VALUES(?,?,?,?,?,?)", pub, u.id, room, role, t, t);
      const job = {
        room, pub, role, uid: u.id, name: u.name,
        quality: b.quality || "720", fps: +b.fps || 30, mic: b.mic !== false,
        privacy: b.privacy || {}, at: t,
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
      this.meta = { room: body.room, host: body.host, hostName: body.hostName, title: body.title, started: now(), ended: false };
      this.history = []; this.pubs = {}; this.guests = []; this.requests = []; this.poll = null; this.challenges = [];
      this.hype = { v: 0, t: now(), lvl: 1 }; this.pinned = null;
      await this.state.storage.put({ meta: this.meta, history: [], pubs: {}, guests: [], requests: [], poll: null, challenges: [], hype: this.hype, pinned: null });
      return R({ ok: true });
    }
    if (p === "/state") {
      return R({ meta: this.meta, publishers: this.publishers(), viewers: this.counts() });
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
        t: "hello", me: att, meta: this.meta, history: this.history, publishers: this.publishers(),
        viewers: this.counts(), poll: this.pollOut(), hype: { v: Math.round(h.v), lvl: h.lvl },
        challenges: this.challenges, pinned: this.pinned, guests: this.guests,
        requests: this.isHost(uid) ? this.requests : undefined,
        host: this.isHost(uid),
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
        if (!text || !this.allowed("c:" + me.uid, 700)) return;
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
