package com.cruyfford.wahj

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var pendingJob: JSONObject? = null
    private var pendingAfterOverlay: (() -> Unit)? = null
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val cb = fileCb ?: return@registerForActivityResult
        fileCb = null
        val u = res.data?.data
        cb.onReceiveValue(if (res.resultCode == RESULT_OK && u != null) arrayOf(u) else null)
    }
    private val server: String get() = BuildConfig.SERVER_URL.trimEnd('/')
    private val ar get() = resources.configuration.locales[0].language == "ar"

    private val projection = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val job = pendingJob ?: return@registerForActivityResult
        pendingJob = null
        if (res.resultCode != RESULT_OK || res.data == null) {
            emit(JSONObject().put("type", "broadcast").put("state", "stopped").put("error", if (ar) "تم إلغاء البث" else "Broadcast cancelled"))
            return@registerForActivityResult
        }
        StreamService.projectionData = res.data
        val i = Intent(this, StreamService::class.java).setAction(StreamService.ACTION_START).putExtra("job", job.toString())
        ContextCompat.startForegroundService(this, i)
        emit(JSONObject().put("type", "broadcast").put("state", "connecting"))
    }

    private val perms = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
        pendingJob?.let { requestProjection() }
    }
    private val camPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) withOverlay { service(StreamService.ACTION_CAM) { it.putExtra("on", true) } }
        else emit(JSONObject().put("type", "cam").put("on", false))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#06050A")
        window.navigationBarColor = Color.parseColor("#06050A")
        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#06050A"))
        setContentView(web)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            setSupportZoom(false)
            userAgentString = "$userAgentString WahjLive-Android/${BuildConfig.VERSION_NAME}"
        }
        web.addJavascriptInterface(Bridge(), "WahjAndroid")
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) { runOnUiThread { request.grant(request.resources) } }
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null)
                fileCb = cb
                return try {
                    pickFile.launch(Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")); true
                } catch (e: Exception) { fileCb = null; false }
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.host == Uri.parse(server).host) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) view.loadData(offlineHtml(), "text/html; charset=utf-8", "utf-8")
            }
        }
        Bus.sink = { emit(it) }
        val deep = intent?.data
        web.loadUrl(server + (deep?.let { if (it.host == "w") "/w" + (it.path ?: "") else "/" } ?: "/"))

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(function(){try{var c=window.Wahj&&Wahj.current();if(c&&c!=='home'&&c!=='auth'&&c!=='studio'){Wahj.go('home');return 1}}catch(e){}return 0})()") { r ->
                    if (r != "1") moveTaskToBack(true)
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val d = intent.data ?: return
        if (d.host == "w") web.loadUrl(server + "/w" + (d.path ?: ""))
        if (d.host == "wallet") web.evaluateJavascript("window.Wahj && Wahj.go('wallet')", null)
    }

    override fun onDestroy() {
        if (Bus.sink != null) Bus.sink = null
        super.onDestroy()
    }

    private fun offlineHtml() = """<html><body style="background:#06050A;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="font-size:48px">📡</div><p style="font-size:18px;font-weight:bold">${if (ar) "تعذّر الاتصال بالإنترنت" else "No connection"}</p>
        <button onclick="location.href='$server'" style="background:#7C5CFF;color:#fff;border:0;border-radius:16px;padding:14px 32px;font-size:16px;font-weight:bold">${if (ar) "إعادة المحاولة" else "Retry"}</button></body></html>"""

    private fun emit(o: JSONObject) {
        runOnUiThread { web.evaluateJavascript("window.__native && window.__native(${o})", null) }
    }

    private fun service(action: String, fill: (Intent) -> Unit = {}) {
        val i = Intent(this, StreamService::class.java).setAction(action)
        fill(i)
        if (StreamService.running) startService(i)
    }

    private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    private fun requestProjection() {
        val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projection.launch(mpm.createScreenCaptureIntent())
    }

    private fun withOverlay(then: () -> Unit) {
        if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)) return then()
        pendingAfterOverlay = then
        Toast.makeText(this, if (ar) "اسمح لوهج بالظهور فوق التطبيقات" else "Allow Wahj to display over other apps", Toast.LENGTH_LONG).show()
        startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
    }

    override fun onPause() {
        super.onPause()
        StreamService.appFront = false
        StreamService.appBackAt = System.currentTimeMillis()
    }

    override fun onResume() {
        super.onResume()
        StreamService.appFront = true
        val p = pendingAfterOverlay
        if (p != null && (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this))) { pendingAfterOverlay = null; p() }
    }

    private fun notifListenerOn(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
        return flat.contains(ComponentName(this, PrivacyListener::class.java).flattenToString())
    }

    private fun handle(m: JSONObject) {
        val d = m.optJSONObject("data") ?: JSONObject()
        when (m.optString("cmd")) {
            "info" -> emit(JSONObject().put("type", "info").put("platform", "android")
                .put("device", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
                .put("version", BuildConfig.VERSION_NAME).put("broadcasting", StreamService.running)
                .put("features", JSONObject().put("overlay", true).put("dnd", true).put("cam", true)))
            "startBroadcast" -> {
                pendingJob = d
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                val need = mutableListOf<String>()
                if (!granted(Manifest.permission.RECORD_AUDIO)) need += Manifest.permission.RECORD_AUDIO
                if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need += Manifest.permission.POST_NOTIFICATIONS
                if (!granted(Manifest.permission.READ_PHONE_STATE)) need += Manifest.permission.READ_PHONE_STATE
                if (need.isEmpty()) requestProjection() else perms.launch(need.toTypedArray())
            }
            "stopBroadcast" -> { service(StreamService.ACTION_STOP); window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
            "overlay" -> {
                val on = d.optBoolean("on")
                if (on) withOverlay { service(StreamService.ACTION_OVERLAY) { it.putExtra("on", true).putExtra("token", d.optString("token")) } }
                else service(StreamService.ACTION_OVERLAY) { it.putExtra("on", false) }
            }
            "camBubble" -> {
                if (!d.optBoolean("on")) service(StreamService.ACTION_CAM) { it.putExtra("on", false) }
                else if (granted(Manifest.permission.CAMERA)) withOverlay { service(StreamService.ACTION_CAM) { it.putExtra("on", true) } }
                else camPerm.launch(Manifest.permission.CAMERA)
            }
            "voice" -> service(StreamService.ACTION_VOICE) {
                it.putExtra("publishers", (d.optJSONArray("publishers") ?: org.json.JSONArray()).toString()).putExtra("me", d.optString("me"))
            }
            "perm" -> {
                val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                when {
                    !nm.isNotificationPolicyAccessGranted -> {
                        Toast.makeText(this, if (ar) "فعّل وهج في «الوصول إلى عدم الإزعاج»" else "Enable Wahj under Do Not Disturb access", Toast.LENGTH_LONG).show()
                        runCatching { startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)) }
                    }
                    !notifListenerOn() -> {
                        Toast.makeText(this, if (ar) "فعّل وهج في «الوصول إلى الإشعارات» لحماية إضافية" else "Enable Wahj under Notification access for extra protection", Toast.LENGTH_LONG).show()
                        runCatching { startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")) }
                    }
                    else -> Toast.makeText(this, if (ar) "درع الخصوصية مفعّل بالكامل ✓" else "Privacy shield fully enabled ✓", Toast.LENGTH_SHORT).show()
                }
            }
            "games" -> Thread {
                val list = org.json.JSONArray()
                try { installedGames().forEach { list.put(it) } } catch (_: Exception) {}
                emit(JSONObject().put("type", "games").put("list", list))
            }.start()
            "launchGame" -> {
                var pkg = d.optString("pkg")
                if (pkg.isBlank()) {
                    val want = d.optString("name").lowercase().filter { it.isLetterOrDigit() }
                    pkg = try { installedGames().firstOrNull { val n = it.optString("name").lowercase().filter { c -> c.isLetterOrDigit() }; n.isNotEmpty() && want.isNotEmpty() && (n.contains(want.take(8)) || want.contains(n)) }?.optString("pkg") ?: "" } catch (_: Exception) { "" }
                }
                val i = if (pkg.isNotBlank()) packageManager.getLaunchIntentForPackage(pkg) else null
                if (i != null) { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); emit(JSONObject().put("type", "launch").put("ok", true)) }
                else emit(JSONObject().put("type", "launch").put("ok", false).put("name", d.optString("name")))
            }
            "share" -> {
                val t = listOf(d.optString("text"), d.optString("url")).filter { it.isNotBlank() }.joinToString("\n")
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t), null))
            }
            "open" -> runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(d.optString("url")))) }
            "haptic" -> {
                val v = getSystemService(VIBRATOR_SERVICE) as Vibrator
                val ms = when (d.optString("k")) { "success" -> 40L; "medium" -> 25L; else -> 12L }
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) else @Suppress("DEPRECATION") v.vibrate(ms)
            }
        }
    }

    /** Games installed on this phone, with their real icons. */
    private fun installedGames(): List<JSONObject> {
        val pm = packageManager
        val launch = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        val acts = pm.queryIntentActivities(launch, 0)
        val out = mutableListOf<JSONObject>()
        val seen = HashSet<String>()
        for (ri in acts) {
            val ai = ri.activityInfo.applicationInfo
            if (ai.packageName == packageName || !seen.add(ai.packageName)) continue
            @Suppress("DEPRECATION")
            val isGame = (Build.VERSION.SDK_INT >= 26 && ai.category == android.content.pm.ApplicationInfo.CATEGORY_GAME) ||
                (ai.flags and android.content.pm.ApplicationInfo.FLAG_IS_GAME) != 0
            if (!isGame) continue
            val name = ri.loadLabel(pm).toString()
            val d = ri.loadIcon(pm)
            val size = 144
            val bmp = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
            val c = android.graphics.Canvas(bmp)
            d.setBounds(0, 0, size, size); d.draw(c)
            val bos = java.io.ByteArrayOutputStream()
            bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, bos)
            val data = "data:image/png;base64," + android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP)
            out += JSONObject().put("name", name).put("pkg", ai.packageName).put("iconData", data)
        }
        return out.sortedBy { it.optString("name").lowercase() }
    }

    inner class Bridge {
        @JavascriptInterface
        fun post(s: String) {
            val m = try { JSONObject(s) } catch (e: Exception) { return }
            runOnUiThread { handle(m) }
        }
    }
}
