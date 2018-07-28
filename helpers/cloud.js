// Dependencies
const path = require('path')
const Storage = require('@google-cloud/storage')

/**
 * Getting google storage api for the chat
 * @param key Google credentials JSON
 * @returns Authenticated Google storage module
 */
function getStorage(key) {
  return new Storage({
    credentials: key,
  })
}

/**
 * Uploading file at path to google storage
 * @param {String} filePath Path of the file to upload
 * @param {Mongoose:Chat} chat Chat with credentials
 * @returns end link of the uploaded file
 */
function put(filePath, chat) {
  return new Promise((resolve, reject) => {
    const key = JSON.parse(chat.googleKey)
    const storage = getStorage(key)
    const bucket = storage.bucket(key.project_id)
    bucket.upload(filePath, (err, file) => {
      if (err) {
        reject(err)
        return
      }
      resolve(`gs://${key.project_id}/${file.name}`)
    })
  })
}

/**
 * Deleting the file at uri
 * @param {String} uri Uri of the file to delete
 * @param {Mongoose:Chat} chat Chat with credentials
 */
function del(uri, chat) {
  return new Promise((resolve, reject) => {
    const key = JSON.parse(chat.googleKey)
    const storage = getStorage(key)
    const bucket = storage.bucket(key.project_id)
    const file = bucket.file(path.basename(uri))
    file.delete((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

// Exports
module.exports = {
  put,
  del,
}
