import Foundation

// MARK: - Shared between the app and the broadcast extension

enum WahjNames {
    static let live = "com.cruyfford.wahj.live"
    static let stopped = "com.cruyfford.wahj.stopped"
    static let stopRequest = "com.cruyfford.wahj.stop"
    static let privacyOn = "com.cruyfford.wahj.privacy.on"
    static let privacyOff = "com.cruyfford.wahj.privacy.off"
    static let failed = "com.cruyfford.wahj.failed"
    static let began = "com.cruyfford.wahj.began"
    static let appFront = "com.cruyfford.wahj.app.front"
    static let appBack = "com.cruyfford.wahj.app.back"
    static let appQuery = "com.cruyfford.wahj.app.query"
    static let appGroup = "group.com.cruyfford.wahj"
    static let localPort: UInt16 = 47821
}

struct WahjJob: Codable {
    var room: String
    var pub: String
    var role: String
    var uid: String
    var name: String?
    var quality: String?
    var fps: Int?
    var mic: Bool?
    var privacy: [String: Bool]?
    var server: String?
    var token: String?
    var title: String?
    var rec: Bool?

    var serverURL: String {
        if let s = server, !s.isEmpty { return s }
        return WahjConfig.serverURL
    }
    var size: (Int32, Int32) {
        switch quality ?? "720" {
        case "1080": return (1920, 1080)
        case "540": return (960, 540)
        default: return (1280, 720)
        }
    }
    var bitrate: Int {
        let fps60 = (fps ?? 30) >= 60
        switch quality ?? "720" {
        case "1080": return fps60 ? 6_000_000 : 4_500_000
        case "540": return fps60 ? 1_800_000 : 1_200_000
        default: return fps60 ? 3_500_000 : 2_500_000
        }
    }
}

enum WahjConfig {
    static var serverURL: String {
        let s = (Bundle.main.object(forInfoDictionaryKey: "WahjServerURL") as? String) ?? ""
        return s.hasSuffix("/") ? String(s.dropLast()) : s
    }
}

enum WahjError: LocalizedError {
    case http(Int, String)
    case bad(String)
    var errorDescription: String? {
        switch self {
        case .http(let c, let m): return "HTTP \(c) \(m)"
        case .bad(let m): return m
        }
    }
}

enum Http {
    static let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 15
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    @discardableResult
    static func json(_ url: String, method: String = "GET", body: Any? = nil, headers: [String: String] = [:]) async throws -> [String: Any] {
        guard let u = URL(string: url) else { throw WahjError.bad("url") }
        var r = URLRequest(url: u)
        r.httpMethod = method
        r.setValue("application/json", forHTTPHeaderField: "content-type")
        headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let b = body { r.httpBody = try JSONSerialization.data(withJSONObject: b) }
        let (d, resp) = try await session.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let obj = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] ?? [:]
        if code >= 400 { throw WahjError.http(code, String(data: d.prefix(300), encoding: .utf8) ?? "") }
        return obj
    }

    static func raw(_ url: String, method: String, data: Data, headers: [String: String]) async -> Int {
        guard let u = URL(string: url) else { return 0 }
        var r = URLRequest(url: u)
        r.httpMethod = method
        headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }
        r.httpBody = data
        let resp = try? await session.data(for: r)
        return (resp?.1 as? HTTPURLResponse)?.statusCode ?? 0
    }
}

/// Cloudflare Realtime SFU, reached through the Wahj worker proxy.
struct SFU {
    let base: String
    func newSession() async throws -> String {
        let r = try await Http.json(base + "/api/sfu/new", method: "POST", body: [String: Any]())
        guard let s = r["sessionId"] as? String else { throw WahjError.bad("sfu session: \(r)") }
        return s
    }
    func tracks(_ sid: String, _ body: [String: Any]) async throws -> [String: Any] {
        try await Http.json(base + "/api/sfu/\(sid)/tracks", method: "POST", body: body)
    }
    func renegotiate(_ sid: String, answer sdp: String) async throws {
        try await Http.json(base + "/api/sfu/\(sid)/renegotiate", method: "PUT", body: ["sessionDescription": ["type": "answer", "sdp": sdp]])
    }
    func iceServers() async -> [[String: Any]] {
        let r = try? await Http.json(base + "/api/ice")
        return (r?["iceServers"] as? [[String: Any]]) ?? [["urls": ["stun:stun.cloudflare.com:3478"]]]
    }
}

// MARK: - Darwin notifications (work across app <-> extension with no shared container)

final class DarwinCenter {
    static let shared = DarwinCenter()
    private var handlers: [String: () -> Void] = [:]
    private let lock = NSLock()

    static func post(_ name: String) {
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(name as CFString), nil, nil, true)
    }

    func observe(_ name: String, _ handler: @escaping () -> Void) {
        lock.lock(); let fresh = handlers[name] == nil; handlers[name] = handler; lock.unlock()
        guard fresh else { return }
        let obs = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(), obs, { _, observer, name, _, _ in
            guard let observer = observer, let name = name else { return }
            let me = Unmanaged<DarwinCenter>.fromOpaque(observer).takeUnretainedValue()
            let key = name.rawValue as String
            me.lock.lock(); let h = me.handlers[key]; me.lock.unlock()
            DispatchQueue.main.async { h?() }
        }, name as CFString, nil, .deliverImmediately)
    }
}

/// Sends a diagnostic line to the server (fire and forget).
enum Diag {
    static var room = ""
    static var server = WahjConfig.serverURL
    static func log(_ msg: String, src: String = "ios-ext") {
        NSLog("[wahj] \(msg)")
        guard !server.isEmpty else { return }
        let mem = memoryMB()
        Task { _ = try? await Http.json(server + "/api/diag", method: "POST", body: ["src": src, "room": room, "msg": msg + " [mem \(mem)MB]"]) }
    }
    static func memoryMB() -> Int {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) { $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) } }
        return kr == KERN_SUCCESS ? Int(info.phys_footprint / 1_048_576) : -1
    }
}

enum L10n {
    static var ar: Bool { (Locale.preferredLanguages.first ?? "ar").hasPrefix("ar") }
    static func s(_ ar: String, _ en: String) -> String { self.ar ? ar : en }
}
