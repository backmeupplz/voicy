// Dependencies
const fs = require('fs')

module.exports = function tryDeletingFile(path) {
  try {
    fs.unlinkSync(path)
  } catch (err) {
    // do nothing
  }
}
