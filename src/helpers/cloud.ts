import { Chat } from '@/models/Chat'
import { Storage } from '@google-cloud/storage'
import { basename } from 'path'

function getStorage(key) {
  return new Storage({
    credentials: key,
    projectId: key.project_id,
  })
}

export async function put(filePath: string, chat: Partial<Chat>) {
  const key = JSON.parse(chat.googleKey)
  const storage = getStorage(key)
  const bucket = storage.bucket(key.project_id)
  const exists = await bucket.exists()
  if (!exists[0]) {
    await bucket.create()
  }
  const [file] = await bucket.upload(filePath)
  return `gs://${key.project_id}/${file.name}`
}

export async function del(uri: string, chat: Partial<Chat>) {
  const key = JSON.parse(chat.googleKey)
  const storage = getStorage(key)
  const bucket = storage.bucket(key.project_id)
  const file = bucket.file(basename(uri))
  await file.delete()
}
