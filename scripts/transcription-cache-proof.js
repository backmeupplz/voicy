#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'

require('reflect-metadata')
require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const TRANSCRIPTION_STATUSES = {
  queuedForDownload: 'queued_for_download',
  completed: 'completed',
}

const TRANSCRIPTION_SOURCE_KINDS = {
  voice: 'voice',
  videoNote: 'video_note',
  audio: 'audio',
  document: 'document',
  video: 'video',
}

function mockModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  }
}

function clearModule(modulePath) {
  delete require.cache[modulePath]
}

function clearVoicyModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}dist${path.sep}`)) {
      delete require.cache[key]
    }
  }
}

function mockContext({
  chatType = 'private',
  silent = false,
  media = {
    file_id: 'proof-file-id',
    file_unique_id: 'proof-file-unique-id',
    file_size: 4096,
  },
} = {}) {
  return {
    dbchat: {
      id: 'cache-proof-chat',
      paid: true,
      transcribeAllAudio: true,
      uiLanguage: 'en',
      silent,
    },
    chat: { id: 12345, type: chatType },
    from: { id: 67890 },
    msg: {
      message_id: 111,
      voice: media,
    },
    api: {},
    reply: async () => {
      throw new Error('cache proof should not send queue acknowledgements')
    },
    timeReceived: new Date(),
  }
}

function installHandleAudioMocks({
  cachedResult,
  accessResult = { allowed: true, consumedFreeTranscription: true },
} = {}) {
  clearVoicyModules()

  const transcriptionJobPath = require.resolve('../dist/models/TranscriptionJob')
  const cacheModelPath = require.resolve(
    '../dist/models/TranscriptionResultCache'
  )
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const abusePath = require.resolve(
    '../dist/helpers/transcriptionJobs/abuseLimits'
  )
  const accessPath = require.resolve(
    '../dist/helpers/goldenBorodutchFreeTranscriptions'
  )

  const createdJobs = []
  const cacheQueries = []
  const publishedJobs = []
  const accessCalls = []
  const refunds = []

  mockModule(transcriptionJobPath, {
    TranscriptionJobStatus: TRANSCRIPTION_STATUSES,
    TranscriptionJobSourceKind: TRANSCRIPTION_SOURCE_KINDS,
    TranscriptionJobModel: {
      create: async (job) => {
        const jobDoc = {
          ...job,
          save: async () => undefined,
        }
        createdJobs.push(jobDoc)
        return jobDoc
      },
    },
  })
  mockModule(cacheModelPath, {
    TranscriptionResultCacheModel: {
      findOne: async (query) => {
        cacheQueries.push(query)
        return cachedResult
      },
      findOneAndUpdate: async () => {
        throw new Error('enqueue cache proof should not upsert cache entries')
      },
    },
  })
  mockModule(publisherPath, {
    __esModule: true,
    default: async (job) => {
      publishedJobs.push(job)
    },
  })
  mockModule(abusePath, {
    checkTranscriptionAbuseLimits: async () => undefined,
  })
  mockModule(accessPath, {
    TranscriptionAccessDenialReason: {
      membershipCheckFailed: 'membership_check_failed',
      missingUser: 'missing_user',
      freeAllowanceExhausted: 'free_allowance_exhausted',
    },
    checkTranscriptionAccess: async (params) => {
      accessCalls.push(params)
      return accessResult
    },
    refundGoldenBorodutchFreeTranscription: async (userId) => {
      refunds.push(userId)
    },
  })

  return {
    createdJobs,
    cacheQueries,
    publishedJobs,
    accessCalls,
    refunds,
  }
}

async function provesCacheKeyAndTtl() {
  clearVoicyModules()
  const {
    transcriptionResultCacheKey,
    transcriptionResultCacheTtlSeconds,
    transcriptionResultCacheExpiresAt,
  } = require('../dist/helpers/transcriptionJobs/transcriptionResultCache')

  assert.equal(
    transcriptionResultCacheKey({
      sourceType: 'voice',
      file_id: 'volatile-file-id',
      file_unique_id: 'stable-file-id',
    }),
    'telegram:file_unique_id:stable-file-id',
    'cache key should prefer Telegram file_unique_id'
  )
  assert.equal(
    transcriptionResultCacheKey({
      sourceType: 'document',
      file_id: 'fallback-file-id',
    }),
    'telegram:document:file_id:fallback-file-id',
    'cache key should have a safe file_id fallback when unique id is absent'
  )
  assert.equal(
    transcriptionResultCacheTtlSeconds({}),
    10 * 24 * 60 * 60,
    'default cache TTL should be 10 days'
  )
  assert.equal(
    transcriptionResultCacheTtlSeconds({
      VOICY_TRANSCRIPTION_CACHE_TTL_DAYS: '2.5',
    }),
    216000,
    'cache TTL should be configurable in days'
  )

  const from = new Date('2026-05-07T00:00:00.000Z')
  assert.equal(
    transcriptionResultCacheExpiresAt(from, {
      VOICY_TRANSCRIPTION_CACHE_TTL_DAYS: '1',
    }).toISOString(),
    '2026-05-08T00:00:00.000Z',
    'cache expiry should be derived from the configured TTL'
  )
}

async function provesCacheHitPublishesWithoutQueue() {
  const proof = installHandleAudioMocks({
    cachedResult: {
      resultText: 'cached transcript',
      resultParts: [{ timeCode: '00:00', text: 'cached transcript' }],
      recognitionLanguage: 'en',
      workerEngine: 'proof-engine',
      duration: 1.5,
      completedAt: new Date('2026-05-07T00:00:00.000Z'),
    },
  })
  const handleAudio = require('../dist/handlers/handleAudio').default

  await handleAudio(mockContext())

  assert.equal(proof.createdJobs.length, 0, 'cache hit must not enqueue a job')
  assert.equal(proof.publishedJobs.length, 1, 'cache hit should publish result')
  assert.equal(proof.publishedJobs[0].resultText, 'cached transcript')
  assert.equal(
    proof.publishedJobs[0].fileId,
    'proof-file-id',
    'cache replay should use the current Telegram file_id, not stored URLs'
  )
  assert.equal(
    proof.cacheQueries[0].cacheKey,
    'telegram:file_unique_id:proof-file-unique-id'
  )
  assert.equal(
    proof.accessCalls.length,
    1,
    'access checks should still run before serving cached results'
  )
  assert.deepEqual(
    proof.refunds,
    ['67890'],
    'cache hits should refund free allowance consumed during access checks'
  )
}

async function provesEmptyCacheHitPublishesWithoutQueue() {
  const proof = installHandleAudioMocks({
    cachedResult: {
      resultText: '',
      resultParts: [],
      completedAt: new Date('2026-05-07T00:00:00.000Z'),
    },
    accessResult: { allowed: true, consumedFreeTranscription: false },
  })
  const handleAudio = require('../dist/handlers/handleAudio').default

  await handleAudio(mockContext())

  assert.equal(
    proof.createdJobs.length,
    0,
    'empty cache hit must not enqueue a job'
  )
  assert.equal(proof.publishedJobs.length, 1, 'empty hit should replay result')
  assert.equal(
    proof.publishedJobs[0].resultText,
    '',
    'empty/no-speech results should stay cacheable and replayable'
  )
}

async function provesCacheMissQueuesJob() {
  const proof = installHandleAudioMocks({
    cachedResult: null,
    accessResult: { allowed: true, consumedFreeTranscription: false },
  })
  const handleAudio = require('../dist/handlers/handleAudio').default

  await handleAudio(mockContext({ chatType: 'channel' }))

  assert.equal(proof.createdJobs.length, 1, 'cache miss should enqueue a job')
  assert.equal(
    proof.createdJobs[0].status,
    TRANSCRIPTION_STATUSES.queuedForDownload
  )
  assert.equal(
    proof.createdJobs[0].fileUniqueId,
    'proof-file-unique-id',
    'queued jobs should preserve the stable Telegram media id for caching'
  )
  assert.equal(
    proof.publishedJobs.length,
    0,
    'cache miss should not publish a cached replay'
  )
}

async function provesCompletionCacheUpsertShape() {
  clearVoicyModules()
  const cacheModelPath = require.resolve(
    '../dist/models/TranscriptionResultCache'
  )
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const upserts = []

  mockModule(cacheModelPath, {
    TranscriptionResultCacheModel: {
      findOneAndUpdate: async (...args) => {
        upserts.push(args)
      },
    },
  })
  mockModule(publisherPath, {
    __esModule: true,
    default: async () => undefined,
  })

  const {
    cacheCompletedTranscriptionJob,
  } = require('../dist/helpers/transcriptionJobs/transcriptionResultCache')

  await cacheCompletedTranscriptionJob({
    fileId: 'fallback-file-id',
    fileUniqueId: 'stable-file-id',
    sourceKind: TRANSCRIPTION_SOURCE_KINDS.voice,
    resultText: '',
    resultParts: [],
    recognitionLanguage: 'en',
    workerEngine: 'proof-engine',
    workerEngineMetadata: { model: 'proof-model' },
    duration: 2,
    completedAt: new Date('2026-05-07T00:00:00.000Z'),
  })

  assert.equal(upserts.length, 1, 'completed jobs should upsert cache entries')
  assert.deepEqual(upserts[0][0], {
    cacheKey: 'telegram:file_unique_id:stable-file-id',
  })
  assert.equal(
    upserts[0][1].$set.resultText,
    '',
    'empty/no-speech results should be stored in cache'
  )
  assert(
    upserts[0][1].$set.expiresAt instanceof Date,
    'cache entries should carry a TTL expiry date'
  )
  assert.deepEqual(upserts[0][2], { upsert: true, new: true })
}

function provesTtlIndexAndNoFailureCaching() {
  const modelSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'models', 'TranscriptionResultCache.ts'),
    'utf8'
  )
  const jobServiceSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'helpers', 'workerApi', 'jobService.ts'),
    'utf8'
  )

  assert(
    modelSource.includes("@index({ expiresAt: 1 }, { expireAfterSeconds: 0 })"),
    'cache model should define a Mongo TTL index'
  )
  assert(
    jobServiceSource.indexOf('await publishCompletedTranscriptionJob(job)') <
      jobServiceSource.indexOf('await cacheCompletedTranscriptionJob(job)') &&
      jobServiceSource.includes(
        "console.error('Failed to cache completed transcription job', error)"
      ),
    'completed results should be cached after final publish without failing completion on cache errors'
  )
  assert(
    !jobServiceSource
      .slice(jobServiceSource.indexOf('export async function failJob'))
      .includes('cacheCompletedTranscriptionJob'),
    'transient/permanent worker failures should not be cached as results'
  )
}

async function main() {
  await provesCacheKeyAndTtl()
  await provesCacheHitPublishesWithoutQueue()
  await provesEmptyCacheHitPublishesWithoutQueue()
  await provesCacheMissQueuesJob()
  await provesCompletionCacheUpsertShape()
  provesTtlIndexAndNoFailureCaching()
  console.log('transcription cache proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
