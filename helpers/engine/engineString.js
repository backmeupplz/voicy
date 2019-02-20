module.exports = function engineString(engine) {
  if (engine === 'wit') {
    return 'wit.ai'
  } else if (engine === 'google') {
    return 'Google Speech'
  }
  return 'Yandex SpeechKit'
}
