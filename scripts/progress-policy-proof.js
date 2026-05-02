#!/usr/bin/env node

require('module-alias/register')

const {
  DEFAULT_PROGRESS_EDIT_INTERVAL_MS,
  MIN_PROGRESS_EDIT_INTERVAL_MS,
  liveProgressAllowedForChatType,
  progressEditIntervalMs,
  shouldThrottleProgressPublish,
} = require('../dist/helpers/transcriptionJobs/progressPublishingPolicy')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const baseTime = new Date('2026-05-02T00:00:00.000Z')

assert(
  progressEditIntervalMs({}) === DEFAULT_PROGRESS_EDIT_INTERVAL_MS,
  'default progress edit interval should be used when unset'
)
assert(
  progressEditIntervalMs({ VOICY_PROGRESS_EDIT_INTERVAL_MS: '500' }) ===
    MIN_PROGRESS_EDIT_INTERVAL_MS,
  'configured progress edit interval should be clamped to minimum'
)
assert(
  progressEditIntervalMs({ VOICY_PROGRESS_EDIT_INTERVAL_MS: '4000' }) === 4000,
  'valid configured progress edit interval should be used'
)

assert(
  !shouldThrottleProgressPublish({ now: baseTime }),
  'first progress publish should not be throttled'
)
assert(
  shouldThrottleProgressPublish({
    intervalMs: 2500,
    lastPublishedAt: baseTime,
    now: new Date(baseTime.getTime() + 1000),
  }),
  'progress publish inside edit interval should be throttled'
)
assert(
  !shouldThrottleProgressPublish({
    intervalMs: 2500,
    lastPublishedAt: baseTime,
    now: new Date(baseTime.getTime() + 2500),
  }),
  'progress publish at edit interval boundary should be allowed'
)
assert(
  !shouldThrottleProgressPublish({
    force: true,
    intervalMs: 2500,
    lastPublishedAt: baseTime,
    now: new Date(baseTime.getTime() + 1000),
  }),
  'forced progress publish should bypass throttling'
)

assert(
  liveProgressAllowedForChatType('private'),
  'private chats should allow live progress edits'
)
assert(
  liveProgressAllowedForChatType('group'),
  'groups should allow live progress edits'
)
assert(
  liveProgressAllowedForChatType('supergroup'),
  'supergroups should allow live progress edits'
)
assert(
  !liveProgressAllowedForChatType('channel'),
  'channels should not use live progress edits'
)

console.log('progress policy proof passed')
