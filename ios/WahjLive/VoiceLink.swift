import Foundation
import AVFoundation
import WebRTC

/// While live, keeps the app alive in the background (silent audio engine) so the chat window,
/// room socket and co-stream voice keep working. When co-streaming, plays the other
/// streamers' audio so everyone can talk while playing.
final class VoiceLink: NSObject, RTCPeerConnectionDelegate {
    private let device = PlayoutDevice()
    private lazy var factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(), decoderFactory: RTCDefaultVideoDecoderFactory(), audioDevice: device)
    }()
    private var pc: RTCPeerConnection?
    private var sid: String?
    private var have = Set<String>()
    private var server = ""
    private var queue: Task<Void, Never>?
    var enabled = true

    func keepAlive(_ on: Bool) {
        if on { device.startEngine() } else { device.stopEngine() }
    }

    /// publishers: room "publishers" list. me: my uid.
    func update(server: String, publishers: [[String: Any]], me: String) {
        self.server = server
        guard enabled else { return }
        var want: [(String, String)] = []
        for p in publishers where (p["uid"] as? String) != me {
            for t in (p["tracks"] as? [[String: Any]]) ?? [] where (t["kind"] as? String) == "audio" {
                if let s = t["sessionId"] as? String, let n = t["trackName"] as? String, !have.contains(s + "/" + n) { want.append((s, n)) }
            }
        }
        guard !want.isEmpty else { return }
        let prev = queue
        queue = Task { [weak self] in
            await prev?.value
            await self?.pull(want)
        }
    }

    private func pull(_ list: [(String, String)]) async {
        let sfu = SFU(base: server)
        do {
            if pc == nil {
                let ice = await sfu.iceServers()
                let cfg = RTCConfiguration()
                cfg.iceServers = ice.compactMap { s in
                    let urls: [String] = (s["urls"] as? [String]) ?? ((s["urls"] as? String).map { [$0] } ?? [])
                    return urls.isEmpty ? nil : RTCIceServer(urlStrings: urls, username: s["username"] as? String, credential: s["credential"] as? String)
                }
                cfg.sdpSemantics = .unifiedPlan
                cfg.bundlePolicy = .maxBundle
                pc = factory.peerConnection(with: cfg, constraints: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil), delegate: self)
            }
            guard let pc = pc else { return }
            if sid == nil { sid = try await sfu.newSession() }
            guard let sid = sid else { return }
            let r = try await sfu.tracks(sid, ["tracks": list.map { ["location": "remote", "sessionId": $0.0, "trackName": $0.1] }])
            for (s, n) in list { have.insert(s + "/" + n) }
            if r["requiresImmediateRenegotiation"] as? Bool == true, let sd = r["sessionDescription"] as? [String: Any], let sdp = sd["sdp"] as? String {
                try await set(pc, RTCSessionDescription(type: .offer, sdp: sdp), remote: true)
                let ans: RTCSessionDescription = try await withCheckedThrowingContinuation { c in
                    pc.answer(for: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)) { d, e in
                        if let d = d { c.resume(returning: d) } else { c.resume(throwing: e ?? WahjError.bad("answer")) }
                    }
                }
                try await set(pc, ans, remote: false)
                for _ in 0..<24 where pc.iceGatheringState != .complete { try? await Task.sleep(nanoseconds: 50_000_000) }
                try await sfu.renegotiate(sid, answer: pc.localDescription?.sdp ?? ans.sdp)
            }
        } catch {
            NSLog("VoiceLink pull failed: \(error)")
        }
    }

    private func set(_ pc: RTCPeerConnection, _ d: RTCSessionDescription, remote: Bool) async throws {
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
            let done: (Error?) -> Void = { e in if let e = e { c.resume(throwing: e) } else { c.resume() } }
            if remote { pc.setRemoteDescription(d, completionHandler: done) } else { pc.setLocalDescription(d, completionHandler: done) }
        }
    }

    func stop() {
        pc?.close(); pc = nil; sid = nil; have.removeAll()
        device.stopEngine()
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}

/// Playout-only WebRTC audio device on AVAudioEngine (never touches the microphone,
/// mixes with the game's audio).
final class PlayoutDevice: NSObject, RTCAudioDevice {
    private weak var delegate: RTCAudioDeviceDelegate?
    private let engine = AVAudioEngine()
    private var node: AVAudioSourceNode?
    private var scratch = [Int16](repeating: 0, count: 8192)
    private(set) var isInitialized = false
    private(set) var isPlayoutInitialized = false
    private(set) var isPlaying = false
    private(set) var isRecordingInitialized = false
    private(set) var isRecording = false
    var deviceInputSampleRate: Double { 48000 }
    var inputIOBufferDuration: TimeInterval { 0.01 }
    var inputNumberOfChannels: Int { 1 }
    var inputLatency: TimeInterval { 0 }
    var deviceOutputSampleRate: Double { 48000 }
    var outputIOBufferDuration: TimeInterval { 0.01 }
    var outputNumberOfChannels: Int { 1 }
    var outputLatency: TimeInterval { 0.02 }

    func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool { self.delegate = delegate; isInitialized = true; return true }
    func terminateDevice() -> Bool { delegate = nil; isInitialized = false; return true }
    func initializePlayout() -> Bool { isPlayoutInitialized = true; return true }
    func startPlayout() -> Bool { isPlaying = true; startEngine(); return true }
    func stopPlayout() -> Bool { isPlaying = false; return true }
    func initializeRecording() -> Bool { isRecordingInitialized = true; return true }
    func startRecording() -> Bool { isRecording = true; return true }
    func stopRecording() -> Bool { isRecording = false; return true }

    func startEngine() {
        if engine.isRunning { return }
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? s.setActive(true)
        if node == nil {
            let fmt = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
            let n = AVAudioSourceNode(format: fmt) { [weak self] silence, ts, frames, abl -> OSStatus in
                let out = UnsafeMutableAudioBufferListPointer(abl)
                guard let f = out.first?.mData?.assumingMemoryBound(to: Float.self) else { return noErr }
                let count = Int(min(frames, 8192))
                guard let self = self, self.isPlaying, let d = self.delegate else {
                    for i in 0..<count { f[i] = 0 }
                    silence.pointee = true
                    return noErr
                }
                var flags = AudioUnitRenderActionFlags()
                self.scratch.withUnsafeMutableBytes { raw in
                    var l = AudioBufferList(mNumberBuffers: 1, mBuffers: AudioBuffer(mNumberChannels: 1, mDataByteSize: UInt32(count * 2), mData: raw.baseAddress))
                    _ = d.getPlayoutData(&flags, ts, 0, UInt32(count), &l)
                }
                for i in 0..<count { f[i] = Float(self.scratch[i]) / 32768 }
                return noErr
            }
            engine.attach(n)
            engine.connect(n, to: engine.mainMixerNode, format: fmt)
            node = n
        }
        try? engine.start()
    }

    func stopEngine() {
        engine.stop()
    }
}
