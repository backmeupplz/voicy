// Dependencies
const Telegraf = require('telegraf')

async function report(bot, err, prefix) {
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
      'bot was blocked',
      'group chat was upgraded to a supergroup chat',
      'Timeout',
      '20 seconds',
      'A bucket name is needed to use Google Cloud Storage',
      'Bad auth',
      'socket hang up',
      'Long running operation has finished',
      'does not have storage.buckets.get',
      'oes not have storage.objects.delete',
      'The project to be billed is associated with a closed billing account',
    ]
    for (const item of bypassList) {
      if (err.message && err.message.indexOf(item) > -1) {
        return
      }
    }
    const telegram = bot
      ? bot.telegram || bot
      : new Telegraf(process.env.TOKEN, {
          username: process.env.USERNAME,
          channelMode: true,
        }).telegram
    await telegram.sendMessage(
      process.env.ADMIN_ID,
      `*Voicy*${prefix ? ` (${prefix})` : ''}:\nMessage: ${err.message}`,
      {
        parse_mode: 'Markdown',
      }
    )
  } catch (error) {
    // Do nothing
  }
}

async function reportUsage(ctx, usage) {
  try {
    await ctx.telegram.sendMessage(
      process.env.ADMIN_ID,
      `*Voicy*:\n${ctx.from.id} used ${usage}`,
      {
        parse_mode: 'Markdown',
      }
    )
  } catch (err) {
    // Do nothing
  }
}

module.exports = {
  report,
  reportUsage,
}
