// fMP4 (CMAF) -> MPEG-TS remuxer for YouTube HLS ingest (YouTube only accepts M2TS segments).
// H.264 + AAC. Each output segment keeps every PID's continuity counter a multiple of 16,
// so segments concatenate with continuous CC without any state between requests.

const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const s32 = (b, o) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
const typ = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const b64 = (u) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function* boxes(b, start = 0, end = b.length) {
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o), hdr = 8;
    const t = typ(b, o + 4);
    if (size === 1) { size = u32(b, o + 8) * 4294967296 + u32(b, o + 12); hdr = 16; }
    else if (size === 0) size = end - o;
    if (size < hdr || o + size > end) return;
    yield { t, o, s: o + hdr, e: o + size };
    o += size;
  }
}
const child = (b, box, t, off = 0) => { for (const c of boxes(b, box.s + off, box.e)) if (c.t === t) return c; return null; };
const path = (b, box, ...ts) => { let c = box; for (const t of ts) { c = c && child(b, c, t); } return c; };

function descLen(b, o) { let n = 0, i = 0; for (; i < 4; i++) { const x = b[o + i]; n = (n << 7) | (x & 0x7f); if (!(x & 0x80)) break; } return [n, i + 1]; }
function findAsc(b, o, end) {
  while (o < end) {
    const tag = b[o]; const [len, ll] = descLen(b, o + 1); const s = o + 1 + ll;
    if (tag === 5) return b.slice(s, s + len);
    if (tag === 3) { const fl = b[s + 2]; let p = s + 3; if (fl & 0x80) p += 2; if (fl & 0x40) p += 1 + b[p]; if (fl & 0x20) p += 2; const r = findAsc(b, p, s + len); if (r) return r; }
    else if (tag === 4) { const r = findAsc(b, s + 13, s + len); if (r) return r; }
    o = s + len;
  }
  return null;
}

/** Parses the init segment (ftyp+moov) into a small JSON-able description. */
export function parseInit(buf) {
  const b = new Uint8Array(buf);
  const top = [...boxes(b)]; const moov = top.find((x) => x.t === "moov");
  if (!moov) return null;
  const meta = { trex: {} };
  for (const tr of boxes(b, moov.s, moov.e)) {
    if (tr.t === "mvex") {
      for (const x of boxes(b, tr.s, tr.e)) if (x.t === "trex") meta.trex[u32(b, x.s + 4)] = [u32(b, x.s + 12), u32(b, x.s + 16), u32(b, x.s + 20)];
      continue;
    }
    if (tr.t !== "trak") continue;
    const tkhd = child(b, tr, "tkhd"); const id = u32(b, tkhd.s + (b[tkhd.s] === 1 ? 20 : 12));
    const mdhd = path(b, tr, "mdia", "mdhd"); const ts = u32(b, mdhd.s + (b[mdhd.s] === 1 ? 20 : 12));
    const hdlr = path(b, tr, "mdia", "hdlr"); const h = typ(b, hdlr.s + 8);
    const stsd = path(b, tr, "mdia", "minf", "stbl", "stsd"); if (!stsd) continue;
    const ent = [...boxes(b, stsd.s + 8, stsd.e)][0]; if (!ent) continue;
    if (h === "vide" && (ent.t === "avc1" || ent.t === "avc3")) {
      const avcC = child(b, { s: ent.s + 78, e: ent.e }, "avcC"); if (!avcC) continue;
      let p = avcC.s; const len = (b[p + 4] & 3) + 1; const nsps = b[p + 5] & 31; p += 6;
      const sps = [], pps = [];
      for (let i = 0; i < nsps; i++) { const l = u16(b, p); sps.push(b64(b.slice(p + 2, p + 2 + l))); p += 2 + l; }
      const npps = b[p++]; for (let i = 0; i < npps; i++) { const l = u16(b, p); pps.push(b64(b.slice(p + 2, p + 2 + l))); p += 2 + l; }
      meta.v = { id, ts, len, sps, pps };
    } else if (h === "soun" && ent.t === "mp4a") {
      const ver = u16(b, ent.s + 8); const off = 28 + (ver === 1 ? 16 : ver === 2 ? 36 : 0);
      const esds = child(b, { s: ent.s + off, e: ent.e }, "esds"); if (!esds) continue;
      const asc = findAsc(b, esds.s + 4, esds.e); if (!asc || asc.length < 2) continue;
      meta.a = { id, ts, asc: b64(asc) };
    }
  }
  return meta.v ? meta : null;
}

/** Extracts samples per track from a media segment (one or more moof+mdat pairs). */
function samples(b, meta) {
  const out = {};
  for (const moof of boxes(b)) {
    if (moof.t !== "moof") continue;
    for (const traf of boxes(b, moof.s, moof.e)) {
      if (traf.t !== "traf") continue;
      const tfhd = child(b, traf, "tfhd"); if (!tfhd) continue;
      const fl = u32(b, tfhd.s) & 0xffffff; const id = u32(b, tfhd.s + 4); let p = tfhd.s + 8;
      const dx = meta.trex[id] || [0, 0, 0];
      let base = moof.o, dDur = dx[0], dSize = dx[1], dFl = dx[2];
      if (fl & 1) { base = u32(b, p) * 4294967296 + u32(b, p + 4); p += 8; }
      if (fl & 2) p += 4;
      if (fl & 8) { dDur = u32(b, p); p += 4; }
      if (fl & 0x10) { dSize = u32(b, p); p += 4; }
      if (fl & 0x20) { dFl = u32(b, p); p += 4; }
      const tfdt = child(b, traf, "tfdt");
      let dts = tfdt ? (b[tfdt.s] === 1 ? u32(b, tfdt.s + 4) * 4294967296 + u32(b, tfdt.s + 8) : u32(b, tfdt.s + 4)) : 0;
      const list = (out[id] = out[id] || []);
      for (const trun of boxes(b, traf.s, traf.e)) {
        if (trun.t !== "trun") continue;
        const v = b[trun.s]; const tf = u32(b, trun.s) & 0xffffff; const n = u32(b, trun.s + 4); let q = trun.s + 8;
        let off = base; if (tf & 1) { off = base + s32(b, q); q += 4; }
        let first = null; if (tf & 4) { first = u32(b, q); q += 4; }
        for (let i = 0; i < n; i++) {
          const dur = tf & 0x100 ? u32(b, (q += 4) - 4) : dDur;
          const size = tf & 0x200 ? u32(b, (q += 4) - 4) : dSize;
          let sf = tf & 0x400 ? u32(b, (q += 4) - 4) : i === 0 && first !== null ? first : dFl;
          if (i === 0 && first !== null && !(tf & 0x400)) sf = first;
          let cts = 0; if (tf & 0x800) { cts = v ? s32(b, q) : u32(b, q); q += 4; }
          if (off + size <= b.length) list.push({ dts, cts, data: b.subarray(off, off + size), key: !(sf & 0x10000) });
          off += size; dts += dur;
        }
      }
    }
  }
  return out;
}

const AUD = new Uint8Array([0, 0, 0, 1, 9, 0xf0]);
const SC = new Uint8Array([0, 0, 0, 1]);
function annexB(s, v) {
  const parts = [AUD]; let hasSps = false; const d = s.data;
  const nal = [];
  for (let o = 0; o + v.len <= d.length;) {
    let l = 0; for (let i = 0; i < v.len; i++) l = l * 256 + d[o + i];
    o += v.len; if (l <= 0 || o + l > d.length) break;
    const t = d[o] & 31; if (t === 9) { o += l; continue; } if (t === 7) hasSps = true;
    nal.push(d.subarray(o, o + l)); o += l;
  }
  if (s.key && !hasSps) { for (const x of v._sps) parts.push(SC, x); for (const x of v._pps) parts.push(SC, x); }
  for (const x of nal) parts.push(SC, x);
  return cat(parts);
}
function cat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; }

const M33 = 8589934592;
const ts90 = (t, scale) => Math.round((t * 90000) / scale);
function pts5(marker, t) {
  t = ((t % M33) + M33) % M33;
  const hi = Math.floor(t / 1073741824); // bits 32..30
  const mid = Math.floor(t / 32768) % 32768;
  const lo = t % 32768;
  return [(marker << 4) | (hi << 1) | 1, mid >> 7, ((mid & 0x7f) << 1) | 1, lo >> 7, ((lo & 0x7f) << 1) | 1];
}
function pes(sid, payload, pts, dts) {
  const both = dts !== null && dts !== pts;
  const hl = both ? 10 : 5;
  const len = 3 + hl + payload.length;
  const h = [0, 0, 1, sid, len > 65535 || sid === 0xe0 ? 0 : len >> 8, len > 65535 || sid === 0xe0 ? 0 : len & 255, 0x80, both ? 0xc0 : 0x80, hl, ...pts5(both ? 3 : 2, pts)];
  if (both) h.push(...pts5(1, dts));
  return cat([new Uint8Array(h), payload]);
}

// CRC32/MPEG-2
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i << 24; for (let j = 0; j < 8; j++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1; t[i] = c >>> 0; } return t; })();
const crc32 = (a) => { let c = 0xffffffff; for (const x of a) c = ((c << 8) ^ CRC[((c >>> 24) ^ x) & 255]) >>> 0; return c >>> 0; };
function psi(tableBytes) { const c = crc32(tableBytes); return [0, ...tableBytes, c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255]; }
const PMT_PID = 0x1000, VPID = 0x100, APID = 0x101;
function patPmt(hasAudio) {
  const pat = psi([0x00, 0xb0, 13, 0, 1, 0xc1, 0, 0, 0, 1, 0xe0 | (PMT_PID >> 8), PMT_PID & 255]);
  const es = [0x1b, 0xe0 | (VPID >> 8), VPID & 255, 0xf0, 0];
  if (hasAudio) es.push(0x0f, 0xe0 | (APID >> 8), APID & 255, 0xf0, 0);
  const secLen = 9 + es.length + 4;
  const pmt = psi([0x02, 0xb0 | (secLen >> 8), secLen & 255, 0, 1, 0xc1, 0, 0, 0xe0 | (VPID >> 8), VPID & 255, 0xf0, 0, ...es]);
  return [pat, pmt];
}

class Mux {
  constructor() { this.cc = {}; this.out = []; }
  pkt(pid, pusi, payload, af) {
    const p = new Uint8Array(188).fill(0xff);
    const cc = (this.cc[pid] = ((this.cc[pid] ?? -1) + 1) & 15);
    p[0] = 0x47; p[1] = (pusi ? 0x40 : 0) | (pid >> 8); p[2] = pid & 255;
    let o = 4;
    const need = 184 - payload.length; // bytes of adaptation field (incl. its length byte)
    if (need > 0 || af) {
      p[3] = 0x30 | cc;
      const afl = Math.max(need, af ? af.length + 1 : 0) - 1;
      p[4] = afl;
      if (afl > 0) { p[5] = 0; if (af) p.set(af, 5); }
      o = 5 + afl;
    } else p[3] = 0x10 | cc;
    p.set(payload, o);
    this.out.push(p);
  }
  // writes a PES/PSI unit split into exactly `count` packets (count >= minimum)
  unit(pid, data, af, count) {
    const firstCap = 184 - (af ? af.length + 1 : 0);
    const minN = data.length <= firstCap ? 1 : 1 + Math.ceil((data.length - firstCap) / 184);
    const n = Math.max(minN, Math.min(count || minN, data.length));
    // sizes: spread the payload over n packets, first packet capped
    const sizes = []; let rest = data.length;
    for (let i = 0; i < n; i++) { const cap = i === 0 ? firstCap : 184; const left = n - i - 1; const s = Math.min(cap, rest - left); sizes.push(s); rest -= s; }
    let o = 0;
    sizes.forEach((s, i) => { this.pkt(pid, i === 0, data.subarray(o, o + s), i === 0 ? af : null); o += s; });
  }
  minPackets(data, af) { const firstCap = 184 - (af ? af.length + 1 : 0); return data.length <= firstCap ? 1 : 1 + Math.ceil((data.length - firstCap) / 184); }
}
function pcrAf(pcr, rai) {
  pcr = ((pcr % M33) + M33) % M33;
  const b = Math.floor(pcr / 2); // top 32 bits of 33
  return new Uint8Array([0x10 | (rai ? 0x40 : 0), (b >>> 24) & 255, (b >>> 16) & 255, (b >>> 8) & 255, b & 255, ((pcr % 2) << 7) | 0x7e, 0]);
}

/** Remuxes one fMP4 media segment into an MPEG-TS segment. */
export function remux(buf, meta) {
  const b = new Uint8Array(buf);
  const v = meta.v, a = meta.a;
  v._sps = v._sps || v.sps.map(unb64); v._pps = v._pps || v.pps.map(unb64);
  const all = samples(b, meta);
  const vs = all[v.id] || [], as = a ? all[a.id] || [] : [];
  if (!vs.length) return null;
  const DELAY = 63000; // 0.7 s between PCR and presentation
  const units = [];
  for (const s of vs) {
    const dts = ts90(s.dts, v.ts) + DELAY, pts = ts90(s.dts + s.cts, v.ts) + DELAY;
    units.push({ pid: VPID, t: dts, data: pes(0xe0, annexB(s, v), pts, dts), af: pcrAf(dts - DELAY, s.key), key: s.key });
  }
  if (a && as.length) {
    const asc = unb64(a.asc);
    const obj = asc[0] >> 3, fi = ((asc[0] & 7) << 1) | (asc[1] >> 7), ch = (asc[1] >> 3) & 15;
    for (let i = 0; i < as.length; i += 4) {
      const grp = as.slice(i, i + 4);
      const frames = grp.map((s) => { const L = s.data.length + 7; return cat([new Uint8Array([0xff, 0xf1, ((obj - 1) << 6) | (fi << 2) | (ch >> 2), ((ch & 3) << 6) | (L >> 11), (L >> 3) & 255, ((L & 7) << 5) | 0x1f, 0xfc]), s.data]); });
      const t = ts90(grp[0].dts, a.ts) + DELAY;
      units.push({ pid: APID, t, data: pes(0xc0, cat(frames), t, null), af: null });
    }
  }
  units.sort((x, y) => x.t - y.t || (x.pid === VPID ? -1 : 1));
  const m = new Mux();
  // PSI: 16 copies of PAT and PMT keeps their CC at a multiple of 16
  const [pat, pmt] = patPmt(!!(a && as.length));
  for (let i = 0; i < 16; i++) { m.unit(0, new Uint8Array(pat)); m.unit(PMT_PID, new Uint8Array(pmt)); }
  // packet budget per PID; pad the last unit so the total is a multiple of 16
  const lastIdx = {}; const tot = {};
  units.forEach((u, i) => { lastIdx[u.pid] = i; tot[u.pid] = (tot[u.pid] || 0) + m.minPackets(u.data, u.af); });
  units.forEach((u, i) => {
    let count = 0;
    if (lastIdx[u.pid] === i) count = m.minPackets(u.data, u.af) + ((16 - (tot[u.pid] % 16)) % 16);
    m.unit(u.pid, u.data, u.af, count);
  });
  return cat(m.out);
}
