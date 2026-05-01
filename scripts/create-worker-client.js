#!/usr/bin/env node

require('reflect-metadata')
require('module-alias/register')

const mongoose = require('mongoose')
const {
  WorkerClientModel,
  generateWorkerToken,
  hashWorkerToken,
} = require('../dist/models/WorkerClient')

async function main() {
  const name = process.argv[2]
  if (!name) {
    throw new Error('Usage: yarn worker:create-client <name>')
  }
  if (!process.env.MONGO) {
    throw new Error('MONGO is required')
  }

  await mongoose.connect(process.env.MONGO)
  const token = generateWorkerToken()
  await WorkerClientModel.create({
    name,
    tokenHash: hashWorkerToken(token),
  })
  console.log(`Worker client created: ${name}`)
  console.log(`Token: ${token}`)
  console.log('Store this token now; only its hash was saved.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined)
  })
