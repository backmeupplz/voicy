module.exports = function(bot, err, prefix) {
  try {
    const bypassList = [
      'message to edit not found',
      'does not contain any stream',
      'Invalid data found',
      'reply message not found',
      'message is not modified',
      'MESSAGE_ID_INVALID',
      'Invalid duration',
      'bot was kicked',
      'Could not find codec parameters for stream',
      'CHAT_WRITE_FORBIDDEN',
      'have no rights to send a message',
      'does not have storage.buckets.create access',
      'Too Many Requests',
      'need administrator rights in the channel',
      'Conversion failed',
      'wrong file id',
      'End of file',
      'does not have storage.buckets.create access to project',
      'bot is not a member',
      'Gateway',
      'message not found',
    ]
    for (const item of bypassList) {
      if (err.message && err.message.indexOf(item) > -1) {
        return
      }
    }
    const telegram = bot.telegram ? bot.telegram : bot
    telegram.sendMessage(
      process.env.ADMIN_ID,
      `*Voicy*${prefix ? ` (${prefix})` : ''}:\nMessage: ${
        err.message
      }\n\`\`\`${JSON.stringify(err, undefined, 2)}\`\`\``,
      {
        parse_mode: 'Markdown',
      }
    )
  } catch {
    // Do nothing
  }
}
