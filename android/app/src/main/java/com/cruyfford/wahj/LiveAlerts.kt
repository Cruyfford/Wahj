package com.cruyfford.wahj

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

/** "X is live" notifications: a periodic background check against the Wahj server (no push service needed). */
object LiveAlerts {
    private const val WORK = "wahj-alerts"
    private fun prefs(c: Context) = c.getSharedPreferences("alerts", Context.MODE_PRIVATE)

    fun configure(c: Context, on: Boolean, token: String?, server: String?) {
        val p = prefs(c).edit().putBoolean("on", on)
        if (!token.isNullOrEmpty()) p.putString("token", token)
        if (!server.isNullOrEmpty()) p.putString("server", server)
        if (prefs(c).getLong("since", 0) == 0L) p.putLong("since", System.currentTimeMillis())
        p.apply()
        val wm = WorkManager.getInstance(c)
        if (!on) { wm.cancelUniqueWork(WORK); return }
        val req = PeriodicWorkRequestBuilder<Check>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    class Check(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
        override fun doWork(): Result {
            val c = applicationContext; val p = prefs(c)
            if (!p.getBoolean("on", false)) return Result.success()
            val token = p.getString("token", "") ?: ""; val server = p.getString("server", "") ?: ""
            if (token.isEmpty() || server.isEmpty()) return Result.success()
            val j = try { Net.json("$server/api/alerts?since=${p.getLong("since", 0)}", headers = mapOf("authorization" to "Bearer $token")) } catch (e: Exception) { return Result.retry() }
            p.edit().putLong("since", j.optLong("t", System.currentTimeMillis())).apply()
            val seen = (p.getStringSet("seen", emptySet()) ?: emptySet()).toMutableSet()
            val ar = java.util.Locale.getDefault().language == "ar"
            val live = j.optJSONArray("live")
            for (i in 0 until (live?.length() ?: 0)) {
                val x = live!!.getJSONObject(i); val id = x.optString("id")
                if (seen.add("live-$id")) notify(c, "live-$id".hashCode(), if (ar) "${x.optString("name")} يبث الآن مباشرة" else "${x.optString("name")} is live",
                    listOf(x.optString("title"), x.optString("game")).filter { it.isNotEmpty() }.joinToString(" · "), id)
            }
            val soon = j.optJSONArray("soon")
            for (i in 0 until (soon?.length() ?: 0)) {
                val x = soon!!.getJSONObject(i); val id = x.optString("id")
                if (seen.add("soon-$id")) notify(c, "soon-$id".hashCode(), if (ar) "${x.optString("name")} يبدأ البث خلال دقائق" else "${x.optString("name")} goes live soon", x.optString("title"), "")
            }
            p.edit().putStringSet("seen", seen.toList().takeLast(200).toSet()).apply()
            return Result.success()
        }
    }

    private fun notify(c: Context, id: Int, title: String, body: String, room: String) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = c.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("alerts", "Live alerts", NotificationManager.IMPORTANCE_HIGH))
        val i = Intent(Intent.ACTION_VIEW, Uri.parse(if (room.isNotEmpty()) "wahj://w/$room" else "wahj://home"), c, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        nm.notify(id, NotificationCompat.Builder(c, "alerts").setSmallIcon(R.drawable.ic_radar).setContentTitle(title).setContentText(body)
            .setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).setContentIntent(pi).build())
    }
}
