import Foundation
import CoreMedia
import AudioToolbox
import WebRTC

/// Custom WebRTC audio device for the broadcast extension.
/// Feeds ReplayKit game audio (+ optional microphone) into WebRTC as 48 kHz mono PCM16,
/// delivered in 10 ms chunks from one dedicated thread.
final class ReplayAudio: NSObject, RTCAudioDevice {
    private weak var delegate: RTCAudioDeviceDelegate?
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
    var outputLatency: TimeInterval { 0 }

    var micEnabled = true
    /// Receives every mixed 10 ms chunk (used by the server recorder).
    var onMixed: (([Int16]) -> Void)?
    var muted = false
    var appGain: Float = 1.0
    var micGain: Float = 1.25

    private let lock = NSLock()
    private var appRing: [Float] = []
    private var micRing: [Float] = []
    private var appRs = Resampler()
    private var micRs = Resampler()
    private var lastApp: CFTimeInterval = 0
    private var lastMic: CFTimeInterval = 0
    private var thread: Thread?
    private var sampleTime: Float64 = 0
    private var out = [Int16](repeating: 0, count: 480)
    private static let chunk = 480
    private static let maxRing = 48000 / 5 // 200 ms

    // MARK: RTCAudioDevice
    func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool {
        self.delegate = delegate
        isInitialized = true
        return true
    }
    func terminateDevice() -> Bool {
        _ = stopRecording()
        delegate = nil
        isInitialized = false
        return true
    }
    func initializePlayout() -> Bool { isPlayoutInitialized = true; return true }
    func startPlayout() -> Bool { isPlaying = true; return true }
    func stopPlayout() -> Bool { isPlaying = false; return true }
    func initializeRecording() -> Bool { isRecordingInitialized = true; return true }
    func startRecording() -> Bool {
        guard !isRecording else { return true }
        isRecording = true
        let t = Thread { [weak self] in self?.loop() }
        t.name = "wahj.audio"
        t.qualityOfService = .userInteractive
        thread = t
        t.start()
        return true
    }
    func stopRecording() -> Bool {
        isRecording = false
        thread = nil
        return true
    }

    // MARK: input from ReplayKit
    func pushApp(_ sb: CMSampleBuffer) {
        guard let (mono, rate) = Self.monoSamples(sb) else { return }
        lock.lock()
        let res = appRs.run(mono, rate: rate)
        appRing.append(contentsOf: res)
        if appRing.count > Self.maxRing { appRing.removeFirst(appRing.count - Self.chunk * 4) }
        lastApp = CACurrentMediaTime()
        lock.unlock()
    }
    func pushMic(_ sb: CMSampleBuffer) {
        guard micEnabled, let (mono, rate) = Self.monoSamples(sb) else { return }
        lock.lock()
        let res = micRs.run(mono, rate: rate)
        micRing.append(contentsOf: res)
        if micRing.count > Self.maxRing { micRing.removeFirst(micRing.count - Self.chunk * 4) }
        lastMic = CACurrentMediaTime()
        lock.unlock()
    }

    private func loop() {
        while isRecording {
            var delivered = false
            while let chunk = nextChunk() {
                deliver(chunk)
                delivered = true
            }
            usleep(delivered ? 4000 : 5000)
        }
    }

    /// Drives on the game-audio clock; falls back to the mic clock when the game is silent.
    private func nextChunk() -> [Int16]? {
        lock.lock(); defer { lock.unlock() }
        let now = CACurrentMediaTime()
        let appLive = now - lastApp < 0.12
        let n = Self.chunk
        let haveApp = appRing.count >= n
        let haveMic = micRing.count >= n
        guard haveApp || (!appLive && haveMic) else { return nil }
        for i in 0..<n {
            var s: Float = 0
            if haveApp { s += appRing[i] * appGain }
            if micRing.count >= n || (haveMic) { s += micRing[i] * micGain }
            if muted { s = 0 }
            out[i] = Int16(max(-32767, min(32767, s * 32767)))
        }
        if haveApp { appRing.removeFirst(n) }
        if micRing.count >= n { micRing.removeFirst(n) } else if !micRing.isEmpty && haveApp && now - lastMic > 0.12 { micRing.removeAll() }
        return out
    }

    private func deliver(_ samples: [Int16]) {
        onMixed?(samples)
        guard let d = delegate else { return }
        var pcm = samples
        var flags = AudioUnitRenderActionFlags()
        var ts = AudioTimeStamp()
        ts.mSampleTime = sampleTime
        ts.mFlags = .sampleTimeValid
        sampleTime += Float64(pcm.count)
        let frames = UInt32(pcm.count)
        pcm.withUnsafeMutableBytes { raw in
            var abl = AudioBufferList(mNumberBuffers: 1, mBuffers: AudioBuffer(mNumberChannels: 1, mDataByteSize: frames * 2, mData: raw.baseAddress))
            _ = d.deliverRecordedData(&flags, &ts, 1, frames, &abl, nil, nil)
        }
    }

    // MARK: CMSampleBuffer -> mono Float
    static func monoSamples(_ sb: CMSampleBuffer) -> ([Float], Double)? {
        guard let fd = CMSampleBufferGetFormatDescription(sb),
              let asbdP = CMAudioFormatDescriptionGetStreamBasicDescription(fd) else { return nil }
        let asbd = asbdP.pointee
        var block: CMBlockBuffer?
        var abl = AudioBufferList()
        let st = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sb, bufferListSizeNeededOut: nil, bufferListOut: &abl, bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block)
        guard st == noErr, let data = abl.mBuffers.mData else { return nil }
        let flags = asbd.mFormatFlags
        let isFloat = flags & kAudioFormatFlagIsFloat != 0
        let bigEndian = flags & kAudioFormatFlagIsBigEndian != 0
        let nonInter = flags & kAudioFormatFlagIsNonInterleaved != 0
        let ch = nonInter ? 1 : max(1, Int(asbd.mChannelsPerFrame))
        let bits = Int(asbd.mBitsPerChannel)
        let bytes = Int(abl.mBuffers.mDataByteSize)
        guard bits == 16 || bits == 32 else { return nil }
        let frames = bytes / (bits / 8) / ch
        guard frames > 0 else { return nil }
        var mono = [Float](repeating: 0, count: frames)
        if bits == 16 {
            let p = data.assumingMemoryBound(to: Int16.self)
            for f in 0..<frames {
                var acc: Float = 0
                for c in 0..<ch {
                    var v = p[f * ch + c]
                    if bigEndian { v = Int16(bigEndian: v) }
                    acc += Float(v) / 32768
                }
                mono[f] = acc / Float(ch)
            }
        } else if isFloat {
            let p = data.assumingMemoryBound(to: Float.self)
            for f in 0..<frames {
                var acc: Float = 0
                for c in 0..<ch { acc += p[f * ch + c] }
                mono[f] = acc / Float(ch)
            }
        } else {
            let p = data.assumingMemoryBound(to: Int32.self)
            for f in 0..<frames {
                var acc: Float = 0
                for c in 0..<ch {
                    var v = p[f * ch + c]
                    if bigEndian { v = Int32(bigEndian: v) }
                    acc += Float(v) / 2147483648
                }
                mono[f] = acc / Float(ch)
            }
        }
        return (mono, asbd.mSampleRate > 0 ? asbd.mSampleRate : 44100)
    }
}

/// Continuous linear resampler to 48 kHz.
struct Resampler {
    private var pos: Double = 0
    private var last: Float = 0
    mutating func run(_ input: [Float], rate: Double) -> [Float] {
        let n = input.count
        guard n > 0 else { return [] }
        if abs(rate - 48000) < 1 { last = input[n - 1]; return input }
        let step = rate / 48000.0
        var out: [Float] = []
        out.reserveCapacity(Int(Double(n) / step) + 2)
        var p = pos
        while p < Double(n) {
            let i = Int(p)
            let f = Float(p - Double(i))
            let a = i == 0 ? last : input[i - 1]
            let b = input[i]
            out.append(a + (b - a) * f)
            p += step
        }
        pos = p - Double(n)
        last = input[n - 1]
        return out
    }
}
