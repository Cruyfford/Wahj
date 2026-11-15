package com.cruyfford.wahj

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.telephony.TelephonyManager
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.Executors

class StreamService : Service() {
    companion object {
        const val ACTION_START = "start"
        const val ACTION_STOP = "stop"
        const val ACTION_OVERLAY = "overlay"
        const val ACTION_CAM = "cam"
        const val ACTION_VOICE = "voice"
        private const val TAG = "WahjStream"
        private const val NOTIF_ID = 77
        @Volatile var running = false
        @Volatile var dndApplied = false
        @Volatile var notifAt = 0L
        var projectionData: Intent? = null
    }

    private val exec = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var job: JSONObject
    private lateinit var server: String
    private lateinit var sfu: Sfu
    private var egl: EglBase? = null
    private var factory: PeerConnectionFactory? = null
    private var adm: JavaAudioDeviceModule? = null
    private var pc: PeerConnection? = null
    private var capturer: ScreenCapturerAndroid? = null
    private var helper: SurfaceTextureHelper? = null
    private var videoSource: VideoSource? = null
    private var audioSource: AudioSource? = null
    private var playback: AudioRecord? = null
    private var mixTmp = ShortArray(4096)
    private var micOn = true
    private var fps = 30
    private var shortSide = 720
    private var stopped = false
    private var restarting = false
    private var wake: PowerManager.WakeLock? = null
    private var prevFilter = NotificationManager.INTERRUPTION_FILTER_ALL
    private var hiddenByCall = false
    private var wantThumb = true
    private var blank: JavaI420Buffer? = null
    private var overlays: Overlays? = null
    private var voice: VoicePull? = null
    private val tick = object : Runnable {
        override fun run() { checkPrivacy(); main.postDelayed(this, 400) }
    }
    private val thumbTick = object : Runnable {
        override fun run() { wantThumb = true; main.postDelayed(this, 20000) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                if (running) return START_NOT_STICKY
                job = JSONObject(intent.getStringExtra("job") ?: "{}")
                server = job.optString("server").ifBlank { BuildConfig.SERVER_URL }.trimEnd('/')
                sfu = Sfu(server)
                micOn = job.optBoolean("mic", true)
                fps = job.optInt("fps", 30)
                shortSide = job.optString("quality", "720").toIntOrNull() ?: 720
                goForeground(camera = false)
                running = true
                stopped = false
                val data = projectionData
                if (data == null) { fail("missing projection"); return START_NOT_STICKY }
                applyDnd()
                exec.execute { try { start(data) } catch (e: Exception) { Log.e(TAG, "start", e); fail(e.message ?: "error") } }
                main.post(tick)
                main.postDelayed(thumbTick, 20000)
                wake = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wahj:live").apply { acquire(12 * 3600_000L) }
            }
            ACTION_STOP -> stopAll(null)
            ACTION_OVERLAY -> {
                val on = intent.getBooleanExtra("on", false)
                if (on && running) overlays().chat(true, server, job.optString("room"), intent.getStringExtra("token") ?: job.optString("token"))
                else overlays?.chat(false, "", "", "")
            }
            ACTION_CAM -> {
                val on = intent.getBooleanExtra("on", false)
                if (on && running) { goForeground(camera = true); overlays().cam(true) } else overlays?.cam(false)
            }
            ACTION_VOICE -> {
                if (!running) return START_NOT_STICKY
                val f = factory ?: return START_NOT_STICKY
                val pubs = JSONArray(intent.getStringExtra("publishers") ?: "[]")
                val me = intent.getStringExtra("me") ?: ""
                if (voice == null) voice = VoicePull(f, sfu, exec)
                voice?.update(pubs, me)
            }
        }
        return START_NOT_STICKY
    }

    private fun overlays(): Overlays = overlays ?: Overlays(this).also { overlays = it }

    private fun goForeground(camera: Boolean) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("live", "Live", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(this, 1, Intent(this, StreamService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        val open = PendingIntent.getActivity(this, 2, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val ar = resources.configuration.locales[0].language == "ar"
        val n: Notification = NotificationCompat.Builder(this, "live")
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setContentTitle(if (ar) "● أنت على الهواء" else "● You're live")
            .setContentText(if (ar) "وهج Live يبث شاشتك الآن" else "Wahj Live is streaming your screen")
            .setOngoing(true).setContentIntent(open)
            .addAction(0, if (ar) "إنهاء البث" else "End stream", stop)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            if (granted(Manifest.permission.RECORD_AUDIO) && Build.VERSION.SDK_INT >= 30) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            if (camera && granted(Manifest.permission.CAMERA) && Build.VERSION.SDK_INT >= 30) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            startForeground(NOTIF_ID, n, type)
        } else startForeground(NOTIF_ID, n)
    }

    private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    // ---------------- publishing ----------------
    private fun start(data: Intent) {
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(applicationContext).createInitializationOptions())
        val e = EglBase.create().also { egl = it }
        val a = JavaAudioDeviceModule.builder(this)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .setSampleRate(48000)
            .setUseStereoInput(false)
            .setAudioBufferCallback { buffer, _, channels, rate, bytesRead, ts -> mixGame(buffer, channels, rate, bytesRead); ts }
            .createAudioDeviceModule()
        adm = a
        val f = PeerConnectionFactory.builder()
            .setAudioDeviceModule(a)
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(e.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(e.eglBaseContext))
            .createPeerConnectionFactory()
        factory = f

        val cap = ScreenCapturerAndroid(data, object : MediaProjection.Callback() {
            override fun onStop() { main.post { stopAll(null) } }
        })
        capturer = cap
        val vs = f.createVideoSource(false)
        videoSource = vs
        helper = SurfaceTextureHelper.create("wahj-capture", e.eglBaseContext)
        cap.initialize(helper, applicationContext, GuardObserver(vs.capturerObserver))
        val (w, h) = captureSize()
        cap.startCapture(w, h, fps)
        startPlaybackCapture(cap.mediaProjection)
        audioSource = f.createAudioSource(MediaConstraints())
        publish()
        Bus.emit("broadcast", "state" to "live")
    }

    private fun publish() {
        val f = factory ?: return
        val cfg = PeerConnection.RTCConfiguration(sfu.iceServers()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_ONCE
        }
        val p = f.createPeerConnection(cfg, object : PcObserver() {
            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState) {
                if (s == PeerConnection.IceConnectionState.FAILED) restart()
                if (s == PeerConnection.IceConnectionState.DISCONNECTED) main.postDelayed({
                    val st = pc?.iceConnectionState()
                    if (st == PeerConnection.IceConnectionState.DISCONNECTED || st == PeerConnection.IceConnectionState.FAILED) restart()
                }, 5000)
            }
        }) ?: throw RuntimeException("peer connection")
        pc = p
        val vTrack = f.createVideoTrack("screen", videoSource)
        val enc = RtpParameters.Encoding(null, true, null).apply {
            maxBitrateBps = bitrate(); maxFramerate = fps
        }
        val vtx = p.addTransceiver(vTrack, RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.SEND_ONLY, listOf("wahj"), listOf(enc)))
        val aTrack = f.createAudioTrack("audio", audioSource)
        val atx = p.addTransceiver(aTrack, RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.SEND_ONLY, listOf("wahj")))
        try {
            val params = vtx.sender.parameters
            params.degradationPreference = RtpParameters.DegradationPreference.MAINTAIN_FRAMERATE
            vtx.sender.setParameters(params)
        } catch (_: Exception) {}

        val offer = Rtc.createOffer(p)
        Rtc.setLocal(p, offer)
        Rtc.waitGathering(p)
        val sid = sfu.newSession()
        val suffix = UUID.randomUUID().toString().take(6)
        val vName = "screen-$suffix"; val aName = "audio-$suffix"
        val r = sfu.tracks(sid, JSONObject()
            .put("sessionDescription", JSONObject().put("type", "offer").put("sdp", p.localDescription.description))
            .put("tracks", JSONArray()
                .put(JSONObject().put("location", "local").put("mid", vtx.mid).put("trackName", vName))
                .put(JSONObject().put("location", "local").put("mid", atx.mid).put("trackName", aName))))
        val sd = r.optJSONObject("sessionDescription") ?: throw RuntimeException("SFU: $r")
        Rtc.setRemote(p, SessionDescription(SessionDescription.Type.ANSWER, sd.getString("sdp")))
        Net.json("$server/api/room/${job.optString("room")}/publish", "POST", JSONObject()
            .put("sessionId", sid)
            .put("tracks", JSONArray()
                .put(JSONObject().put("trackName", vName).put("kind", "video").put("role", "screen"))
                .put(JSONObject().put("trackName", aName).put("kind", "audio").put("role", "audio"))),
            mapOf("x-pub" to job.optString("pub")))
    }

    private fun restart() {
        if (restarting || stopped) return
        restarting = true
        exec.execute {
            var ok = false
            for (i in 0 until 6) {
                if (stopped) break
                try { pc?.close(); pc = null; publish(); ok = true; break } catch (e: Exception) {
                    Thread.sleep(minOf(8000L, 1000L shl i))
                }
            }
            restarting = false
            if (!ok && !stopped) fail("lost connection")
        }
    }

    private fun bitrate(): Int {
        val hi = fps >= 60
        return when (shortSide) { 1080 -> if (hi) 6_000_000 else 4_500_000; 540 -> if (hi) 1_800_000 else 1_200_000; else -> if (hi) 3_500_000 else 2_500_000 }
    }

    private fun captureSize(): Pair<Int, Int> {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val b: Rect = if (Build.VERSION.SDK_INT >= 30) wm.currentWindowMetrics.bounds else {
            val m = android.util.DisplayMetrics(); @Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(m); Rect(0, 0, m.widthPixels, m.heightPixels)
        }
        val W = b.width(); val H = b.height()
        val s = minOf(1.0, shortSide.toDouble() / minOf(W, H))
        fun even(v: Double) = (v.toInt() / 2) * 2
        return Pair(even(W * s), even(H * s))
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val c = capturer ?: return
        val (w, h) = captureSize()
        exec.execute { try { c.changeCaptureFormat(w, h, fps) } catch (_: Exception) {} }
    }

    // ---------------- game audio ----------------
    private fun startPlaybackCapture(mp: MediaProjection?) {
        if (mp == null || Build.VERSION.SDK_INT < 29 || !granted(Manifest.permission.RECORD_AUDIO)) return
        try {
            val conf = AudioPlaybackCaptureConfiguration.Builder(mp)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            val fmt = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(48000).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build()
            val minBuf = AudioRecord.getMinBufferSize(48000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            @Suppress("MissingPermission")
            val rec = AudioRecord.Builder().setAudioFormat(fmt).setBufferSizeInBytes(maxOf(minBuf * 4, 48000)).setAudioPlaybackCaptureConfig(conf).build()
            rec.startRecording()
            playback = rec
        } catch (e: Exception) { Log.w(TAG, "playback capture", e) }
    }

    /** Called by WebRTC with each 10 ms mic buffer: mix in the game sound (and mute the mic if asked). */
    private fun mixGame(buf: ByteBuffer, channels: Int, rate: Int, bytes: Int) {
        val n = bytes / 2
        buf.order(ByteOrder.LITTLE_ENDIAN)
        if (!micOn || hiddenByCall) for (i in 0 until n) buf.putShort(i * 2, 0)
        val rec = playback ?: return
        if (hiddenByCall) return
        if (mixTmp.size < n) mixTmp = ShortArray(n)
        val got = try { rec.read(mixTmp, 0, n / maxOf(1, channels), AudioRecord.READ_NON_BLOCKING) } catch (e: Exception) { 0 }
        if (got <= 0 || rate != 48000) return
        for (i in 0 until got) {
            val g = mixTmp[i].toInt()
            for (c in 0 until channels) {
                val idx = (i * channels + c) * 2
                if (idx + 1 >= bytes) break
                val s = buf.getShort(idx) + g
                buf.putShort(idx, s.coerceIn(-32768, 32767).toShort())
            }
        }
    }

    // ---------------- privacy ----------------
    private fun applyDnd() {
        val want = job.optJSONObject("privacy")?.optBoolean("dnd", true) ?: true
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (want && nm.isNotificationPolicyAccessGranted) {
            prevFilter = nm.currentInterruptionFilter
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS)
            dndApplied = true
        }
    }
    private fun restoreDnd() {
        if (!dndApplied) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        try { if (nm.isNotificationPolicyAccessGranted) nm.setInterruptionFilter(prevFilter) } catch (_: Exception) {}
        dndApplied = false
    }

    private fun inCall(): Boolean {
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        val m = am.mode
        if (m == AudioManager.MODE_RINGTONE || m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION || m == 4 /* CALL_SCREENING */) return true
        return try {
            @Suppress("DEPRECATION")
            (getSystemService(TELEPHONY_SERVICE) as TelephonyManager).callState != TelephonyManager.CALL_STATE_IDLE
        } catch (_: Exception) { false }
    }

    private fun checkPrivacy() {
        if (!running) return
        val guard = job.optJSONObject("privacy")?.optBoolean("callGuard", true) ?: true
        val call = guard && inCall()
        if (call != hiddenByCall) {
            hiddenByCall = call
            Bus.emit("privacy", "on" to call)
            overlays?.privacy(call)
            exec.execute {
                try { Net.json("$server/api/room/${job.optString("room")}/privacy", "POST", JSONObject().put("on", call).put("reason", "call"), mapOf("x-pub" to job.optString("pub"))) } catch (_: Exception) {}
            }
        }
    }

    private fun hidden(): Boolean = hiddenByCall || System.currentTimeMillis() - notifAt < 4000

    private inner class GuardObserver(private val inner: CapturerObserver) : CapturerObserver {
        override fun onCapturerStarted(success: Boolean) = inner.onCapturerStarted(success)
        override fun onCapturerStopped() = inner.onCapturerStopped()
        override fun onFrameCaptured(frame: VideoFrame) {
            if (hidden()) {
                val w = frame.rotatedWidth; val h = frame.rotatedHeight
                val old = blank
                val b: JavaI420Buffer = if (old != null && old.width == w && old.height == h) old else {
                    old?.release()
                    val nb = JavaI420Buffer.allocate(w, h)
                    fill(nb.dataY, 16); fill(nb.dataU, 128); fill(nb.dataV, 128)
                    blank = nb
                    nb
                }
                b.retain()
                val f = VideoFrame(b, 0, frame.timestampNs)
                inner.onFrameCaptured(f)
                f.release()
                return
            }
            inner.onFrameCaptured(frame)
            if (wantThumb) { wantThumb = false; thumb(frame) }
        }
        private fun fill(bb: ByteBuffer, v: Int) { val p = bb.position(); while (bb.hasRemaining()) bb.put(v.toByte()); bb.position(p) }
    }

    private fun thumb(frame: VideoFrame) {
        try {
            val src = frame.buffer
            val tw = 480
            val th = (tw.toDouble() * src.height / src.width).toInt() / 2 * 2
            val scaled = src.cropAndScale(0, 0, src.width, src.height, tw, th)
            val i420 = scaled.toI420()
            scaled.release()
            if (i420 == null) return
            val nv21 = ByteArray(tw * th * 3 / 2)
            val y = i420.dataY; val u = i420.dataU; val v = i420.dataV
            for (r in 0 until th) for (c in 0 until tw) nv21[r * tw + c] = y.get(r * i420.strideY + c)
            var o = tw * th
            for (r in 0 until th / 2) for (c in 0 until tw / 2) {
                nv21[o++] = v.get(r * i420.strideV + c); nv21[o++] = u.get(r * i420.strideU + c)
            }
            i420.release()
            val out = ByteArrayOutputStream()
            YuvImage(nv21, android.graphics.ImageFormat.NV21, tw, th, null).compressToJpeg(Rect(0, 0, tw, th), 65, out)
            val bytes = out.toByteArray()
            exec.execute {
                val code = Net.bytes("$server/api/thumb/${job.optString("room")}", bytes, mapOf("x-pub" to job.optString("pub")))
                if (code == 401) main.post { stopAll("ended") }
            }
        } catch (e: Exception) { Log.w(TAG, "thumb", e) }
    }

    // ---------------- teardown ----------------
    private fun fail(msg: String) {
        Bus.emit("broadcast", "state" to "stopped", "error" to msg)
        main.post { stopAll(msg, notify = false) }
    }

    private fun stopAll(reason: String?, notify: Boolean = true) {
        if (stopped) return
        stopped = true
        running = false
        main.removeCallbacks(tick); main.removeCallbacks(thumbTick)
        restoreDnd()
        overlays?.destroy(); overlays = null
        val j = if (::job.isInitialized) job else null
        exec.execute {
            try { voice?.close() } catch (_: Exception) {}
            try { capturer?.stopCapture() } catch (_: Exception) {}
            try { capturer?.dispose() } catch (_: Exception) {}
            try { playback?.stop(); playback?.release() } catch (_: Exception) {}
            try { pc?.close() } catch (_: Exception) {}
            try { videoSource?.dispose(); audioSource?.dispose() } catch (_: Exception) {}
            try { helper?.dispose() } catch (_: Exception) {}
            try { factory?.dispose(); adm?.release() } catch (_: Exception) {}
            try { egl?.release() } catch (_: Exception) {}
            if (j != null) try { Net.json("$server/api/end", "POST", JSONObject().put("pub", j.optString("pub")).put("room", j.optString("room")), mapOf("x-pub" to j.optString("pub"))) } catch (_: Exception) {}
        }
        if (notify) Bus.emit("broadcast", "state" to "stopped")
        try { wake?.release() } catch (_: Exception) {}
        projectionData = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (!stopped) stopAll(null)
        super.onDestroy()
    }
}

/** Plays the other co-streamers' audio so everyone can talk while playing. */
class VoicePull(private val factory: PeerConnectionFactory, private val sfu: Sfu, private val exec: java.util.concurrent.ExecutorService) {
    private var pc: PeerConnection? = null
    private var sid: String? = null
    private val have = HashSet<String>()

    fun update(pubs: JSONArray, me: String) {
        val want = mutableListOf<Pair<String, String>>()
        for (i in 0 until pubs.length()) {
            val p = pubs.getJSONObject(i)
            if (p.optString("uid") == me) continue
            val tr = p.optJSONArray("tracks") ?: continue
            for (k in 0 until tr.length()) {
                val t = tr.getJSONObject(k)
                if (t.optString("kind") != "audio") continue
                val key = t.optString("sessionId") + "/" + t.optString("trackName")
                if (!have.contains(key)) want += t.optString("sessionId") to t.optString("trackName")
            }
        }
        if (want.isEmpty()) return
        exec.execute { try { pull(want) } catch (e: Exception) { Log.w("WahjVoice", "pull", e) } }
    }

    private fun pull(list: List<Pair<String, String>>) {
        val p = pc ?: factory.createPeerConnection(PeerConnection.RTCConfiguration(sfu.iceServers()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN; bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
        }, PcObserver())!!.also { pc = it }
        val s = sid ?: sfu.newSession().also { sid = it }
        val arr = JSONArray()
        list.forEach { arr.put(JSONObject().put("location", "remote").put("sessionId", it.first).put("trackName", it.second)) }
        val r = sfu.tracks(s, JSONObject().put("tracks", arr))
        list.forEach { have += it.first + "/" + it.second }
        if (r.optBoolean("requiresImmediateRenegotiation")) {
            val sd = r.getJSONObject("sessionDescription")
            Rtc.setRemote(p, SessionDescription(SessionDescription.Type.OFFER, sd.getString("sdp")))
            val ans = Rtc.createAnswer(p)
            Rtc.setLocal(p, ans)
            Rtc.waitGathering(p, 1200)
            sfu.renegotiate(s, p.localDescription.description)
        }
    }

    fun close() { pc?.close(); pc = null; sid = null; have.clear() }
}

open class PcObserver : PeerConnection.Observer {
    override fun onSignalingChange(s: PeerConnection.SignalingState) {}
    override fun onIceConnectionChange(s: PeerConnection.IceConnectionState) {}
    override fun onIceConnectionReceivingChange(b: Boolean) {}
    override fun onIceGatheringChange(s: PeerConnection.IceGatheringState) {}
    override fun onIceCandidate(c: IceCandidate) {}
    override fun onIceCandidatesRemoved(c: Array<out IceCandidate>) {}
    override fun onAddStream(s: MediaStream) {}
    override fun onRemoveStream(s: MediaStream) {}
    override fun onDataChannel(d: DataChannel) {}
    override fun onRenegotiationNeeded() {}
    override fun onAddTrack(r: RtpReceiver, s: Array<out MediaStream>) {}
}
