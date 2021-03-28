const engines = require('../../engines')

module.exports = function engineString(engine) {
  return engines.find((e) => e.code === engine).name
}
