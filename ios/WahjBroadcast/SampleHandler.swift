import ReplayKit
import CallKit
import CoreImage
import ImageIO
import UIKit
import WebRTC

class SampleHandler: RPBroadcastSampleHandler, CXCallObserverDelegate {
    private var pub: Publisher?
    private var recorder: SegmentRecorder?
    private var job: WahjJob?
    private let guardian = PrivacyGuard()
    private let callObserver = CXCallObserver()
    private var blank: CVPixelBuffer?
    private var wantThumb = true
    private var thumbTimer: DispatchSourceTimer?
    private let ci = CIContext(options: [.cacheIntermediates: false])
    private let work = DispatchQueue(label: "wahj.thumb")
    private var finished = false

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        DarwinCenter.shared.observe(WahjNames.stopRequest) { [weak self] in
            self?.finish(L10n.s("تم إيقاف البث من تطبيق وهج", "Stopped from the Wahj app"))
        }
        callObserver.setDelegate(self, queue: DispatchQueue.main)
        guardian.onChange = { [weak self] on in self?.sendPrivacy(on) }
        Task { await boot() }
    }

    private func boot() async {
        guard let job = await JobLoader.load() else {
            finish(L10n.s("افتح تطبيق وهج واضغط «ابدأ البث المباشر» أولاً", "Open Wahj and tap “Start live stream” first"))
            return
        }
        self.job = job
        guardian.callGuard = job.privacy?["callGuard"] ?? true
        guardian.bannerGuard = job.privacy?["bannerGuard"] ?? true
        let p = Publisher(job: job)
        p.onFatal = { [weak self] m in self?.finish(m) }
        do {
            if job.rec == true {
                let r = SegmentRecorder(job: job)
                recorder = r
                p.audio.onMixed = { [weak r] s in r?.pushAudio(s) }
            }
            try await p.start()
            pub = p
            DarwinCenter.post(WahjNames.live)
            startThumbs()
            if callObserver.calls.contains(where: { !$0.hasEnded }) { guardian.setCall(true) }
        } catch {
            DarwinCenter.post(WahjNames.failed)
            finish(L10n.s("تعذّر الاتصال بالسيرفر: ", "Could not connect: ") + error.localizedDescription)
        }
    }

    override func processSampleBuffer(_ sb: CMSampleBuffer, with type: RPSampleBufferType) {
        guard let p = pub else { return }
        switch type {
        case .video:
            guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
            let (rotation, edge, cgo) = Self.orientation(sb)
            let time = CMSampleBufferGetPresentationTimeStamp(sb)
            if guardian.hideAll {
                if let b = blankBuffer(like: pb) { p.push(b, rotation: rotation, time: time); recorder?.push(b, orientation: .up, time: time) }
                return
            }
            guardian.process(pb, edge: edge)
            p.push(pb, rotation: rotation, time: time)
            recorder?.push(pb, orientation: cgo, time: time)
            if wantThumb {
                wantThumb = false
                makeThumb(pb, cgo)
            }
        case .audioApp:
            p.audio.pushApp(sb)
        case .audioMic:
            p.audio.pushMic(sb)
        @unknown default:
            break
        }
    }

    override func broadcastPaused() { pub?.audio.muted = true }
    override func broadcastResumed() { pub?.audio.muted = false }

    override func broadcastFinished() {
        cleanup()
    }

    private func cleanup() {
        guard !finished else { return }
        finished = true
        thumbTimer?.cancel()
        recorder?.finish()
        pub?.stop()
        if let job = job {
            let sem = DispatchSemaphore(value: 0)
            Task {
                _ = try? await Http.json(job.serverURL + "/api/end", method: "POST", body: ["pub": job.pub, "room": job.room], headers: ["x-pub": job.pub])
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 2)
        }
        DarwinCenter.post(WahjNames.stopped)
    }

    private func finish(_ message: String) {
        cleanup()
        finishBroadcastWithError(NSError(domain: "Wahj", code: 1, userInfo: [NSLocalizedDescriptionKey: message]))
    }

    // MARK: privacy
    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        guardian.setCall(callObserver.calls.contains(where: { !$0.hasEnded }))
    }

    private func sendPrivacy(_ on: Bool) {
        DarwinCenter.post(on ? WahjNames.privacyOn : WahjNames.privacyOff)
        guard let job = job else { return }
        Task {
            _ = try? await Http.json(job.serverURL + "/api/room/\(job.room)/privacy", method: "POST",
                                     body: ["on": on, "reason": "call"], headers: ["x-pub": job.pub])
        }
    }

    private func blankBuffer(like pb: CVPixelBuffer) -> CVPixelBuffer? {
        if let b = blank { return b }
        let w = 720, h = 1280
        var out: CVPixelBuffer?
        let attrs: [String: Any] = [kCVPixelBufferIOSurfacePropertiesKey as String: [:]]
        CVPixelBufferCreate(nil, w, h, kCVPixelFormatType_420YpCbCr8BiPlanarFullRange, attrs as CFDictionary, &out)
        guard let b = out else { return nil }
        CVPixelBufferLockBaseAddress(b, [])
        for plane in 0..<2 {
            if let base = CVPixelBufferGetBaseAddressOfPlane(b, plane) {
                memset(base, plane == 0 ? 12 : 128, CVPixelBufferGetBytesPerRowOfPlane(b, plane) * CVPixelBufferGetHeightOfPlane(b, plane))
            }
        }
        CVPixelBufferUnlockBaseAddress(b, [])
        blank = b
        return b
    }

    // MARK: thumbnails (+ heartbeat)
    private func startThumbs() {
        let t = DispatchSource.makeTimerSource(queue: work)
        t.schedule(deadline: .now() + 20, repeating: 20)
        t.setEventHandler { [weak self] in self?.wantThumb = true }
        t.resume()
        thumbTimer = t
    }

    private func makeThumb(_ pb: CVPixelBuffer, _ o: CGImagePropertyOrientation) {
        guard let job = job else { return }
        var img = CIImage(cvPixelBuffer: pb).oriented(o)
        let scale = 480 / max(img.extent.width, img.extent.height)
        img = img.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cs = CGColorSpace(name: CGColorSpace.sRGB),
              let data = ci.jpegRepresentation(of: img, colorSpace: cs, options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.6]) else { return }
        work.async {
            Task {
                let code = await Http.raw(job.serverURL + "/api/thumb/\(job.room)", method: "POST", data: data, headers: ["x-pub": job.pub])
                if code == 401 { self.finish(L10n.s("انتهى البث", "The stream has ended")) }
            }
        }
    }

    // MARK: orientation
    static func orientation(_ sb: CMSampleBuffer) -> (RTCVideoRotation, PrivacyGuard.Edge, CGImagePropertyOrientation) {
        guard let n = CMGetAttachment(sb, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber,
              let o = CGImagePropertyOrientation(rawValue: n.uint32Value) else { return (._0, .top, .up) }
        switch o {
        case .right: return (._90, .left, o)    // display = buffer rotated 90° clockwise
        case .left: return (._270, .right, o)   // display = buffer rotated 90° counter-clockwise
        case .down: return (._180, .bottom, o)
        default: return (._0, .top, .up)
        }
    }
}

/// Finds the job the app prepared: via loopback from the app, then App Group, then the server.
enum JobLoader {
    static func load() async -> WahjJob? {
        for _ in 0..<4 {
            if let j = await fromLocal() { return j }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        if let d = UserDefaults(suiteName: WahjNames.appGroup)?.data(forKey: "job"),
           let j = try? JSONDecoder().decode(WahjJob.self, from: d) { return j }
        if let id = UIDevice.current.identifierForVendor?.uuidString, !WahjConfig.serverURL.isEmpty,
           let r = try? await Http.json(WahjConfig.serverURL + "/api/pending?device=" + id),
           let j = r["job"] as? [String: Any], let d = try? JSONSerialization.data(withJSONObject: j) {
            return try? JSONDecoder().decode(WahjJob.self, from: d)
        }
        return nil
    }

    private static func fromLocal() async -> WahjJob? {
        guard let u = URL(string: "http://127.0.0.1:\(WahjNames.localPort)/job") else { return nil }
        var r = URLRequest(url: u)
        r.timeoutInterval = 1.5
        guard let (d, resp) = try? await Http.session.data(for: r), (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONDecoder().decode(WahjJob.self, from: d)
    }
}
