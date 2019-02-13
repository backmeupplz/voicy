// Dependencies
const { Lock } = require('semaphore-async-await')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const uuid = require('uuid/v4')
const speechAPI = require('./speechAPI')
const download = require('download')
const temp = require('temp')
const fs = require('fs')
const flac = require('./flac')
const report = require('./report')

// Generate cluster workers
const workers = []
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`)
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork()
    worker.on('message', masterReceivesMessage)
    workers.push(worker)
  }
} else {
  console.log(`Worker ${process.pid} started`)
  process.on('message', workerReceivesMessage)
}

// Called only from the master
let recognitionPromises = {}
let clusterNumber = 0
async function urlToText(url, chat) {
  // Obtain worker syncronously
  const lock = new Lock(1)
  await lock.acquire()
  if (clusterNumber >= workers.length) {
    clusterNumber = 0
  }
  const worker = workers[clusterNumber]
  clusterNumber++
  lock.release()
  // Create promise and send the message to worker
  return new Promise((res, rej) => {
    const promiseId = uuid()
    recognitionPromises[promiseId] = { res, rej }
    worker.send({ url, promiseId, chat })
  })
}

async function workerReceivesMessage({ url, promiseId, chat }) {
  // Log message received
  console.log(
    `(${promiseId}) Worker ${process.pid} processes audio url ${url}...`
  )
  try {
    const result = await convert(url, chat)
    process.send({ ...result, promiseId })
  } catch (error) {
    process.send({ error: error.message, promiseId })
  }
}

function masterReceivesMessage({ text, duration, promiseId, error }) {
  // Get promise functions
  const promiseFunctions = recognitionPromises[promiseId]
  // Log message received
  if (error) {
    console.log(`(${promiseId}) Master ${process.pid} got error "${error}"`)
    if (promiseFunctions) {
      promiseFunctions.rej(new Error(error))
    }
  } else {
    console.log(
      `(${promiseId}) Master ${
        process.pid
      } got result duration ${duration} and text "${text}"`
    )
    if (promiseFunctions) {
      promiseFunctions.res({ text, duration })
    }
  }
}

async function convert(url, chat) {
  // Download audio file
  const ogaPath = temp.path({ suffix: '.oga' })
  try {
    const data = await download(url)
    fs.writeFileSync(ogaPath, data)
  } catch (err) {
    tryDeletingFile(ogaPath)
    report(undefined, err, 'sendTranscription.downloadAudioFile')
    throw err
  }
  // Convert audio file to flac
  let flacPath
  let duration
  try {
    const result = await flac(ogaPath)
    flacPath = result.flacPath
    duration = result.duration
  } catch (err) {
    tryDeletingFile(ogaPath)
    report(undefined, err, 'sendTranscription.convertAudioFile')
    throw err
  }

  // Convert flac file to speech
  try {
    // Get transcription
    const text = await speechAPI.getText(flacPath, chat, duration, ogaPath)
    // Unlink (delete) flac file
    tryDeletingFile(flacPath)
    // Return result
    return {
      text,
      duration,
    }
  } catch (err) {
    tryDeletingFile(flacPath)
    report(undefined, err, 'sendTranscription.convertFlacToText')
    throw err
  } finally {
    // No need for oga file anymore
    fs.unlinkSync(ogaPath)
  }
}

function tryDeletingFile(path) {
  try {
    fs.unlinkSync(path)
  } catch (err) {
    // do nothing
  }
}

module.exports = urlToText
