// Dependencies
const mongoose = require('mongoose')
const { Lock } = require('semaphore-async-await')

// Schema
const Schema = mongoose.Schema
const messageStatsSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
)
const MessageStats = mongoose.model('messageStats', messageStatsSchema)

async function countMessage() {
  const lock = new Lock(2)
  await lock.acquire()
  try {
    const today = dateToEpoch(new Date())
    let messageStats = await MessageStats.findOne({ date: today })
    if (!messageStats) {
      messageStats = new MessageStats()
      messageStats.count = 0
      messageStats.date = today
    }
    messageStats.count = messageStats.count + 1
    await messageStats.save()
  } catch {
    // Do nothing
  } finally {
    lock.release()
  }
}

function dateToEpoch(date) {
  return date.setHours(0, 0, 0, 0)
}

function setupCounter(bot) {
  bot.use((ctx, next) => {
    next()
    countMessage()
  })
}

// Exports
module.exports = setupCounter
