// Dependencies
const mongoose = require('mongoose')
const { Lock } = require('semaphore-async-await')

// Schema
const Schema = mongoose.Schema
const statsSchema = new Schema(
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
const Stats = mongoose.model('stats', statsSchema)

async function countMessage() {
  const lock = new Lock(1)
  lock.acquire()
  try {
    const today = dateToEpoch(new Date())
    let stats = await Stats.findOne({ date: today })
    if (!stats) {
      stats = new Stats()
      stats.count = 0
      stats.date = today
    }
    stats.count = stats.count + 1
    await stats.save()
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
