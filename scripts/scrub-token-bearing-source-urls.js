#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:redacted-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'

require('reflect-metadata')
require('module-alias/register')

const mongoose = require('mongoose')
const {
  scrubTokenBearingSourceUrls,
} = require('../dist/helpers/sourceUrlScrubber')

async function main() {
  if (!process.env.MONGO) {
    throw new Error('MONGO is required to scrub token-bearing source URLs')
  }

  const dryRun = process.argv.includes('--dry-run')

  await mongoose.connect(process.env.MONGO)
  try {
    const result = await scrubTokenBearingSourceUrls(dryRun)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
