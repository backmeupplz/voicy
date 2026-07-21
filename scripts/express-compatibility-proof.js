#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SIGNING_SECRET =
  process.env.STRIPE_WEBHOOK_SIGNING_SECRET || 'whsec_test'

require('reflect-metadata')
require('module-alias/register')

const http = require('http')
const { webhookApp } = require('../dist/helpers/startWebhook')
const bodyParserPackage = require('body-parser/package.json')
const expressPackage = require('express/package.json')
const qsPackage = require('qs/package.json')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function versionAtLeast(actual, minimum) {
  const actualParts = actual.split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (actualParts[index] > minimumParts[index]) return true
    if (actualParts[index] < minimumParts[index]) return false
  }
  return true
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function request(server, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const address = server.address()
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      }
    )
    req.on('error', reject)
    req.end(payload)
  })
}

async function main() {
  assert(
    versionAtLeast(expressPackage.version, '4.22.2'),
    `expected Express >=4.22.2, got ${expressPackage.version}`
  )
  assert(
    versionAtLeast(qsPackage.version, '6.15.2'),
    `expected qs >=6.15.2, got ${qsPackage.version}`
  )

  const server = await listen(webhookApp)
  try {
    const workerResponse = await request(server, '/worker/v1/jobs/claim', {})
    assert(
      workerResponse.status === 401,
      `expected worker auth rejection, got ${workerResponse.status}`
    )
    assert(
      JSON.parse(workerResponse.body).error === 'missing_worker_token',
      `unexpected worker response: ${workerResponse.body}`
    )

    const stripeResponse = await request(server, '/', {})
    assert(
      stripeResponse.status === 400,
      `expected unsigned Stripe rejection, got ${stripeResponse.status}`
    )
    assert(
      stripeResponse.body.includes('Missing stripe-signature header'),
      `unexpected Stripe response: ${stripeResponse.body}`
    )
  } finally {
    await close(server)
  }

  console.log(
    `express compatibility proof passed (express ${expressPackage.version}, ` +
      `body-parser ${bodyParserPackage.version}, qs ${qsPackage.version})`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
