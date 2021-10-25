const engines = require('../engines')

/**
 * Function that converts url with audio file into text
 * @param {Path} flacPath Flac path of the audio file to convert
 * @param {Mongoose:Chat} Chat where audio was fetched
 * @param {Int} duration Duration of audio file
 */
async function getText(flacPath, chat, duration, ogaPath) {
  const engineObject = engines.find((e) => e.code === chat.engine)
  return engineObject.recognize(flacPath, chat, duration, ogaPath)
}

module.exports = {
  getText,
}
