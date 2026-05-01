import * as path from 'path'
import { Readable } from 'stream'
import { URL } from 'url'
import { createWriteStream } from 'fs'
import { mkdir, readFile, stat, unlink } from 'fs/promises'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { spawn } from 'child_process'
import axios, { AxiosInstance } from 'axios'

const streamPipeline = promisify(pipeline)

const DEFAULT_POLL_INTERVAL_MS = 5000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 300000
const DEFAULT_WORK_DIR = path.join(process.cwd(), 'tmp', 'voicy-worker')

interface WorkerJob {
  id: string
  status: string
  sourceUrl?: string
  sourceKind?: string
  mimeType?: string
  recognitionLanguageHint?: string
  attempts?: number
}

interface ClaimResponse {
  job: WorkerJob
}

interface WorkerSource {
  sourceUrl: string
  sourceKind?: string
  mimeType?: string
  fileId?: string
  fileUniqueId?: string
}

interface SourceResponse {
  source: WorkerSource
}

interface WorkerResultPart {
  timeCode?: string
  text: string
}

interface TranscriptionOutput {
  text: string
  parts?: WorkerResultPart[]
  language?: string
  duration?: number
  metadata?: Record<string, unknown>
}

interface WorkerConfig {
  apiUrl: string
  token: string
  transcribeCommand: string
  workDir: string
  pollIntervalMs: number
  heartbeatIntervalMs: number
  downloadTimeoutMs: number
  idleExit: boolean
  language?: string
  engine: string
  model?: string
}

interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

interface RunCommandResult {
  stdout: string
  stderr: string
}

const consoleLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
}

class WorkerClientError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.retryable = retryable
  }
}

function required(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function numberFromEnv(
  value: string | undefined,
  fallback: number,
  name: string
) {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`)
  }
  return parsed
}

function booleanFromEnv(value: string | undefined) {
  return value === '1' || value === 'true'
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    apiUrl: required(env.VOICY_WORKER_API_URL, 'VOICY_WORKER_API_URL').replace(
      /\/+$/,
      ''
    ),
    token: required(env.VOICY_WORKER_TOKEN, 'VOICY_WORKER_TOKEN'),
    transcribeCommand: required(
      env.VOICY_WORKER_TRANSCRIBE_COMMAND,
      'VOICY_WORKER_TRANSCRIBE_COMMAND'
    ),
    workDir: env.VOICY_WORKER_WORK_DIR || DEFAULT_WORK_DIR,
    pollIntervalMs: numberFromEnv(
      env.VOICY_WORKER_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
      'VOICY_WORKER_POLL_INTERVAL_MS'
    ),
    heartbeatIntervalMs: numberFromEnv(
      env.VOICY_WORKER_HEARTBEAT_INTERVAL_MS,
      DEFAULT_HEARTBEAT_INTERVAL_MS,
      'VOICY_WORKER_HEARTBEAT_INTERVAL_MS'
    ),
    downloadTimeoutMs: numberFromEnv(
      env.VOICY_WORKER_DOWNLOAD_TIMEOUT_MS,
      DEFAULT_DOWNLOAD_TIMEOUT_MS,
      'VOICY_WORKER_DOWNLOAD_TIMEOUT_MS'
    ),
    idleExit: booleanFromEnv(env.VOICY_WORKER_IDLE_EXIT),
    language: env.VOICY_WORKER_LANGUAGE,
    engine: env.VOICY_WORKER_ENGINE || 'faster-whisper',
    model: env.VOICY_WORKER_MODEL,
  }
}

function createApi(config: WorkerConfig) {
  return axios.create({
    baseURL: config.apiUrl,
    headers: { Authorization: `Bearer ${config.token}` },
    timeout: config.downloadTimeoutMs,
  })
}

async function claimJob(api: AxiosInstance) {
  const response = await api.post('/jobs/claim', undefined, {
    validateStatus: (status) => status === 200 || status === 204,
  })
  if (response.status === 204) {
    return undefined
  }
  return (response.data as ClaimResponse).job
}

async function getSource(api: AxiosInstance, jobId: string) {
  const response = await api.get(`/jobs/${jobId}/source`)
  return (response.data as SourceResponse).source
}

function extensionForSource(source: WorkerSource) {
  if (source.mimeType === 'audio/mpeg') {
    return '.mp3'
  }
  if (source.mimeType === 'audio/wav' || source.mimeType === 'audio/x-wav') {
    return '.wav'
  }
  if (source.mimeType === 'audio/mp4') {
    return '.m4a'
  }
  if (source.sourceKind === 'video_note') {
    return '.mp4'
  }
  const urlPath = new URL(source.sourceUrl).pathname
  const ext = path.extname(urlPath)
  return ext || '.ogg'
}

async function removeIfExists(filePath: string) {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
  })
}

async function downloadSource(
  api: AxiosInstance,
  config: WorkerConfig,
  job: WorkerJob,
  source: WorkerSource
) {
  await mkdir(config.workDir, { recursive: true })
  const inputPath = path.join(
    config.workDir,
    `${job.id}${extensionForSource(source)}`
  )
  await removeIfExists(inputPath)
  const response = await api.get(source.sourceUrl, {
    baseURL: undefined,
    responseType: 'stream',
    timeout: config.downloadTimeoutMs,
  })
  await streamPipeline(response.data as Readable, createWriteStream(inputPath))
  return inputPath
}

function quoteShellValue(value: string) {
  return JSON.stringify(value)
}

function commandForJob(
  config: WorkerConfig,
  inputPath: string,
  outputPath: string,
  language?: string
) {
  return config.transcribeCommand
    .replace(/\{input\}/g, quoteShellValue(inputPath))
    .replace(/\{output\}/g, quoteShellValue(outputPath))
    .replace(/\{language\}/g, quoteShellValue(language || ''))
}

function runCommand(command: string): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, windowsHide: true })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      if (code !== 0) {
        reject(
          new WorkerClientError(
            `Transcription command exited with ${code}: ${stderr || stdout}`
          )
        )
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function parseJsonOutput(value: string) {
  try {
    return JSON.parse(value) as Partial<TranscriptionOutput>
  } catch {
    return undefined
  }
}

function normalizeTranscriptionOutput(
  rawOutput: string,
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string
) {
  const parsed = parseJsonOutput(rawOutput.trim())
  const text = parsed?.text || rawOutput.trim()

  if (!text) {
    throw new WorkerClientError('Transcription command produced no text', false)
  }

  return {
    text,
    parts: parsed?.parts,
    language:
      parsed?.language ||
      job.recognitionLanguageHint ||
      config.language ||
      undefined,
    duration: parsed?.duration,
    engine: config.engine,
    metadata: {
      ...(parsed?.metadata || {}),
      engine: config.engine,
      model: config.model,
      sourceKind: job.sourceKind,
      attempts: job.attempts,
      inputFile: path.basename(inputPath),
    },
  }
}

async function readTranscriptionOutput(
  commandResult: RunCommandResult,
  outputPath: string,
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string
) {
  const outputStat = await stat(outputPath).catch(() => undefined)
  const rawOutput = outputStat
    ? await readFile(outputPath, 'utf8')
    : commandResult.stdout
  return normalizeTranscriptionOutput(rawOutput, config, job, inputPath)
}

async function transcribeJob(
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string
) {
  const outputPath = path.join(config.workDir, `${job.id}.transcript.json`)
  await removeIfExists(outputPath)
  const language = job.recognitionLanguageHint || config.language
  const command = commandForJob(config, inputPath, outputPath, language)
  const commandResult = await runCommand(command)
  return readTranscriptionOutput(
    commandResult,
    outputPath,
    config,
    job,
    inputPath
  )
}

async function failJob(
  api: AxiosInstance,
  jobId: string,
  error: unknown,
  logger: Logger
) {
  const retryable = error instanceof WorkerClientError ? error.retryable : true
  const message = error instanceof Error ? error.message : String(error)
  logger.warn(`Reporting job ${jobId} failure: ${message}`)
  await api.post(`/jobs/${jobId}/failure`, { error: message, retryable })
}

function startHeartbeat(
  api: AxiosInstance,
  jobId: string,
  intervalMs: number,
  logger: Logger
) {
  if (intervalMs <= 0) {
    return undefined
  }
  return setInterval(() => {
    api.post(`/jobs/${jobId}/heartbeat`).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`Heartbeat failed for job ${jobId}: ${message}`)
    })
  }, intervalMs)
}

export async function processNextJob(
  config: WorkerConfig,
  logger: Logger = consoleLogger
) {
  const api = createApi(config)
  const job = await claimJob(api)
  if (!job) {
    return false
  }

  logger.info(`Claimed transcription job ${job.id}`)
  const heartbeat = startHeartbeat(
    api,
    job.id,
    config.heartbeatIntervalMs,
    logger
  )

  try {
    const source = await getSource(api, job.id)
    const inputPath = await downloadSource(api, config, job, source)
    const result = await transcribeJob(config, job, inputPath)
    await api.post(`/jobs/${job.id}/result`, result)
    logger.info(`Completed transcription job ${job.id}`)
    return true
  } catch (error) {
    await failJob(api, job.id, error, logger)
    return true
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat)
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runWorker(
  config: WorkerConfig = loadConfig(),
  logger: Logger = consoleLogger
) {
  logger.info(`Starting Voicy worker client against ${config.apiUrl}`)
  let stopped = false
  const stop = () => {
    stopped = true
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  while (!stopped) {
    const processed = await processNextJob(config, logger)
    if (!processed && config.idleExit) {
      logger.info(
        'No queued jobs; exiting because VOICY_WORKER_IDLE_EXIT is set'
      )
      break
    }
    if (!processed) {
      await delay(config.pollIntervalMs)
    }
  }
}

if (require.main === module) {
  runWorker().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
