const assert = require('assert')
const { sanitizeErrorReport } = require('../dist/helpers/report')

const secretTelegramToken = [
  '123456789',
  'abcdefghijklmnopqrstuvwxyzABCDE',
].join(':')
const secretStripeKey = ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_')
const secretMongoUrl = 'mongodb://user:password@example.test/voicy'
const localPosixPath = '/Users/nikita/voicy-worker/input.ogg'
const localWindowsPath = 'C:\\voicy-worker\\input.ogg'
const privateMessageText = '/start private transcript contents'

const error = new Error(
  `failed with ${secretTelegramToken} ${secretStripeKey} ${secretMongoUrl}?token=secret ${localPosixPath} ${localWindowsPath}`
)
error.stack = `Error: ${error.message}\n    at proof (/tmp/report-sanitizer-proof.js:1:1)`

const report = sanitizeErrorReport(error, {
  location: 'proof',
  jobId: 'job-123',
  meta: {
    workerUrl: `https://example.test/worker?token=${secretTelegramToken}`,
  },
  ctx: {
    update: {
      update_id: 123,
      message: {},
    },
    chat: {
      id: -100123,
      type: 'supergroup',
    },
    from: {
      id: 456,
    },
    msg: {
      message_id: 789,
      text: privateMessageText,
    },
  },
})

const serialized = JSON.stringify(report)

assert.strictEqual(report.location, 'proof')
assert.strictEqual(report.jobId, 'job-123')
assert.strictEqual(report.context.updateId, 123)
assert.strictEqual(report.context.updateType, 'message')
assert.strictEqual(report.context.chatId, '-100123')
assert.strictEqual(report.context.chatType, 'supergroup')
assert.strictEqual(report.context.userId, '456')
assert.strictEqual(report.context.messageType, 'text')
assert.strictEqual(report.context.command, '/start')
assert(!serialized.includes(secretTelegramToken), 'Telegram token leaked')
assert(!serialized.includes(secretStripeKey), 'Stripe key leaked')
assert(!serialized.includes('mongodb://user:password'), 'Mongo password leaked')
assert(!serialized.includes(localPosixPath), 'POSIX local path leaked')
assert(!serialized.includes(localWindowsPath), 'Windows local path leaked')
assert(!serialized.includes('private transcript'), 'message text leaked')

console.log('report sanitizer proof passed')
