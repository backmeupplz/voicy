#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')

const { idCommandText } = require('../dist/commands/handleId')

assert.equal(
  idCommandText({ chat: { id: 12345 }, from: { id: 67890 } }),
  'chat id: 12345\nuser id: 67890'
)

assert.equal(
  idCommandText({ chat: { id: -1001234567890 }, from: { id: 555 } }),
  'chat id: -1001234567890\nuser id: 555'
)

assert.equal(
  idCommandText({ chat: { id: -1001234567890 } }),
  'chat id: -1001234567890\nuser id: unavailable'
)

console.log('id command proof passed')
