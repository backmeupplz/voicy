import * as express from 'express'
import {
  WorkerApiError,
  claimDownloadJob,
  claimNextJob,
  claimReadyJobFromBucket,
  completeJob,
  failJob,
  getOwnedJob,
  heartbeatJob,
  markJobDownloaded,
  serializeJob,
  startTranscriptionJob,
  updateJobProgress,
} from '@/helpers/workerApi/jobService'
import { safeWorkerSourceUrl } from '@/helpers/sourceUrlSecurity'
import authenticateWorker, {
  WorkerRequest,
} from '@/helpers/workerApi/authenticateWorker'

const workerRouter = express.Router()

function asyncRoute(
  handler: (request: WorkerRequest, response: express.Response) => Promise<void>
) {
  return (request: WorkerRequest, response: express.Response) => {
    handler(request, response).catch((error) => {
      if (error instanceof WorkerApiError) {
        response.status(error.status).json({ error: error.code })
        return
      }
      console.error(error)
      response.status(500).json({ error: 'worker_api_error' })
    })
  }
}

function workerClient(request: WorkerRequest) {
  return request.workerClient
}

workerRouter.use(express.json({ limit: '1mb' }))
workerRouter.use(authenticateWorker)

workerRouter.post(
  '/jobs/claim-download',
  asyncRoute(async (request, response) => {
    const job = await claimDownloadJob(
      workerClient(request),
      request.body || {}
    )
    if (!job) {
      response.status(204).send()
      return
    }
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/claim-ready',
  asyncRoute(async (request, response) => {
    const job = await claimReadyJobFromBucket(
      workerClient(request),
      request.body || {}
    )
    if (!job) {
      response.status(204).send()
      return
    }
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/claim',
  asyncRoute(async (request, response) => {
    const job = await claimNextJob(workerClient(request))
    if (!job) {
      response.status(204).send()
      return
    }
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/:id/downloaded',
  asyncRoute(async (request, response) => {
    const job = await markJobDownloaded(
      request.params.id,
      workerClient(request),
      request.body || {}
    )
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/:id/transcribe',
  asyncRoute(async (request, response) => {
    const job = await startTranscriptionJob(
      request.params.id,
      workerClient(request)
    )
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.get(
  '/jobs/:id',
  asyncRoute(async (request, response) => {
    const job = await getOwnedJob(request.params.id, workerClient(request))
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.get(
  '/jobs/:id/source',
  asyncRoute(async (request, response) => {
    const job = await getOwnedJob(request.params.id, workerClient(request))
    response.json({
      source: {
        jobId: job._id.toString(),
        fileId: job.fileId,
        fileUniqueId: job.fileUniqueId,
        filePath: job.filePath,
        localSourcePath: job.localSourcePath,
        fileSize: job.fileSize,
        mimeType: job.mimeType,
        fileName: job.fileName,
        sourceKind: job.sourceKind,
        sourceUrl: safeWorkerSourceUrl(job.sourceUrl),
      },
    })
  })
)

workerRouter.post(
  '/jobs/:id/heartbeat',
  asyncRoute(async (request, response) => {
    const job = await heartbeatJob(request.params.id, workerClient(request))
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/:id/progress',
  asyncRoute(async (request, response) => {
    const job = await updateJobProgress(
      request.params.id,
      workerClient(request),
      request.body || {}
    )
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/:id/result',
  asyncRoute(async (request, response) => {
    const job = await completeJob(
      request.params.id,
      workerClient(request),
      request.body || {}
    )
    response.json({ job: serializeJob(job) })
  })
)

workerRouter.post(
  '/jobs/:id/failure',
  asyncRoute(async (request, response) => {
    const job = await failJob(
      request.params.id,
      workerClient(request),
      request.body || {}
    )
    response.json({ job: serializeJob(job) })
  })
)

export default workerRouter
