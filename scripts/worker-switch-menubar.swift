// Menu bar switch for which Voicy worker takes new jobs.
// Build: swiftc -O scripts/worker-switch-menubar.swift -o ~/.voicy-worker/VoicySwitch
// Reads VOICY_WORKER_API_URL and VOICY_WORKER_TOKEN from ~/.voicy-worker/env.
import AppKit

struct Worker: Decodable {
  let name: String
  let active: Bool
  let online: Bool
}

struct WorkerList: Decodable {
  let `self`: String
  let workers: [Worker]
}

final class Switch: NSObject, NSApplicationDelegate {
  let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  var config: [String: String] = [:]
  var list: WorkerList?
  var awake: NSObjectProtocol?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let env = (try? String(contentsOfFile: NSHomeDirectory() + "/.voicy-worker/env", encoding: .utf8)) ?? ""
    for line in env.split(separator: "\n") {
      let pair = line.split(separator: "=", maxSplits: 1).map(String.init)
      if pair.count == 2 { config[pair[0]] = pair[1] }
    }
    render()
    request("/workers")
    Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in self.request("/workers") }
  }

  func request(_ path: String, activate name: String? = nil) {
    guard let api = config["VOICY_WORKER_API_URL"], let url = URL(string: api + path) else { return }
    var request = URLRequest(url: url, timeoutInterval: 4)
    request.setValue("Bearer \(config["VOICY_WORKER_TOKEN"] ?? "")", forHTTPHeaderField: "Authorization")
    if let name {
      request.httpMethod = "POST"
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try? JSONEncoder().encode(["name": name])
    }
    URLSession.shared.dataTask(with: request) { data, _, _ in
      let list = data.flatMap { try? JSONDecoder().decode(WorkerList.self, from: $0) }
      DispatchQueue.main.async {
        self.list = list
        self.render()
      }
    }.resume()
  }

  @objc func pick(_ sender: NSMenuItem) {
    request("/workers/active", activate: sender.representedObject as? String)
  }

  func render() {
    let workers = list?.workers ?? []
    // Standby workers cover only while no active worker is online.
    let busy = workers.filter { $0.online && $0.active }
    let working = busy.isEmpty ? workers.filter { $0.online } : busy
    let mine = working.contains { $0.name == list?.`self` }
    let symbol = working.isEmpty ? "exclamationmark.triangle" : mine ? "laptopcomputer" : "desktopcomputer"
    item.button?.image = NSImage(systemSymbolName: symbol, accessibilityDescription: "Voicy worker")

    // Keep this Mac awake while it is the chosen worker.
    let chosen = workers.contains { $0.name == list?.`self` && $0.active }
    if chosen && awake == nil {
      awake = ProcessInfo.processInfo.beginActivity(options: .idleSystemSleepDisabled, reason: "Voicy worker is active")
    } else if !chosen, let activity = awake {
      ProcessInfo.processInfo.endActivity(activity)
      awake = nil
    }

    let menu = NSMenu()
    let status = list == nil ? "Voicy: backend unreachable"
      : working.isEmpty ? "Voicy: no worker online"
      : "Voicy: \(working.map(\.name).joined(separator: ", ")) transcribing"
    menu.addItem(withTitle: status, action: nil, keyEquivalent: "")
    menu.addItem(.separator())
    for worker in workers {
      let mark = worker.name == list?.`self` ? " (this Mac)" : ""
      let entry = menu.addItem(
        withTitle: worker.name + mark + (worker.online ? "" : " — offline"),
        action: #selector(pick), keyEquivalent: "")
      entry.target = self
      entry.representedObject = worker.name
      entry.state = worker.active ? .on : .off
    }
    menu.addItem(.separator())
    menu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate), keyEquivalent: "q")
    item.menu = menu
  }
}

let app = NSApplication.shared
let delegate = Switch()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
