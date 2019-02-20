// Dependencies
const Telegraf = require('telegraf')
const report = require('../helpers/report')
const cluster = require('cluster')
const uuid = require('uuid/v4')
// Create bot
const bot = new Telegraf(process.env.TOKEN, {
  channelMode: true,
})
bot.webhookReply = false
// Get bot's username
bot.telegram
  .getMe()
  .then(info => {
    bot.options.username = info.username
  })
  .catch(console.info)
// Bot catch
bot.catch(err => {
  report(bot, err, 'bot.catch')
})
// Start bot
function startBot() {
  if (cluster.isMaster) {
    // Start bot
    if (process.env.USE_WEBHOOK === 'true') {
      const domain = process.env.WEBHOOK_DOMAIN
      bot.telegram
        .deleteWebhook()
        .then(async () => {
          const secretPath = uuid()
          bot.startWebhook(`/${secretPath}`, undefined, 5000)
          await bot.telegram.setWebhook(
            `https://${domain}/${secretPath}`,
            undefined,
            100
          )
          const webhookInfo = await bot.telegram.getWebhookInfo()
          console.info('Bot is up and running with webhooks', webhookInfo)
        })
        .catch(err => console.info('Bot launch error', err))
    } else {
      bot.startPolling()
      // Console that everything is fine
      console.info('Bot is up and running')
    }
  }
}
// Export bot
module.exports = { bot, startBot }
