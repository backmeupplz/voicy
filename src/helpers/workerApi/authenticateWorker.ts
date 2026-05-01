import * as express from 'express'
import { DocumentType } from '@typegoose/typegoose'
import {
  WorkerClient,
  WorkerClientModel,
  hashWorkerToken,
} from '@/models/WorkerClient'

export interface WorkerRequest extends express.Request {
  workerClient?: DocumentType<WorkerClient>
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

  const workerClient = await WorkerClientModel.findOneAndUpdate(
    { tokenHash: hashWorkerToken(token), enabled: true },
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
