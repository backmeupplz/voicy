#!/usr/bin/env node

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const mongoUri = process.env.MONGO
const botPattern =
  process.env.VOICY_BOT_PROCESS_PATTERN || 'voicy-current-bot|dist/app.js'
const workerPattern =
  process.env.VOICY_WORKER_PROCESS_PATTERN ||
  'workerClient/runWindowsWorker|yarn worker:run'
const launchdLabel =
  process.env.VOICY_WORKER_LAUNCHD_LABEL || 'com.voicy.test-worker'
const whisperCommand = process.env.VOICY_WHISPER_COMMAND || 'whisper'
const requiredPathEntries = ['/opt/homebrew/bin', '/usr/local/bin']
const mongoTimeoutMs = Number(process.env.VOICY_HEALTH_MONGO_TIMEOUT_MS || 5000)

const checks = []

function record(name, ok, details = {}) {
  checks.push({ name, ok, ...details })
}

function command(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

function processMatches(pattern) {
  const result = command('pgrep', ['-fl', pattern])
  if (result.status === 0) {
    return result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('local-runtime-health'))
  }
  return []
}

function commandPath(executable) {
  if (executable.includes('/')) {
    return isExecutable(executable) ? executable : undefined
  }
  for (const entry of (process.env.PATH || '').split(':')) {
    const candidate = path.join(entry, executable)
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

function checkProcess(name, pattern) {
  const matches = processMatches(pattern)
  record(`${name} process`, matches.length > 0, {
    pattern,
    matches,
  })
}

function checkLaunchd() {
  const result = command('launchctl', [
    'print',
    `gui/${process.getuid()}/${launchdLabel}`,
  ])
  record('worker launchd label', result.status === 0, {
    label: launchdLabel,
    detail:
      result.status === 0 ? 'loaded' : (result.stderr || result.stdout).trim(),
  })
}

function checkWhisper() {
  const pathValue = process.env.PATH || ''
  const missingPathEntries = requiredPathEntries.filter(
    (entry) => !pathValue.split(':').includes(entry)
  )
  const resolved = whisperCommand.includes('/')
    ? whisperCommand
    : commandPath(whisperCommand)
  record('whisper command', Boolean(resolved), {
    command: whisperCommand,
    resolved,
    missingPathEntries,
  })
}

async function checkMongo() {
  if (!mongoUri) {
    record('mongo', false, { detail: 'MONGO is required' })
    return
  }

  mongoose.set('strictQuery', false)
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: mongoTimeoutMs })
  await mongoose.connection.db.admin().ping()
  record('mongo', true, { database: mongoose.connection.name })

  const collection = mongoose.connection.db.collection('transcriptionjobs')
  const statusCounts = await collection
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray()
  const recentJobs = await collection
    .find(
      {},
      {
        projection: {
          _id: 1,
          chatId: 1,
          status: 1,
          claimedByWorkerId: 1,
          attempts: 1,
          updatedAt: 1,
          error: 1,
        },
      }
    )
    .sort({ updatedAt: -1, _id: -1 })
    .limit(5)
    .toArray()

  record('queued transcription health', true, {
    statusCounts: Object.fromEntries(
      statusCounts.map((entry) => [entry._id || 'unknown', entry.count])
    ),
    recentJobs: recentJobs.map((job) => ({
      id: String(job._id),
      chatId: job.chatId,
      status: job.status,
      claimedByWorkerId: job.claimedByWorkerId,
      attempts: job.attempts,
      updatedAt: job.updatedAt,
      error: job.error,
    })),
  })
}

async function main() {
  checkProcess('bot', botPattern)
  checkProcess('worker', workerPattern)
  checkLaunchd()
  checkWhisper()
  await checkMongo()

  const ok = checks.every((check) => check.ok)
  console.log(JSON.stringify({ ok, checks }, null, 2))
  process.exitCode = ok ? 0 : 1
}

main()
  .catch((error) => {
    record('runtime health script', false, { error: error.message })
    console.log(JSON.stringify({ ok: false, checks }, null, 2))
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined)
  })
