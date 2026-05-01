import * as express from 'express'
import {
  WorkerApiError,
  claimNextJob,
  completeJob,
  failJob,
  getOwnedJob,
  heartbeatJob,
  serializeJob,
  updateJobProgress,
} from '@/helpers/workerApi/jobService'
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
        fileSize: job.fileSize,
        mimeType: job.mimeType,
        sourceKind: job.sourceKind,
        sourceUrl: job.sourceUrl,
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
