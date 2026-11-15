package com.cruyfford.wahj

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Fallback when Do-Not-Disturb access isn't granted: the moment a notification arrives
 * during a live stream, the picture is hidden for a few seconds so the banner never reaches viewers.
 */
class PrivacyListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!StreamService.running || StreamService.dndApplied) return
        if (sbn.packageName == packageName || sbn.isOngoing) return
        val n = sbn.notification
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0 && n.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0) return
        StreamService.notifAt = System.currentTimeMillis()
    }
}
