package com.cruyfford.wahj

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.PixelFormat
import android.graphics.SurfaceTexture
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.provider.Settings
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.Gravity
import android.view.MotionEvent
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/** Floating windows drawn above the game: live chat panel and a face-cam bubble. */
class Overlays(private val ctx: Context) {
    private val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private val dp = ctx.resources.displayMetrics.density
    private val ar = ctx.resources.configuration.locales[0].language == "ar"
    private val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    // ---------- chat ----------
    private var chatRoot: LinearLayout? = null
    private var header: TextView? = null
    private var list: LinearLayout? = null
    private var banner: TextView? = null
    private var socket: RoomSocket? = null
    private var collapsed = false
    private var viewers = 0
    private var level = 1
    private var priv = false

    fun canDraw() = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx)

    fun chat(on: Boolean, server: String, room: String, token: String) {
        if (!on) { socket?.close(); socket = null; chatRoot?.let { runCatching { wm.removeView(it) } }; chatRoot = null; Bus.emit("overlay", "on" to false); return }
        if (!canDraw() || chatRoot != null) { if (!canDraw()) Bus.emit("overlay", "on" to false); return }
        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply { cornerRadius = 18 * dp; setColor(Color.argb(170, 12, 10, 22)); setStroke((1 * dp).toInt(), Color.argb(40, 255, 255, 255)) }
            setPadding((10 * dp).toInt(), (8 * dp).toInt(), (10 * dp).toInt(), (8 * dp).toInt())
            layoutDirection = if (ar) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
        }
        val h = TextView(ctx).apply { setTextColor(Color.WHITE); textSize = 12f; typeface = Typeface.DEFAULT_BOLD }
        val l = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        val b = TextView(ctx).apply {
            setTextColor(Color.WHITE); textSize = 12.5f; typeface = Typeface.DEFAULT_BOLD; visibility = View.GONE
            background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Color.parseColor("#FFB800"), Color.parseColor("#FF4D8D"))).apply { cornerRadius = 12 * dp }
            setPadding((8 * dp).toInt(), (5 * dp).toInt(), (8 * dp).toInt(), (5 * dp).toInt())
        }
        root.addView(h); root.addView(b, LinearLayout.LayoutParams(-1, -2).apply { topMargin = (5 * dp).toInt() }); root.addView(l)
        header = h; list = l; banner = b; chatRoot = root
        updateHeader()
        val lp = WindowManager.LayoutParams((230 * dp).toInt(), WindowManager.LayoutParams.WRAP_CONTENT, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.START; x = (8 * dp).toInt(); y = (90 * dp).toInt()
        }
        draggable(root, lp) { collapsed = !collapsed; l.visibility = if (collapsed) View.GONE else View.VISIBLE }
        wm.addView(root, lp)
        socket = RoomSocket(server, room, token) { handle(it) }.also { it.open() }
        Bus.emit("overlay", "on" to true)
    }

    fun privacy(on: Boolean) { priv = on; main.post { updateHeader() } }

    private fun updateHeader() {
        header?.text = (if (priv) "🔒 " else "● LIVE  ") + "👁 $viewers   🔥 x$level"
        header?.setTextColor(if (priv) Color.parseColor("#FFB800") else Color.WHITE)
    }

    private fun handle(m: JSONObject) {
        when (m.optString("t")) {
            "hello" -> {
                viewers = m.optInt("viewers"); level = m.optJSONObject("hype")?.optInt("lvl", 1) ?: 1
                val h = m.optJSONArray("history")
                if (h != null) for (i in maxOf(0, h.length() - 5) until h.length()) addLine(h.getJSONObject(i))
            }
            "chat" -> addLine(m)
            "viewers" -> viewers = m.optInt("n")
            "hype" -> { level = m.optInt("lvl", level); if (m.optBoolean("train")) flash(if (ar) "🚀 قطار الحماس x$level" else "🚀 HYPE TRAIN x$level") }
            "effect" -> {
                val e = mapOf("confetti" to "🎉", "hearts" to "💖", "fire" to "🔥", "shake" to "💥", "lightning" to "⚡", "airhorn" to "📯", "boo" to "👻", "wave" to "🌊")[m.optString("id")] ?: "✨"
                flash("$e ${m.optString("name")} ${if (ar) "أرسل" else "sent"} $e")
            }
            "challenges" -> {
                val c = m.optJSONArray("list")?.optJSONObject(0)
                if (c != null && c.optString("state") == "new" && !m.has("changed")) flash("🏆 ${c.optString("name")}: ${c.optString("text")}", 6000)
            }
            "requests" -> {
                val a = m.optJSONArray("list"); val r = a?.optJSONObject(a.length() - 1)
                if (r != null) flash("🤝 ${r.optString("name")} ${if (ar) "يطلب البث معك" else "wants to co-stream"}", 6000)
            }
        }
        updateHeader()
    }

    private fun addLine(m: JSONObject) {
        val l = list ?: return
        val name = m.optString("name"); val text = m.optString("text")
        val color = try { Color.parseColor(m.optString("color", "#7C5CFF")) } catch (_: Exception) { Color.parseColor("#7C5CFF") }
        val s = SpannableStringBuilder("$name  $text")
        s.setSpan(ForegroundColorSpan(color), 0, name.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        s.setSpan(StyleSpan(Typeface.BOLD), 0, name.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        val tv = TextView(ctx).apply { this.text = s; setTextColor(Color.WHITE); textSize = 12.5f; setPadding(0, (3 * dp).toInt(), 0, (3 * dp).toInt()) }
        l.addView(tv)
        while (l.childCount > 5) l.removeViewAt(0)
        main.postDelayed({ runCatching { l.removeView(tv) } }, 25000)
    }

    private fun flash(t: String, ms: Long = 3500) {
        val b = banner ?: return
        b.text = t; b.visibility = View.VISIBLE
        main.removeCallbacksAndMessages("flash")
        main.postAtTime({ b.visibility = View.GONE }, "flash", android.os.SystemClock.uptimeMillis() + ms)
    }

    // ---------- face cam bubble ----------
    private var camRoot: FrameLayout? = null
    private var camDev: CameraDevice? = null
    private var camSession: CameraCaptureSession? = null
    private var camThread: HandlerThread? = null
    private var big = false

    @SuppressLint("MissingPermission")
    fun cam(on: Boolean) {
        if (!on) { closeCam(); Bus.emit("cam", "on" to false); return }
        if (!canDraw() || camRoot != null) return
        val size = (110 * dp).toInt()
        val tv = TextureView(ctx)
        val root = FrameLayout(ctx).apply {
            outlineProvider = object : ViewOutlineProvider() { override fun getOutline(v: View, o: Outline) { o.setOval(0, 0, v.width, v.height) } }
            clipToOutline = true
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.BLACK); setStroke((3 * dp).toInt(), Color.WHITE) }
            elevation = 8 * dp
            addView(tv, FrameLayout.LayoutParams(-1, -1))
        }
        val lp = WindowManager.LayoutParams(size, size, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.END; x = (12 * dp).toInt(); y = (300 * dp).toInt()
        }
        draggable(root, lp, rtlX = true) {
            big = !big
            lp.width = ((if (big) 160 else 110) * dp).toInt(); lp.height = lp.width
            runCatching { wm.updateViewLayout(root, lp) }
        }
        wm.addView(root, lp)
        camRoot = root
        tv.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) { openCamera(tv, st) }
            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {}
            override fun onSurfaceTextureDestroyed(st: SurfaceTexture) = true
            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }
        Bus.emit("cam", "on" to true)
    }

    @SuppressLint("MissingPermission")
    private fun openCamera(tv: TextureView, st: SurfaceTexture) {
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT } ?: cm.cameraIdList.firstOrNull() ?: return
        val t = HandlerThread("wahj-cam").also { it.start() }
        camThread = t
        val handler = Handler(t.looper)
        st.setDefaultBufferSize(480, 480)
        // mirror the selfie view
        main.post { tv.scaleX = -1f }
        try {
            cm.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(d: CameraDevice) {
                    camDev = d
                    val surface = Surface(st)
                    val req = d.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply { addTarget(surface) }
                    @Suppress("DEPRECATION")
                    d.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(s: CameraCaptureSession) { camSession = s; runCatching { s.setRepeatingRequest(req.build(), null, handler) } }
                        override fun onConfigureFailed(s: CameraCaptureSession) {}
                    }, handler)
                }
                override fun onDisconnected(d: CameraDevice) { d.close() }
                override fun onError(d: CameraDevice, e: Int) { d.close() }
            }, handler)
        } catch (_: Exception) {}
    }

    private fun closeCam() {
        runCatching { camSession?.close() }; runCatching { camDev?.close() }
        camSession = null; camDev = null
        camThread?.quitSafely(); camThread = null
        camRoot?.let { runCatching { wm.removeView(it) } }; camRoot = null
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun draggable(v: View, lp: WindowManager.LayoutParams, rtlX: Boolean = false, onTap: () -> Unit) {
        var sx = 0f; var sy = 0f; var ox = 0; var oy = 0; var moved = false
        v.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { sx = e.rawX; sy = e.rawY; ox = lp.x; oy = lp.y; moved = false }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - sx; val dy = e.rawY - sy
                    if (Math.abs(dx) + Math.abs(dy) > 12 * dp) moved = true
                    lp.x = ox + (if (rtlX) -dx else dx).toInt(); lp.y = oy + dy.toInt()
                    runCatching { wm.updateViewLayout(v, lp) }
                }
                MotionEvent.ACTION_UP -> if (!moved) onTap()
            }
            true
        }
    }

    fun destroy() {
        chat(false, "", "", "")
        closeCam()
    }
}
