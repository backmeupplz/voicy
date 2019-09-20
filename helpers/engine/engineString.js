module.exports = function engineString(engine) {
  if (engine === 'wit') {
    return 'Wit.ai'
  } else if (engine === 'ashmanov') {
    return 'Nanosemantics'
  } else {
    return 'Google Speech'
  }
}
