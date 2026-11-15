import Foundation
import CoreVideo
import QuartzCore

/// Keeps notifications and calls out of the stream.
/// - Call guard: whole frame is replaced while any call (phone, WhatsApp, FaceTime…) is ringing or active.
/// - Banner guard: detects a notification banner sliding into the top band of the screen and covers that band.
final class PrivacyGuard {
    /// Which edge of the raw buffer is the top of what the user sees.
    enum Edge { case top, bottom, left, right }

    var callGuard = true
    var bannerGuard = true

    private(set) var callActive = false
    private var callOffAt: CFTimeInterval = 0
    private var maskUntil: CFTimeInterval = 0
    private var frame = 0
    private var prev = [Float](repeating: 0, count: GX * GY)
    private var havePrev = false
    private var lastEdge: Edge = .top
    private static let GX = 16, GY = 16

    var onChange: ((Bool) -> Void)?

    func setCall(_ on: Bool) {
        if on {
            let was = callActive
            callActive = true
            callOffAt = 0
            if !was { onChange?(true) }
        } else if callActive {
            callOffAt = CACurrentMediaTime() + 1.5
        }
    }

    /// True while the whole picture must be hidden.
    var hideAll: Bool {
        if callActive, callOffAt > 0, CACurrentMediaTime() > callOffAt {
            callActive = false
            callOffAt = 0
            onChange?(false)
        }
        return callGuard && callActive
    }

    /// Analyzes the frame and covers the top band in place when a banner is detected.
    func process(_ pb: CVPixelBuffer, edge: Edge) {
        guard bannerGuard, CVPixelBufferGetPlaneCount(pb) == 2 else { return }
        if edge != lastEdge { havePrev = false; lastEdge = edge }
        frame += 1
        let now = CACurrentMediaTime()
        if frame % 2 == 0 { analyze(pb, edge: edge, now: now) }
        if now < maskUntil { cover(pb, edge: edge) }
    }

    private func analyze(_ pb: CVPixelBuffer, edge: Edge, now: CFTimeInterval) {
        guard CVPixelBufferLockBaseAddress(pb, .readOnly) == kCVReturnSuccess else { return }
        defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddressOfPlane(pb, 0) else { return }
        let W = CVPixelBufferGetWidthOfPlane(pb, 0), H = CVPixelBufferGetHeightOfPlane(pb, 0)
        let bpr = CVPixelBufferGetBytesPerRowOfPlane(pb, 0)
        let y = base.assumingMemoryBound(to: UInt8.self)
        let GX = Self.GX, GY = Self.GY
        var cur = [Float](repeating: 0, count: GX * GY)
        for cy in 0..<GY {
            for cx in 0..<GX {
                var acc = 0
                for sy in 0..<3 {
                    for sx in 0..<3 {
                        let u = (Double(cx) + (Double(sx) + 0.5) / 3) / Double(GX)
                        let v = (Double(cy) + (Double(sy) + 0.5) / 3) / Double(GY)
                        let (bx, by) = Self.map(u, v, edge, W, H)
                        acc += Int(y[by * bpr + bx])
                    }
                }
                cur[cy * GX + cx] = Float(acc) / 9
            }
        }
        defer { prev = cur; havePrev = true }
        guard havePrev else { return }
        let landscape = edge == .left || edge == .right
        let bandRows = landscape ? 4 : 3
        var topSum: Float = 0, topN = 0, changed = 0, restSum: Float = 0, restN = 0
        for cy in 0..<GY {
            for cx in 0..<GX {
                let d = abs(cur[cy * GX + cx] - prev[cy * GX + cx])
                if cy < bandRows {
                    if cx >= 2 && cx < GX - 2 { topSum += d; topN += 1; if d > 20 { changed += 1 } }
                } else { restSum += d; restN += 1 }
            }
        }
        let dTop = topSum / Float(max(1, topN))
        let dRest = restSum / Float(max(1, restN))
        let frac = Float(changed) / Float(max(1, topN))
        if frac >= 0.4 && dTop > 16 && dTop > 2.5 * dRest + 4 {
            maskUntil = now + 5.5
        }
    }

    private func cover(_ pb: CVPixelBuffer, edge: Edge) {
        guard CVPixelBufferLockBaseAddress(pb, []) == kCVReturnSuccess else { return }
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        let landscape = edge == .left || edge == .right
        let band = landscape ? 0.27 : 0.19
        for plane in 0..<2 {
            guard let base = CVPixelBufferGetBaseAddressOfPlane(pb, plane) else { continue }
            let W = CVPixelBufferGetWidthOfPlane(pb, plane), H = CVPixelBufferGetHeightOfPlane(pb, plane)
            let bpr = CVPixelBufferGetBytesPerRowOfPlane(pb, plane)
            let p = base.assumingMemoryBound(to: UInt8.self)
            let value: UInt8 = plane == 0 ? 18 : 128
            let bytesPerPx = plane == 0 ? 1 : 2
            switch edge {
            case .top, .bottom:
                let rows = Int(Double(H) * band)
                let start = edge == .top ? 0 : H - rows
                for r in start..<(start + rows) { memset(p + r * bpr, Int32(value), W * bytesPerPx) }
            case .left, .right:
                let cols = Int(Double(W) * band)
                let start = edge == .left ? 0 : W - cols
                for r in 0..<H { memset(p + r * bpr + start * bytesPerPx, Int32(value), cols * bytesPerPx) }
            }
        }
    }

    /// Display coords (u across, v down from the visible top) -> raw buffer pixel.
    private static func map(_ u: Double, _ v: Double, _ e: Edge, _ W: Int, _ H: Int) -> (Int, Int) {
        let x: Double, y: Double
        switch e {
        case .top: x = u; y = v
        case .bottom: x = 1 - u; y = 1 - v
        case .left: x = v; y = 1 - u
        case .right: x = 1 - v; y = u
        }
        return (min(W - 1, max(0, Int(x * Double(W)))), min(H - 1, max(0, Int(y * Double(H)))))
    }
}
