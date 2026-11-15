import UIKit
import AVKit
import AVFoundation
import CoreMedia

/// "Chat over game" for iPhone: a Picture-in-Picture window that floats above any game,
/// rendered natively from the room socket (chat, effects, polls, challenges, join requests).
final class ChatPiP: NSObject, AVPictureInPictureControllerDelegate, AVPictureInPictureSampleBufferPlaybackDelegate {
    private let hostView: UIView
    private let layerView = UIView()
    private let display = AVSampleBufferDisplayLayer()
    private var pip: AVPictureInPictureController?
    private var socket: RoomSocket?
    private var timer: Timer?
    private var dirty = true

    private struct Line { let name: String; let color: UIColor; let text: String; let kind: Int } // 0 chat, 1 event
    private var lines: [Line] = []
    private var viewers = 0
    private var hype: CGFloat = 0
    private var level = 1
    private var banner: (String, Date)?
    private var privacy = false
    private let size = CGSize(width: 540, height: 720)
    private(set) var active = false
    var onState: ((Bool) -> Void)?

    init(host: UIView) {
        hostView = host
        super.init()
        layerView.frame = CGRect(x: 0, y: host.bounds.height - 160, width: 120, height: 160)
        layerView.autoresizingMask = [.flexibleTopMargin]
        layerView.isUserInteractionEnabled = false
        display.frame = layerView.bounds
        display.videoGravity = .resizeAspect
        layerView.layer.addSublayer(display)
        host.insertSubview(layerView, at: 0) // sits behind the web view
    }

    func start(server: String, room: String, token: String) {
        guard AVPictureInPictureController.isPictureInPictureSupported() else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        socket?.close()
        socket = RoomSocket(server: server, room: room, token: token)
        socket?.onMessage = { [weak self] m in self?.handle(m) }
        socket?.open()
        if pip == nil {
            let src = AVPictureInPictureController.ContentSource(sampleBufferDisplayLayer: display, playbackDelegate: self)
            let p = AVPictureInPictureController(contentSource: src)
            p.delegate = self
            p.canStartPictureInPictureAutomaticallyFromInline = true
            p.requiresLinearPlayback = true
            pip = p
        }
        active = true
        render()
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if let b = self.banner, Date() > b.1 { self.banner = nil; self.dirty = true }
            if self.dirty { self.render() }
        }
        onState?(true)
    }

    func stop() {
        active = false
        timer?.invalidate()
        socket?.close(); socket = nil
        pip?.stopPictureInPicture()
        pip = nil
        display.flushAndRemoveImage()
        onState?(false)
    }

    func setPrivacy(_ on: Bool) { privacy = on; dirty = true }

    // MARK: room events
    private func handle(_ m: [String: Any]) {
        let t = m["t"] as? String ?? ""
        let ar = L10n.ar
        switch t {
        case "hello":
            lines = ((m["history"] as? [[String: Any]]) ?? []).suffix(8).map(chatLine)
            viewers = m["viewers"] as? Int ?? 0
            if let h = m["hype"] as? [String: Any] { hype = CGFloat(h["v"] as? Double ?? 0); level = h["lvl"] as? Int ?? 1 }
        case "chat": lines.append(chatLine(m))
        case "viewers": viewers = m["n"] as? Int ?? viewers
        case "hype":
            hype = CGFloat(m["v"] as? Double ?? Double(hype)); level = m["lvl"] as? Int ?? level
            if m["train"] as? Bool == true { banner = ((ar ? "🚀 قطار الحماس x" : "🚀 HYPE TRAIN x") + "\(level)", Date().addingTimeInterval(4)) }
        case "effect":
            let emo = ["confetti": "🎉", "hearts": "💖", "fire": "🔥", "shake": "💥", "lightning": "⚡", "airhorn": "📯", "boo": "👻", "wave": "🌊"][m["id"] as? String ?? ""] ?? "✨"
            let who = m["name"] as? String ?? ""
            banner = ("\(emo) \(who) \(ar ? "أرسل" : "sent") \(emo)", Date().addingTimeInterval(3.5))
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "challenges":
            if let list = m["list"] as? [[String: Any]], let c = list.first, c["state"] as? String == "new", m["changed"] == nil {
                banner = ("🏆 \(c["name"] as? String ?? ""): \(c["text"] as? String ?? "")", Date().addingTimeInterval(6))
            }
        case "requests":
            if let list = m["list"] as? [[String: Any]], let r = list.last {
                banner = ("🤝 \(r["name"] as? String ?? "") \(ar ? "يطلب البث معك" : "wants to co-stream")", Date().addingTimeInterval(6))
            }
        case "poll":
            if let p = m["poll"] as? [String: Any], let opts = p["opts"] as? [String], let votes = p["votes"] as? [Int] {
                let s = zip(opts, votes).map { "\($0.0): \($0.1)" }.joined(separator: "  ·  ")
                banner = ("📊 " + s, Date().addingTimeInterval(4))
            }
        default: return
        }
        if lines.count > 30 { lines.removeFirst(lines.count - 30) }
        dirty = true
    }

    private func chatLine(_ m: [String: Any]) -> Line {
        Line(name: m["name"] as? String ?? "", color: UIColor(hex: m["color"] as? String ?? "") ?? .systemPurple, text: m["text"] as? String ?? "", kind: 0)
    }

    // MARK: render
    private func render() {
        dirty = false
        let W = Int(size.width), H = Int(size.height)
        var pbOut: CVPixelBuffer?
        let attrs: [String: Any] = [kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true, kCVPixelBufferIOSurfacePropertiesKey as String: [:]]
        CVPixelBufferCreate(nil, W, H, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pbOut)
        guard let pb = pbOut else { return }
        CVPixelBufferLockBaseAddress(pb, [])
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else {
            CVPixelBufferUnlockBaseAddress(pb, []); return
        }
        ctx.translateBy(x: 0, y: CGFloat(H)); ctx.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(ctx)
        draw(CGRect(x: 0, y: 0, width: W, height: H))
        UIGraphicsPopContext()
        CVPixelBufferUnlockBaseAddress(pb, [])

        var fmt: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(allocator: nil, imageBuffer: pb, formatDescriptionOut: &fmt)
        guard let f = fmt else { return }
        var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()), decodeTimeStamp: .invalid)
        var sb: CMSampleBuffer?
        CMSampleBufferCreateReadyWithImageBuffer(allocator: nil, imageBuffer: pb, formatDescription: f, sampleTiming: &timing, sampleBufferOut: &sb)
        guard let s = sb else { return }
        if let arr = CMSampleBufferGetSampleAttachmentsArray(s, createIfNecessary: true), CFArrayGetCount(arr) > 0 {
            let dict = unsafeBitCast(CFArrayGetValueAtIndex(arr, 0), to: CFMutableDictionary.self)
            CFDictionarySetValue(dict, Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(), Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
        }
        if display.status == .failed { display.flush() }
        display.enqueue(s)
    }

    private func draw(_ r: CGRect) {
        let bg = UIColor(red: 0.05, green: 0.04, blue: 0.09, alpha: 1)
        bg.setFill(); UIRectFill(r)
        // aurora header
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [UIColor(red: 0.49, green: 0.36, blue: 1, alpha: 0.55).cgColor, UIColor(red: 1, green: 0.3, blue: 0.55, alpha: 0.35).cgColor] as CFArray, locations: [0, 1])!
        UIGraphicsGetCurrentContext()?.drawLinearGradient(grad, start: .zero, end: CGPoint(x: r.width, y: 90), options: [])
        let ar = L10n.ar
        let para = NSMutableParagraphStyle(); para.baseWritingDirection = .natural; para.alignment = ar ? .right : .left; para.lineBreakMode = .byWordWrapping
        let pad: CGFloat = 26
        // header
        let head = NSMutableAttributedString(string: "● LIVE", attributes: [.font: UIFont.systemFont(ofSize: 26, weight: .heavy), .foregroundColor: UIColor(red: 1, green: 0.18, blue: 0.33, alpha: 1)])
        head.append(NSAttributedString(string: "   👁 \(viewers)    🔥 x\(level)", attributes: [.font: UIFont.systemFont(ofSize: 26, weight: .bold), .foregroundColor: UIColor.white]))
        head.draw(in: CGRect(x: pad, y: 26, width: r.width - pad * 2, height: 40))
        // hype bar
        UIColor(white: 1, alpha: 0.12).setFill()
        UIBezierPath(roundedRect: CGRect(x: pad, y: 78, width: r.width - pad * 2, height: 10), cornerRadius: 5).fill()
        UIColor(red: 1, green: 0.3, blue: 0.55, alpha: 1).setFill()
        UIBezierPath(roundedRect: CGRect(x: pad, y: 78, width: (r.width - pad * 2) * min(1, hype / 100), height: 10), cornerRadius: 5).fill()

        if privacy {
            let s = NSAttributedString(string: ar ? "🔒 البث محجوب للخصوصية" : "🔒 Stream hidden for privacy", attributes: [.font: UIFont.systemFont(ofSize: 30, weight: .bold), .foregroundColor: UIColor.systemYellow, .paragraphStyle: para])
            s.draw(in: CGRect(x: pad, y: 110, width: r.width - pad * 2, height: 80))
        }
        // messages, newest at the bottom
        var y = r.height - (banner == nil ? 30 : 140)
        for l in lines.reversed() {
            let s = NSMutableAttributedString(string: l.name + "  ", attributes: [.font: UIFont.systemFont(ofSize: 27, weight: .heavy), .foregroundColor: l.color, .paragraphStyle: para])
            s.append(NSAttributedString(string: l.text, attributes: [.font: UIFont.systemFont(ofSize: 27, weight: .medium), .foregroundColor: UIColor.white, .paragraphStyle: para]))
            let h = ceil(s.boundingRect(with: CGSize(width: r.width - pad * 2 - 24, height: 400), options: [.usesLineFragmentOrigin], context: nil).height)
            y -= h + 22
            if y < (privacy ? 190 : 104) { break }
            UIColor(white: 1, alpha: 0.07).setFill()
            UIBezierPath(roundedRect: CGRect(x: pad - 8, y: y - 8, width: r.width - pad * 2 + 16, height: h + 16), cornerRadius: 18).fill()
            s.draw(with: CGRect(x: pad + 4, y: y, width: r.width - pad * 2 - 8, height: h), options: [.usesLineFragmentOrigin], context: nil)
        }
        if lines.isEmpty {
            let s = NSAttributedString(string: ar ? "الدردشة هادئة… 👋" : "Chat is quiet… 👋", attributes: [.font: UIFont.systemFont(ofSize: 28, weight: .semibold), .foregroundColor: UIColor(white: 1, alpha: 0.5), .paragraphStyle: para])
            s.draw(in: CGRect(x: pad, y: r.height / 2 - 20, width: r.width - pad * 2, height: 50))
        }
        if let b = banner {
            let rect = CGRect(x: pad - 8, y: r.height - 120, width: r.width - pad * 2 + 16, height: 96)
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [UIColor(red: 1, green: 0.72, blue: 0, alpha: 1).cgColor, UIColor(red: 1, green: 0.3, blue: 0.55, alpha: 1).cgColor] as CFArray, locations: [0, 1])!
            let ctx = UIGraphicsGetCurrentContext()!
            ctx.saveGState(); UIBezierPath(roundedRect: rect, cornerRadius: 22).addClip()
            ctx.drawLinearGradient(g, start: rect.origin, end: CGPoint(x: rect.maxX, y: rect.maxY), options: []); ctx.restoreGState()
            let p2 = NSMutableParagraphStyle(); p2.alignment = .center; p2.lineBreakMode = .byTruncatingTail
            NSAttributedString(string: b.0, attributes: [.font: UIFont.systemFont(ofSize: 28, weight: .heavy), .foregroundColor: UIColor.white, .paragraphStyle: p2])
                .draw(with: rect.insetBy(dx: 16, dy: 14), options: [.usesLineFragmentOrigin], context: nil)
        }
    }

    // MARK: AVPictureInPictureSampleBufferPlaybackDelegate
    func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, setPlaying playing: Bool) {}
    func pictureInPictureControllerTimeRangeForPlayback(_ pictureInPictureController: AVPictureInPictureController) -> CMTimeRange {
        CMTimeRange(start: .negativeInfinity, duration: .positiveInfinity)
    }
    func pictureInPictureControllerIsPlaybackPaused(_ pictureInPictureController: AVPictureInPictureController) -> Bool { false }
    func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, didTransitionToRenderSize newRenderSize: CMVideoDimensions) {}
    func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) { completionHandler() }
}

extension UIColor {
    convenience init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}
