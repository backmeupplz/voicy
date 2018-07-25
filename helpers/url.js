// Dependencies
const qs = require('querystring')

/**
 * Constructs file url for file path from Telegram
 * @param {Telegram:FilePath} filePath Path of the file
 * @returns {URL} Url to download file
 */
function fileUrl(filePath) {
  return `https://api.telegram.org/file/bot${process.env.TOKEN}/${qs.escape(filePath)}`
}

// Exports
module.exports = {
  fileUrl,
}
