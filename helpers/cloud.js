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
    projectId: key.project_id,
  })
}

/**
 * Uploading file at path to google storage
 * @param {String} filePath Path of the file to upload
 * @param {Mongoose:Chat} chat Chat with credentials
 * @returns end link of the uploaded file
 */
async function put(filePath, chat) {
  return new Promise(async (resolve, reject) => {
    try {
      const key = JSON.parse(chat.googleKey)
      const storage = getStorage(key)
      const bucket = storage.bucket(key.project_id)
      const exists = await bucket.exists()
      if (!exists[0]) {
        bucket.create(async err => {
          if (err) {
            reject(err)
            return
          }
          try {
            const uri = await upload(bucket, filePath, key)
            resolve(uri)
          } catch (error) {
            reject(error)
          }
        })
      } else {
        try {
          const uri = await upload(bucket, filePath, key)
          resolve(uri)
        } catch (err) {
          reject(err)
        }
      }
    } catch (err) {
      reject(err)
    }
  })
}

function upload(bucket, filePath, key) {
  return new Promise((resolve, reject) => {
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
    try {
      const key = JSON.parse(chat.googleKey)
      const storage = getStorage(key)
      const bucket = storage.bucket(key.project_id)
      const file = bucket.file(path.basename(uri))
      file.delete(err => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    } catch (err) {
      reject(err)
    }
  })
}

// Exports
module.exports = {
  put,
  del,
}
