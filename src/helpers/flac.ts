import deleteFile from '@/helpers/deleteFile'
import ffmpeg = require('fluent-ffmpeg')
import temp from 'temp'

export default function (filepath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, info) => {
      if (err) {
        reject(err)
        return
      }

      const fileSize = info.format.duration
      const output = temp.path({ suffix: '.flac' })

      ffmpeg()
        .on('error', (error) => {
          deleteFile(output)
          reject(error)
        })
        .on('end', () => resolve({ flacPath: output, duration: fileSize }))
        .input(filepath)
        .setStartTime(0)
        .duration(fileSize)
        .output(output)
        .audioFrequency(16000)
        .toFormat('s16le')
        .run()
    })
  })
}
