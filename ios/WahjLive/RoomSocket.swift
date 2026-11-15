import Foundation

/// Native connection to a stream room (used while the app is in the background).
final class RoomSocket {
    private let url: URL
    private var task: URLSessionWebSocketTask?
    private var closed = false
    private var tries = 0
    private var ping: Timer?
    var onMessage: (([String: Any]) -> Void)?

    init?(server: String, room: String, token: String) {
        var s = server.replacingOccurrences(of: "https://", with: "wss://").replacingOccurrences(of: "http://", with: "ws://")
        s += "/api/room/\(room)/ws?pub=1&token=" + (token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")
        guard let u = URL(string: s) else { return nil }
        url = u
    }

    func open() {
        closed = false
        let t = URLSession.shared.webSocketTask(with: url)
        task = t
        t.resume()
        receive(t)
        DispatchQueue.main.async {
            self.ping?.invalidate()
            self.ping = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in self?.send(["t": "ping"]) }
        }
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            guard let self = self, t === self.task else { return }
            switch result {
            case .success(let msg):
                self.tries = 0
                var data: Data?
                switch msg {
                case .string(let s): data = s.data(using: .utf8)
                case .data(let d): data = d
                @unknown default: break
                }
                if let d = data, let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
                    DispatchQueue.main.async { self.onMessage?(o) }
                }
                self.receive(t)
            case .failure:
                self.reconnect()
            }
        }
    }

    private func reconnect() {
        guard !closed else { return }
        let delay = min(8.0, 0.6 * pow(2.0, Double(tries)))
        tries += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, !self.closed else { return }
            self.open()
        }
    }

    func send(_ o: [String: Any]) {
        guard let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return }
        task?.send(.string(s)) { _ in }
    }

    func close() {
        closed = true
        ping?.invalidate()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }
}
