// Dependencies
const bluebird = require('bluebird')

/**
 * Setting up bluebird as a Promise engine
 */
function setupPromises() {
  global.Promise = bluebird
  global.Promise.config({ cancellation: true })
}

// Exports
module.exports = setupPromises
