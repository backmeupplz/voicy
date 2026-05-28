import * as path from 'path'
import { Readable } from 'stream'
import { URL } from 'url'
import { copyFile, mkdir, readFile, stat, unlink } from 'fs/promises'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { redactSensitiveText } from '../helpers/report'
import { spawn } from 'child_process'
import axios, { AxiosInstance } from 'axios'

const streamPipeline = promisify(pipeline)

const DEFAULT_POLL_INTERVAL_MS = 5000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 300000
const DEFAULT_RESTART_DELAY_MS = 10000
const DEFAULT_WORK_DIR = path.join(process.cwd(), 'tmp', 'voicy-worker')
const DEFAULT_WORKER_MODEL = 'large-v3'
const COMMAND_OUTPUT_CAPTURE_LIMIT_BYTES = 1024 * 1024
const MAX_TRANSCRIPTION_OUTPUT_BYTES = COMMAND_OUTPUT_CAPTURE_LIMIT_BYTES
const MAX_TRANSCRIPTION_RESULT_TEXT_CHARS = 100000
const MAX_TRANSCRIPTION_RESULT_PARTS = 5000
const TRANSCRIPTION_RESULT_LOG_CHARS = 2000

type WorkerQueueBucket = 'oldest' | 'newest'

interface WorkerJob {
  id: string
  status: string
  chatId?: string
  telegramChatId?: string
  telegramChatType?: string
  sourceMessageId?: number
  sourceUrl?: string
  sourceKind?: string
  mimeType?: string
  fileSize?: number
  localSourcePath?: string
  recognitionLanguageHint?: string
  attempts?: number
}

interface ClaimResponse {
  job: WorkerJob
}

interface WorkerSource {
  sourceUrl?: string
  sourceKind?: string
  mimeType?: string
  fileName?: string
  fileId?: string
  fileUniqueId?: string
  filePath?: string
  localSourcePath?: string
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
  transcribeExecutable: string
  transcribeArgs: string[]
  workDir: string
  pollIntervalMs: number
  heartbeatIntervalMs: number
  downloadTimeoutMs: number
  restartDelayMs: number
  downloadConcurrency: number
  transcriptionConcurrency: number
  readyQueueLimit: number
  telegramBotApiUrl: string
  telegramBotToken?: string
  idleExit: boolean
  language?: string
  engine: string
  model: string
}

interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

interface RunCommandResult {
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  stdoutTruncated: boolean
  stderrTruncated: boolean
  elapsedMs: number
  exitCode: number | null
}

interface DownloadedJob {
  job: WorkerJob
  inputPath: string
  schedulingBucket?: WorkerQueueBucket | 'recovered'
}

interface ResolvedSource {
  sourceUrl?: string
  localPath?: string
}

interface HeartbeatHandle {
  isStale: () => boolean
  stop: () => void
}

const consoleLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
}

type LogValue = string | number | boolean | undefined

const staleWorkerJobErrorCodes = new Set([
  'job_not_found',
  'job_not_owned',
  'job_not_active',
  'job_cancelled',
])

function formatLogValue(value: LogValue) {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  return String(value)
}

function formatLogContext(context: Record<string, LogValue>) {
  return Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatLogValue(value)}`)
    .join(' ')
}

function logWorkerActivity(
  logger: Logger,
  message: string,
  context: Record<string, LogValue>
) {
  const formattedContext = formatLogContext(context)
  logger.info(formattedContext ? `${message} ${formattedContext}` : message)
}

function backendErrorCode(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return undefined
  }
  const data = error.response?.data
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const code = (data as { error?: unknown }).error
  return typeof code === 'string' ? code : undefined
}

function isStaleWorkerJobError(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) {
    return false
  }
  const code = backendErrorCode(error)
  return code ? staleWorkerJobErrorCodes.has(code) : false
}

function logStaleWorkerJob(
  logger: Logger,
  job: WorkerJob,
  phase: string,
  action: string,
  error: unknown
) {
  logWorkerActivity(logger, 'Worker stale job ignored', {
    ...jobLogContext(job),
    phase,
    action,
    backendError: backendErrorCode(error) || 'unknown',
  })
}

function jobLogContext(job: WorkerJob): Record<string, LogValue> {
  return {
    jobId: job.id,
    chatId: job.chatId,
    telegramChatId: job.telegramChatId,
    telegramChatType: job.telegramChatType,
    sourceMessageId: job.sourceMessageId,
    sourceKind: job.sourceKind,
    fileSize: job.fileSize,
    language: job.recognitionLanguageHint,
    attempts: job.attempts,
  }
}

function transcriptionResultLogContext(
  job: WorkerJob,
  result: TranscriptionOutput,
  config: WorkerConfig,
  elapsedMs: number
): Record<string, LogValue> {
  return {
    ...jobLogContext(job),
    engine: config.engine,
    model: config.model,
    detectedLanguage: result.language,
    elapsedMs,
    textChars: result.text.length,
    emptyResult: result.text.length === 0,
    parts: result.parts?.length || 0,
    duration: result.duration,
  }
}

function transcriptionResultTextForLog(result: TranscriptionOutput) {
  const truncated = result.text.length > TRANSCRIPTION_RESULT_LOG_CHARS
  const preview = truncated
    ? result.text.slice(0, TRANSCRIPTION_RESULT_LOG_CHARS)
    : result.text
  const redactedPreview = redactSensitiveText(preview)
  return truncated
    ? `${redactedPreview}... [truncated; textChars=${result.text.length}]`
    : redactedPreview
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

function stringArrayFromJsonEnv(
  value: string | undefined,
  name: string
): string[] {
  if (!value) {
    throw new Error(`${name} is required`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${name} must be a JSON array of strings: ${message}`)
  }

  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== 'string')
  ) {
    throw new Error(`${name} must be a JSON array of strings`)
  }

  return parsed
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  if (
    env.VOICY_WORKER_TRANSCRIBE_COMMAND &&
    !env.VOICY_WORKER_TRANSCRIBE_EXECUTABLE
  ) {
    throw new Error(
      'VOICY_WORKER_TRANSCRIBE_COMMAND shell templates are no longer supported; set VOICY_WORKER_TRANSCRIBE_EXECUTABLE and VOICY_WORKER_TRANSCRIBE_ARGS_JSON'
    )
  }

  const downloadConcurrency = Math.max(
    1,
    numberFromEnv(
      env.VOICY_WORKER_DOWNLOAD_CONCURRENCY,
      2,
      'VOICY_WORKER_DOWNLOAD_CONCURRENCY'
    )
  )
  const transcriptionConcurrency = Math.max(
    1,
    numberFromEnv(
      env.VOICY_WORKER_TRANSCRIPTION_CONCURRENCY,
      1,
      'VOICY_WORKER_TRANSCRIPTION_CONCURRENCY'
    )
  )

  return {
    apiUrl: required(env.VOICY_WORKER_API_URL, 'VOICY_WORKER_API_URL').replace(
      /\/+$/,
      ''
    ),
    token: required(env.VOICY_WORKER_TOKEN, 'VOICY_WORKER_TOKEN'),
    transcribeExecutable: required(
      env.VOICY_WORKER_TRANSCRIBE_EXECUTABLE,
      'VOICY_WORKER_TRANSCRIBE_EXECUTABLE'
    ),
    transcribeArgs: stringArrayFromJsonEnv(
      env.VOICY_WORKER_TRANSCRIBE_ARGS_JSON,
      'VOICY_WORKER_TRANSCRIBE_ARGS_JSON'
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
    restartDelayMs: numberFromEnv(
      env.VOICY_WORKER_RESTART_DELAY_MS,
      DEFAULT_RESTART_DELAY_MS,
      'VOICY_WORKER_RESTART_DELAY_MS'
    ),
    downloadConcurrency,
    transcriptionConcurrency,
    readyQueueLimit: Math.max(
      1,
      numberFromEnv(
        env.VOICY_WORKER_READY_QUEUE_LIMIT,
        Math.max(downloadConcurrency, transcriptionConcurrency * 2),
        'VOICY_WORKER_READY_QUEUE_LIMIT'
      )
    ),
    telegramBotApiUrl: (
      env.VOICY_WORKER_TELEGRAM_API_URL || 'https://api.telegram.org'
    ).replace(/\/+$/, ''),
    telegramBotToken: env.VOICY_WORKER_TELEGRAM_BOT_TOKEN || env.TOKEN,
    idleExit: booleanFromEnv(env.VOICY_WORKER_IDLE_EXIT),
    language: env.VOICY_WORKER_LANGUAGE,
    engine: env.VOICY_WORKER_ENGINE || 'faster-whisper',
    model:
      env.VOICY_WORKER_MODEL || env.VOICY_WHISPER_MODEL || DEFAULT_WORKER_MODEL,
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

async function claimDownloadJobFromBucket(
  api: AxiosInstance,
  bucket: WorkerQueueBucket
) {
  const response = await api.post(
    '/jobs/claim-download',
    { bucket },
    {
      validateStatus: (status) => status === 200 || status === 204,
    }
  )
  if (response.status === 204) {
    return undefined
  }
  return (response.data as ClaimResponse).job
}

async function claimReadyJob(
  api: AxiosInstance,
  bucket: WorkerQueueBucket = 'oldest'
) {
  const response = await api.post(
    '/jobs/claim-ready',
    { bucket },
    {
      validateStatus: (status) =>
        status === 200 || status === 204 || status === 404,
    }
  )
  if (response.status !== 200) {
    return undefined
  }
  return (response.data as ClaimResponse).job
}

async function getSource(api: AxiosInstance, jobId: string) {
  const response = await api.get(`/jobs/${jobId}/source`)
  return (response.data as SourceResponse).source
}

async function markDownloaded(
  api: AxiosInstance,
  jobId: string,
  inputPath: string
) {
  const response = await api.post(`/jobs/${jobId}/downloaded`, {
    localSourcePath: inputPath,
  })
  return (response.data as ClaimResponse).job
}

async function startTranscription(api: AxiosInstance, jobId: string) {
  const response = await api.post(`/jobs/${jobId}/transcribe`)
  return (response.data as ClaimResponse).job
}

const extensionByMimeType: Record<string, string> = {
  'audio/aac': '.aac',
  'audio/aiff': '.aiff',
  'audio/amr': '.amr',
  'audio/flac': '.flac',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/x-aiff': '.aiff',
  'audio/x-m4a': '.m4a',
  'audio/x-ms-wma': '.wma',
  'audio/x-wav': '.wav',
  'video/3gpp': '.3gp',
  'video/mp4': '.mp4',
  'video/mpeg': '.mpeg',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-m4v': '.m4v',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
}

export function extensionForSource(source: WorkerSource) {
  const mimeType = source.mimeType?.toLowerCase().split(';')[0].trim()
  if (mimeType && extensionByMimeType[mimeType]) {
    return extensionByMimeType[mimeType]
  }
  if (source.fileName) {
    const fileNameExt = path.extname(source.fileName)
    if (fileNameExt) {
      return fileNameExt.toLowerCase()
    }
  }
  if (source.sourceKind === 'video_note' || source.sourceKind === 'video') {
    return '.mp4'
  }
  if (source.sourceUrl) {
    const urlPath = new URL(source.sourceUrl).pathname
    const ext = path.extname(urlPath)
    return ext || '.ogg'
  }
  if (source.filePath) {
    const ext = path.extname(source.filePath)
    return ext || '.ogg'
  }
  return '.ogg'
}

function isLoopbackHost(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  )
}

function isAbsoluteFilePath(filePath: string) {
  return path.isAbsolute(filePath) || path.win32.isAbsolute(filePath)
}

function canUseLocalTelegramFilePath(config: WorkerConfig, filePath: string) {
  const telegramApi = new URL(config.telegramBotApiUrl)
  return isLoopbackHost(telegramApi.hostname) && isAbsoluteFilePath(filePath)
}

function assertAllowedSourceUrl(sourceUrl: string, config: WorkerConfig) {
  const parsed = new URL(sourceUrl)
  const api = new URL(config.apiUrl)
  const telegramApi = new URL(config.telegramBotApiUrl)
  if (
    parsed.origin === telegramApi.origin &&
    (parsed.protocol === 'https:' || isLoopbackHost(parsed.hostname))
  ) {
    return
  }
  if (isLoopbackHost(parsed.hostname) && isLoopbackHost(api.hostname)) {
    return
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.telegram.org') {
    throw new WorkerClientError('Worker source URL is not allowed', false)
  }
}

async function removeIfExists(filePath: string) {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
  })
}

function telegramFileUrl(config: WorkerConfig, filePath: string) {
  if (!config.telegramBotToken) {
    throw new WorkerClientError(
      'VOICY_WORKER_TELEGRAM_BOT_TOKEN or TOKEN is required to download Telegram media',
      false
    )
  }
  const encodedPath = filePath
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `${config.telegramBotApiUrl}/file/bot${config.telegramBotToken}/${encodedPath}`
}

async function resolveSource(
  config: WorkerConfig,
  source: WorkerSource
): Promise<ResolvedSource> {
  if (source.sourceUrl) {
    return { sourceUrl: source.sourceUrl }
  }
  if (source.filePath) {
    if (canUseLocalTelegramFilePath(config, source.filePath)) {
      return { localPath: source.filePath }
    }
    return { sourceUrl: telegramFileUrl(config, source.filePath) }
  }
  if (!source.fileId) {
    throw new WorkerClientError('Job source has no URL or Telegram file id')
  }
  if (!config.telegramBotToken) {
    throw new WorkerClientError(
      'VOICY_WORKER_TELEGRAM_BOT_TOKEN or TOKEN is required to resolve Telegram file ids',
      false
    )
  }
  const response = await axios.get(
    `${config.telegramBotApiUrl}/bot${config.telegramBotToken}/getFile`,
    {
      params: { file_id: source.fileId },
      timeout: config.downloadTimeoutMs,
    }
  )
  const filePath = response.data?.result?.file_path
  if (typeof filePath !== 'string' || !filePath) {
    throw new WorkerClientError(
      'Telegram getFile response did not include file_path'
    )
  }
  if (canUseLocalTelegramFilePath(config, filePath)) {
    return { localPath: filePath }
  }
  return { sourceUrl: telegramFileUrl(config, filePath) }
}

async function downloadSource(
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
  const resolved = await resolveSource(config, source)
  if (resolved.localPath) {
    await copyFile(resolved.localPath, inputPath)
    return inputPath
  }
  if (!resolved.sourceUrl) {
    throw new WorkerClientError('Job source did not resolve to a file')
  }
  assertAllowedSourceUrl(resolved.sourceUrl, config)
  const response = await axios.get(resolved.sourceUrl, {
    responseType: 'stream',
    timeout: config.downloadTimeoutMs,
  })
  await streamPipeline(response.data as Readable, createWriteStream(inputPath))
  return inputPath
}

function commandArgsForJob(
  config: WorkerConfig,
  inputPath: string,
  outputPath: string,
  language?: string
) {
  return config.transcribeArgs.map((arg) =>
    arg
      .replace(/\{input\}/g, () => inputPath)
      .replace(/\{output\}/g, () => outputPath)
      .replace(/\{language\}/g, () => language || '')
      .replace(/\{model\}/g, () => config.model)
  )
}

function commandEnv(config: WorkerConfig) {
  return {
    ...process.env,
    VOICY_WORKER_MODEL: config.model,
    VOICY_WHISPER_MODEL: config.model,
  }
}

function runCommand(
  executable: string,
  args: string[],
  config: WorkerConfig
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      env: commandEnv(config),
    })
    const stdoutCapture = createBoundedOutputCapture()
    const stderrCapture = createBoundedOutputCapture()

    child.stdout.on('data', (chunk) => stdoutCapture.append(chunk))
    child.stderr.on('data', (chunk) => stderrCapture.append(chunk))
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new WorkerClientError(
            `Unable to start transcription executable "${executable}". Set VOICY_WORKER_TRANSCRIBE_EXECUTABLE to an absolute executable path or include it in PATH.`,
            false
          )
        )
        return
      }
      reject(error)
    })
    child.on('close', (code) => {
      const elapsedMs = Date.now() - startedAt
      resolve({
        stdout: stdoutCapture.text(),
        stderr: stderrCapture.text(),
        stdoutBytes: stdoutCapture.bytes,
        stderrBytes: stderrCapture.bytes,
        stdoutTruncated: stdoutCapture.truncated,
        stderrTruncated: stderrCapture.truncated,
        elapsedMs,
        exitCode: code,
      })
    })
  })
}

function commandFailureMessage(commandResult: RunCommandResult) {
  return `Transcription command exited with ${commandResult.exitCode}; stdoutChars=${commandResult.stdout.length}; stderrChars=${commandResult.stderr.length}; stdoutBytes=${commandResult.stdoutBytes}; stderrBytes=${commandResult.stderrBytes}; stdoutTruncated=${commandResult.stdoutTruncated}; stderrTruncated=${commandResult.stderrTruncated}`
}

function createBoundedOutputCapture() {
  const chunks: Buffer[] = []
  let capturedBytes = 0
  let totalBytes = 0

  return {
    get bytes() {
      return totalBytes
    },
    get truncated() {
      return totalBytes > capturedBytes
    },
    append(chunk: Buffer | string) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.length
      const remaining = COMMAND_OUTPUT_CAPTURE_LIMIT_BYTES - capturedBytes
      if (remaining <= 0) {
        return
      }
      const captured =
        buffer.length > remaining ? buffer.subarray(0, remaining) : buffer
      chunks.push(Buffer.from(captured))
      capturedBytes += captured.length
    },
    text() {
      return Buffer.concat(chunks, capturedBytes).toString('utf8')
    },
  }
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
  const text = typeof parsed?.text === 'string' ? parsed.text : rawOutput.trim()

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

function assertSafeTranscriptionOutput(
  result: ReturnType<typeof normalizeTranscriptionOutput>
) {
  if (result.text.length > MAX_TRANSCRIPTION_RESULT_TEXT_CHARS) {
    throw new WorkerClientError(
      `Transcription result text is too large to upload safely; textChars=${result.text.length}; maxTextChars=${MAX_TRANSCRIPTION_RESULT_TEXT_CHARS}`,
      false
    )
  }
  if (
    Array.isArray(result.parts) &&
    result.parts.length > MAX_TRANSCRIPTION_RESULT_PARTS
  ) {
    throw new WorkerClientError(
      `Transcription result has too many parts to upload safely; parts=${result.parts.length}; maxParts=${MAX_TRANSCRIPTION_RESULT_PARTS}`,
      false
    )
  }
}

async function readTranscriptionOutput(
  commandResult: RunCommandResult,
  outputPath: string,
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string,
  logger: Logger
) {
  const outputStat = await stat(outputPath).catch(() => undefined)
  let rawOutput: string
  let outputSource: 'file' | 'stdout'
  if (outputStat) {
    if (outputStat.size > MAX_TRANSCRIPTION_OUTPUT_BYTES) {
      throw new WorkerClientError(
        `Transcription output file is too large to parse safely; outputBytes=${outputStat.size}; maxBytes=${MAX_TRANSCRIPTION_OUTPUT_BYTES}`,
        false
      )
    }
    rawOutput = await readFile(outputPath, 'utf8')
    outputSource = 'file'
  } else {
    if (commandResult.stdoutTruncated) {
      throw new WorkerClientError(
        `Transcription command stdout exceeded safe capture limit; stdoutBytes=${commandResult.stdoutBytes}; configure the transcriber to write the final transcript to {output}`,
        false
      )
    }
    rawOutput = commandResult.stdout
    outputSource = 'stdout'
  }
  const result = normalizeTranscriptionOutput(rawOutput, config, job, inputPath)
  assertSafeTranscriptionOutput(result)
  logWorkerActivity(logger, 'Worker transcription command completed', {
    jobId: job.id,
    engine: config.engine,
    model: config.model,
    language: result.language,
    elapsedMs: commandResult.elapsedMs,
    exitCode:
      commandResult.exitCode && commandResult.exitCode !== 0
        ? commandResult.exitCode
        : undefined,
    outputSource,
    stdoutBytes: commandResult.stdoutBytes,
    stderrBytes: commandResult.stderrBytes,
    stdoutTruncated: commandResult.stdoutTruncated || undefined,
    stderrTruncated: commandResult.stderrTruncated || undefined,
    textChars: result.text.length,
    parts: result.parts?.length || 0,
    duration: result.duration,
  })
  return result
}

async function transcribeJob(
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string,
  logger: Logger
) {
  const outputPath = path.join(config.workDir, `${job.id}.transcript.json`)
  await removeIfExists(outputPath)
  const language = job.recognitionLanguageHint || config.language
  const args = commandArgsForJob(config, inputPath, outputPath, language)
  logWorkerActivity(logger, 'Worker transcription command starting', {
    jobId: job.id,
    engine: config.engine,
    model: config.model,
    language,
    sourceKind: job.sourceKind,
    attempts: job.attempts,
    inputFile: path.basename(inputPath),
    outputFile: path.basename(outputPath),
  })
  const commandResult = await runCommand(
    config.transcribeExecutable,
    args,
    config
  )
  if (commandResult.exitCode !== 0) {
    const rawOutput = await readFile(outputPath, 'utf8').catch(() => undefined)
    const parsed = rawOutput ? parseJsonOutput(rawOutput.trim()) : undefined
    if (!parsed || typeof parsed.text !== 'string') {
      throw new WorkerClientError(commandFailureMessage(commandResult))
    }
  }
  return readTranscriptionOutput(
    commandResult,
    outputPath,
    config,
    job,
    inputPath,
    logger
  )
}

async function failJob(
  api: AxiosInstance,
  jobId: string,
  job: WorkerJob,
  error: unknown,
  logger: Logger
) {
  const retryable = error instanceof WorkerClientError ? error.retryable : true
  const message = redactSensitiveText(
    error instanceof Error ? error.message : String(error)
  )
  logger.warn(`Reporting job ${jobId} failure: ${message}`)
  try {
    await api.post(`/jobs/${jobId}/failure`, { error: message, retryable })
  } catch (failureError) {
    if (isStaleWorkerJobError(failureError)) {
      logStaleWorkerJob(
        logger,
        job,
        'failure_report',
        'report_failure',
        failureError
      )
      return
    }
    throw failureError
  }
}

function startHeartbeat(
  api: AxiosInstance,
  job: WorkerJob,
  intervalMs: number,
  logger: Logger
): HeartbeatHandle | undefined {
  if (intervalMs <= 0) {
    return undefined
  }
  let stale = false
  const timer = setInterval(() => {
    api.post(`/jobs/${job.id}/heartbeat`).catch((error) => {
      if (isStaleWorkerJobError(error)) {
        stale = true
        logStaleWorkerJob(logger, job, 'heartbeat', 'heartbeat', error)
        clearInterval(timer)
        return
      }
      const message = redactSensitiveText(
        error instanceof Error ? error.message : String(error)
      )
      logger.warn(`Heartbeat failed for job ${job.id}: ${message}`)
    })
  }, intervalMs)
  return {
    isStale: () => stale,
    stop: () => clearInterval(timer),
  }
}

export async function processNextJob(
  config: WorkerConfig,
  logger: Logger = consoleLogger
) {
  const processed = await processAvailableJobs(config, logger)
  return processed > 0
}

async function downloadJob(
  api: AxiosInstance,
  config: WorkerConfig,
  job: WorkerJob,
  logger: Logger
): Promise<DownloadedJob | undefined> {
  const startedAt = Date.now()
  logWorkerActivity(
    logger,
    'Worker media download job claimed',
    jobLogContext(job)
  )
  const heartbeat = startHeartbeat(api, job, config.heartbeatIntervalMs, logger)

  try {
    let source: WorkerSource
    try {
      source = await getSource(api, job.id)
    } catch (error) {
      if (isStaleWorkerJobError(error)) {
        logStaleWorkerJob(logger, job, 'download', 'get_source', error)
        return undefined
      }
      throw error
    }
    const inputPath = await downloadSource(config, job, source)
    if (heartbeat?.isStale()) {
      logWorkerActivity(logger, 'Worker media download result dropped', {
        ...jobLogContext(job),
        phase: 'mark_downloaded',
        action: 'drop_after_stale_heartbeat',
        inputFile: path.basename(inputPath),
      })
      return undefined
    }
    let readyJob: WorkerJob
    try {
      readyJob = await markDownloaded(api, job.id, inputPath)
    } catch (error) {
      if (isStaleWorkerJobError(error)) {
        logStaleWorkerJob(logger, job, 'download', 'mark_downloaded', error)
        return undefined
      }
      throw error
    }
    logWorkerActivity(logger, 'Worker media download completed', {
      ...jobLogContext(readyJob),
      elapsedMs: Date.now() - startedAt,
      inputFile: path.basename(inputPath),
    })
    return { job: readyJob, inputPath }
  } catch (error) {
    const retryable =
      error instanceof WorkerClientError ? error.retryable : true
    logWorkerActivity(logger, 'Worker media download failed', {
      ...jobLogContext(job),
      elapsedMs: Date.now() - startedAt,
      retryable,
    })
    if (heartbeat?.isStale()) {
      logWorkerActivity(logger, 'Worker media download failure dropped', {
        ...jobLogContext(job),
        phase: 'failure_report',
        action: 'drop_after_stale_heartbeat',
      })
      return undefined
    }
    await failJob(api, job.id, job, error, logger)
    return undefined
  } finally {
    if (heartbeat) {
      heartbeat.stop()
    }
  }
}

async function transcribeDownloadedJob(
  api: AxiosInstance,
  config: WorkerConfig,
  downloaded: DownloadedJob,
  logger: Logger
) {
  const startedAt = Date.now()
  let job: WorkerJob
  try {
    job = ['processing', 'transcribing'].includes(downloaded.job.status)
      ? downloaded.job
      : await startTranscription(api, downloaded.job.id)
  } catch (error) {
    if (isStaleWorkerJobError(error)) {
      logStaleWorkerJob(
        logger,
        downloaded.job,
        'transcription',
        'start_transcription',
        error
      )
      return
    }
    throw error
  }
  logWorkerActivity(logger, 'Worker transcription job started', {
    ...jobLogContext(job),
    engine: config.engine,
    model: config.model,
    inputFile: path.basename(downloaded.inputPath),
  })
  const heartbeat = startHeartbeat(api, job, config.heartbeatIntervalMs, logger)

  try {
    const result = await transcribeJob(
      config,
      job,
      downloaded.inputPath,
      logger
    )
    logWorkerActivity(logger, 'Worker transcription result uploading', {
      ...transcriptionResultLogContext(
        job,
        result,
        config,
        Date.now() - startedAt
      ),
    })
    if (heartbeat?.isStale()) {
      logWorkerActivity(logger, 'Worker transcription result dropped', {
        ...jobLogContext(job),
        phase: 'result_upload',
        action: 'drop_after_stale_heartbeat',
        textChars: result.text.length,
      })
      return
    }
    try {
      await api.post(`/jobs/${job.id}/result`, result)
    } catch (error) {
      if (isStaleWorkerJobError(error)) {
        logStaleWorkerJob(logger, job, 'result_upload', 'upload_result', error)
        return
      }
      throw error
    }
    logWorkerActivity(logger, 'Worker transcription job completed', {
      ...transcriptionResultLogContext(
        job,
        result,
        config,
        Date.now() - startedAt
      ),
      transcriptionResult: transcriptionResultTextForLog(result),
    })
  } catch (error) {
    const retryable =
      error instanceof WorkerClientError ? error.retryable : true
    logWorkerActivity(logger, 'Worker transcription job failed', {
      ...jobLogContext(job),
      engine: config.engine,
      model: config.model,
      elapsedMs: Date.now() - startedAt,
      retryable,
    })
    if (heartbeat?.isStale()) {
      logWorkerActivity(logger, 'Worker transcription failure dropped', {
        ...jobLogContext(job),
        phase: 'failure_report',
        action: 'drop_after_stale_heartbeat',
      })
      return
    }
    await failJob(api, job.id, job, error, logger)
  } finally {
    if (heartbeat) {
      heartbeat.stop()
    }
  }
}

export async function processAvailableJobs(
  config: WorkerConfig,
  logger: Logger = consoleLogger
) {
  const api = createApi(config)
  const readyQueues: Record<WorkerQueueBucket | 'recovered', DownloadedJob[]> =
    {
      oldest: [],
      newest: [],
      recovered: [],
    }
  const downloads = new Set<Promise<void>>()
  const transcriptions = new Set<Promise<void>>()
  const activeDownloadBuckets: Record<WorkerQueueBucket, number> = {
    oldest: 0,
    newest: 0,
  }
  let downloadQueueExhausted = false
  let recheckDownloadsAfterTranscription = false
  let hasObservedDownloadExhaustion = false
  let nextDownloadBucket: WorkerQueueBucket = 'oldest'
  let nextTranscriptionBucket: WorkerQueueBucket = 'oldest'
  let processed = 0

  const queuedReadyCount = () =>
    readyQueues.oldest.length +
    readyQueues.newest.length +
    readyQueues.recovered.length

  const queueReadyJob = (ready: DownloadedJob) => {
    const bucket = ready.schedulingBucket || 'oldest'
    readyQueues[bucket].push(ready)
    fillTranscriptions()
  }

  const startDownload = async (job: WorkerJob, bucket: WorkerQueueBucket) => {
    const ready = await downloadJob(api, config, job, logger)
    if (ready) {
      queueReadyJob({ ...ready, schedulingBucket: bucket })
    }
  }

  const fillDownloads = async () => {
    while (
      !downloadQueueExhausted &&
      downloads.size < config.downloadConcurrency &&
      queuedReadyCount() < config.readyQueueLimit
    ) {
      const bucket = nextDownloadBucket
      const job = await claimDownloadJobFromBucket(api, bucket)
      if (!job) {
        downloadQueueExhausted = true
        hasObservedDownloadExhaustion = true
        recheckDownloadsAfterTranscription = queuedReadyCount() > 0
        if (recheckDownloadsAfterTranscription) {
          nextDownloadBucket = 'newest'
        }
        logWorkerActivity(logger, 'Worker download queue exhausted', {
          queuedReadyJobs: queuedReadyCount(),
          activeDownloads: downloads.size,
          activeTranscriptions: transcriptions.size,
        })
        return
      }
      const schedulingBucket = hasObservedDownloadExhaustion ? bucket : 'oldest'
      processed += 1
      logWorkerActivity(logger, 'Worker download scheduler selected job', {
        ...jobLogContext(job),
        claimBucket: bucket,
        schedulingBucket,
        queuedReadyJobs: queuedReadyCount(),
      })
      nextDownloadBucket = bucket === 'oldest' ? 'newest' : 'oldest'
      activeDownloadBuckets[schedulingBucket] += 1
      const task = startDownload(job, schedulingBucket).finally(() => {
        activeDownloadBuckets[schedulingBucket] -= 1
        downloads.delete(task)
      })
      downloads.add(task)
    }
  }

  const fillRecoveredReadyJobs = async () => {
    while (
      transcriptions.size + queuedReadyCount() <
      config.transcriptionConcurrency
    ) {
      const job = await claimReadyJob(api, 'oldest')
      if (!job?.localSourcePath) {
        return
      }
      processed += 1
      logWorkerActivity(logger, 'Worker recovered ready job selected', {
        ...jobLogContext(job),
        schedulingBucket: 'recovered',
        inputFile: path.basename(job.localSourcePath),
      })
      queueReadyJob({
        job,
        inputPath: job.localSourcePath,
        schedulingBucket: 'recovered',
      })
    }
  }

  const takeNextReadyJob = () => {
    const preferred = nextTranscriptionBucket
    const alternate = preferred === 'oldest' ? 'newest' : 'oldest'
    const bucket =
      readyQueues[preferred].length > 0
        ? preferred
        : readyQueues[alternate].length > 0
        ? alternate
        : 'recovered'
    const ready = readyQueues[bucket].shift()
    if (ready && bucket !== 'recovered') {
      nextTranscriptionBucket = bucket === 'oldest' ? 'newest' : 'oldest'
      return ready
    }
    return ready
  }

  const fillTranscriptions = () => {
    while (
      queuedReadyCount() > 0 &&
      transcriptions.size < config.transcriptionConcurrency
    ) {
      const alternate =
        nextTranscriptionBucket === 'oldest' ? 'newest' : 'oldest'
      if (
        readyQueues[nextTranscriptionBucket].length === 0 &&
        activeDownloadBuckets[nextTranscriptionBucket] > 0 &&
        (readyQueues[alternate].length > 0 || readyQueues.recovered.length > 0)
      ) {
        return
      }
      const ready = takeNextReadyJob()
      if (!ready) {
        return
      }
      logWorkerActivity(logger, 'Worker transcription scheduler selected job', {
        ...jobLogContext(ready.job),
        schedulingBucket: ready.schedulingBucket,
        queuedReadyJobs: queuedReadyCount(),
      })
      const task = transcribeDownloadedJob(api, config, ready, logger).finally(
        () => {
          transcriptions.delete(task)
          if (recheckDownloadsAfterTranscription) {
            downloadQueueExhausted = false
            recheckDownloadsAfterTranscription = false
          }
        }
      )
      transcriptions.add(task)
    }
  }

  const waitForActiveWork = async () => {
    const activeWork = [...downloads, ...transcriptions]
    if (activeWork.length === 0) {
      return
    }
    try {
      await Promise.race(activeWork)
    } catch (error) {
      await Promise.allSettled(activeWork)
      throw error
    }
  }

  let cycleComplete = false
  while (!cycleComplete) {
    await fillDownloads()
    await fillRecoveredReadyJobs()
    fillTranscriptions()

    if (
      downloads.size === 0 &&
      transcriptions.size === 0 &&
      queuedReadyCount() === 0
    ) {
      cycleComplete = true
      continue
    }

    await waitForActiveWork()
  }

  const legacyJob = processed === 0 ? await claimJob(api) : undefined
  if (!legacyJob) {
    return processed
  }

  logWorkerActivity(
    logger,
    'Worker legacy transcription job claimed',
    jobLogContext(legacyJob)
  )
  const source = await getSource(api, legacyJob.id)
  const inputPath =
    legacyJob.localSourcePath ||
    (await downloadSource(config, legacyJob, source))
  await transcribeDownloadedJob(
    api,
    config,
    { job: legacyJob, inputPath },
    logger
  )
  return processed + 1
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runWorker(
  config: WorkerConfig = loadConfig(),
  logger: Logger = consoleLogger,
  shouldStop: () => boolean = () => false
) {
  logger.info(`Starting Voicy worker client against ${config.apiUrl}`)
  let stopped = false
  const stop = () => {
    stopped = true
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  let loopCrashCount = 0
  while (!stopped && !shouldStop()) {
    let processed = 0
    try {
      processed = await processAvailableJobs(config, logger)
      loopCrashCount = 0
    } catch (error) {
      loopCrashCount += 1
      const message = redactSensitiveText(
        error instanceof Error ? error.message : String(error)
      )
      logger.error(
        `Worker loop crashed; restarting in ${config.restartDelayMs}ms: crashCount=${loopCrashCount}: ${message}`
      )
      if (config.idleExit) {
        throw error
      }
      if (config.restartDelayMs > 0) {
        await delay(config.restartDelayMs)
      }
      continue
    }
    if (processed === 0 && config.idleExit) {
      logger.info(
        'No queued jobs; exiting because VOICY_WORKER_IDLE_EXIT is set'
      )
      break
    }
    if (processed === 0) {
      await delay(config.pollIntervalMs)
    }
  }
  logger.info('Voicy worker client stopped')
}

if (require.main === module) {
  runWorker().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
