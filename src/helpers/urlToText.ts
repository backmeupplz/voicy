import { Chat } from '@/models/Chat'
import { cpus } from 'os'
import { v4 as uuid } from 'uuid'
import { writeFileSync } from 'fs'
import RecognitionResult from '@/helpers/engine/RecognitionResult'
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'
import cluster, { Worker } from 'cluster'
import deleteFile from '@/helpers/deleteFile'
import download from 'download'
import flac from '@/helpers/flac'
import getTextFromAudio from '@/helpers/getTextFromAudio'
import report from '@/helpers/report'
import temp from 'temp'

const numCPUs = cpus().length

interface WorkerMessage {
  url: string
  promiseId: string
  chat: Partial<Chat>
}

interface PrimaryMessage {
  textWithTimecodes?: RecognitionResultPart[]
  duration?: number
  promiseId: string
  errorString?: string
}

// Generate cluster workers
const workers: Worker[] = []
if (cluster.isPrimary) {
  console.info(`Primary ${process.pid} is running`)
  for (let i = 0; i < numCPUs; i += 1) {
    const worker = cluster.fork()
    worker.on('message', primaryReceivesMessage)
    workers.push(worker)
  }
} else {
  console.info(`Worker ${process.pid} started`)
  process.on('message', workerReceivesMessage)
}

// Called only from the primary
const recognitionPromises: {
  [index: string]: {
    res: (value: RecognitionResult) => void
    rej: (error: Error) => void
  }
} = {}
let clusterNumber = 0
export default function urlToText(url: string, chat: Partial<Chat>) {
  if (clusterNumber >= workers.length) {
    clusterNumber = 0
  }
  const worker = workers[clusterNumber]
  clusterNumber += 1
  // Create promise and send the message to worker
  return new Promise<RecognitionResult>((res, rej) => {
    const promiseId = uuid()
    recognitionPromises[promiseId] = { res, rej }
    const workerMessage: WorkerMessage = { url, promiseId, chat }
    worker.send(workerMessage)
  })
}

async function workerReceivesMessage({ url, promiseId, chat }: WorkerMessage) {
  let primaryMessage: PrimaryMessage
  try {
    const result = await convert(url, chat)
    primaryMessage = { ...result, promiseId }
  } catch (error) {
    primaryMessage = {
      errorString: error.message,
      promiseId,
    }
  }
  process.send(primaryMessage)
}

function primaryReceivesMessage({
  textWithTimecodes,
  duration,
  promiseId,
  errorString,
}: PrimaryMessage) {
  // Get promise functions
  const promiseFunctions = recognitionPromises[promiseId]
  // Log message received
  if (promiseFunctions) {
    if (errorString) {
      promiseFunctions.rej(new Error(errorString))
    } else {
      promiseFunctions.res({ textWithTimecodes, duration })
    }
    delete recognitionPromises[promiseId]
  }
}

async function convert(url: string, chat: Partial<Chat>) {
  // Download audio file
  const ogaPath = temp.path({ suffix: '.oga' })
  try {
    const data = await download(url)
    writeFileSync(ogaPath, data)
  } catch (error) {
    deleteFile(ogaPath)
    report(error, { location: 'sendTranscription.downloadAudioFile' })
    throw error
  }
  // Convert audio file to flac
  let flacPath: string
  let duration: number
  try {
    const result = await flac(ogaPath)
    flacPath = result.flacPath
    duration = result.duration
  } catch (error) {
    deleteFile(ogaPath)
    report(error, { location: 'sendTranscription.convertAudioFile' })
    throw error
  }

  // Convert flac file to speech
  try {
    // Get transcription
    const textWithTimecodes = await getTextFromAudio(
      flacPath,
      chat,
      duration,
      ogaPath
    )
    // Return result
    return {
      textWithTimecodes,
      duration,
    }
  } catch (error) {
    report(error, { location: 'sendTranscription.convertFlacToText' })
    throw error
  } finally {
    deleteFile(flacPath)
    deleteFile(ogaPath)
  }
}
