// Dependencies
const { handleMessage } = require('./voice')
const { findChat } = require('./db')
const { checkDate } = require('./filter')

/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // Voice handler
  bot.on(['voice', 'video_note'], ctx => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

    // Handle voice
    clusterizedHandleMessage(ctx)
  })
  // Audio handler
  bot.on(['audio', 'document'], async ctx => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

    // Check if files banned
    const chat = await findChat(ctx.chat.id)
    if (chat.filesBanned) return
    // Handle voice
    clusterizedHandleMessage(ctx)
  })
}

const cluster = require('cluster')
const numCPUs = require('os').cpus().length

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`)
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
  cluster.on('exit', worker => {
    console.log(`worker ${worker.process.pid} died`)
  })
} else {
  function clusterizedHandleMessage(ctx) {
    handleMessage(ctx)
  }

  console.log(`Worker ${process.pid} started`)
}

// Exports
module.exports = {
  setupAudioHandler,
}
