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

let i = 0
async function countMessage() {
  const lock = new Lock(2)
  await lock.acquire()
  try {
    if (i < 10000) {
      i += 1
    } else {
      const today = dateToEpoch(new Date())
      let messageStats = await MessageStats.findOne({ date: today })
      if (!messageStats) {
        messageStats = new MessageStats()
        messageStats.count = 10000
        messageStats.date = today
      }
      messageStats.count += 10000
      await messageStats.save()
      i = 0
    }
  } catch (err) {
    // Do nothing
  } finally {
    lock.release()
  }
}

function dateToEpoch(date) {
  return date.setHours(0, 0, 0, 0)
}

// Exports
module.exports = { countMessage }
