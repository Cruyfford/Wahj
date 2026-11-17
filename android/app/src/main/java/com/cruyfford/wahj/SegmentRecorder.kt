package com.cruyfford.wahj

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.util.Log
import org.json.JSONObject
import org.webrtc.VideoFrame
import org.webrtc.VideoSink
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Records the outgoing (privacy-filtered) stream into HLS fMP4 segments and uploads them to the server (R2).
 * Video comes from the WebRTC track (letterboxed into a fixed 720p canvas), audio from the mixed mic+game buffer.
 */
class SegmentRecorder(private val server: String, private val room: String, private val pub: String,
                      private val ctx: android.content.Context? = null, private val recKey: String = "", private val wifiOnly: Boolean = false) : VideoSink {
    /** deferred: segments are written to disk during the stream and uploaded after it ends (keeps upstream for the live video) */
    private val deferred = ctx != null && recKey.isNotEmpty()
    private val dir: java.io.File? = if (deferred) java.io.File(ctx!!.filesDir, "rec/$room").apply {
        mkdirs()
        java.io.File(this, "meta.txt").writeText("$server\n$room\n$recKey\n$wifiOnly")
    } else null
    private var savedN = 0
    companion object { private const val TAG = "WahjRec"; private const val SEG_US = 6_000_000L }

    private var W = 1280
    private var H = 720
    private var venc: MediaCodec? = null
    private var aenc: MediaCodec? = null
    private val encExec = Executors.newSingleThreadExecutor()
    private val upExec = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val pending = AtomicInteger(0)
    @Volatile private var running = true
    @Volatile var disabled = false
    private var lastFrameUs = 0L
    private var drain: Thread? = null

    // muxing state (drain thread only)
    private var sps: ByteArray? = null
    private var pps: ByteArray? = null
    private var asc: ByteArray? = null
    private var initSent = false
    private var t0 = -1L
    private val vq = ArrayList<Fmp4.Sample>()
    private val aq = ArrayList<Fmp4.Sample>()
    private var seq = 0
    private var aBaseSamples = -1L

    // ---------- video ----------
    override fun onFrame(frame: VideoFrame) {
        if (!running || disabled) return
        val tsUs = frame.timestampNs / 1000
        if (tsUs - lastFrameUs < 32_000) return // ~30 fps
        if (!busy.compareAndSet(false, true)) return
        lastFrameUs = tsUs
        frame.retain()
        encExec.execute {
            try { encodeFrame(frame, tsUs) } catch (e: Exception) { Log.w(TAG, "frame", e) } finally { frame.release(); busy.set(false) }
        }
    }

    private fun encodeFrame(frame: VideoFrame, tsUs: Long) {
        if (venc == null) {
            val portrait = frame.rotatedHeight > frame.rotatedWidth
            W = if (portrait) 720 else 1280; H = if (portrait) 1280 else 720
            if (!startEncoders()) { disabled = true; return }
        }
        val enc = venc ?: return
        val idx = enc.dequeueInputBuffer(5000)
        if (idx < 0) return
        val img = enc.getInputImage(idx) ?: run { enc.queueInputBuffer(idx, 0, 0, tsUs, 0); return }
        // fit the frame into the canvas, keep aspect, black bars
        val fw = frame.rotatedWidth; val fh = frame.rotatedHeight
        val s = minOf(W.toDouble() / fw, H.toDouble() / fh)
        val sw = ((fw * s).toInt() / 2) * 2; val sh = ((fh * s).toInt() / 2) * 2
        val ox = ((W - sw) / 2) / 2 * 2; val oy = ((H - sh) / 2) / 2 * 2
        val buf = frame.buffer
        val scaled = if (frame.rotation % 180 == 0) buf.cropAndScale(0, 0, buf.width, buf.height, sw, sh)
                     else buf.cropAndScale(0, 0, buf.width, buf.height, sh, sw)
        val i420 = scaled.toI420(); scaled.release()
        if (i420 == null) { enc.queueInputBuffer(idx, 0, 0, tsUs, 0); return }
        try {
            val planes = img.planes
            // clear to black
            for (p in 0..2) {
                val pl = planes[p]; val bb = pl.buffer
                val v = if (p == 0) 16.toByte() else 128.toByte()
                val ph = if (p == 0) H else H / 2
                val pw = if (p == 0) W else W / 2
                val row = ByteArray(pl.rowStride).also { java.util.Arrays.fill(it, v) }
                for (r in 0 until ph) {
                    val pos = r * pl.rowStride
                    val len = minOf(pl.rowStride, bb.capacity() - pos, (pw - 1) * pl.pixelStride + 1)
                    if (len > 0) { bb.position(pos); bb.put(row, 0, len) }
                }
            }
            copyPlane(i420.dataY, i420.strideY, sw, sh, planes[0], ox, oy, frame.rotation, 1)
            copyPlane(i420.dataU, i420.strideU, sw / 2, sh / 2, planes[1], ox / 2, oy / 2, frame.rotation, 2)
            copyPlane(i420.dataV, i420.strideV, sw / 2, sh / 2, planes[2], ox / 2, oy / 2, frame.rotation, 2)
        } finally { i420.release() }
        enc.queueInputBuffer(idx, 0, W * H * 3 / 2, tsUs, 0)
    }

    /** Copies a (possibly rotated) source plane into the encoder image at (ox, oy). dw/dh = destination size. */
    private fun copyPlane(src: ByteBuffer, sStride: Int, dw: Int, dh: Int, pl: android.media.Image.Plane, ox: Int, oy: Int, rot: Int, sub: Int) {
        val dst = pl.buffer; val ps = pl.pixelStride; val rs = pl.rowStride
        if (rot % 360 == 0 && ps == 1) {
            val row = ByteArray(dw)
            for (y in 0 until dh) {
                src.position(y * sStride); src.get(row, 0, dw)
                dst.position((oy + y) * rs + ox); dst.put(row, 0, dw)
            }
            return
        }
        // generic path: rotation and/or interleaved chroma
        val sw = if (rot % 180 == 0) dw else dh
        val sh = if (rot % 180 == 0) dh else dw
        val line = ByteArray(sStride)
        val tmp = ByteArray(sw * sh)
        for (y in 0 until sh) { src.position(y * sStride); src.get(line, 0, minOf(sStride, src.capacity() - y * sStride)); System.arraycopy(line, 0, tmp, y * sw, sw) }
        for (y in 0 until dh) {
            val base = (oy + y) * rs + ox * ps
            for (x in 0 until dw) {
                val (sx, sy) = when ((rot % 360 + 360) % 360) {
                    90 -> Pair(y, sh - 1 - x)
                    180 -> Pair(sw - 1 - x, sh - 1 - y)
                    270 -> Pair(sw - 1 - y, x)
                    else -> Pair(x, y)
                }
                val di = base + x * ps
                if (di < dst.capacity()) dst.put(di, tmp[sy * sw + sx])
            }
        }
    }

    private fun startEncoders(): Boolean {
        return try {
            val vf = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, W, H).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
                setInteger(MediaFormat.KEY_BIT_RATE, 2_000_000)
                setInteger(MediaFormat.KEY_FRAME_RATE, 30)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
                setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
                setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel31)
            }
            val v = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            try { v.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE) } catch (e: Exception) {
                vf.removeKey(MediaFormat.KEY_PROFILE); vf.removeKey(MediaFormat.KEY_LEVEL)
                v.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            }
            v.start(); venc = v
            val af = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 48000, 1).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, 96_000)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
            }
            val a = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            a.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE); a.start(); aenc = a
            drain = Thread({ drainLoop() }, "wahj-rec-drain").also { it.start() }
            true
        } catch (e: Exception) { Log.w(TAG, "encoders", e); false }
    }

    // ---------- audio (called with each mixed 10 ms buffer) ----------
    fun pushAudio(buf: ByteBuffer, bytes: Int, channels: Int) {
        val a = aenc ?: return
        if (!running || disabled) return
        val ptsUs = System.nanoTime() / 1000 - (bytes / 2 / maxOf(1, channels)) * 1_000_000L / 48000
        try {
            val idx = a.dequeueInputBuffer(0)
            if (idx < 0) return
            val inb = a.getInputBuffer(idx) ?: return
            inb.clear()
            val src = buf.duplicate().order(ByteOrder.LITTLE_ENDIAN); src.position(0); src.limit(bytes)
            if (channels == 1) inb.put(src) else {
                // downmix to mono
                val n = bytes / 2 / channels
                for (i in 0 until n) { var acc = 0; for (c in 0 until channels) acc += src.getShort((i * channels + c) * 2).toInt(); inb.putShort((acc / channels).toShort()) }
            }
            a.queueInputBuffer(idx, 0, inb.position(), ptsUs, 0)
        } catch (_: Exception) {}
    }

    // ---------- drain + mux ----------
    private fun drainLoop() {
        val info = MediaCodec.BufferInfo()
        while (running || pendingOutput()) {
            var worked = false
            venc?.let { worked = drainOne(it, info, true) || worked }
            aenc?.let { worked = drainOne(it, info, false) || worked }
            if (!worked) Thread.sleep(5)
            if (!running && !worked) break
        }
        flush(final = true)
    }
    private fun pendingOutput() = false

    private fun drainOne(c: MediaCodec, info: MediaCodec.BufferInfo, video: Boolean): Boolean {
        val idx = try { c.dequeueOutputBuffer(info, 0) } catch (e: Exception) { return false }
        if (idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val f = c.outputFormat
            if (video) {
                f.getByteBuffer("csd-0")?.let { sps = Fmp4.nals(Fmp4.bytes(it)).firstOrNull { n -> (n[0].toInt() and 0x1f) == 7 } }
                f.getByteBuffer("csd-1")?.let { pps = Fmp4.nals(Fmp4.bytes(it)).firstOrNull { n -> (n[0].toInt() and 0x1f) == 8 } }
            } else f.getByteBuffer("csd-0")?.let { asc = Fmp4.bytes(it) }
            return true
        }
        if (idx < 0) return false
        val ob = c.getOutputBuffer(idx)
        if (ob != null && info.size > 0) {
            ob.position(info.offset); ob.limit(info.offset + info.size)
            val data = ByteArray(info.size); ob.get(data)
            if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                if (video) Fmp4.nals(data).forEach { n -> when (n[0].toInt() and 0x1f) { 7 -> sps = n; 8 -> pps = n } }
                else if (asc == null) asc = data
            } else onSample(video, data, info.presentationTimeUs, info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0)
        }
        c.releaseOutputBuffer(idx, false)
        return true
    }

    private fun onSample(video: Boolean, data: ByteArray, ptsUs: Long, key: Boolean) {
        if (video) {
            if (vq.isEmpty() && !key) return // segments must start on a keyframe
            if (sps == null) Fmp4.nals(data).forEach { n -> when (n[0].toInt() and 0x1f) { 7 -> sps = n; 8 -> pps = n } }
            val s = Fmp4.Sample(Fmp4.toAvcc(data), ptsUs, key)
            if (t0 < 0) t0 = ptsUs
            if (!initSent) sendInit()
            if (key && vq.isNotEmpty() && ptsUs - vq[0].ptsUs >= SEG_US) cut(ptsUs)
            vq += s
        } else {
            if (t0 < 0 || ptsUs < t0) return
            aq += Fmp4.Sample(data, ptsUs, true)
        }
    }

    private fun sendInit() {
        val s = sps ?: return; val p = pps ?: return; val a = asc ?: byteArrayOf(0x11, 0x88.toByte())
        upload("init?w=$W&h=$H", Fmp4.init(W, H, s, p, a, 1))
        initSent = true
    }

    private fun cut(endUs: Long) {
        if (vq.isEmpty() || !initSent) { vq.clear(); return }
        val v = ArrayList(vq); vq.clear()
        val dur = IntArray(v.size) { k -> (((if (k + 1 < v.size) v[k + 1].ptsUs else endUs) - v[k].ptsUs) * Fmp4.VIDEO_TS / 1_000_000).toInt().coerceAtLeast(1) }
        val a = ArrayList<Fmp4.Sample>()
        val it = aq.iterator()
        while (it.hasNext()) { val s = it.next(); if (s.ptsUs < endUs) { a += s; it.remove() } else break }
        if (aBaseSamples < 0 && a.isNotEmpty()) aBaseSamples = (a[0].ptsUs - t0) * Fmp4.AUDIO_TS / 1_000_000
        val aBase = aBaseSamples.coerceAtLeast(0)
        val seg = Fmp4.segment(seq + 1, v, dur, (v[0].ptsUs - t0) * Fmp4.VIDEO_TS / 1_000_000, a, aBase)
        aBaseSamples = aBase + a.size * 1024L
        val secs = (endUs - v[0].ptsUs) / 1e6
        upload("seg?n=$seq&dur=" + String.format(java.util.Locale.US, "%.3f", secs), seg)
        seq++
    }

    private fun flush(final: Boolean) {
        if (final && vq.isNotEmpty()) cut(vq.last().ptsUs + 33_333)
    }

    private fun upload(path: String, data: ByteArray) {
        if (disabled) return
        if (deferred) {
            try {
                val name = String.format("%05d.part", savedN++)
                java.io.File(dir, name).writeBytes(data)
                java.io.File(dir, "index.txt").appendText("$name|$path\n")
            } catch (e: Exception) { Log.w(TAG, "disk write failed", e) }
            return
        }
        if (pending.get() >= 8) { Log.w(TAG, "backlog, dropping $path"); return }
        pending.incrementAndGet()
        upExec.execute {
            try {
                for (attempt in 0 until 3) {
                    val code = Net.bytes("$server/api/rec/$room/$path", data, mapOf("x-pub" to pub), "application/octet-stream")
                    if (code == 200) break
                    if (code == 401 || code == 409 || code == 503) { disabled = true; break }
                    Thread.sleep(1000L * (attempt + 1))
                }
            } finally { pending.decrementAndGet() }
        }
    }

    /** Stop encoders, flush the last segment and wait briefly for uploads. */
    fun stop() {
        if (!running) return
        running = false
        try { encExec.shutdown(); encExec.awaitTermination(1, java.util.concurrent.TimeUnit.SECONDS) } catch (_: Exception) {}
        try { drain?.join(2000) } catch (_: Exception) {}
        try { venc?.stop(); venc?.release() } catch (_: Exception) {}
        try { aenc?.stop(); aenc?.release() } catch (_: Exception) {}
        val end = System.currentTimeMillis() + 5000
        while (pending.get() > 0 && System.currentTimeMillis() < end) Thread.sleep(100)
        upExec.shutdown()
        if (deferred) { java.io.File(dir, "done").writeText("1"); RecUploader.kick(ctx!!) }
    }
}


/** Uploads recordings saved on the phone once the stream is over (resumes on next app start if interrupted). */
object RecUploader {
    @Volatile private var running = false
    fun kick(ctx: android.content.Context) {
        if (running) return
        running = true
        Thread {
            try {
                val base = java.io.File(ctx.filesDir, "rec")
                for (d in base.listFiles() ?: emptyArray()) {
                    if (!java.io.File(d, "done").exists() && System.currentTimeMillis() - d.lastModified() < 6 * 3600_000L) continue
                    val meta = java.io.File(d, "meta.txt").takeIf { it.exists() }?.readLines() ?: run { d.deleteRecursively(); continue }
                    val (server, room, key) = Triple(meta[0], meta[1], meta[2]); val wifi = meta.getOrNull(3) == "true"
                    if (wifi && !onWifi(ctx)) continue
                    val idx = java.io.File(d, "index.txt").takeIf { it.exists() }?.readLines()?.filter { it.contains("|") } ?: emptyList()
                    var ok = true
                    for (line in idx) {
                        val (name, path) = line.split("|", limit = 2)
                        val f = java.io.File(d, name); if (!f.exists()) continue
                        var code = 0
                        for (a in 0 until 3) { code = Net.bytes("$server/api/rec/$room/$path", f.readBytes(), mapOf("x-rec" to key), "application/octet-stream"); if (code == 200 || code == 401) break; Thread.sleep(2000L * (a + 1)) }
                        if (code == 200 || code == 401 || code == 409) f.delete() else { ok = false; break }
                    }
                    if (ok) d.deleteRecursively()
                    Bus.emit("diag", "msg" to "android rec upload room=$room ok=$ok parts=${idx.size}")
                }
            } catch (e: Exception) { Log.w("WahjRec", "uploader", e) } finally { running = false }
        }.start()
    }
    private fun onWifi(ctx: android.content.Context): Boolean {
        val cm = ctx.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val c = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return c.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) || c.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET)
    }
}
