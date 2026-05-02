#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const homeDir = os.homedir()
const defaultLabel = 'com.voicy.test-worker'
const defaultPath = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
].join(':')

const args = new Set(process.argv.slice(2))
const label =
  valueFor('--label') || process.env.VOICY_WORKER_LAUNCHD_LABEL || defaultLabel
const plistPath = path.join(
  homeDir,
  'Library',
  'LaunchAgents',
  `${label}.plist`
)
const logDir =
  process.env.VOICY_WORKER_LOG_DIR ||
  path.join(homeDir, 'Library', 'Logs', 'voicy')
const nodeEnv = process.env.NODE_ENV || 'production'
const pathValue =
  process.env.VOICY_WORKER_PATH || executablePath(process.env.PATH)

function valueFor(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return undefined
  }
  return process.argv[index + 1]
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function executablePath(configuredPath) {
  const entries = configuredPath ? configuredPath.split(':') : []
  for (const entry of defaultPath.split(':')) {
    if (!entries.includes(entry)) {
      entries.push(entry)
    }
  }
  return entries.join(':')
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function envEntry(key, value) {
  return `    <key>${xmlEscape(key)}</key>
    <string>${xmlEscape(value)}</string>`
}

function commandExists(command) {
  if (command.includes('/')) {
    return isExecutable(command) ? command : undefined
  }
  for (const entry of pathValue.split(':')) {
    const candidate = path.join(entry, command)
    if (isExecutable(candidate)) {
      return candidate
    }
  }
  return undefined
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function plist() {
  const yarn = commandExists('yarn') || '/opt/homebrew/bin/yarn'
  const env = {
    NODE_ENV: nodeEnv,
    PATH: pathValue,
    VOICY_WORKER_API_URL: requireEnv('VOICY_WORKER_API_URL'),
    VOICY_WORKER_TOKEN: requireEnv('VOICY_WORKER_TOKEN'),
    VOICY_WORKER_WORK_DIR:
      process.env.VOICY_WORKER_WORK_DIR ||
      path.join(
        homeDir,
        'Library',
        'Application Support',
        'voicy-worker',
        'jobs'
      ),
    VOICY_WORKER_ENGINE:
      process.env.VOICY_WORKER_ENGINE || 'openai-whisper-cli',
    VOICY_WORKER_MODEL:
      process.env.VOICY_WORKER_MODEL ||
      process.env.VOICY_WHISPER_MODEL ||
      'turbo',
    VOICY_WORKER_TRANSCRIBE_COMMAND:
      process.env.VOICY_WORKER_TRANSCRIBE_COMMAND ||
      'node scripts/whisper-transcriber.js {input} {output} {language}',
    VOICY_WHISPER_MODEL:
      process.env.VOICY_WHISPER_MODEL ||
      process.env.VOICY_WORKER_MODEL ||
      'turbo',
    VOICY_WHISPER_COMMAND:
      process.env.VOICY_WHISPER_COMMAND ||
      commandExists('whisper') ||
      'whisper',
  }

  if (process.env.VOICY_WORKER_LANGUAGE) {
    env.VOICY_WORKER_LANGUAGE = process.env.VOICY_WORKER_LANGUAGE
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(repoRoot)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(yarn)}</string>
    <string>worker:run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(env)
  .map(([key, value]) => envEntry(key, value))
  .join('\n')}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(path.join(logDir, `${label}.out.log`))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(path.join(logDir, `${label}.err.log`))}</string>
</dict>
</plist>
`
}

function runLaunchctl(subcommand, options = {}) {
  const result = spawnSync('launchctl', subcommand, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    if (options.allowFailure) {
      return false
    }
    throw new Error(
      `${['launchctl', ...subcommand].join(' ')} failed: ${
        result.stderr || result.stdout
      }`
    )
  }
  return true
}

function main() {
  const content = plist()
  if (args.has('--print')) {
    process.stdout.write(content)
    return
  }

  fs.mkdirSync(path.dirname(plistPath), { recursive: true })
  fs.mkdirSync(logDir, { recursive: true })
  fs.writeFileSync(plistPath, content)
  console.log(`Wrote ${plistPath}`)

  if (args.has('--unload')) {
    runLaunchctl(['bootout', `gui/${process.getuid()}`, plistPath], {
      allowFailure: true,
    })
    console.log(`Unloaded ${label}`)
  }

  if (args.has('--load')) {
    runLaunchctl(['bootout', `gui/${process.getuid()}`, plistPath], {
      allowFailure: true,
    })
    runLaunchctl(['bootstrap', `gui/${process.getuid()}`, plistPath])
    runLaunchctl(['kickstart', '-k', `gui/${process.getuid()}/${label}`])
    console.log(`Loaded ${label}`)
  }
}

main()
