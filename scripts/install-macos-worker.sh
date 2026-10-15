#!/bin/sh
# Installs this checkout as the production Voicy worker plus the menu bar
# switch, as LaunchAgents. Config: ~/.voicy-worker/env (chmod 600), see
# docs/windows-worker-client.md "Switching Between Windows and a Mac".
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
root=$HOME/.voicy-worker
logs=$HOME/Library/Logs/voicy-worker
mkdir -p "$logs" "$root/jobs"
swiftc -O "$repo/scripts/worker-switch-menubar.swift" -o "$root/VoicySwitch"

agent() { # label, KeepAlive value, ProgramArguments strings, log name
  plist=$HOME/Library/LaunchAgents/$1.plist
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>WorkingDirectory</key><string>$repo</string>
  <key>ProgramArguments</key><array>$3</array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>$2
  <key>StandardOutPath</key><string>$logs/$4.log</string>
  <key>StandardErrorPath</key><string>$logs/$4.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
}

agent com.voicy.worker "<true/>" \
  "<string>/bin/sh</string><string>-c</string><string>set -a; . $root/env; exec $(command -v node) dist/workerClient/runWindowsWorker.js</string>" \
  worker
# Quit from the menu stays quit until next login.
agent com.voicy.worker-switch "<dict><key>SuccessfulExit</key><false/></dict>" \
  "<string>$root/VoicySwitch</string>" \
  switch
