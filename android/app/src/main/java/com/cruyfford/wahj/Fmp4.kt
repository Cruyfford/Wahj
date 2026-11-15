package com.cruyfford.wahj

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/** Minimal fragmented-MP4 (CMAF / HLS fMP4) writer: one H.264 video track + one AAC audio track. */
object Fmp4 {
    const val VIDEO_TS = 90000
    const val AUDIO_TS = 48000

    class Sample(val data: ByteArray, val ptsUs: Long, val key: Boolean)

    private fun u32(v: Long) = byteArrayOf((v ushr 24).toByte(), (v ushr 16).toByte(), (v ushr 8).toByte(), v.toByte())
    private fun u32(v: Int) = u32(v.toLong() and 0xFFFFFFFFL)
    private fun u16(v: Int) = byteArrayOf((v ushr 8).toByte(), v.toByte())
    private fun u64(v: Long) = u32(v ushr 32) + u32(v and 0xFFFFFFFFL)
    private fun zeros(n: Int) = ByteArray(n)
    private fun cat(vararg parts: ByteArray): ByteArray { val o = ByteArrayOutputStream(); parts.forEach { o.write(it) }; return o.toByteArray() }

    fun box(type: String, vararg payload: ByteArray): ByteArray {
        val body = cat(*payload)
        return cat(u32(8 + body.size), type.toByteArray(Charsets.US_ASCII), body)
    }
    private fun full(type: String, version: Int, flags: Int, vararg payload: ByteArray) =
        box(type, byteArrayOf(version.toByte(), (flags ushr 16).toByte(), (flags ushr 8).toByte(), flags.toByte()), *payload)

    private val MATRIX = cat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000))

    /** Splits Annex-B (00 00 01 / 00 00 00 01) into NAL units. */
    fun nals(b: ByteArray): List<ByteArray> {
        val out = mutableListOf<ByteArray>()
        var i = 0; var start = -1
        while (i + 3 <= b.size) {
            val sc3 = b[i].toInt() == 0 && b[i + 1].toInt() == 0 && b[i + 2].toInt() == 1
            val sc4 = i + 4 <= b.size && b[i].toInt() == 0 && b[i + 1].toInt() == 0 && b[i + 2].toInt() == 0 && b[i + 3].toInt() == 1
            if (sc3 || sc4) {
                if (start >= 0) out += b.copyOfRange(start, i)
                i += if (sc4) 4 else 3
                start = i
            } else i++
        }
        if (start >= 0 && start < b.size) out += b.copyOfRange(start, b.size)
        if (out.isEmpty() && b.isNotEmpty()) out += b
        // trim trailing zero bytes left by 4-byte start codes
        return out.map { n -> var e = n.size; while (e > 1 && n[e - 1].toInt() == 0) e--; if (e == n.size) n else n.copyOfRange(0, e) }
    }

    /** Annex-B access unit -> AVCC (4-byte length prefixed), dropping SPS/PPS/AUD. */
    fun toAvcc(annexB: ByteArray): ByteArray {
        val o = ByteArrayOutputStream()
        for (n in nals(annexB)) {
            if (n.isEmpty()) continue
            val t = n[0].toInt() and 0x1F
            if (t == 7 || t == 8 || t == 9) continue
            o.write(u32(n.size)); o.write(n)
        }
        return o.toByteArray()
    }

    fun init(w: Int, h: Int, sps: ByteArray, pps: ByteArray, asc: ByteArray, channels: Int): ByteArray {
        val ftyp = box("ftyp", "iso6".toByteArray(), u32(0), "iso6".toByteArray(), "isom".toByteArray(), "mp41".toByteArray(), "cmfc".toByteArray())
        val mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(0), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(3))

        val avcC = box("avcC", byteArrayOf(1, sps[1], sps[2], sps[3], 0xFF.toByte(), 0xE1.toByte()), u16(sps.size), sps, byteArrayOf(1), u16(pps.size), pps)
        val avc1 = box("avc1", zeros(6), u16(1), zeros(16), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xFFFF), avcC)
        val vtrak = trak(1, w, h, VIDEO_TS, "vide", "VideoHandler", full("vmhd", 0, 1, zeros(8)), avc1, audio = false)

        val dsi = cat(byteArrayOf(0x05, asc.size.toByte()), asc)
        val dcd = cat(byteArrayOf(0x04, (13 + dsi.size).toByte(), 0x40, 0x15), zeros(3), u32(128000), u32(96000), dsi)
        val sl = byteArrayOf(0x06, 0x01, 0x02)
        val esd = cat(byteArrayOf(0x03, (3 + dcd.size + sl.size).toByte()), u16(2), byteArrayOf(0), dcd, sl)
        val esds = full("esds", 0, 0, esd)
        val mp4a = box("mp4a", zeros(6), u16(1), zeros(8), u16(channels), u16(16), zeros(4), u32(AUDIO_TS shl 16), esds)
        val atrak = trak(2, 0, 0, AUDIO_TS, "soun", "SoundHandler", full("smhd", 0, 0, zeros(4)), mp4a, audio = true)

        val trex = { id: Int -> full("trex", 0, 0, u32(id), u32(1), u32(0), u32(0), u32(0)) }
        val moov = box("moov", mvhd, vtrak, atrak, box("mvex", trex(1), trex(2)))
        return cat(ftyp, moov)
    }

    private fun trak(id: Int, w: Int, h: Int, ts: Int, handler: String, name: String, mhd: ByteArray, entry: ByteArray, audio: Boolean): ByteArray {
        val tkhd = full("tkhd", 0, 3, u32(0), u32(0), u32(id), u32(0), u32(0), zeros(8), u16(0), u16(0), u16(if (audio) 0x0100 else 0), u16(0), MATRIX, u32(w shl 16), u32(h shl 16))
        val mdhd = full("mdhd", 0, 0, u32(0), u32(0), u32(ts), u32(0), u16(0x55C4), u16(0))
        val hdlr = full("hdlr", 0, 0, u32(0), handler.toByteArray(), zeros(12), (name + "\u0000").toByteArray())
        val dinf = box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1)))
        val stbl = box("stbl", full("stsd", 0, 0, u32(1), entry), full("stts", 0, 0, u32(0)), full("stsc", 0, 0, u32(0)),
            full("stsz", 0, 0, u32(0), u32(0)), full("stco", 0, 0, u32(0)))
        return box("trak", tkhd, box("mdia", mdhd, hdlr, box("minf", mhd, dinf, stbl)))
    }

    /**
     * One media segment (moof + mdat).
     * @param video samples with durations already known (vDur[i] in 90 kHz units)
     * @param audio AAC frames (1024 samples each)
     */
    fun segment(seq: Int, video: List<Sample>, vDur: IntArray, vBase: Long, audio: List<Sample>, aBase: Long): ByteArray {
        val vBytes = video.sumOf { it.data.size }
        fun build(vOff: Int, aOff: Int): ByteArray {
            val vtrun = ByteArrayOutputStream().apply {
                write(u32(video.size)); write(u32(vOff))
                video.forEachIndexed { i, s -> write(u32(vDur[i])); write(u32(s.data.size)); write(u32(if (s.key) 0x02000000 else 0x01010000)) }
            }.toByteArray()
            val vtraf = box("traf", full("tfhd", 0, 0x020000, u32(1)), full("tfdt", 1, 0, u64(vBase)), full("trun", 0, 0x000701, vtrun))
            val parts = mutableListOf(full("mfhd", 0, 0, u32(seq)), vtraf)
            if (audio.isNotEmpty()) {
                val atrun = ByteArrayOutputStream().apply {
                    write(u32(audio.size)); write(u32(aOff))
                    audio.forEach { write(u32(1024)); write(u32(it.data.size)) }
                }.toByteArray()
                parts += box("traf", full("tfhd", 0, 0x020000, u32(2)), full("tfdt", 1, 0, u64(aBase)), full("trun", 0, 0x000301, atrun))
            }
            return box("moof", *parts.toTypedArray())
        }
        val probe = build(0, 0)
        val moof = build(probe.size + 8, probe.size + 8 + vBytes)
        val mdat = ByteArrayOutputStream()
        video.forEach { mdat.write(it.data) }
        audio.forEach { mdat.write(it.data) }
        val body = mdat.toByteArray()
        return cat(moof, u32(8 + body.size), "mdat".toByteArray(), body)
    }

    fun bytes(b: ByteBuffer): ByteArray { val d = b.duplicate(); val a = ByteArray(d.remaining()); d.get(a); return a }
}
