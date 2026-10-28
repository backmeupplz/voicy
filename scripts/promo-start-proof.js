#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')
const { createHash } = require('crypto')

const { promoEvent, startPayload } = require('../dist/helpers/promoStart')

assert.equal(startPayload('/start xp1-a-vdb'), 'xp1-a-vdb')
assert.equal(startPayload('/start@voicybot xp1-b-vdb'), 'xp1-b-vdb')
assert.equal(startPayload('/start'), undefined)

const event = promoEvent('xp1-a-vdb', 'start', 42, 'tok')
assert.equal(event.c, 'xp1')
assert.equal(event.v, 'a')
assert.equal(event.k, 'start')
// the same hash VideoDownloadBot's promo.ts sends for this user and campaign
assert.equal(
  event.u,
  createHash('sha256').update('tok:xp1:42').digest('hex').slice(0, 16)
)
assert.equal(promoEvent('xp2-b-vdb', 'join', 42, 'tok').k, 'join')
assert.equal(promoEvent('ref-Abc', 'start', 42, 'tok'), undefined)
assert.equal(promoEvent('vdb-voicy-1-a', 'start', 42, 'tok'), undefined)
assert.equal(promoEvent('xp1-a-vdb', 'start', 42, ''), undefined)
assert.equal(promoEvent('xp1-a-vdb', 'start', undefined, 'tok'), undefined)
assert.equal(promoEvent(undefined, 'join', 42, 'tok'), undefined)

console.log('promo start proof passed')
