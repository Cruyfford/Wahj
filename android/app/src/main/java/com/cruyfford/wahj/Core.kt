package com.cruyfford.wahj

import android.os.Handler
import android.os.Looper
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.PeerConnection
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** App-wide event bus: native -> web UI. */
object Bus {
    private val main = Handler(Looper.getMainLooper())
    @Volatile var sink: ((JSONObject) -> Unit)? = null
    fun emit(o: JSONObject) { main.post { sink?.invoke(o) } }
    fun emit(type: String, vararg kv: Pair<String, Any?>) {
        val o = JSONObject().put("type", type)
        kv.forEach { o.put(it.first, it.second) }
        emit(o)
    }
}

object Net {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS).build()
    private val JSON_T = "application/json".toMediaType()

    fun json(url: String, method: String = "GET", body: JSONObject? = null, headers: Map<String, String> = emptyMap()): JSONObject {
        val b = Request.Builder().url(url)
        headers.forEach { (k, v) -> b.header(k, v) }
        if (method != "GET") b.method(method, (body ?: JSONObject()).toString().toRequestBody(JSON_T))
        http.newCall(b.build()).execute().use { r: Response ->
            val txt = r.body?.string() ?: ""
            if (!r.isSuccessful) throw RuntimeException("HTTP ${r.code}: ${txt.take(200)}")
            return if (txt.isBlank()) JSONObject() else JSONObject(txt)
        }
    }

    fun bytes(url: String, data: ByteArray, headers: Map<String, String>, type: String = "image/jpeg"): Int {
        val b = Request.Builder().url(url).post(data.toRequestBody(type.toMediaType()))
        headers.forEach { (k, v) -> b.header(k, v) }
        return try { http.newCall(b.build()).execute().use { it.code } } catch (e: Exception) { 0 }
    }
}

/** Cloudflare Realtime SFU through the Wahj worker proxy. */
class Sfu(private val base: String) {
    fun newSession(): String = Net.json("$base/api/sfu/new", "POST").getString("sessionId")
    fun tracks(sid: String, body: JSONObject): JSONObject = Net.json("$base/api/sfu/$sid/tracks", "POST", body)
    fun renegotiate(sid: String, sdp: String) {
        Net.json("$base/api/sfu/$sid/renegotiate", "PUT", JSONObject().put("sessionDescription", JSONObject().put("type", "answer").put("sdp", sdp)))
    }
    fun iceServers(): List<PeerConnection.IceServer> {
        val out = mutableListOf<PeerConnection.IceServer>()
        try {
            val arr = Net.json("$base/api/ice").optJSONArray("iceServers") ?: JSONArray()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                val urls = s.opt("urls")
                val list = when (urls) {
                    is JSONArray -> (0 until urls.length()).map { urls.getString(it) }
                    is String -> listOf(urls)
                    else -> emptyList()
                }
                if (list.isEmpty()) continue
                val b = PeerConnection.IceServer.builder(list)
                if (s.has("username")) b.setUsername(s.getString("username"))
                if (s.has("credential")) b.setPassword(s.getString("credential"))
                out += b.createIceServer()
            }
        } catch (_: Exception) {}
        if (out.isEmpty()) out += PeerConnection.IceServer.builder("stun:stun.cloudflare.com:3478").createIceServer()
        return out
    }
}

object Rtc {
    fun createOffer(pc: PeerConnection): SessionDescription = sdp { obs -> pc.createOffer(obs, org.webrtc.MediaConstraints()) }
    fun createAnswer(pc: PeerConnection): SessionDescription = sdp { obs -> pc.createAnswer(obs, org.webrtc.MediaConstraints()) }
    fun setLocal(pc: PeerConnection, d: SessionDescription) = set { obs -> pc.setLocalDescription(obs, d) }
    fun setRemote(pc: PeerConnection, d: SessionDescription) = set { obs -> pc.setRemoteDescription(obs, d) }
    fun waitGathering(pc: PeerConnection, ms: Long = 2000) {
        val end = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < end && pc.iceGatheringState() != PeerConnection.IceGatheringState.COMPLETE) Thread.sleep(40)
    }

    private fun sdp(start: (SdpObserver) -> Unit): SessionDescription {
        val l = CountDownLatch(1)
        var res: SessionDescription? = null
        var err: String? = null
        start(object : SdpObserver {
            override fun onCreateSuccess(d: SessionDescription) { res = d; l.countDown() }
            override fun onCreateFailure(e: String?) { err = e; l.countDown() }
            override fun onSetSuccess() {}
            override fun onSetFailure(e: String?) {}
        })
        l.await(10, TimeUnit.SECONDS)
        return res ?: throw RuntimeException("sdp: $err")
    }

    private fun set(start: (SdpObserver) -> Unit) {
        val l = CountDownLatch(1)
        var err: String? = null
        start(object : SdpObserver {
            override fun onCreateSuccess(d: SessionDescription) {}
            override fun onCreateFailure(e: String?) {}
            override fun onSetSuccess() { l.countDown() }
            override fun onSetFailure(e: String?) { err = e ?: "set failed"; l.countDown() }
        })
        l.await(10, TimeUnit.SECONDS)
        err?.let { throw RuntimeException(it) }
    }
}

/** Native room connection (chat over game, effects, privacy). */
class RoomSocket(private val server: String, private val room: String, private val token: String, private val onMsg: (JSONObject) -> Unit) {
    private var ws: WebSocket? = null
    @Volatile private var closed = false
    private var tries = 0
    private val main = Handler(Looper.getMainLooper())

    fun open() {
        closed = false
        val url = server.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://") + "/api/room/$room/ws?pub=1&token=" + java.net.URLEncoder.encode(token, "UTF-8")
        ws = Net.http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                tries = 0
                val o = try { JSONObject(text) } catch (e: Exception) { return }
                main.post { onMsg(o) }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { retry() }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { retry() }
        })
    }

    private fun retry() {
        if (closed) return
        val d = minOf(8000L, (600 * Math.pow(2.0, tries.toDouble())).toLong()); tries++
        main.postDelayed({ if (!closed) open() }, d)
    }

    fun send(o: JSONObject) { ws?.send(o.toString()) }
    fun close() { closed = true; ws?.close(1000, null); ws = null }
}
