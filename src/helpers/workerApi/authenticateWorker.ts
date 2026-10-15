import * as express from 'express'
import { DocumentType } from '@typegoose/typegoose'
import {
  WorkerClient,
  WorkerClientModel,
  hashWorkerToken,
} from '@/models/WorkerClient'

export interface WorkerRequest extends express.Request {
  workerClient?: DocumentType<WorkerClient>
  path: string
  params: { [key: string]: string }
  body?: Record<string, unknown>
}

function bearerToken(request: express.Request) {
  const authorization = request.headers.authorization
  if (!authorization) {
    return undefined
  }
  const [scheme, token] = authorization.split(' ')
  if (scheme !== 'Bearer' || !token || authorization.split(' ').length !== 2) {
    return undefined
  }
  return token
}

export default async function authenticateWorker(
  request: WorkerRequest,
  response: express.Response,
  next: express.NextFunction
) {
  const token = bearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'missing_worker_token' })
    return
  }

  const filter = { tokenHash: hashWorkerToken(token), enabled: true }
  // Switch UIs call /workers with a worker token; only job traffic proves the
  // worker process itself is online.
  const workerClient = request.path.startsWith('/workers')
    ? await WorkerClientModel.findOne(filter)
    : await WorkerClientModel.findOneAndUpdate(
        filter,
        { $set: { lastSeenAt: new Date() } },
        { new: true }
      )
  if (!workerClient) {
    response.status(401).json({ error: 'invalid_worker_token' })
    return
  }

  request.workerClient = workerClient
  next()
}
