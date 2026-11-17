import UIKit
import AVFoundation

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // stream audio must play even when the ringer switch is on silent
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.backgroundColor = UIColor(red: 0.024, green: 0.02, blue: 0.04, alpha: 1)
        w.rootViewController = WebVC()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // wahj://w/<room>
        (window?.rootViewController as? WebVC)?.openDeepLink(url)
        return true
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        .allButUpsideDown
    }
}
