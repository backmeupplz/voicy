#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const { createHash } = require('crypto')

const { promoStartEvent } = require('../dist/helpers/promoStart')

const event = promoStartEvent('/start vdb-voicy-1-a', 42, 'tok')
assert.equal(event.c, 'vdb-voicy-1')
assert.equal(event.v, 'a')
assert.equal(event.k, 'start')
// the same hash VideoDownloadBot's promo.ts sends for this user and campaign
assert.equal(
  event.u,
  createHash('sha256').update('tok:vdb-voicy-1:42').digest('hex').slice(0, 16)
)
assert.equal(promoStartEvent('/start@voicybot vdb-voicy-1-b', 42, 'tok').v, 'b')
assert.equal(promoStartEvent('/start', 42, 'tok'), undefined)
assert.equal(promoStartEvent('/start ref-Abc', 42, 'tok'), undefined)
assert.equal(promoStartEvent('/start vdb-voicy-1-a', 42, ''), undefined)
assert.equal(promoStartEvent('/start vdb-voicy-1-a', undefined, 'tok'), undefined)

console.log('promo start proof passed')
