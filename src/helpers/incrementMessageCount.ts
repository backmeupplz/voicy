import { MessageStatsModel } from '@/models/MessageStats'

const step = 100000
let i = 0

export default function incrementMessageCount() {
  if (i <= step) {
    i += 1
  } else {
    i = 0
    void incrementTodaysCount()
  }
}

async function incrementTodaysCount() {
  const date = dateToEpoch(new Date())
  const { doc } = await MessageStatsModel.findOrCreate({ date })
  doc.count += step
  return doc.save()
}

function dateToEpoch(date) {
  return date.setHours(0, 0, 0, 0)
}
