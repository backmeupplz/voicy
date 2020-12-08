const axios = require('axios')

let over10000 = true

function isOver10000() {
  return over10000
}

setInterval(async () => {
  try {
    const response = (await axios('https://stats.borodutch.com/stats')).data
    over10000 = response.goldenBorodutch.subCount > 10000
  } catch {
    // Do nothing
  }
}, 60 * 1000)

module.exports = { isOver10000 }
