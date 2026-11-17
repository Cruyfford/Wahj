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
    // diagnostics
    private var nApp = 0, nMic = 0, nBad = 0, nChunks = 0, nDeliverErr = 0, peak: Float = 0, lastDiag: CFTimeInterval = 0
    private var loggedApp = false, loggedMic = false
    private func fmtInfo(_ sb: CMSampleBuffer) -> String {
        guard let fd = CMSampleBufferGetFormatDescription(sb), let a = CMAudioFormatDescriptionGetStreamBasicDescription(fd)?.pointee else { return "?" }
        return "rate=\(Int(a.mSampleRate)) ch=\(a.mChannelsPerFrame) bits=\(a.mBitsPerChannel) flags=\(a.mFormatFlags) frames=\(CMSampleBufferGetNumSamples(sb))"
    }
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
        Diag.log("audio: WebRTC started recording (delegate=\(delegate != nil))")
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
        if !loggedApp { loggedApp = true; Diag.log("audio: first game-audio buffer \(fmtInfo(sb))") }
        guard let (mono, rate) = Self.monoSamples(sb) else { nBad += 1; return }
        nApp += 1
        lock.lock()
        let res = appRs.run(mono, rate: rate)
        appRing.append(contentsOf: res)
        if appRing.count > Self.maxRing { appRing.removeFirst(appRing.count - Self.chunk * 4) }
        lastApp = CACurrentMediaTime()
        lock.unlock()
    }
    func pushMic(_ sb: CMSampleBuffer) {
        if !loggedMic { loggedMic = true; Diag.log("audio: first mic buffer \(fmtInfo(sb)) enabled=\(micEnabled)") }
        guard micEnabled, let (mono, rate) = Self.monoSamples(sb) else { nBad += 1; return }
        nMic += 1
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
        nChunks += 1
        for v in samples { let a = abs(Float(v)) / 32767; if a > peak { peak = a } }
        let now = CACurrentMediaTime()
        if now - lastDiag > 15 {
            if lastDiag > 0 {
                let db = peak > 0 ? 20 * log10(peak) : -99
                Diag.log(String(format: "audio: 15s game=%d mic=%d bad=%d chunks=%d (want ~1500) peak=%.0fdBFS deliverErr=%d muted=%@", nApp, nMic, nBad, nChunks, db, nDeliverErr, muted ? "yes" : "no"))
            }
            lastDiag = now; nApp = 0; nMic = 0; nBad = 0; nChunks = 0; nDeliverErr = 0; peak = 0
        }
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
            let st = d.deliverRecordedData(&flags, &ts, 1, frames, &abl, nil, nil)
            if st != noErr { nDeliverErr += 1 }
        }
    }

    // MARK: CMSampleBuffer -> mono Float
    static func monoSamples(_ sb: CMSampleBuffer) -> ([Float], Double)? {
        guard let fd = CMSampleBufferGetFormatDescription(sb),
              let asbdP = CMAudioFormatDescriptionGetStreamBasicDescription(fd) else { return nil }
        let asbd = asbdP.pointee
        // ask how big the AudioBufferList must be (non-interleaved stereo needs 2 buffers)
        var need = 0
        _ = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sb, bufferListSizeNeededOut: &need, bufferListOut: nil, bufferListSize: 0,
            blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: nil)
        guard need > 0 else { return nil }
        let raw = UnsafeMutableRawPointer.allocate(byteCount: need, alignment: 16)
        defer { raw.deallocate() }
        let ablP = raw.bindMemory(to: AudioBufferList.self, capacity: 1)
        var block: CMBlockBuffer?
        let st = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sb, bufferListSizeNeededOut: nil, bufferListOut: ablP, bufferListSize: need,
            blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment, blockBufferOut: &block)
        guard st == noErr else { return nil }
        let bufs = UnsafeMutableAudioBufferListPointer(ablP)
        let flags = asbd.mFormatFlags
        let isFloat = flags & kAudioFormatFlagIsFloat != 0
        let bigEndian = flags & kAudioFormatFlagIsBigEndian != 0
        let bits = Int(asbd.mBitsPerChannel)
        guard bits == 16 || bits == 32 || bits == 24 else { return nil }
        let bps = bits / 8
        var mono: [Float] = []
        var nb = 0
        for buf in bufs {
            guard let data = buf.mData else { continue }
            let ch = max(1, Int(buf.mNumberChannels))
            let frames = Int(buf.mDataByteSize) / bps / ch
            guard frames > 0 else { continue }
            if mono.isEmpty { mono = [Float](repeating: 0, count: frames) }
            let n = min(frames, mono.count)
            let p = data.assumingMemoryBound(to: UInt8.self)
            for f in 0..<n {
                var acc: Float = 0
                for c in 0..<ch {
                    let o = (f * ch + c) * bps
                    var v: Float
                    if bits == 16 {
                        var x = UInt16(p[o]) | UInt16(p[o + 1]) << 8
                        if bigEndian { x = x.byteSwapped }
                        v = Float(Int16(bitPattern: x)) / 32768
                    } else if bits == 24 {
                        var x = Int32(p[o]) | Int32(p[o + 1]) << 8 | Int32(p[o + 2]) << 16
                        if bigEndian { x = Int32(p[o + 2]) | Int32(p[o + 1]) << 8 | Int32(p[o]) << 16 }
                        if x & 0x800000 != 0 { x |= ~0xFFFFFF }
                        v = Float(x) / 8388608
                    } else if isFloat {
                        var x = UInt32(p[o]) | UInt32(p[o + 1]) << 8 | UInt32(p[o + 2]) << 16 | UInt32(p[o + 3]) << 24
                        if bigEndian { x = x.byteSwapped }
                        v = Float(bitPattern: x)
                    } else {
                        var x = UInt32(p[o]) | UInt32(p[o + 1]) << 8 | UInt32(p[o + 2]) << 16 | UInt32(p[o + 3]) << 24
                        if bigEndian { x = x.byteSwapped }
                        v = Float(Int32(bitPattern: x)) / 2147483648
                    }
                    acc += v
                }
                mono[f] += acc / Float(ch)
            }
            nb += 1
        }
        guard !mono.isEmpty else { return nil }
        if nb > 1 { let k = 1 / Float(nb); for i in 0..<mono.count { mono[i] *= k } }
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
