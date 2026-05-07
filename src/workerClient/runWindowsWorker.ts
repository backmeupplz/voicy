import * as path from 'path'
import { Readable } from 'stream'
import { URL } from 'url'
import { createWriteStream } from 'fs'
import { mkdir, readFile, stat, unlink } from 'fs/promises'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { redactSensitiveText } from '../helpers/report'
import { spawn } from 'child_process'
import axios, { AxiosInstance } from 'axios'

const streamPipeline = promisify(pipeline)

const DEFAULT_POLL_INTERVAL_MS = 5000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 300000
const DEFAULT_WORK_DIR = path.join(process.cwd(), 'tmp', 'voicy-worker')
const DEFAULT_WORKER_MODEL = 'large-v3'

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
  downloadConcurrency: number
  transcriptionConcurrency: number
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
  elapsedMs: number
}

interface DownloadedJob {
  job: WorkerJob
  inputPath: string
}

const consoleLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
}

type LogValue = string | number | boolean | undefined

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
  return redactSensitiveText(result.text)
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
    downloadConcurrency: Math.max(
      1,
      numberFromEnv(
        env.VOICY_WORKER_DOWNLOAD_CONCURRENCY,
        2,
        'VOICY_WORKER_DOWNLOAD_CONCURRENCY'
      )
    ),
    transcriptionConcurrency: Math.max(
      1,
      numberFromEnv(
        env.VOICY_WORKER_TRANSCRIPTION_CONCURRENCY,
        1,
        'VOICY_WORKER_TRANSCRIPTION_CONCURRENCY'
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

async function claimDownloadJob(api: AxiosInstance) {
  const response = await api.post('/jobs/claim-download', undefined, {
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

async function resolveSourceUrl(config: WorkerConfig, source: WorkerSource) {
  if (source.sourceUrl) {
    return source.sourceUrl
  }
  if (source.filePath) {
    return telegramFileUrl(config, source.filePath)
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
  return telegramFileUrl(config, filePath)
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
  const sourceUrl = await resolveSourceUrl(config, source)
  assertAllowedSourceUrl(sourceUrl, config)
  const response = await axios.get(sourceUrl, {
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
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
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
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      const elapsedMs = Date.now() - startedAt
      if (code !== 0) {
        reject(
          new WorkerClientError(
            `Transcription command exited with ${code}; stdoutChars=${stdout.length}; stderrChars=${stderr.length}`
          )
        )
        return
      }
      resolve({ stdout, stderr, elapsedMs })
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

async function readTranscriptionOutput(
  commandResult: RunCommandResult,
  outputPath: string,
  config: WorkerConfig,
  job: WorkerJob,
  inputPath: string,
  logger: Logger
) {
  const outputStat = await stat(outputPath).catch(() => undefined)
  const rawOutput = outputStat
    ? await readFile(outputPath, 'utf8')
    : commandResult.stdout
  const result = normalizeTranscriptionOutput(rawOutput, config, job, inputPath)
  logWorkerActivity(logger, 'Worker transcription command completed', {
    jobId: job.id,
    engine: config.engine,
    model: config.model,
    language: result.language,
    elapsedMs: commandResult.elapsedMs,
    outputSource: outputStat ? 'file' : 'stdout',
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
  error: unknown,
  logger: Logger
) {
  const retryable = error instanceof WorkerClientError ? error.retryable : true
  const message = redactSensitiveText(
    error instanceof Error ? error.message : String(error)
  )
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
      const message = redactSensitiveText(
        error instanceof Error ? error.message : String(error)
      )
      logger.warn(`Heartbeat failed for job ${jobId}: ${message}`)
    })
  }, intervalMs)
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
  const heartbeat = startHeartbeat(
    api,
    job.id,
    config.heartbeatIntervalMs,
    logger
  )

  try {
    const source = await getSource(api, job.id)
    const inputPath = await downloadSource(config, job, source)
    const readyJob = await markDownloaded(api, job.id, inputPath)
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
    await failJob(api, job.id, error, logger)
    return undefined
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat)
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
  const job = ['processing', 'transcribing'].includes(downloaded.job.status)
    ? downloaded.job
    : await startTranscription(api, downloaded.job.id)
  logWorkerActivity(logger, 'Worker transcription job started', {
    ...jobLogContext(job),
    engine: config.engine,
    model: config.model,
    inputFile: path.basename(downloaded.inputPath),
  })
  const heartbeat = startHeartbeat(
    api,
    job.id,
    config.heartbeatIntervalMs,
    logger
  )

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
    await api.post(`/jobs/${job.id}/result`, result)
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
    await failJob(api, job.id, error, logger)
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat)
    }
  }
}

export async function processAvailableJobs(
  config: WorkerConfig,
  logger: Logger = consoleLogger
) {
  const api = createApi(config)
  const readyQueue: DownloadedJob[] = []
  const downloads = new Set<Promise<void>>()
  const transcriptions = new Set<Promise<void>>()
  let downloadQueueExhausted = false
  let processed = 0

  const startDownload = async (job: WorkerJob) => {
    const ready = await downloadJob(api, config, job, logger)
    if (ready) {
      readyQueue.push(ready)
    }
  }

  const fillDownloads = async () => {
    while (
      !downloadQueueExhausted &&
      downloads.size < config.downloadConcurrency
    ) {
      const job = await claimDownloadJob(api)
      if (!job) {
        downloadQueueExhausted = true
        return
      }
      processed += 1
      const task = startDownload(job).finally(() => downloads.delete(task))
      downloads.add(task)
    }
  }

  const fillTranscriptions = () => {
    while (
      readyQueue.length > 0 &&
      transcriptions.size < config.transcriptionConcurrency
    ) {
      const ready = readyQueue.shift()
      if (!ready) {
        return
      }
      const task = transcribeDownloadedJob(api, config, ready, logger).finally(
        () => transcriptions.delete(task)
      )
      transcriptions.add(task)
    }
  }

  let cycleComplete = false
  while (!cycleComplete) {
    await fillDownloads()
    fillTranscriptions()

    if (
      downloads.size === 0 &&
      transcriptions.size === 0 &&
      readyQueue.length === 0
    ) {
      cycleComplete = true
      continue
    }

    await Promise.race([...downloads, ...transcriptions])
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
    const processed = await processAvailableJobs(config, logger)
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
}

if (require.main === module) {
  runWorker().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
