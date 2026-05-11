#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const repoRoot = path.join(__dirname, '..')
const installer = fs.readFileSync(
  path.join(repoRoot, 'scripts', 'install-windows-worker.ps1'),
  'utf8'
)
const runner = fs.readFileSync(
  path.join(repoRoot, 'scripts', 'run-windows-worker.ps1'),
  'utf8'
)

assert(
  installer.includes('-RestartCount 999') &&
    installer.includes('-RestartInterval (New-TimeSpan -Minutes 1)'),
  'worker scheduled task should restart repeatedly after process failure'
)
assert(
  installer.includes('-MultipleInstances IgnoreNew'),
  'worker scheduled task should avoid duplicate worker instances'
)
assert(
  installer.includes('VOICY_WORKER_TOKEN=$WorkerToken') &&
    installer.includes('icacls $envPath'),
  'worker token should be stored in the protected env file'
)
assert(
  installer.includes('$TranscribeArgsJson | ConvertFrom-Json'),
  'installer should validate transcription argv JSON before registration'
)
assert(
  runner.includes('& $yarnCommand worker:run *>> $logPath'),
  'runner should execute the worker and append stdout/stderr to the daily log'
)
assert(
  runner.includes('exit $exitCode') && runner.includes('exit 1'),
  'runner should preserve worker failures so Task Scheduler can restart it'
)
assert(
  runner.includes('Voicy worker wrapper starting') &&
    runner.includes('Voicy worker wrapper exited') &&
    runner.includes('Voicy worker wrapper crashed'),
  'runner should log startup, clean exit, and crash paths'
)

console.log('windows worker task proof passed')
