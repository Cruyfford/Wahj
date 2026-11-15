import UIKit
import WebKit
import ReplayKit
import AVFoundation
import AVKit

final class WebVC: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
    private let jobServer = LocalJobServer()
    private lazy var pip = ChatPiP(host: view)
    private let voice = VoiceLink()
    private var broadcasting = false
    private var currentJob: [String: Any]?
    private var errorView: UIView?
    private let bg = UIColor(red: 0.024, green: 0.02, blue: 0.04, alpha: 1)

    private var server: String { WahjConfig.serverURL }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bg

        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsPictureInPictureMediaPlayback = false
        cfg.websiteDataStore = .default()
        cfg.userContentController.add(WeakHandler(self), name: "wahj")
        let top = Int(UIApplication.shared.windows.first?.safeAreaInsets.top ?? 47)
        let bottom = Int(UIApplication.shared.windows.first?.safeAreaInsets.bottom ?? 34)
        cfg.userContentController.addUserScript(WKUserScript(source: "document.documentElement.style.setProperty('--nst','\(max(top, 20))px');document.documentElement.style.setProperty('--nsb','\(bottom)px')", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let ua = "WahjLive-iOS/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1")"
        cfg.applicationNameForUserAgent = ua

        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = bg
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.navigationDelegate = self
        web.uiDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view.addSubview(web)

        // The system broadcast picker lives behind the web view; we tap it programmatically.
        if let ext = Self.broadcastExtensionID() { picker.preferredExtension = ext }
        picker.showsMicrophoneButton = false
        picker.frame = CGRect(x: 0, y: 0, width: 60, height: 60)
        view.insertSubview(picker, at: 0)
        _ = pip

        DarwinCenter.shared.observe(WahjNames.live) { [weak self] in self?.setBroadcasting(true) }
        DarwinCenter.shared.observe(WahjNames.stopped) { [weak self] in self?.setBroadcasting(false) }
        DarwinCenter.shared.observe(WahjNames.failed) { [weak self] in self?.emit(["type": "broadcast", "state": "stopped", "error": L10n.s("تعذّر بدء البث", "Could not start the stream")]) }
        DarwinCenter.shared.observe(WahjNames.privacyOn) { [weak self] in self?.pip.setPrivacy(true); self?.emit(["type": "privacy", "on": true]) }
        DarwinCenter.shared.observe(WahjNames.privacyOff) { [weak self] in self?.pip.setPrivacy(false); self?.emit(["type": "privacy", "on": false]) }
        pip.onState = { [weak self] on in self?.emit(["type": "overlay", "on": on]) }

        loadApp()
    }

    private func loadApp(path: String = "/") {
        guard let u = URL(string: server + path) else { return }
        errorView?.removeFromSuperview(); errorView = nil
        web.load(URLRequest(url: u, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20))
    }

    func openDeepLink(_ url: URL) {
        // wahj://w/<room>
        let parts = url.pathComponents.filter { $0 != "/" }
        if url.host == "w", let room = parts.first { loadApp(path: "/w/" + room) }
    }

    static func broadcastExtensionID() -> String? {
        guard let dir = Bundle.main.builtInPlugInsURL,
              let items = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return nil }
        for u in items where u.pathExtension == "appex" {
            if let b = Bundle(url: u),
               let ext = b.object(forInfoDictionaryKey: "NSExtension") as? [String: Any],
               (ext["NSExtensionPointIdentifier"] as? String)?.contains("broadcast-services-upload") == true {
                return b.bundleIdentifier
            }
        }
        return nil
    }

    // MARK: JS bridge
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        let data = body["data"] as? [String: Any] ?? [:]
        switch cmd {
        case "info":
            emit(["type": "info", "platform": "ios", "device": UIDevice.current.identifierForVendor?.uuidString ?? "",
                  "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0",
                  "broadcasting": broadcasting || UIScreen.main.isCaptured,
                  "features": ["pip": AVPictureInPictureController.isPictureInPictureSupported(), "overlay": true, "dnd": false, "cam": false]])
        case "startBroadcast":
            startBroadcast(data)
        case "stopBroadcast":
            DarwinCenter.post(WahjNames.stopRequest)
            setBroadcasting(false)
        case "overlay":
            if data["on"] as? Bool == true {
                pip.start(server: data["server"] as? String ?? server, room: data["room"] as? String ?? "", token: data["token"] as? String ?? "")
            } else { pip.stop() }
        case "voice":
            voice.update(server: data["server"] as? String ?? server, publishers: data["publishers"] as? [[String: Any]] ?? [], me: data["me"] as? String ?? "")
        case "launchGame":
            launchGame(name: data["name"] as? String ?? "", appId: data["appId"] as? String ?? "")
        case "share":
            var items: [Any] = []
            if let t = data["text"] as? String, !t.isEmpty { items.append(t) }
            if let u = data["url"] as? String, let url = URL(string: u) { items.append(url) }
            let a = UIActivityViewController(activityItems: items, applicationActivities: nil)
            a.popoverPresentationController?.sourceView = view
            present(a, animated: true)
        case "open":
            if let s = data["url"] as? String, let u = URL(string: s) { UIApplication.shared.open(u) }
        case "haptic":
            switch data["k"] as? String {
            case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        default: break
        }
    }

    /// Opens the chosen game: known URL schemes first, then a guess from its name, then its App Store page (one tap to "Open").
    private func launchGame(name: String, appId: String) {
        let n = name.lowercased()
        let known: [(String, [String])] = [
            ("pubg", ["pubgmobile://", "pubgm://"]), ("free fire", ["freefire://", "freefiremax://"]), ("minecraft", ["minecraft://"]),
            ("roblox", ["roblox://"]), ("clash royale", ["clashroyale://"]), ("clash of clans", ["clashofclans://"]), ("brawl stars", ["brawlstars://"]),
            ("fortnite", ["com.epicgames.fortnite://", "fortnite://"]), ("call of duty", ["codm://", "callofduty://"]), ("efootball", ["efootball://", "pesmobile://"]),
            ("fc ", ["fcmobile://", "fifamobile://"]), ("fifa", ["fifamobile://"]), ("genshin", ["yuanshengame://", "genshinimpact://"]), ("among us", ["amongus://"]),
            ("subway", ["subwaysurfers://"]), ("8 ball", ["8ballpool://"]), ("candy crush", ["candycrushsaga://"]), ("pokémon go", ["pokemongo://"]),
            ("geometry dash", ["geometrydash://"]), ("stumble guys", ["stumbleguys://"]), ("mobile legends", ["mobilelegends://"]), ("honkai", ["honkaistarrail://"]),
        ]
        var schemes = known.filter { n.contains($0.0) }.flatMap { $0.1 }
        let slug = n.folding(options: .diacriticInsensitive, locale: nil).filter { $0.isLetter || $0.isNumber }
        if slug.count >= 3 { schemes.append(slug + "://") }
        func next(_ i: Int) {
            if i >= schemes.count {
                if !appId.isEmpty, let u = URL(string: "itms-apps://apps.apple.com/app/id" + appId) { UIApplication.shared.open(u) }
                return
            }
            guard let u = URL(string: schemes[i]) else { return next(i + 1) }
            UIApplication.shared.open(u, options: [:]) { ok in if !ok { next(i + 1) } }
        }
        next(0)
    }

    private func startBroadcast(_ data: [String: Any]) {
        currentJob = data
        if let d = try? JSONSerialization.data(withJSONObject: data) {
            jobServer.serve(d)
            UserDefaults(suiteName: WahjNames.appGroup)?.set(d, forKey: "job")
        }
        voice.keepAlive(true)
        emit(["type": "broadcast", "state": "starting"])
        // Open the system "Start Broadcast" sheet.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            for case let b as UIButton in self.picker.subviews {
                b.sendActions(for: .touchUpInside)
                b.sendActions(for: .touchDown)
                break
            }
        }
    }

    private func setBroadcasting(_ on: Bool) {
        guard on != broadcasting else { if on { emit(["type": "broadcast", "state": "live"]) }; return }
        broadcasting = on
        emit(["type": "broadcast", "state": on ? "live" : "stopped"])
        UIApplication.shared.isIdleTimerDisabled = on
        if !on {
            pip.stop()
            voice.stop()
            currentJob = nil
        }
    }

    private func emit(_ o: [String: Any]) {
        guard let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return }
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.__native && window.__native(\(s))", completionHandler: nil) }
    }

    // MARK: navigation
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = navigationAction.request.url else { return decisionHandler(.allow) }
        if let host = URL(string: server)?.host, u.host == host || u.scheme == "about" || u.scheme == "blob" || u.scheme == "data" {
            return decisionHandler(.allow)
        }
        if navigationAction.navigationType == .linkActivated || ["shortcuts", "tel", "mailto", "itms-apps"].contains(u.scheme ?? "") {
            UIApplication.shared.open(u)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { pushInsets() }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        pushInsets()
    }

    /// WKWebView doesn't always report env(safe-area-inset-*) — pass the real values in.
    private func pushInsets() {
        let i = view.safeAreaInsets
        let js = "document.documentElement.style.setProperty('--nst','\(Int(i.top))px');document.documentElement.style.setProperty('--nsb','\(Int(i.bottom))px')"
        web?.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showError() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {}
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    private func showError() {
        guard errorView == nil else { return }
        let v = UIView(frame: view.bounds)
        v.backgroundColor = bg
        v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        let l = UILabel()
        l.text = L10n.s("تعذّر الاتصال بالإنترنت", "No connection")
        l.textColor = .white
        l.font = .systemFont(ofSize: 18, weight: .bold)
        l.textAlignment = .center
        let b = UIButton(type: .system)
        b.setTitle(L10n.s("إعادة المحاولة", "Retry"), for: .normal)
        b.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        b.setTitleColor(.white, for: .normal)
        b.backgroundColor = UIColor(red: 0.49, green: 0.36, blue: 1, alpha: 1)
        b.layer.cornerRadius = 16
        b.addAction(UIAction { [weak self] _ in self?.loadApp() }, for: .touchUpInside)
        let st = UIStackView(arrangedSubviews: [l, b])
        st.axis = .vertical; st.spacing = 18
        st.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(st)
        NSLayoutConstraint.activate([st.centerXAnchor.constraint(equalTo: v.centerXAnchor), st.centerYAnchor.constraint(equalTo: v.centerYAnchor),
                                     b.widthAnchor.constraint(equalToConstant: 200), b.heightAnchor.constraint(equalToConstant: 52)])
        view.addSubview(v)
        errorView = v
    }
}

/// Avoids the WKUserContentController retain cycle.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}
