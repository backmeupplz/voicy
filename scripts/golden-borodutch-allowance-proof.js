#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'

require('reflect-metadata')
require('module-alias/register')

const assert = require('assert')

const {
  TranscriptionAccessDenialReason,
  checkTranscriptionAccess,
} = require('../dist/helpers/goldenBorodutchFreeTranscriptions')
const {
  transcriptionAccessUserId,
} = require('../dist/handlers/handleAudio')

function memoryStore(initial = {}) {
  const records = new Map(
    Object.entries(initial).map(([telegramUserId, transcriptionsUsed]) => [
      telegramUserId,
      {
        telegramUserId,
        transcriptionsUsed,
        membershipChecks: [],
      },
    ])
  )
  return {
    records,
    consumed: [],
    async recordMembershipCheck(telegramUserId, membership) {
      const record = ensureRecord(records, telegramUserId)
      record.membershipChecks.push(membership)
    },
    async consumeFreeTranscription(telegramUserId, limit, membership) {
      const record = ensureRecord(records, telegramUserId)
      record.membershipChecks.push(membership)
      if (record.transcriptionsUsed >= limit) {
        return undefined
      }
      record.transcriptionsUsed += 1
      this.consumed.push(telegramUserId)
      return { transcriptionsUsed: record.transcriptionsUsed }
    },
    async freeTranscriptionRecord(telegramUserId) {
      const record = records.get(telegramUserId)
      return record
        ? { transcriptionsUsed: record.transcriptionsUsed }
        : undefined
    },
    async refundFreeTranscription(telegramUserId) {
      const record = records.get(telegramUserId)
      if (record && record.transcriptionsUsed > 0) {
        record.transcriptionsUsed -= 1
      }
    },
  }
}

function ensureRecord(records, telegramUserId) {
  if (!records.has(telegramUserId)) {
    records.set(telegramUserId, {
      telegramUserId,
      transcriptionsUsed: 0,
      membershipChecks: [],
    })
  }
  return records.get(telegramUserId)
}

function telegramApi(statuses) {
  const calls = []
  return {
    calls,
    async getChatMember(chatId, userId) {
      calls.push({ chatId, userId })
      const next = statuses.shift()
      if (next instanceof Error) {
        throw next
      }
      return next || { status: 'left' }
    },
  }
}

async function check({ chat, userId, api, store }) {
  return checkTranscriptionAccess({
    chat,
    telegramUserId: userId,
    telegramApi: api,
    store,
    env: { VOICY_DONATION_WALL_ENABLED: 'true' },
    settings: {
      chatId: '@golden_borodutch',
      freeTranscriptionLimit: 50,
    },
  })
}

async function main() {
  const disabledApi = telegramApi([])
  const disabledStore = memoryStore()
  const disabledResult = await checkTranscriptionAccess({
    chat: { paid: false },
    telegramUserId: '101',
    telegramApi: disabledApi,
    store: disabledStore,
    env: { VOICY_DONATION_WALL_ENABLED: 'false' },
  })
  assert.equal(disabledResult.allowed, true)
  assert.equal(disabledResult.consumedFreeTranscription, false)
  assert.equal(disabledApi.calls.length, 0)

  const paidApi = telegramApi([])
  const paidStore = memoryStore()
  const paidResult = await check({
    chat: { paid: true },
    userId: '101',
    api: paidApi,
    store: paidStore,
  })
  assert.equal(paidResult.allowed, true)
  assert.equal(paidResult.consumedFreeTranscription, false)
  assert.equal(paidApi.calls.length, 0)

  const subscribedApi = telegramApi([{ status: 'member' }])
  const subscribedStore = memoryStore()
  const subscribedResult = await check({
    chat: { paid: false },
    userId: '101',
    api: subscribedApi,
    store: subscribedStore,
  })
  assert.equal(subscribedResult.allowed, true)
  assert.equal(subscribedResult.consumedFreeTranscription, true)
  assert.equal(subscribedResult.remaining, 49)
  assert.equal(subscribedStore.records.get('101').transcriptionsUsed, 1)

  const unsubscribeApi = telegramApi([{ status: 'left' }, { status: 'member' }])
  const unsubscribeStore = memoryStore({ 101: 1 })
  const unsubscribedResult = await check({
    chat: { paid: false },
    userId: '101',
    api: unsubscribeApi,
    store: unsubscribeStore,
  })
  assert.equal(unsubscribedResult.allowed, false)
  assert.equal(
    unsubscribedResult.reason,
    TranscriptionAccessDenialReason.subscriptionRequired
  )
  assert.equal(unsubscribeStore.records.get('101').transcriptionsUsed, 1)

  const resubscribedResult = await check({
    chat: { paid: false },
    userId: '101',
    api: unsubscribeApi,
    store: unsubscribeStore,
  })
  assert.equal(resubscribedResult.allowed, true)
  assert.equal(unsubscribeStore.records.get('101').transcriptionsUsed, 2)

  const exhaustedApi = telegramApi([{ status: 'administrator' }])
  const exhaustedStore = memoryStore({ 101: 50 })
  const exhaustedResult = await check({
    chat: { paid: false },
    userId: '101',
    api: exhaustedApi,
    store: exhaustedStore,
  })
  assert.equal(exhaustedResult.allowed, false)
  assert.equal(
    exhaustedResult.reason,
    TranscriptionAccessDenialReason.freeAllowanceExhausted
  )
  assert.equal(exhaustedStore.records.get('101').transcriptionsUsed, 50)

  const errorApi = telegramApi([new Error('bot is not a member')])
  const errorStore = memoryStore()
  const errorResult = await check({
    chat: { paid: false },
    userId: '101',
    api: errorApi,
    store: errorStore,
  })
  assert.equal(errorResult.allowed, false)
  assert.equal(
    errorResult.reason,
    TranscriptionAccessDenialReason.membershipCheckFailed
  )
  assert.equal(errorStore.records.get('101').transcriptionsUsed, 0)

  const missingUserResult = await check({
    chat: { paid: false },
    api: telegramApi([]),
    store: memoryStore(),
  })
  assert.equal(missingUserResult.allowed, false)
  assert.equal(
    missingUserResult.reason,
    TranscriptionAccessDenialReason.missingUser
  )

  assert.equal(
    transcriptionAccessUserId(
      { from: { id: 222 }, message_id: 1 },
      { from: { id: 111 } }
    ),
    '222'
  )
  assert.equal(
    transcriptionAccessUserId({ message_id: 1 }, { from: { id: 111 } }),
    '111'
  )

  console.log('golden borodutch allowance proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
