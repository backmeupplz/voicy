module.exports = function(bot, err, prefix) {
  try {
    const bypassList = []
    for (const item of bypassList) {
      if (err.message && err.message.indexOf(item) > -1) {
        return
      }
    }
    bot.sendMessage(
      process.env.ADMIN_ID,
      `*Voicy*${prefix ? ` (prefix)` : ''}:\n\`\`\`${JSON.stringify(
        err,
        undefined,
        2
      )}\`\`\``
    )
  } catch {
    // Do nothing
  }
}
