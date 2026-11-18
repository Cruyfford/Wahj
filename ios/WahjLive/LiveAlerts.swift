import Foundation
import UIKit
import BackgroundTasks
import UserNotifications

/// "X is live" notifications without a push server: iOS wakes the app in the background now and then
/// (BGAppRefresh), we ask the Wahj server who of the people you follow went live, and post a local notification.
enum LiveAlerts {
    static let taskId = "com.cruyfford.wahj.alerts"
    private static let d = UserDefaults.standard

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            handle(task as! BGAppRefreshTask)
        }
        UNUserNotificationCenter.current().delegate = Delegate.shared
    }

    /// Called from the web app: {on, token, server}
    static func configure(_ data: [String: Any]) {
        let on = data["on"] as? Bool ?? true
        d.set(on, forKey: "alerts.on")
        if let t = data["token"] as? String { d.set(t, forKey: "alerts.token") }
        if let s = data["server"] as? String, !s.isEmpty { d.set(s, forKey: "alerts.server") }
        if d.double(forKey: "alerts.since") == 0 { d.set(Date().timeIntervalSince1970 * 1000, forKey: "alerts.since") }
        if on {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
            schedule()
        } else {
            BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId)
        }
    }

    static func schedule() {
        guard d.bool(forKey: "alerts.on"), !(d.string(forKey: "alerts.token") ?? "").isEmpty else { return }
        let r = BGAppRefreshTaskRequest(identifier: taskId)
        r.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(r)
    }

    private static func handle(_ task: BGAppRefreshTask) {
        schedule()
        let work = Task { await check(); task.setTaskCompleted(success: true) }
        task.expirationHandler = { work.cancel() }
    }

    /// Also runs whenever the app goes to the background, so a fresh baseline is kept.
    static func check() async {
        guard d.bool(forKey: "alerts.on"), let token = d.string(forKey: "alerts.token"), !token.isEmpty,
              let server = d.string(forKey: "alerts.server") else { return }
        let since = Int64(d.double(forKey: "alerts.since"))
        guard let url = URL(string: "\(server)/api/alerts?since=\(since)") else { return }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        if let t = j["t"] as? Double { d.set(t, forKey: "alerts.since") }
        var seen = Set(d.stringArray(forKey: "alerts.seen") ?? [])
        func post(_ id: String, _ title: String, _ body: String, _ room: String) {
            guard !seen.contains(id) else { return }
            seen.insert(id)
            let c = UNMutableNotificationContent()
            c.title = title; c.body = body; c.sound = .default
            c.userInfo = ["room": room]
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: c, trigger: nil))
        }
        let ar = Locale.preferredLanguages.first?.hasPrefix("ar") ?? true
        for x in (j["live"] as? [[String: Any]]) ?? [] {
            let name = x["name"] as? String ?? "", title = x["title"] as? String ?? "", game = x["game"] as? String ?? ""
            let id = x["id"] as? String ?? ""
            post("live-" + id, ar ? "\(name) يبث الآن مباشرة" : "\(name) is live", [title, game].filter { !$0.isEmpty }.joined(separator: " · "), id)
        }
        for x in (j["soon"] as? [[String: Any]]) ?? [] {
            let name = x["name"] as? String ?? "", title = x["title"] as? String ?? ""
            post("soon-" + (x["id"] as? String ?? ""), ar ? "\(name) يبدأ البث خلال دقائق" : "\(name) goes live soon", title, "")
        }
        d.set(Array(seen.suffix(200)), forKey: "alerts.seen")
    }

    final class Delegate: NSObject, UNUserNotificationCenterDelegate {
        static let shared = Delegate()
        func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }
        func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse) async {
            guard let room = r.notification.request.content.userInfo["room"] as? String, !room.isEmpty, let url = URL(string: "wahj://w/" + room) else { return }
            await MainActor.run {
                ((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? WebVC)?.openDeepLink(url)
            }
        }
    }
}
