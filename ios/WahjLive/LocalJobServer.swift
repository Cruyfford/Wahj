import Foundation
import Network

/// Tiny loopback-only HTTP server that hands the prepared broadcast job to the extension.
/// Works without App Groups, so it survives any re-signing tool.
final class LocalJobServer {
    private var listener: NWListener?
    private var job = Data()
    private var expires = Date.distantPast
    private let q = DispatchQueue(label: "wahj.jobserver")

    func serve(_ data: Data, for seconds: TimeInterval = 300) {
        q.async {
            self.job = data
            self.expires = Date().addingTimeInterval(seconds)
            self.startIfNeeded()
        }
    }

    private func startIfNeeded() {
        guard listener == nil, let port = NWEndpoint.Port(rawValue: WahjNames.localPort) else { return }
        let params = NWParameters.tcp
        params.requiredInterfaceType = .loopback
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: port)
        guard let l = try? NWListener(using: params) else { return }
        l.newConnectionHandler = { [weak self] c in self?.handle(c) }
        l.stateUpdateHandler = { [weak self] st in
            if case .failed = st { self?.q.async { self?.listener?.cancel(); self?.listener = nil } }
        }
        l.start(queue: q)
        listener = l
    }

    private func handle(_ c: NWConnection) {
        c.start(queue: q)
        c.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] _, _, _, _ in
            guard let self = self else { c.cancel(); return }
            let ok = Date() < self.expires && !self.job.isEmpty
            let body = ok ? self.job : Data("{}".utf8)
            var resp = Data("HTTP/1.1 \(ok ? "200 OK" : "404 Not Found")\r\nContent-Type: application/json\r\nContent-Length: \(body.count)\r\nConnection: close\r\n\r\n".utf8)
            resp.append(body)
            c.send(content: resp, completion: .contentProcessed { _ in c.cancel() })
        }
    }
}
