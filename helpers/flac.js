const ffmpeg = require('fluent-ffmpeg');
const temp = require('temp');

module.exports = filepath =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, info) => {
      if (err) {
        reject(err);
        return;
      }

      const fileSize = info.format.duration;
      const output = temp.path({ suffix: '.flac' });

      ffmpeg()
        .on('error', error => reject(error))
        .on('end', () => resolve({ flacPath: output, duration: fileSize }))
        .input(filepath)
        .setStartTime(0)
        .duration(fileSize)
        .output(output)
        .audioFrequency(16000)
        .toFormat('s16le')
        .run();
    });
  });
