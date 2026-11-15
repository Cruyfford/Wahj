import Foundation
import CoreMedia
import CoreVideo
import WebRTC

/// Publishes the screen (+ game/mic audio) to Cloudflare Realtime SFU and announces it to the room.
final class Publisher: NSObject, RTCPeerConnectionDelegate {
    let job: WahjJob
    let sfu: SFU
    let audio: ReplayAudio
    private let factory: RTCPeerConnectionFactory
    private let source: RTCVideoSource
    private let capturer: RTCVideoCapturer
    private var pc: RTCPeerConnection?
    private(set) var sessionId = ""
    private var restarting = false
    private var failSince: CFTimeInterval = 0
    private var stopped = false
    var onFatal: ((String) -> Void)?
    var onState: ((String) -> Void)?

    init(job: WahjJob) {
        self.job = job
        self.sfu = SFU(base: job.serverURL)
        RTCInitializeSSL()
        let enc = RTCDefaultVideoEncoderFactory()
        if let h264 = RTCDefaultVideoEncoderFactory.supportedCodecs().first(where: { $0.name == kRTCVideoCodecH264Name }) {
            enc.preferredCodec = h264
        }
        let dev = ReplayAudio()
        dev.micEnabled = job.mic ?? true
        audio = dev
        factory = RTCPeerConnectionFactory(encoderFactory: enc, decoderFactory: RTCDefaultVideoDecoderFactory(), audioDevice: dev)
        source = factory.videoSource()
        capturer = RTCVideoCapturer(delegate: source)
        super.init()
        let (w, h) = job.size
        source.adaptOutputFormat(toWidth: w, height: h, fps: Int32(job.fps ?? 30))
    }

    func start() async throws {
        let ice = await sfu.iceServers()
        Diag.log("ice servers=\(ice.count)")
        let cfg = RTCConfiguration()
        cfg.iceServers = ice.compactMap { s in
            let urls: [String] = (s["urls"] as? [String]) ?? ((s["urls"] as? String).map { [$0] } ?? [])
            guard !urls.isEmpty else { return nil }
            return RTCIceServer(urlStrings: urls, username: s["username"] as? String, credential: s["credential"] as? String)
        }
        cfg.sdpSemantics = .unifiedPlan
        cfg.bundlePolicy = .maxBundle
        cfg.rtcpMuxPolicy = .require
        cfg.continualGatheringPolicy = .gatherOnce
        let cons = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        guard let pc = factory.peerConnection(with: cfg, constraints: cons, delegate: self) else { throw WahjError.bad("peer connection") }
        self.pc = pc

        let vInit = RTCRtpTransceiverInit()
        vInit.direction = .sendOnly
        vInit.streamIds = ["wahj"]
        let enc = RTCRtpEncodingParameters()
        enc.maxBitrateBps = NSNumber(value: job.bitrate)
        enc.maxFramerate = NSNumber(value: job.fps ?? 30)
        vInit.sendEncodings = [enc]
        let vTrack = factory.videoTrack(with: source, trackId: "screen")
        guard let vtx = pc.addTransceiver(with: vTrack, init: vInit) else { throw WahjError.bad("video transceiver") }

        let aInit = RTCRtpTransceiverInit()
        aInit.direction = .sendOnly
        aInit.streamIds = ["wahj"]
        let aTrack = factory.audioTrack(with: factory.audioSource(with: cons), trackId: "audio")
        guard let atx = pc.addTransceiver(with: aTrack, init: aInit) else { throw WahjError.bad("audio transceiver") }

        // Games: keep the frame rate smooth, drop resolution first under bad networks.
        let params = vtx.sender.parameters
        params.degradationPreference = NSNumber(value: RTCDegradationPreference.maintainFramerate.rawValue)
        vtx.sender.parameters = params

        let offer = try await makeOffer(pc, cons)
        try await setLocal(pc, offer)
        await waitGathering(pc)
        guard let local = pc.localDescription else { throw WahjError.bad("no local sdp") }
        Diag.log("offer ready gathering=\(pc.iceGatheringState.rawValue) mids=\(vtx.mid),\(atx.mid)")

        let sid = try await sfu.newSession()
        sessionId = sid
        Diag.log("sfu session ok")
        let suffix = String(UUID().uuidString.prefix(6)).lowercased()
        let vName = "screen-" + suffix, aName = "audio-" + suffix
        let r = try await sfu.tracks(sid, [
            "sessionDescription": ["type": "offer", "sdp": Self.tuneOpus(local.sdp)],
            "tracks": [
                ["location": "local", "mid": vtx.mid, "trackName": vName],
                ["location": "local", "mid": atx.mid, "trackName": aName],
            ],
        ])
        guard let sd = r["sessionDescription"] as? [String: Any], let sdp = sd["sdp"] as? String else {
            throw WahjError.bad("SFU: \(r)")
        }
        try await setRemote(pc, RTCSessionDescription(type: .answer, sdp: sdp))
        Diag.log("answer applied")
        try await Http.json(job.serverURL + "/api/room/\(job.room)/publish", method: "POST", body: [
            "sessionId": sid,
            "tracks": [
                ["trackName": vName, "kind": "video", "role": "screen"],
                ["trackName": aName, "kind": "audio", "role": "audio"],
            ],
        ], headers: ["x-pub": job.pub])
        onState?("live")
        startStats()
    }

    // MARK: quality telemetry (every 15 s → server diag)
    private var statsTimer: DispatchSourceTimer?
    private var lastV: (Double, Double) = (0, 0)   // bytes, timestamp(us)
    private var lastA: (Double, Double) = (0, 0)
    private func startStats() {
        guard statsTimer == nil else { return }
        let t = DispatchSource.makeTimerSource(queue: .global(qos: .utility))
        t.schedule(deadline: .now() + 10, repeating: 15)
        t.setEventHandler { [weak self] in self?.collectStats() }
        t.resume(); statsTimer = t
    }
    private func collectStats() {
        guard let pc = pc, !stopped else { return }
        pc.statistics { [weak self] rep in
            guard let self = self else { return }
            var v = "", a = "", rtt = "", lost = ""
            func num(_ o: NSObject?) -> Double { (o as? NSNumber)?.doubleValue ?? 0 }
            for (_, st) in rep.statistics {
                let x = st.values
                switch st.type {
                case "outbound-rtp":
                    let kind = (x["kind"] as? String) ?? (x["mediaType"] as? String) ?? ""
                    let bytes = num(x["bytesSent"]), ts = st.timestamp_us
                    if kind == "video" {
                        let kbps = self.lastV.1 > 0 ? (bytes - self.lastV.0) * 8 / ((ts - self.lastV.1) / 1000) : 0
                        self.lastV = (bytes, ts)
                        v = String(format: "v %.0ffps %@x%@ %.0fkbps limit=%@ dropped=%.0f", num(x["framesPerSecond"]),
                                   "\(Int(num(x["frameWidth"])))", "\(Int(num(x["frameHeight"])))", kbps, (x["qualityLimitationReason"] as? String) ?? "-", num(x["framesDropped"]))
                    } else if kind == "audio" {
                        let kbps = self.lastA.1 > 0 ? (bytes - self.lastA.0) * 8 / ((ts - self.lastA.1) / 1000) : 0
                        self.lastA = (bytes, ts)
                        a = String(format: "a %.0fkbps", kbps)
                    }
                case "remote-inbound-rtp":
                    if ((x["kind"] as? String) ?? "") == "video" {
                        rtt = String(format: "rtt=%.0fms", num(x["roundTripTime"]) * 1000)
                        lost = String(format: "lost=%.1f%%", num(x["fractionLost"]) * 100)
                    }
                default: break
                }
            }
            Diag.log("stats pub \(v) | \(a) \(rtt) \(lost)")
        }
    }

    // Stereo-ish quality music for game audio.
    static func tuneOpus(_ sdp: String) -> String {
        var lines = sdp.components(separatedBy: "\r\n")
        guard let rtp = lines.first(where: { $0.hasPrefix("a=rtpmap:") && $0.lowercased().contains("opus/48000") }),
              let pt = rtp.split(separator: ":").dropFirst().first?.split(separator: " ").first else { return sdp }
        if let i = lines.firstIndex(where: { $0.hasPrefix("a=fmtp:\(pt) ") }) {
            if !lines[i].contains("maxaveragebitrate") { lines[i] += ";maxaveragebitrate=128000;stereo=0;usedtx=0" }
        }
        return lines.joined(separator: "\r\n")
    }

    func push(_ pb: CVPixelBuffer, rotation: RTCVideoRotation, time: CMTime) {
        guard !stopped else { return }
        let ns = Int64(CMTimeGetSeconds(time) * 1_000_000_000)
        let frame = RTCVideoFrame(buffer: RTCCVPixelBuffer(pixelBuffer: pb), rotation: rotation, timeStampNs: ns)
        source.capturer(capturer, didCapture: frame)
    }

    func stop() {
        stopped = true
        statsTimer?.cancel(); statsTimer = nil
        _ = audio.stopRecording()
        pc?.close()
        pc = nil
    }

    // MARK: reconnect
    private func restart() {
        guard !restarting, !stopped else { return }
        restarting = true
        onState?("reconnecting")
        Task {
            for attempt in 0..<6 {
                if stopped { break }
                pc?.close(); pc = nil
                do { try await start(); restarting = false; return } catch {
                    try? await Task.sleep(nanoseconds: UInt64(min(8, 1 << attempt)) * 1_000_000_000)
                }
            }
            restarting = false
            if !stopped { onFatal?(L10n.s("انقطع الاتصال بالسيرفر", "Lost connection to the server")) }
        }
    }

    // MARK: async helpers
    private func makeOffer(_ pc: RTCPeerConnection, _ c: RTCMediaConstraints) async throws -> RTCSessionDescription {
        try await withCheckedThrowingContinuation { cont in
            pc.offer(for: c) { sdp, err in
                if let sdp = sdp { cont.resume(returning: sdp) } else { cont.resume(throwing: err ?? WahjError.bad("offer")) }
            }
        }
    }
    private func setLocal(_ pc: RTCPeerConnection, _ d: RTCSessionDescription) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            pc.setLocalDescription(d) { err in if let e = err { cont.resume(throwing: e) } else { cont.resume() } }
        }
    }
    private func setRemote(_ pc: RTCPeerConnection, _ d: RTCSessionDescription) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            pc.setRemoteDescription(d) { err in if let e = err { cont.resume(throwing: e) } else { cont.resume() } }
        }
    }
    private func waitGathering(_ pc: RTCPeerConnection) async {
        for _ in 0..<40 {
            if pc.iceGatheringState == .complete { return }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }

    // MARK: RTCPeerConnectionDelegate
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        guard peerConnection === pc else { return }
        Diag.log("ice state \(newState.rawValue)")
        switch newState {
        case .failed: restart()
        case .disconnected:
            failSince = CACurrentMediaTime()
            DispatchQueue.global().asyncAfter(deadline: .now() + 5) { [weak self] in
                guard let self = self, let pc = self.pc, pc === peerConnection else { return }
                if pc.iceConnectionState == .disconnected || pc.iceConnectionState == .failed { self.restart() }
            }
        default: break
        }
    }
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
