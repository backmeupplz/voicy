#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  botDescription,
  botDescriptionTexts,
  maxDescriptionLength,
  maxShortDescriptionLength,
  sourceUrl,
  supportContact,
} = require('../dist/helpers/botDescriptions')
const configureBotDescription =
  require('../dist/helpers/configureBotDescription').default

// One text per interface language in locales/, plus the default
const localeLanguages = fs
  .readdirSync(path.join(__dirname, '..', 'locales'))
  .filter((file) => file.endsWith('.yaml') && file !== 'en.yaml')
  .map((file) => file.replace(/\.yaml$/, ''))
  .sort()
assert.deepEqual(
  botDescriptionTexts
    .map((text) => text.languageCode)
    .filter(Boolean)
    .sort(),
  localeLanguages
)
assert.equal(botDescriptionTexts[0].languageCode, undefined)

for (const text of botDescriptionTexts) {
  for (const donationWall of [true, false]) {
    const description = botDescription(text, { donationWall })
    const label = `${text.languageCode || 'default'} wall=${donationWall}`
    assert.ok(description.length <= maxDescriptionLength, label)
    assert.ok(description.includes('Whisper'), label)
    assert.ok(description.includes('/language'), label)
    assert.ok(description.includes('/files'), label)
    assert.ok(description.includes(sourceUrl), label)
    assert.ok(description.includes(supportContact), label)
    assert.equal(description.includes('/donate'), donationWall, label)
    assert.doesNotMatch(description, /wit\.ai|google|\/engine|bit\.ly/i, label)
    // plain text: no Markdown escapes leak into what users see
    assert.doesNotMatch(description, /\\/, label)
  }
  assert.ok(text.shortDescription.length <= maxShortDescriptionLength)
  assert.ok(text.shortDescription.includes('Whisper'))
  assert.doesNotMatch(text.shortDescription, /wit\.ai|google|\/engine/i)
}

function fakeTelegram(current = {}) {
  const calls = []
  const call = async (method, payload) => {
    calls.push([method, payload])
    const key = payload.language_code || 'default'
    if (method === 'getMyDescription') {
      return { description: current[`d:${key}`] || '' }
    }
    if (method === 'getMyShortDescription') {
      return { short_description: current[`s:${key}`] || '' }
    }
    if (method === 'setMyDescription') {
      current[`d:${key}`] = payload.description
      return true
    }
    if (method === 'setMyShortDescription') {
      current[`s:${key}`] = payload.short_description
      return true
    }
    throw new Error(`unexpected ${method}`)
  }
  return { call, calls, current }
}

async function main() {
  const quiet = console.log
  console.log = () => {}
  try {
    const wallOn = { VOICY_DONATION_WALL_ENABLED: 'true' }

    // A fresh bot gets every text set; the default has no language_code
    const fresh = fakeTelegram()
    const updated = await configureBotDescription(fresh.call, wallOn)
    assert.equal(updated.length, botDescriptionTexts.length * 2)
    const defaultSet = fresh.calls.find(
      ([method]) => method === 'setMyDescription'
    )
    assert.deepEqual(defaultSet[1], {
      description: botDescription(botDescriptionTexts[0], {
        donationWall: true,
      }),
    })
    assert.ok(fresh.current['d:ru'].includes('Войси'))
    assert.ok(fresh.current['s:de'].includes('Whisper'))

    // A restart with nothing changed only reads
    const again = fakeTelegram({ ...fresh.current })
    assert.deepEqual(await configureBotDescription(again.call, wallOn), [])
    assert.ok(again.calls.every(([method]) => method.startsWith('get')))

    // Turning the wall off rewrites only the descriptions
    const wallOff = fakeTelegram({ ...fresh.current })
    const offUpdated = await configureBotDescription(wallOff.call, {})
    assert.equal(offUpdated.length, botDescriptionTexts.length)
    assert.ok(offUpdated.every((entry) => entry.startsWith('setMyDescription(')))
    assert.ok(!wallOff.current['d:default'].includes('/donate'))

    // A failing language is logged and the rest still sync
    const errors = []
    const error = console.error
    console.error = (...args) => errors.push(args)
    try {
      const flaky = fakeTelegram()
      const failing = async (method, payload) => {
        if (payload.language_code === 'es') {
          throw new Error('Too Many Requests')
        }
        return flaky.call(method, payload)
      }
      const partial = await configureBotDescription(failing, wallOn)
      assert.equal(partial.length, (botDescriptionTexts.length - 1) * 2)
      assert.equal(errors.length, 2)
      assert.equal(flaky.current['d:es'], undefined)
      assert.ok(flaky.current['d:uk'])
    } finally {
      console.error = error
    }
  } finally {
    console.log = quiet
  }
  console.log('bot description proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
