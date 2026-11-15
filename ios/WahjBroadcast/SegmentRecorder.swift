import Foundation
import AVFoundation
import CoreImage
import CoreMedia
import UniformTypeIdentifiers

/// Records the (privacy-filtered) stream to HLS fMP4 segments and uploads them to the Wahj server (R2).
/// Video is letterboxed into a fixed 720p canvas so rotation mid-stream never breaks the file.
final class SegmentRecorder: NSObject, AVAssetWriterDelegate {
    private let job: WahjJob
    private let q = DispatchQueue(label: "wahj.rec", qos: .utility)
    private let up = DispatchQueue(label: "wahj.rec.upload", qos: .utility)
    private var writer: AVAssetWriter?
    private var vIn: AVAssetWriterInput?
    private var aIn: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private let ci = CIContext(options: [.cacheIntermediates: false])
    private var canvas = CGSize(width: 1280, height: 720)
    private var startPTS: CMTime = .invalid
    private var lastVideo: CMTime = .invalid
    private var busy = false
    private var seg = 0
    private var pendingUploads = 0
    private let lock = NSLock()
    private(set) var disabled = false
    private var finishing = false

    // audio
    private var audioFmt: CMAudioFormatDescription?
    private var audioAnchor: CMTime = .invalid
    private var audioCount: Int64 = 0

    init(job: WahjJob) {
        self.job = job
        super.init()
        var asbd = AudioStreamBasicDescription(mSampleRate: 48000, mFormatID: kAudioFormatLinearPCM,
                                               mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked,
                                               mBytesPerPacket: 2, mFramesPerPacket: 1, mBytesPerFrame: 2, mChannelsPerFrame: 1,
                                               mBitsPerChannel: 16, mReserved: 0)
        CMAudioFormatDescriptionCreate(allocator: nil, asbd: &asbd, layoutSize: 0, layout: nil, magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &audioFmt)
    }

    // MARK: video
    func push(_ pb: CVPixelBuffer, orientation: CGImagePropertyOrientation, time: CMTime) {
        guard !disabled, !finishing, time.isValid else { return }
        if lastVideo.isValid, CMTimeGetSeconds(CMTimeSubtract(time, lastVideo)) < 1.0 / 31 { return }
        lock.lock(); if busy { lock.unlock(); return }; busy = true; lock.unlock()
        lastVideo = time
        q.async { [weak self] in
            guard let self = self else { return }
            defer { self.lock.lock(); self.busy = false; self.lock.unlock() }
            autoreleasepool { self.write(pb, orientation, time) }
        }
    }

    private func write(_ pb: CVPixelBuffer, _ o: CGImagePropertyOrientation, _ time: CMTime) {
        var img = CIImage(cvPixelBuffer: pb).oriented(o)
        if writer == nil {
            let e = img.extent
            canvas = e.width >= e.height ? CGSize(width: 1280, height: 720) : CGSize(width: 720, height: 1280)
            guard setup(at: time) else { disabled = true; return }
        }
        guard let w = writer, w.status == .writing, let vi = vIn, vi.isReadyForMoreMediaData,
              let pool = adaptor?.pixelBufferPool else { return }
        var outPB: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &outPB)
        guard let out = outPB else { return }
        // aspect-fit into the canvas on black
        let e = img.extent
        let s = min(canvas.width / e.width, canvas.height / e.height)
        img = img.transformed(by: CGAffineTransform(translationX: -e.minX, y: -e.minY))
            .transformed(by: CGAffineTransform(scaleX: s, y: s))
        let dx = (canvas.width - e.width * s) / 2, dy = (canvas.height - e.height * s) / 2
        img = img.transformed(by: CGAffineTransform(translationX: dx, y: dy))
        let bg = CIImage(color: .black).cropped(to: CGRect(origin: .zero, size: canvas))
        ci.render(img.composited(over: bg), to: out, bounds: CGRect(origin: .zero, size: canvas), colorSpace: CGColorSpaceCreateDeviceRGB())
        adaptor?.append(out, withPresentationTime: time)
    }

    private func setup(at time: CMTime) -> Bool {
        guard let type = UTType(AVFileType.mp4.rawValue) else { return false }
        let w = AVAssetWriter(contentType: type)
        w.outputFileTypeProfile = .mpeg4AppleHLS
        w.preferredOutputSegmentInterval = CMTime(seconds: 6, preferredTimescale: 1)
        w.initialSegmentStartTime = time
        w.delegate = self
        let vs: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(canvas.width), AVVideoHeightKey: Int(canvas.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 2_000_000,
                AVVideoMaxKeyFrameIntervalDurationKey: 2,
                AVVideoExpectedSourceFrameRateKey: 30,
                AVVideoAllowFrameReorderingKey: false,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ]
        let vi = AVAssetWriterInput(mediaType: .video, outputSettings: vs)
        vi.expectsMediaDataInRealTime = true
        let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vi, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(canvas.width),
            kCVPixelBufferHeightKey as String: Int(canvas.height),
            kCVPixelBufferIOSurfacePropertiesKey as String: [:] as [String: Any],
        ])
        let ai = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 96000,
        ])
        ai.expectsMediaDataInRealTime = true
        guard w.canAdd(vi), w.canAdd(ai) else { return false }
        w.add(vi); w.add(ai)
        guard w.startWriting() else { NSLog("rec: startWriting failed \(String(describing: w.error))"); return false }
        w.startSession(atSourceTime: time)
        writer = w; vIn = vi; aIn = ai; adaptor = ad; startPTS = time
        return true
    }

    // MARK: audio (48 kHz mono PCM16 from the mixer)
    func pushAudio(_ samples: [Int16]) {
        guard !disabled, !finishing, let fmt = audioFmt, !samples.isEmpty else { return }
        let now = CMClockGetTime(CMClockGetHostTimeClock())
        q.async { [weak self] in
            guard let self = self, let w = self.writer, w.status == .writing, let ai = self.aIn else { return }
            // continuous timeline anchored on the host clock; re-anchor if we drift
            let frames = Int64(samples.count)
            let start = CMTimeSubtract(now, CMTime(value: frames, timescale: 48000))
            if !self.audioAnchor.isValid { self.audioAnchor = start; self.audioCount = 0 }
            var pts = CMTimeAdd(self.audioAnchor, CMTime(value: self.audioCount, timescale: 48000))
            if abs(CMTimeGetSeconds(CMTimeSubtract(pts, start))) > 0.15 { self.audioAnchor = start; self.audioCount = 0; pts = start }
            self.audioCount += frames
            guard CMTimeCompare(pts, self.startPTS) >= 0, ai.isReadyForMoreMediaData else { return }
            let bytes = samples.count * 2
            var bb: CMBlockBuffer?
            guard CMBlockBufferCreateWithMemoryBlock(allocator: nil, memoryBlock: nil, blockLength: bytes, blockAllocator: nil, customBlockSource: nil,
                                                     offsetToData: 0, dataLength: bytes, flags: kCMBlockBufferAssureMemoryNowFlag, blockBufferOut: &bb) == noErr,
                  let block = bb else { return }
            samples.withUnsafeBytes { raw in _ = CMBlockBufferReplaceDataBytes(with: raw.baseAddress!, blockBuffer: block, offsetIntoDestination: 0, dataLength: bytes) }
            var sb: CMSampleBuffer?
            guard CMAudioSampleBufferCreateReadyWithPacketDescriptions(allocator: nil, dataBuffer: block, formatDescription: fmt, sampleCount: samples.count,
                                                                        presentationTimeStamp: pts, packetDescriptions: nil, sampleBufferOut: &sb) == noErr,
                  let s = sb else { return }
            ai.append(s)
        }
    }

    // MARK: segments
    func assetWriter(_ writer: AVAssetWriter, didOutputSegmentData data: Data, segmentType: AVAssetSegmentType, segmentReport: AVAssetSegmentReport?) {
        if segmentType == .initialization {
            upload(path: "init?w=\(Int(canvas.width))&h=\(Int(canvas.height))", data: data)
        } else {
            let d = segmentReport?.trackReports.first(where: { $0.mediaType == .video })?.duration
            let dur = d.map { CMTimeGetSeconds($0) } ?? 6
            let n = seg; seg += 1
            upload(path: "seg?n=\(n)&dur=\(String(format: "%.3f", dur.isFinite ? dur : 6))", data: data)
        }
    }

    private func upload(path: String, data: Data) {
        lock.lock()
        if pendingUploads >= 8 { lock.unlock(); NSLog("rec: upload backlog, dropping segment"); return }
        pendingUploads += 1
        lock.unlock()
        let url = job.serverURL + "/api/rec/\(job.room)/" + path
        up.async { [weak self] in
            guard let self = self else { return }
            defer { self.lock.lock(); self.pendingUploads -= 1; self.lock.unlock() }
            for attempt in 0..<3 {
                let sem = DispatchSemaphore(value: 0)
                var code = 0
                Task {
                    code = await Http.raw(url, method: "POST", data: data, headers: ["x-pub": self.job.pub, "content-type": "application/octet-stream"])
                    sem.signal()
                }
                _ = sem.wait(timeout: .now() + 30)
                if code == 200 { return }
                if code == 401 || code == 409 || code == 503 { self.disabled = true; return }
                Thread.sleep(forTimeInterval: Double(attempt + 1))
            }
        }
    }

    /// Flushes the last segment and waits briefly for uploads (called when the broadcast ends).
    func finish(timeout: TimeInterval = 4) {
        guard !finishing else { return }
        finishing = true
        let sem = DispatchSemaphore(value: 0)
        q.async {
            guard let w = self.writer, w.status == .writing else { sem.signal(); return }
            self.vIn?.markAsFinished(); self.aIn?.markAsFinished()
            w.finishWriting { sem.signal() }
        }
        _ = sem.wait(timeout: .now() + 2)
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            lock.lock(); let p = pendingUploads; lock.unlock()
            if p == 0 { break }
            Thread.sleep(forTimeInterval: 0.1)
        }
    }
}
